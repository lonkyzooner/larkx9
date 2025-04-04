import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { voiceRecognitionService, RecognitionState, WakeWordState, MicrophonePermission, VoiceEvent } from '../services/voice/VoiceRecognitionService';
import { commandProcessingService, CommandResult } from '../services/voice/CommandProcessingService';
import { liveKitVoiceService } from '../services/livekit/LiveKitVoiceService';
import { SynthesisState } from '../services/voice/OpenAIVoiceService'; // Keep type definition for compatibility
import { useSettings } from '../lib/settings-store';
import { generateUserToken } from '../services/livekit/tokenService';
import { v4 as uuidv4 } from 'uuid';

// Define the context interface
interface VoiceContextType {
  // Recognition state
  isListening: boolean;
  recognitionState: RecognitionState;
  wakeWordState: WakeWordState;
  micPermission: MicrophonePermission;
  transcript: string;
  
  // Command processing
  isProcessing: boolean;
  lastCommand: string | null;
  lastResponse: string | null;
  commandHistory: CommandResult[];
  
  // Voice synthesis
  isSpeaking: boolean;
  synthesisState: SynthesisState;
  
  // Events
  events: ReturnType<typeof voiceRecognitionService.getEvents>;
  voiceEvents: {
    mirandaRequested: boolean;
    mirandaPlaying: boolean;
    mirandaComplete: boolean;
    mirandaError: string | null;
  };
  
  // Actions
  startListening: () => void;
  stopListening: () => void;
  requestMicrophonePermission: () => Promise<boolean>;
  processCommand: (command: string) => Promise<CommandResult>;
  speak: (text: string, voice?: string, streamingEnabled?: boolean) => Promise<void>;
  stopSpeaking: () => void;
  triggerMiranda: (language?: string) => void;
  
  // Debug info
  debugInfo: string[];
}

// Create the context with default values
const VoiceContext = createContext<VoiceContextType>({
  isListening: false,
  recognitionState: 'inactive',
  wakeWordState: 'inactive',
  micPermission: 'unknown',
  transcript: '',
  
  isProcessing: false,
  lastCommand: null,
  lastResponse: null,
  commandHistory: [],
  
  isSpeaking: false,
  synthesisState: 'idle',
  
  events: voiceRecognitionService.getEvents(),
  voiceEvents: {
    mirandaRequested: false,
    mirandaPlaying: false,
    mirandaComplete: false,
    mirandaError: null
  },
  
  startListening: () => {},
  stopListening: () => {},
  requestMicrophonePermission: async () => false,
  processCommand: async () => ({ command: '', response: '', success: false }),
  speak: async () => {},
  stopSpeaking: () => {},
  triggerMiranda: () => {},
  
  debugInfo: []
});

// Maximum number of debug messages to keep
const MAX_DEBUG_MESSAGES = 50;

// Provider component
export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State for recognition
  const [isListening, setIsListening] = useState(false);
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('inactive');
  const [wakeWordState, setWakeWordState] = useState<WakeWordState>('inactive');
  const [micPermission, setMicPermission] = useState<MicrophonePermission>('unknown');
  const [transcript, setTranscript] = useState('');
  
  // State for command processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<CommandResult[]>([]);
  
  // State for voice synthesis
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [synthesisState, setSynthesisState] = useState<SynthesisState>('idle');
  
  // State for voice events
  const [voiceEvents, setVoiceEvents] = useState({
    mirandaRequested: false,
    mirandaPlaying: false,
    mirandaComplete: false,
    mirandaError: null as string | null
  });
  
  // Debug info
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // Get settings
  const { settings, updateSettings } = useSettings();
  
  // Add debug message
  const addDebugMessage = useCallback((message: string) => {
    setDebugInfo(prev => {
      const newMessages = [...prev, `${new Date().toISOString().substring(11, 19)} - ${message}`];
      // Keep only the last MAX_DEBUG_MESSAGES messages
      return newMessages.slice(-MAX_DEBUG_MESSAGES);
    });
  }, []);
  
  // Initialize subscriptions to services
  useEffect(() => {
    // Subscribe to recognition state
    const recognitionStateSub = voiceRecognitionService.getRecognitionState().subscribe(state => {
      setRecognitionState(state);
      setIsListening(state === 'listening');
    });
    
    // Subscribe to wake word state
    const wakeWordStateSub = voiceRecognitionService.getWakeWordState().subscribe(state => {
      setWakeWordState(state);
    });
    
    // Subscribe to microphone permission
    const micPermissionSub = voiceRecognitionService.getMicPermission().subscribe(permission => {
      setMicPermission(permission);
      
      // Log microphone permission changes for debugging
      addDebugMessage(`Microphone permission changed to: ${permission}`);
      
      // If permission is denied, we should notify the user
      if (permission === 'denied') {
        // Dispatch an event that can be caught by components
        document.dispatchEvent(new CustomEvent('permission_required', { 
          detail: { 
            type: 'microphone',
            timestamp: Date.now()
          } 
        }));
      }
    });
    
    // Subscribe to transcript
    const transcriptSub = voiceRecognitionService.getTranscript().subscribe(text => {
      setTranscript(text);
    });
    
    // Subscribe to voice events
    const eventsSub = voiceRecognitionService.getEvents().subscribe(event => {
      handleVoiceEvent(event);
    });
    
    // Subscribe to command processing state
    const processingSub = commandProcessingService.getProcessingState().subscribe(processing => {
      setIsProcessing(processing);
    });
    
    // Subscribe to command results
    const resultsSub = commandProcessingService.getCommandResults().subscribe(result => {
      handleCommandResult(result);
    });
    
    // Load command history
    setCommandHistory(commandProcessingService.getCommandHistory());
    
    // Subscribe to LiveKit voice service speaking state
    const speakingSub = liveKitVoiceService.getSpeakingState().subscribe(speaking => {
      setIsSpeaking(speaking);
      addDebugMessage(`Speaking state changed to: ${speaking ? 'speaking' : 'not speaking'}`);
    });
    
    // Subscribe to LiveKit voice service synthesis state
    const synthesisSub = liveKitVoiceService.getSynthesisState().subscribe(state => {
      setSynthesisState(state);
      addDebugMessage(`Synthesis state changed to: ${state}`);
    });
    
    // Subscribe to LiveKit voice service error events
    const voiceErrorSub = liveKitVoiceService.getErrorEvent().subscribe(error => {
      if (error) {
        addDebugMessage(`Voice synthesis error: ${error.message || 'Unknown error'}`);
      }
    });
    
    // Subscribe to LiveKit voice service microphone permission state
    const livekitMicPermissionSub = liveKitVoiceService.getMicPermission().subscribe(permission => {
      // Only update if different from current state to avoid duplicate events
      if (permission !== micPermission) {
        addDebugMessage(`LiveKit microphone permission changed to: ${permission}`);
      }
    });
    
    // Setup listeners for Miranda rights events
    const handleMirandaRequested = (event: Event) => {
      addDebugMessage('Miranda rights requested');
      setVoiceEvents(prev => ({ ...prev, mirandaRequested: true, mirandaError: null }));
    };
    
    const handleMirandaPlaying = (event: Event) => {
      addDebugMessage('Miranda rights playback started');
      setVoiceEvents(prev => ({ ...prev, mirandaPlaying: true, mirandaComplete: false }));
    };
    
    const handleMirandaRead = (event: CustomEvent) => {
      addDebugMessage(`Miranda rights read in ${event.detail?.language || 'unknown language'}`);
      setVoiceEvents(prev => ({ ...prev, mirandaPlaying: false, mirandaComplete: true }));
    };
    
    const handleMirandaError = (event: CustomEvent) => {
      const errorMessage = event.detail?.error || 'Unknown error';
      addDebugMessage(`Miranda rights error: ${errorMessage}`);
      setVoiceEvents(prev => ({ 
        ...prev, 
        mirandaPlaying: false, 
        mirandaError: errorMessage 
      }));
    };
    
    // Add event listeners for Miranda rights events
    document.addEventListener('mirandaRightsRequested', handleMirandaRequested);
    document.addEventListener('mirandaRightsPlaying', handleMirandaPlaying);
    document.addEventListener('mirandaRightsRead', handleMirandaRead as EventListener);
    document.addEventListener('mirandaRightsError', handleMirandaError as EventListener);
    
    // Cleanup subscriptions and event listeners
    return () => {
      recognitionStateSub.unsubscribe();
      wakeWordStateSub.unsubscribe();
      micPermissionSub.unsubscribe();
      transcriptSub.unsubscribe();
      eventsSub.unsubscribe();
      processingSub.unsubscribe();
      resultsSub.unsubscribe();
      speakingSub.unsubscribe();
      synthesisSub.unsubscribe();
      voiceErrorSub.unsubscribe();
      livekitMicPermissionSub.unsubscribe();
      
      // Remove Miranda rights event listeners
      document.removeEventListener('mirandaRightsRequested', handleMirandaRequested);
      document.removeEventListener('mirandaRightsPlaying', handleMirandaPlaying);
      document.removeEventListener('mirandaRightsRead', handleMirandaRead as EventListener);
      document.removeEventListener('mirandaRightsError', handleMirandaError as EventListener);
    };
  }, []);
  
  // Handle voice events
  const handleVoiceEvent = useCallback((event: VoiceEvent) => {
    switch (event.type) {
      case 'wake_word_detected':
        addDebugMessage(`Wake word detected: ${event.payload.match}`);
        break;
      case 'command_detected':
        addDebugMessage(`Command detected: ${event.payload.command}`);
        // Process the command
        processCommand(event.payload.command);
        break;
      case 'error':
        addDebugMessage(`Error: ${event.payload.message || event.payload.error}`);
        break;
      case 'debug':
        // Only log important debug messages
        if (event.payload.message && typeof event.payload.message === 'string') {
          addDebugMessage(`Debug: ${event.payload.message}`);
        }
        break;
      default:
        // Don't log other events to avoid spam
        break;
    }
  }, [addDebugMessage]);
  
  // Handle command result
  const handleCommandResult = useCallback((result: CommandResult) => {
    setLastCommand(result.command);
    setLastResponse(result.response);
    
    // Update command history
    setCommandHistory(prev => {
      const newHistory = [...prev, result];
      // Keep only the last 100 commands
      return newHistory.slice(-100);
    });
    
    addDebugMessage(`Command result: ${result.success ? 'Success' : 'Failed'} - ${result.response}`);
  }, [addDebugMessage]);
  
  // Start listening
  const startListening = useCallback(() => {
    addDebugMessage('Starting listening...');
    voiceRecognitionService.startListening();
  }, [addDebugMessage]);
  
  // Stop listening
  const stopListening = useCallback(() => {
    addDebugMessage('Stopping listening...');
    voiceRecognitionService.stopListening();
  }, [addDebugMessage]);
  
  // Request microphone permission
  const requestMicrophonePermission = useCallback(async () => {
    addDebugMessage('Requesting microphone permission...');
    return voiceRecognitionService.requestMicrophonePermission();
  }, [addDebugMessage]);
  
  // Trigger Miranda rights reading
  const triggerMiranda = useCallback((language: string = 'english') => {
    addDebugMessage(`Triggering Miranda rights in ${language}`);
    
    // Reset Miranda state
    setVoiceEvents(prev => ({
      ...prev,
      mirandaRequested: true,
      mirandaPlaying: false,
      mirandaComplete: false,
      mirandaError: null
    }));
    
    // Track this Miranda trigger
    const triggerId = `miranda_${Date.now()}`;
    
    // Dispatch event to trigger Miranda rights reading
    document.dispatchEvent(new CustomEvent('triggerMiranda', { 
      detail: { 
        language,
        source: 'voice_context',
        triggerId,
        timestamp: Date.now()
      } 
    }));
    
    // Set up error listener with timeout
    const errorHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      addDebugMessage(`Miranda error received: ${customEvent.detail?.error || 'Unknown error'}`);
      
      setVoiceEvents(prev => ({
        ...prev,
        mirandaPlaying: false,
        mirandaError: customEvent.detail?.error || 'Failed to read Miranda rights'
      }));
    };
    
    // Add error listener
    document.addEventListener('mirandaRightsError', errorHandler);
    
    // Remove listener after 10 seconds to prevent memory leaks
    setTimeout(() => {
      document.removeEventListener('mirandaRightsError', errorHandler);
    }, 10000);
    
    return triggerId;
  }, [addDebugMessage]);

  // Use browser's built-in speech synthesis
  const speakWithBrowser = useCallback((text: string, voice?: string): void => {
    if (!('speechSynthesis' in window)) {
      addDebugMessage('Browser does not support speech synthesis');
      return;
    }
    
    try {
      addDebugMessage('Using browser speech synthesis');
      console.log('[VoiceContext] Using browser speech synthesis');
      
      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set voice if available
      if (voice && window.speechSynthesis.getVoices().length > 0) {
        const voices = window.speechSynthesis.getVoices();
        // Try to find a voice that matches the requested voice name
        const matchedVoice = voices.find(v => 
          v.name.toLowerCase().includes(voice.toLowerCase()) ||
          v.lang.toLowerCase().includes(voice.toLowerCase())
        );
        
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
      }
      
      // Speak the text
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugMessage(`Error using browser speech synthesis: ${errorMessage}`);
      console.error('[VoiceContext] Error using browser speech synthesis:', errorMessage);
    }
  }, [addDebugMessage]);

  // Speak text using the preferred method based on settings
  const speak = useCallback(async (text: string, voice?: string, streamingEnabled?: boolean): Promise<void> => {
    // Don't attempt to speak empty text
    if (!text || text.trim() === '') {
      addDebugMessage('Attempted to speak empty text');
      return;
    }
    
    // Get the user's preferred synthesis method
    const { voicePreferences } = useSettings.getState().settings;
    const { synthesisMethod } = voicePreferences;
    addDebugMessage(`Using speech synthesis method: ${synthesisMethod}`);
    console.log('[VoiceContext] Using speech synthesis method:', synthesisMethod);
    
    // Use browser speech synthesis if explicitly selected
    if (synthesisMethod === 'browser') {
      speakWithBrowser(text, voice);
      return;
    }
    
    // For LiveKit or auto mode, try LiveKit first
    try {
      // Log the speech request for debugging
      addDebugMessage(`Speaking text: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      console.log('[VoiceContext] Speaking text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
      
      // Generate a room name if not already connected
      if (!liveKitVoiceService.isConnected()) {
        const userId = uuidv4();
        const roomName = `lark-room-${uuidv4()}`;
        
        try {
          const token = await generateUserToken(roomName, userId);
          
          addDebugMessage(`Connecting to LiveKit room: ${roomName}`);
          console.log('[VoiceContext] Connecting to LiveKit room:', roomName);
          
          // Initialize without requiring microphone permissions for speech synthesis
          await liveKitVoiceService.initialize(roomName, token, false);
          addDebugMessage('Successfully connected to LiveKit room');
        } catch (connectionError) {
          const errorMsg = connectionError instanceof Error ? connectionError.message : 'Unknown connection error';
          addDebugMessage(`Error connecting to LiveKit: ${errorMsg}`);
          console.error('[VoiceContext] Error connecting to LiveKit:', errorMsg);
          
          // If in auto mode, fall back to browser synthesis
          if (synthesisMethod === 'auto') {
            addDebugMessage('Falling back to browser speech synthesis after LiveKit connection error');
            speakWithBrowser(text, voice);
          } else {
            throw connectionError; // Re-throw if LiveKit was explicitly selected
          }
          return;
        }
      }
      
      // Attempt to speak the text with LiveKit
      await liveKitVoiceService.speak(text, voice);
      addDebugMessage('Speech synthesis request sent successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugMessage(`Error speaking text: ${errorMessage}`);
      console.error('[VoiceContext] Error speaking text:', errorMessage);
      
      // Fallback to browser's speech synthesis if in auto mode
      if (synthesisMethod === 'auto') {
        try {
          addDebugMessage('Attempting fallback to browser speech synthesis');
          speakWithBrowser(text, voice);
        } catch (fallbackError) {
          addDebugMessage('Fallback speech synthesis also failed');
        }
      }
    }
  }, [addDebugMessage, speakWithBrowser]);
  
  // Stop speaking
  const stopSpeaking = useCallback((): void => {
    addDebugMessage('Stopping speech');
    liveKitVoiceService.stop();
  }, [addDebugMessage]);

  // Process command
  const processCommand = useCallback(async (command: string) => {
    if (!command || typeof command !== 'string' || command.trim() === '') {
      addDebugMessage('Attempted to process empty command');
      return {
        command: '',
        response: 'No command provided',
        success: false
      };
    }
    
    addDebugMessage(`Processing command: ${command}`);
    
    try {
      // Check if command is related to Miranda rights
      const isMirandaCommand = command.toLowerCase().includes('miranda');
      if (isMirandaCommand) {
        addDebugMessage('Detected potential Miranda rights command');
        
        // Extract language from command if present
        const languageMatch = command.match(/miranda\s+(?:rights\s+)?(?:in\s+)?(\w+)/i);
        const language = languageMatch && languageMatch[1] ? languageMatch[1].toLowerCase() : 'english';
        
        // For Miranda commands, we want to ensure they're processed even if there are network issues
        if (micPermission === 'denied') {
          addDebugMessage(`Miranda command with denied mic permission, using direct trigger for language: ${language}`);
          
          // Directly trigger Miranda rights if microphone permission is denied
          setTimeout(() => triggerMiranda(language), 100);
          
          return {
            command,
            response: `Reading Miranda rights in ${language}. Switching to Miranda tab.`,
            success: true,
            action: 'miranda',
            metadata: { language, directTrigger: true }
          };
        }
      }
      
      // Process the command using the command processing service
      const result = await commandProcessingService.processCommand(command);
      
      // Log the result for debugging
      addDebugMessage(`Command processed: ${result.success ? 'Success' : 'Failed'} - Action: ${result.action || 'none'}`);
      
      // Special handling for Miranda commands
      if (result.action === 'miranda') {
        const language = result.metadata?.language || 'english';
        // Ensure Miranda is triggered regardless of the result
        setTimeout(() => triggerMiranda(language), 100);
      }
      
      return result;
    } catch (error) {
      // Handle errors in command processing
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugMessage(`Error processing command: ${errorMessage}`);
      
      // Special handling for Miranda commands that fail
      if (command.toLowerCase().includes('miranda')) {
        addDebugMessage('Attempting fallback for failed Miranda command');
        
        // Extract language even in error case
        const languageMatch = command.match(/miranda\s+(?:rights\s+)?(?:in\s+)?(\w+)/i);
        const language = languageMatch && languageMatch[1] ? languageMatch[1].toLowerCase() : 'english';
        
        // Attempt to trigger Miranda directly as fallback
        setTimeout(() => triggerMiranda(language), 100);
        
        return {
          command,
          response: `I'll try to read Miranda rights in ${language}, but encountered an error: ${errorMessage}`,
          success: true, // Mark as success so UI shows positive feedback
          action: 'miranda',
          metadata: { language, fallback: true, error: errorMessage }
        };
      }
      
      // Return a failed command result with user-friendly message
      return {
        command,
        response: `I'm sorry, I couldn't process your command. Please try again.`,
        success: false,
        metadata: { error: errorMessage }
      };
    }
  }, [addDebugMessage, triggerMiranda, micPermission]);
  

  
  // Context value
  const contextValue: VoiceContextType = {
    isListening,
    recognitionState,
    wakeWordState,
    micPermission,
    transcript,
    
    isProcessing,
    lastCommand,
    lastResponse,
    commandHistory,
    
    isSpeaking,
    synthesisState,
    
    events: voiceRecognitionService.getEvents(),
    voiceEvents,
    
    startListening,
    stopListening,
    requestMicrophonePermission,
    processCommand,
    speak,
    stopSpeaking,
    triggerMiranda,
    
    debugInfo
  };
  
  return (
    <VoiceContext.Provider value={contextValue}>
      {children}
    </VoiceContext.Provider>
  );
};

// Custom hook to use the voice context
export const useVoice = () => useContext(VoiceContext);

// Export the context for direct use if needed
export default VoiceContext;
