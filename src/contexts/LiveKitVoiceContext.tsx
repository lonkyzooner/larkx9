import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { liveKitVoiceService, MicrophonePermission } from '../services/livekit/LiveKitVoiceService';
import { generateUserToken } from '../services/livekit/tokenService';
import { v4 as uuidv4 } from 'uuid';
import { SynthesisState } from '../services/voice/OpenAIVoiceService';

// Define the context interface
interface LiveKitVoiceContextType {
  // Voice synthesis
  isSpeaking: boolean;
  synthesisState: SynthesisState;
  
  // Room state
  isConnected: boolean;
  roomName: string;
  
  // Microphone permission
  micPermission: MicrophonePermission;
  requestMicrophonePermission: () => Promise<boolean>;
  
  // Actions
  connect: (roomName?: string, requireMicrophone?: boolean) => Promise<boolean | undefined>;
  disconnect: () => void;
  speak: (text: string, voice?: string, targetLanguage?: string) => Promise<void>;
  speakWithOpenAIFallback: (text: string, voice?: string) => Promise<void>;
  stopSpeaking: () => void;
  
  // Debug info
  debugInfo: string[];
  error: any | null;
}

// Create the context with default values
const LiveKitVoiceContext = createContext<LiveKitVoiceContextType>({
  isSpeaking: false,
  synthesisState: 'idle',
  isConnected: false,
  roomName: '',
  micPermission: 'unknown',
  requestMicrophonePermission: async () => false,
  connect: async () => undefined,
  disconnect: () => {},
  speak: async () => {},
  speakWithOpenAIFallback: async () => {},
  stopSpeaking: () => {},
  debugInfo: [],
  error: null
});

// Maximum number of debug messages to keep
const MAX_DEBUG_MESSAGES = 50;

// Provider component
export const LiveKitVoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [synthesisState, setSynthesisState] = useState<SynthesisState>('idle');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [roomName, setRoomName] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [userId] = useState<string>(uuidv4());
  const [micPermission, setMicPermission] = useState<MicrophonePermission>('unknown');
  const [error, setError] = useState<any | null>(null);

  // Add debug message
  const addDebugMessage = useCallback((message: string) => {
    setDebugInfo(prev => {
      const newMessages = [...prev, `[${new Date().toISOString()}] ${message}`];
      // Keep only the last MAX_DEBUG_MESSAGES messages
      return newMessages.slice(-MAX_DEBUG_MESSAGES);
    });
  }, []);

  // Request microphone permission with improved error handling
  const requestMicrophonePermission = useCallback(async () => {
    try {
      // First check if we're in a secure context (required for permissions)
      if (window.isSecureContext === false) {
        addDebugMessage('Cannot request microphone: not in a secure context (HTTPS required)');
        setMicPermission('denied');
        return false;
      }
      
      const result = await liveKitVoiceService.requestMicrophonePermission();
      addDebugMessage(`Microphone permission ${result ? 'granted' : 'denied'}`);
      
      // Update the mic permission state
      setMicPermission(result ? 'granted' : 'denied');
      
      // If denied, log a helpful message about fallback functionality
      if (!result) {
        console.log('Operating without microphone access - text input mode only');
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugMessage(`Error requesting microphone permission: ${errorMessage}`);
      
      // Set a more specific error type based on the error message
      setError({
        type: 'permission_error',
        message: 'Microphone access is blocked. Please enable it in your browser settings.',
        timestamp: Date.now(),
        recoverable: false
      });
      
      // Update permission state
      setMicPermission('denied');
      
      // Log that we'll continue in text-only mode
      console.log('Continuing in text-only mode due to microphone permission issues');
      return false;
    }
  }, [addDebugMessage]);

  // Connect to LiveKit room with better fallback handling
  const connect = useCallback(async (customRoomName?: string, requireMicrophone: boolean = false) => {
    try {
      // Check microphone permission if needed, but don't block connection
      if (requireMicrophone) {
        if (micPermission === 'unknown' || micPermission === 'prompt') {
          try {
            const permissionGranted = await requestMicrophonePermission();
            if (!permissionGranted) {
              addDebugMessage('Microphone permission denied, continuing with text input only');
              // Inform the user that voice input is unavailable but text will work
              console.log('Voice input unavailable - using text input mode');
            }
          } catch (permError) {
            // Don't fail the connection attempt, just log the error
            console.error('Error checking microphone permission, continuing anyway:', permError);
            addDebugMessage('Error checking microphone permission, but continuing for TTS only');
          }
        } else if (micPermission === 'denied') {
          addDebugMessage('Microphone permission denied, but will continue for TTS only');
          // Don't throw error, just log it and continue
        }
      }
      
      // Generate a room name if not provided
      const newRoomName = customRoomName || `lark-room-${uuidv4()}`;
      
      // Generate a token for the user
      const token = await generateUserToken(newRoomName, userId);
      
      // Initialize the LiveKit service - pass false for requireMicrophone to allow TTS without mic
      await liveKitVoiceService.initialize(newRoomName, token, requireMicrophone);
      
      setRoomName(newRoomName);
      setIsConnected(true);
      addDebugMessage(`Connected to LiveKit room: ${newRoomName}`);
      
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugMessage(`Error connecting to LiveKit room: ${errorMessage}`);
      setError({
        type: 'connection_error',
        message: errorMessage
      });
      // Don't throw error, just log it and return false
      return false;
    }
  }, [userId, addDebugMessage, micPermission, requestMicrophonePermission]);

  // Disconnect from LiveKit room
  const disconnect = useCallback(() => {
    liveKitVoiceService.disconnect();
    setIsConnected(false);
    setRoomName('');
    addDebugMessage('Disconnected from LiveKit room');
  }, [addDebugMessage]);

  // Speak text using LiveKit
  const speak = useCallback(async (text: string, voice?: string, targetLanguage?: string): Promise<void> => {
    try {
      // Log the speech request for debugging
      addDebugMessage(`Speaking text: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      
      // Connect to a room if not already connected - don't require microphone for TTS
      if (!isConnected) {
        const connectResult = await connect(undefined, false);
        // If connection failed, we'll still try to speak using the fallback
        if (connectResult === false) {
          addDebugMessage('Connection failed, using fallback TTS');
        }
      }
      
      // Speak the text - even if connection failed, the service will use fallback methods
      await liveKitVoiceService.speak(text, voice || 'ash', targetLanguage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugMessage(`Error speaking text: ${errorMessage}`);
      
      // Try fallback directly if LiveKit fails
      try {
        addDebugMessage('Attempting to use fallback TTS directly');
        await liveKitVoiceService.speakWithOpenAIFallback(text, voice || 'ash');
        return; // If fallback succeeds, don't throw the original error
      } catch (fallbackError) {
        addDebugMessage(`Fallback TTS also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        // Now throw the original error since both methods failed
        throw error;
      }
    }
  }, [isConnected, connect, addDebugMessage]);

  // Stop speaking
  const stopSpeaking = useCallback((): void => {
    liveKitVoiceService.stop();
    addDebugMessage('Stopping speech');
  }, [addDebugMessage]);

  // Subscribe to LiveKit service events
  useEffect(() => {
    // Subscribe to speaking state
    const speakingSubscription = liveKitVoiceService.getSpeakingState().subscribe(speaking => {
      setIsSpeaking(speaking);
    });
    
    // Subscribe to synthesis state
    const synthesisSubscription = liveKitVoiceService.getSynthesisState().subscribe(state => {
      setSynthesisState(state);
    });
    
    // Subscribe to microphone permission state
    const micPermissionSubscription = liveKitVoiceService.getMicPermission().subscribe(permission => {
      setMicPermission(permission);
      addDebugMessage(`Microphone permission: ${permission}`);
    });
    
    // Subscribe to events
    const eventsSubscription = liveKitVoiceService.getEvents().subscribe(event => {
      addDebugMessage(`LiveKit event: ${event.type} - ${JSON.stringify(event.payload)}`);
    });
    
    // Subscribe to errors
    const errorSubscription = liveKitVoiceService.getErrorEvent().subscribe(error => {
      if (error) {
        setError(error);
        addDebugMessage(`LiveKit error: ${error.message || 'Unknown error'}`);
      }
    });
    
    return () => {
      // Unsubscribe from all subscriptions
      speakingSubscription.unsubscribe();
      synthesisSubscription.unsubscribe();
      eventsSubscription.unsubscribe();
      errorSubscription.unsubscribe();
      
      // Disconnect from LiveKit
      liveKitVoiceService.disconnect();
    };
  }, [addDebugMessage]);

  // Context value
  // Add the speakWithOpenAIFallback method to directly use OpenAI without LiveKit
  const speakWithOpenAIFallback = useCallback(async (text: string, voice?: string): Promise<void> => {
    try {
      addDebugMessage(`Using OpenAI directly for speech: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      await liveKitVoiceService.speakWithOpenAIFallback(text, voice || 'ash');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugMessage(`Error using OpenAI fallback: ${errorMessage}`);
      throw error;
    }
  }, [addDebugMessage]);

  const contextValue: LiveKitVoiceContextType = {
    isSpeaking,
    synthesisState,
    isConnected,
    roomName,
    micPermission,
    requestMicrophonePermission,
    connect,
    disconnect,
    speak,
    speakWithOpenAIFallback,
    stopSpeaking,
    debugInfo,
    error
  };

  return (
    <LiveKitVoiceContext.Provider value={contextValue}>
      {children}
    </LiveKitVoiceContext.Provider>
  );
};

// Custom hook to use the LiveKit voice context
export const useLiveKitVoice = () => useContext(LiveKitVoiceContext);

// Export the context for direct use if needed
export default LiveKitVoiceContext;
