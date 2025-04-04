import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnalyticsData, CommandEvent, VoiceEvent, VoiceData, VoiceEventPayload } from '../types/voice';
import { useVoice } from '../contexts/VoiceContext';
import { useSettings } from '../lib/settings-store';
import { useSimulatedTTS } from '../hooks/useSimulatedTTS.tsx';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { indexedDBService } from '../lib/indexeddb-service';
import { voiceRecognitionService } from '../services/voice/VoiceRecognitionService';
import {
  MicIcon, 
  StopCircleIcon, 
  VolumeIcon, 
  RefreshCwIcon, 
  ShieldIcon, 
  BookTextIcon, 
  AlertTriangleIcon,
  BrainIcon,
  InfoIcon,
  BotIcon,
  UserIcon,
  ArrowRightIcon,
  SettingsIcon,
  BellIcon,
  EyeIcon,
  EyeOffIcon,
  BarChart2Icon,
  CloudIcon,
  SendIcon,
  CloudOffIcon,
  DatabaseIcon,
  ActivityIcon,
  BugIcon
} from 'lucide-react';

interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface ExtendedAnalyticsData extends AnalyticsData {
  voiceAccuracy: number;
  recognitionAccuracy: number;
  commandSuccess: number;
  commandFailure: number;
  multiCommandSuccess: number;
  averageCommandsPerChain: number;
  averageResponseTime: number;
  cacheHits: number;
}

// Animation duration in ms
const TYPING_SPEED = 30;
const TYPING_PAUSE = 500;

type TypingState = {
  currentText: string;
  typingIndex: number;
};

export const VoiceAssistantV2: React.FC = () => {
  // Get voice context and settings
  const voiceContext = useVoice();
  const { settings } = useSettings();
  
  // Get text-to-speech capabilities
  const tts = useSimulatedTTS();
  const speak = tts.speak;
  const stopSpeaking = tts.stop || (() => {});
  const isSpeaking = tts.speaking || false;
  
  // Use refs to track state and avoid infinite loops
  const speakingRef = useRef(isSpeaking);
  const processingCommandRef = useRef(false);
  
  // Component state
  const [messages, setMessages] = useState<Message[]>([
    { type: 'assistant', content: 'Hello! I\'m your L.A.R.K. voice assistant. How can I help you today?', timestamp: Date.now() }
  ]);
  const [inputText, setInputText] = useState('');
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [listeningForCommand, setListeningForCommand] = useState(false);
  const [listeningMessage, setListeningMessage] = useState('Listening for command...');
  const [speaking, setSpeaking] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [waveformAmplitudes, setWaveformAmplitudes] = useState(Array(12).fill(0.1));
  const [recognitionAccuracy, setRecognitionAccuracy] = useState(0.85);
  const [analyticsData, setAnalyticsData] = useState<ExtendedAnalyticsData>({
    voiceAccuracy: 0,
    recognitionAccuracy: 0,
    commandSuccess: 0,
    commandFailure: 0,
    multiCommandSuccess: 0,
    averageCommandsPerChain: 0,
    averageResponseTime: 0,
    cacheHits: 0
  });
  
  // Simulate typing effect
  const [showTypingEffect, setShowTypingEffect] = useState(false);
  const [currentTypingText, setCurrentTypingText] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  const typingEffectRef = useRef<NodeJS.Timeout | null>(null);
  
  // References
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef<boolean>(true);
  
  // Component mount/unmount effect
  useEffect(() => {
    // Set mounted flag
    mountedRef.current = true;
    console.log('VoiceAssistantV2 component mounted');
    
    // Clean up on unmount
    return () => {
      console.log('VoiceAssistantV2 component unmounting');
      mountedRef.current = false;
      
      // Clear any active timeouts
      if (typingEffectRef.current) {
        clearTimeout(typingEffectRef.current);
        typingEffectRef.current = null;
      }
      
      // Clear waveform animation
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
        waveformIntervalRef.current = null;
      }
      
      // Stop any ongoing speech
      if (typeof stopSpeaking === 'function') {
        stopSpeaking();
      }
    };
  }, [stopSpeaking]);

  // Load analytics data from IndexedDB
  const loadAnalyticsData = useCallback(async () => {
    try {
      // Using any to bypass the type check since IndexedDBService might have been extended
      const dbService = indexedDBService as any;
      const onlineCommandData = await dbService.getAllItems('commands');
      const typedVoiceData = await dbService.getAllItems('voiceCache') as VoiceData[];
      const typedErrorData = await dbService.getAllItems('errorLog');
      
      // Calculate average response time
      const totalResponseTime = onlineCommandData.reduce((acc, command) => {
        const typedCommand = command as any; // Using any to bypass the type check
        return acc + (typedCommand.responseTime || 0);
      }, 0);
      
      // Calculate average commands per chain
      const chains = onlineCommandData.reduce((acc: Record<string, number>, command) => {
        const typedCommand = command as any; // Using any to bypass the type check
        if (typedCommand.chainId) {
          acc[typedCommand.chainId] = (acc[typedCommand.chainId] || 0) + 1;
        }
        return acc;
      }, {});
      
      const chainsArray = Object.values(chains) as number[];
      const averageCommandsPerChain = chainsArray.length ? 
        chainsArray.reduce((acc: number, count: number) => acc + count, 0) / chainsArray.length : 0;
      
      // Count multi-command successes
      const multiCommandSuccess = chainsArray.filter((count: number) => count > 1).length;
      
      // Update analytics data
      const newAnalyticsData: ExtendedAnalyticsData = {
        voiceAccuracy: typedVoiceData.reduce((acc, data) => acc + (data.accuracy || 0), 0) / (typedVoiceData.length || 1),
        recognitionAccuracy: recognitionAccuracy,
        commandSuccess: onlineCommandData.length || 0,
        commandFailure: typedErrorData.length || 0,
        multiCommandSuccess,
        averageCommandsPerChain,
        averageResponseTime: totalResponseTime / (onlineCommandData.length || 1),
        cacheHits: typedVoiceData.filter(data => data.fromCache).length || 0
      };
      
      setAnalyticsData(newAnalyticsData);
      
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }, [recognitionAccuracy]);

  // Scroll to bottom of messages
  // Use a more efficient dependency array to avoid unnecessary re-renders
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, showTypingEffect, typingIndex]);
  
  // Handle microphone permission changes
  useEffect(() => {
    if (voiceContext?.micPermission === 'denied') {
      // Add a message about microphone permission being denied
      setMessages(prev => {
        // Check if we already have a permission message to avoid duplicates
        const hasPermissionMessage = prev.some(msg => 
          msg.type === 'assistant' && 
          msg.content.includes('microphone permission')
        );
        
        if (!hasPermissionMessage) {
          return [...prev, {
            type: 'assistant',
            content: 'Microphone permission is required for voice recognition. Please click the "Test Mic" button to request permission.',
            timestamp: Date.now()
          }];
        }
        return prev;
      });
    }
  }, [voiceContext?.micPermission]);
  
  // Typing effect animation - separated into two distinct effects to prevent update loops
  // This effect handles the typing animation
  useEffect(() => {
    // Only proceed if we're actively showing the typing effect and haven't reached the end
    if (!mountedRef.current) return;
    
    if (showTypingEffect && typingIndex < currentTypingText.length) {
      // Clear any existing timeout to prevent multiple timers
      if (typingEffectRef.current) {
        clearTimeout(typingEffectRef.current);
      }
      
      // Set a new timeout to increment the typing index
      typingEffectRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setTypingIndex(prev => prev + 1);
        }
      }, TYPING_SPEED);
      
      // Cleanup function
      return () => {
        if (typingEffectRef.current) {
          clearTimeout(typingEffectRef.current);
          typingEffectRef.current = null;
        }
      };
    }
  }, [showTypingEffect, typingIndex, currentTypingText.length, mountedRef]); // Only depend on the length, not the entire string
  
  // This effect handles hiding the typing effect after completion and adding the message
  useEffect(() => {
    // Only proceed if component is mounted and we've finished typing but the effect is still showing
    if (!mountedRef.current) return;
    
    if (showTypingEffect && 
        typingIndex >= currentTypingText.length && 
        currentTypingText.length > 0 && 
        currentTypingText !== 'Processing your command...') {
      
      // Set a timeout to hide the typing effect and add the message
      const hideTimer = setTimeout(() => {
        if (mountedRef.current) {
          // Add the completed message to the message list
          setMessages(prevMessages => [
            ...prevMessages,
            { type: 'assistant', content: currentTypingText, timestamp: Date.now() }
          ]);
          
          // Hide the typing effect
          setShowTypingEffect(false);
        }
      }, 1000); // Hide after 1 second of showing the full message
      
      // Cleanup function
      return () => {
        clearTimeout(hideTimer);
      };
    }
  }, [showTypingEffect, typingIndex, currentTypingText.length, currentTypingText, mountedRef]); // Include currentTypingText for the message content

  // Subscribe to voice context events - single source of truth for event handling
  useEffect(() => {
    if (!voiceContext || !voiceContext.events) return;
    
    // Create event handlers
    const handleVoiceEvent = (event: any) => {
      console.log('Voice event received:', event.type, event.payload);
      
      // Handle specific voice events
      switch (event.type) {
        case 'permission_required':
          // Show permission message with instructions
          setMessages(prev => {
            // Check if we already have a recent permission message
            const hasRecentPermissionMessage = prev.slice(-3).some(msg => 
              msg.type === 'assistant' && 
              msg.content.includes('microphone permission')
            );
            
            if (!hasRecentPermissionMessage) {
              return [...prev, {
                type: 'assistant',
                content: 'Microphone permission is required. Please click the "Test Mic" button to request permission.',
                timestamp: Date.now()
              }];
            }
            return prev;
          });
          break;
          
        case 'error':
          // Log error details for debugging
          console.error('Voice recognition error:', event.payload);
          break;
      }
    };
    
    // Subscribe to voice events
    const subscription = voiceContext.events.subscribe(handleVoiceEvent);
    
    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, [voiceContext]);
  
  // Handle text input submission
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      type: 'user',
      content: inputText.trim(),
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    // Log the attempt to process a text command
    console.log('Text command received:', userMessage.content);
    
    // Check if this is a Miranda command before processing
    const isMirandaCommand = userMessage.content.toLowerCase().includes('miranda');
    if (isMirandaCommand) {
      console.log('Detected potential Miranda command in text input');
    }
    
    try {
      // Start typing effect to show the system is working
      setShowTypingEffect(true);
      setCurrentTypingText('Processing your command...');
      setTypingIndex(0);
      
      // Check if we have a direct reference to the command processing service
      // This is a fallback for when the voice context is not available or initialized
      let result;
      
      // Check microphone permission status to determine processing path
      const micPermissionDenied = voiceContext?.micPermission === 'denied';
      if (micPermissionDenied) {
        console.log('Microphone permission denied, using optimized text command path');
      }
      
      // Handle direct Miranda command with optimized path if needed
      if (isMirandaCommand && (micPermissionDenied || !voiceContext)) {
        console.log('Using direct Miranda command processing due to mic permission or missing voice context');
        
        // Extract language from command if present (e.g., "read miranda rights in spanish")
        const languageMatch = userMessage.content.match(/miranda\s+(?:rights\s+)?(?:in\s+)?(\w+)/i);
        const language = languageMatch && languageMatch[1] ? languageMatch[1].toLowerCase() : 'english';
        
        // Create a simplified result for Miranda command
        result = {
          command: userMessage.content,
          response: `Reading Miranda rights in ${language}.`,
          success: true,
          action: 'miranda',
          metadata: { language }
        };
      } else if (voiceContext && typeof voiceContext.processCommand === 'function') {
        // Normal path - use the voice context to process the command
        console.log('Processing text command through voice context');
        result = await voiceContext.processCommand(userMessage.content);
      } else {
        // Fallback path - try to import and use the command processing service directly
        console.log('Voice context not available, using fallback command processing');
        try {
          // Dynamic import of command processing service
          const { commandProcessingService } = await import('../services/voice/CommandProcessingService');
          if (commandProcessingService && typeof commandProcessingService.processCommand === 'function') {
            result = await commandProcessingService.processCommand(userMessage.content);
          } else {
            throw new Error('Command processing service not available');
          }
        } catch (importError) {
          console.error('Failed to import command processing service:', importError);
          throw new Error('Command processing system could not be loaded');
        }
      }
      
      console.log('Command processing result:', result);
      
      // Always ensure we have a result object to prevent undefined errors
      if (!result) {
        result = {
          command: userMessage.content,
          response: "I'm sorry, I couldn't process your command properly.",
          success: false
        };
      }
      
      // Check if this is a miranda command and trigger the miranda rights module
      if (result?.action === 'miranda') {
        // Stop typing effect immediately for Miranda commands
        setShowTypingEffect(false);
        try {
          // Extract language from metadata if available
          const language = result.metadata?.language || 'english';
          console.log('Triggering Miranda rights with language:', language);
          
          // Add response message indicating Miranda rights will be read
          const responseMessage: Message = {
            type: 'assistant',
            content: `Miranda rights will be read in ${language}. Switching to Miranda tab.`,
            timestamp: Date.now()
          };
          
          setMessages(prev => [...prev, responseMessage]);
          
          // Use multiple trigger methods to ensure Miranda rights are read
          // This redundancy ensures the command works even if one method fails
          
          // Method 1: Use voice context if available
          if (voiceContext && typeof voiceContext.triggerMiranda === 'function') {
            console.log('Using voice context to trigger Miranda rights');
            try {
              voiceContext.triggerMiranda(language);
            } catch (error) {
              console.error('Error using voice context to trigger Miranda:', error);
              // Continue to fallback methods
            }
          }
          
          // Method 2: Always dispatch a direct event as a backup
          // This ensures Miranda rights are triggered even if voice context fails
          console.log('Using direct event dispatch for Miranda as backup');
          try {
            document.dispatchEvent(new CustomEvent('triggerMiranda', { 
              detail: { 
                language,
                source: 'text_command_redundant',
                triggerId: `miranda_text_${Date.now()}`,
                timestamp: Date.now()
              } 
            }));
          } catch (eventError) {
            console.error('Error dispatching Miranda event:', eventError);
          }
          
          // Method 3: Try to switch to Miranda tab
          try {
            const mirandaTabTrigger = document.querySelector('[value="miranda"]') as HTMLElement;
            
            // Log if the Miranda tab element wasn't found
            if (!mirandaTabTrigger) {
              console.error('Miranda tab trigger element not found');
              // Add fallback message
              setMessages(prev => [...prev, {
                type: 'assistant',
                content: 'Unable to switch to Miranda tab automatically. Please switch to the Miranda tab manually.',
                timestamp: Date.now()
              }]);
            } else {
              // Click the tab with a slight delay to ensure events are processed
              setTimeout(() => {
                try {
                  if (mirandaTabTrigger) mirandaTabTrigger.click();
                } catch (clickError) {
                  console.error('Error clicking Miranda tab:', clickError);
                }
              }, 100);
            }
          } catch (tabError) {
            console.error('Error finding or interacting with Miranda tab:', tabError);
          }
          
          // Listen for Miranda rights events to provide feedback
          const handleMirandaError = (event: CustomEvent) => {
            console.log('Received Miranda error event:', event);
            setMessages(prev => [...prev, {
              type: 'assistant',
              content: `Error reading Miranda rights: ${event.detail?.error || 'Unknown error'}`,
              timestamp: Date.now()
            }]);
            // Remove listener after handling
            document.removeEventListener('mirandaRightsError', handleMirandaError as EventListener);
          };
          
          // Add temporary event listener for Miranda errors
          document.addEventListener('mirandaRightsError', handleMirandaError as EventListener);
          
          // Remove the listener after 10 seconds if not triggered
          setTimeout(() => {
            document.removeEventListener('mirandaRightsError', handleMirandaError as EventListener);
          }, 10000);
          
        } catch (error) {
          console.error('Error processing Miranda command:', error);
          setMessages(prev => [...prev, {
            type: 'assistant',
            content: 'There was an error processing the Miranda rights command. Please try again.',
            timestamp: Date.now()
          }]);
        }
      } else {
        // For other commands, check if we should add a response message
        // We need to prevent duplicate messages that might come from the command results subscription
        const isBeingHandledBySubscription = result?.command && typeof result.command === 'string';
        
        if (!isBeingHandledBySubscription) {
          const responseMessage: Message = {
            type: 'assistant',
            content: result?.response || 'I processed your command.',
            timestamp: Date.now()
          };
          
          // Add the response message to the messages state
          setMessages(prev => [...prev, responseMessage]);
          console.log('Added response message:', responseMessage);
        } else {
          console.log('Skipping response message as it will be handled by subscription');
        }
        
        // Speak the response if audio feedback is enabled and speak function is available
        if (settings?.voicePreferences?.audioFeedback && typeof speak === 'function') {
          const textToSpeak = result?.response || 'I processed your command.';
          setSpeaking(true);
          await speak(textToSpeak);
          setSpeaking(false);
        }
      }
    } catch (error) {
      console.error('Error processing text command:', error);
      
      // Always stop the typing effect when there's an error
      setShowTypingEffect(false);
      
      // Check if this was a Miranda command attempt that failed
      const wasMirandaCommand = inputText.toLowerCase().includes('miranda');
      
      if (wasMirandaCommand) {
        console.log('Miranda command failed, attempting fallback methods');
        
        // Extract language from command if present
        const languageMatch = inputText.match(/miranda\s+(?:rights\s+)?(?:in\s+)?(\w+)/i);
        const language = languageMatch && languageMatch[1] ? languageMatch[1].toLowerCase() : 'english';
        
        // For Miranda commands, provide a more specific error message
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: `I'll try to read Miranda rights in ${language} despite the error. Switching to Miranda tab.`,
          timestamp: Date.now()
        }]);
        
        // Attempt to trigger Miranda rights directly as a fallback
        // This ensures Miranda rights are read even if command processing fails
        try {
          document.dispatchEvent(new CustomEvent('triggerMiranda', { 
            detail: { 
              language,
              source: 'text_command_error_fallback',
              triggerId: `miranda_fallback_${Date.now()}`,
              timestamp: Date.now()
            } 
          }));
        } catch (eventError) {
          console.error('Error dispatching Miranda fallback event:', eventError);
        }
        
        // Try to switch to Miranda tab
        try {
          const mirandaTabTrigger = document.querySelector('[value="miranda"]') as HTMLElement;
          if (mirandaTabTrigger) {
            // Click the tab immediately
            setTimeout(() => {
              try {
                if (mirandaTabTrigger) mirandaTabTrigger.click();
              } catch (clickError) {
                console.error('Error clicking Miranda tab in error handler:', clickError);
              }
            }, 100);
          } else {
            // If tab not found, provide manual instructions
            setMessages(prev => [...prev, {
              type: 'assistant',
              content: 'Unable to switch to Miranda tab automatically. Please switch to the Miranda tab manually.',
              timestamp: Date.now()
            }]);
          }
        } catch (tabError) {
          console.error('Error finding or interacting with Miranda tab in error handler:', tabError);
        }
      } else {
        // For other commands, show a generic error message
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: 'Sorry, I encountered an error processing your command: ' + 
                   (error instanceof Error ? error.message : 'Unknown error'),
          timestamp: Date.now()
        }]);
      }
      
      setShowTypingEffect(false);
    }
  };

  // Define voice event type constants to match VoiceEventType
  const VOICE_EVENT_TYPES = {
    WAKE_WORD_DETECTED: 'WAKE_WORD_DETECTED',
    COMMAND_DETECTED: 'COMMAND_DETECTED',
    COMMAND_PROCESSED: 'COMMAND_PROCESSED',
    COMMAND_ERROR: 'COMMAND_ERROR',
    RECOGNITION_STATE_CHANGED: 'RECOGNITION_STATE_CHANGED'
  } as const;
  
  // Add error boundary for Miranda rights functionality
  const handleMirandaError = (error: any) => {
    console.error('Miranda rights error caught by error handler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    };
  };

  // Handle voice events from context
  useEffect(() => {
    const handleVoiceEvent = (event: VoiceEvent) => {
      switch (event.type) {
        case 'WAKE_WORD_DETECTED':
          setWakeWordActive(true);
          setListeningForCommand(true);
          setListeningMessage('Listening for command...');
          animateWaveform();
          break;
          
        case 'COMMAND_DETECTED':
          setWakeWordActive(false);
          setListeningForCommand(false);
          
          // Add user message
          if (event.payload?.command) {
            setMessages(prevMessages => [
              ...prevMessages, 
              { type: 'user', content: event.payload.command || '', timestamp: Date.now() }
            ]);
          }
          
          // Process the command with AI instead of simulating a response
          if (voiceContext?.processCommand && event.payload?.command && !processingCommandRef.current) {
            // Set processing flag to prevent multiple simultaneous commands
            processingCommandRef.current = true;
            
            // Create a separate function to process the command to avoid closure issues
            const processCommand = async (cmd: string) => {
              try {
                // Process the command using OpenAI
                const result = await voiceContext?.processCommand(cmd);
                
                // Only update state if component is still mounted (check with a ref)
                if (result && result.response) {
                  // Use functional updates to avoid stale closures
                  setMessages(prevMessages => [
                    ...prevMessages,
                    { type: 'assistant', content: result.response, timestamp: Date.now() }
                  ]);
                  
                  // Speak the response if audio feedback is enabled
                  if (settings?.voicePreferences?.audioFeedback && speak && !speakingRef.current) {
                    setSpeaking(true);
                    await speak(result.response);
                    setSpeaking(false);
                  }
                }
              } catch (error) {
                console.error('Error processing voice command:', error);
                setMessages(prevMessages => [
                  ...prevMessages,
                  { type: 'assistant', content: 'Sorry, I encountered an error processing your command.', timestamp: Date.now() }
                ]);
              } finally {
                // Reset processing flag when done
                processingCommandRef.current = false;
              }
            };
            
            // Process command in a non-blocking way with a separate function call
            const commandToProcess = event.payload.command;
            setTimeout(() => processCommand(commandToProcess), 0);
          }
          break;
          
        case 'COMMAND_ERROR':
          setWakeWordActive(false);
          setListeningForCommand(false);
          
          // Add error message
          setMessages(prevMessages => [
            ...prevMessages, 
            { type: 'assistant', content: "Sorry, I couldn't understand that. Could you try again?", timestamp: Date.now() }
          ]);
          break;
          
        case 'RECOGNITION_STATE_CHANGED':
          // Check the recognition state
          if (event.payload?.state === 'listening') {
            setListeningForCommand(true);
          } else if (event.payload?.state === 'idle' || event.payload?.state === 'processing') {
            // Do nothing or handle as needed
          } else {
            // For any other state (including 'inactive' or 'error' from service)
            setListeningForCommand(false);
            setWakeWordActive(false);
          }
          break;
      }
    };

    // Use the events observable from voiceContext to subscribe - single subscription approach
    // Use type assertion to ensure compatibility between service and component event types
    const subscription = voiceContext.events.subscribe((event: any) => {
      // Handle the event using our handler
      handleVoiceEvent(event);
    });
    
    // Subscribe to command results from the command processing service
    // This ensures we get responses for both voice and text commands
    let commandResultsSubscription: any = null;
    const commandResultsRef = useRef<any>(null);
    const processedCommandsRef = useRef<Set<string>>(new Set());
    
    try {
      // Import the command processing service to subscribe to results
      import('../services/voice/CommandProcessingService').then(({ commandProcessingService }) => {
        // Prevent duplicate subscriptions
        if (commandResultsRef.current) {
          return;
        }
        
        if (commandProcessingService && typeof commandProcessingService.getCommandResults === 'function') {
          commandResultsSubscription = commandProcessingService.getCommandResults().subscribe((result: any) => {
            if (result && result.response) {
              console.log('Command result received:', result);
              
              // Use a ref to track if component is still mounted
              if (!mountedRef.current) return;
              
              // Create a unique ID for this command result to prevent duplicates
              const resultId = `${result.command}-${result.timestamp || Date.now()}`;
              
              // Check if we've already processed this command result
              if (processedCommandsRef.current.has(resultId)) {
                console.log('Skipping duplicate command result:', resultId);
                return;
              }
              
              // Add this result to the processed set
              processedCommandsRef.current.add(resultId);
              
              // Limit the size of the processed set to prevent memory leaks
              if (processedCommandsRef.current.size > 100) {
                // Convert to array, remove oldest entries, convert back to set
                const entries = Array.from(processedCommandsRef.current);
                processedCommandsRef.current = new Set(entries.slice(-50));
              }
              
              // Stop typing effect if it's still active
              setShowTypingEffect(false);
              
              // Only add a message if this isn't a Miranda command (those are handled separately)
              if (result.action !== 'miranda') {
                // Add the response to messages
                setMessages(prev => [
                  ...prev,
                  {
                    type: 'assistant',
                    content: result.response,
                    timestamp: Date.now()
                  }
                ]);
                
                // Speak the response if audio feedback is enabled
                if (settings?.voicePreferences?.audioFeedback && typeof speak === 'function' && !speakingRef.current) {
                  setSpeaking(true);
                  speak(result.response).then(() => {
                    if (mountedRef.current) {
                      setSpeaking(false);
                    }
                  });
                }
              }
            }
          });
          
          // Store the subscription in the ref
          commandResultsRef.current = commandResultsSubscription;
          console.log('Successfully subscribed to command results');
        }
      }).catch(err => {
        console.error('Failed to subscribe to command results:', err);
      });
    } catch (error) {
      console.error('Error setting up command results subscription:', error);
    }
    
    // Cleanup function
    return () => {
      // Mark component as unmounted
      mountedRef.current = false;
      
      // Unsubscribe from voice events
      subscription.unsubscribe();
      
      // Unsubscribe from command results
      if (commandResultsRef.current) {
        commandResultsRef.current.unsubscribe();
        commandResultsRef.current = null;
      }
      
      // Stop listening when component unmounts
      if (voiceContext) {
        voiceContext.stopListening();
      }
      
      // Clear any active waveform animation
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
        waveformIntervalRef.current = null;
      }
      
      // Clear any active typing effect
      if (typingEffectRef.current) {
        clearTimeout(typingEffectRef.current);
        typingEffectRef.current = null;
      }
    };
    
    // No additional cleanup needed as it's handled in the event listener section
  }, [voiceContext]);

  // Monitor isSpeaking state and update the ref
  useEffect(() => {
    speakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // Load analytics when shown - with better dependency management
  useEffect(() => {
    if (!showAnalytics) return;
    
    // Initial load
    const initialLoad = async () => {
      if (!speakingRef.current) {
        await loadAnalyticsData();
      }
    };
    
    // Start with initial load
    initialLoad();
    
    // Set up interval for refresh
    const interval = setInterval(() => {
      if (!speakingRef.current && showAnalytics) {
        loadAnalyticsData();
      }
    }, 30000);
    
    // Clean up interval
    return () => clearInterval(interval);
  }, [showAnalytics, loadAnalyticsData]);
  
  // Simulate typing effect for assistant messages
  const simulateTypingResponse = useCallback((text: string) => {
    if (!mountedRef.current) return;
    
    // Clear any existing typing effect
    if (typingEffectRef.current) {
      clearTimeout(typingEffectRef.current);
      typingEffectRef.current = null;
    }
    
    // Set initial state for typing effect
    setCurrentTypingText(text || 'I processed your command.');
    setTypingIndex(0);
    setShowTypingEffect(true);
    
    // We don't need to manually handle the typing animation here anymore
    // The useEffect hooks will take care of the animation and cleanup
    // This prevents multiple intervals from being created
  }, [mountedRef]);
  

  // Reference to store the animation interval
  const waveformIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Animate waveform during listening - using a function instead of callback to avoid dependency issues
  const animateWaveform = () => {
    // Clear any existing interval
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }
    
    // Create a new animation interval
    waveformIntervalRef.current = setInterval(() => {
      setWaveformAmplitudes(Array(12).fill(0).map(() => Math.max(0.1, Math.min(Math.random(), 1))));
    }, 150);
    
    // Auto-stop after 5 seconds to prevent runaway animations
    setTimeout(() => {
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
        waveformIntervalRef.current = null;
        setWaveformAmplitudes(Array(12).fill(0.1));
      }
    }, 5000);
  };

  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
        <h2 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
          <BotIcon className="h-5 w-5 text-primary" />
          Voice Assistant
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className={`${showDebug ? 'bg-primary/10 text-primary' : ''} h-8`}
          >
            <BugIcon className="h-4 w-4 mr-1" />
            Debug
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`${showAnalytics ? 'bg-primary/10 text-primary' : ''} h-8`}
          >
            <BarChart2Icon className="h-4 w-4 mr-1" />
            Analytics
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {listeningForCommand && (
          <div className="bg-primary/5 rounded-lg p-4 flex items-center gap-3 border border-primary/20 animate-pulse">
            <div className="flex items-end h-8 space-x-1 min-w-[60px]">
              {waveformAmplitudes.map((amplitude, index) => (
                <div 
                  key={index} 
                  className="w-1 bg-primary rounded-t" 
                  style={{ height: `${amplitude * 100}%` }}
                />
              ))}
            </div>
            <p className="text-sm font-medium text-primary">{listeningMessage}</p>
          </div>
        )}
        
        <div className="bg-background/50 rounded-lg p-2 border border-border overflow-y-auto max-h-[350px] space-y-2 min-h-[200px]">
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-2 p-2 rounded-md ${message.type === 'user' ? 'bg-muted/50 ml-8' : 'bg-primary/5 mr-8'}`}>
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.type === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                {message.type === 'user' ? <UserIcon className="h-4 w-4" /> : <BotIcon className="h-4 w-4" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="text-sm">{message.content}</div>
                {message.timestamp && (
                  <div className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          ))}

          {showTypingEffect && (
            <div className="flex gap-2 p-2 rounded-md bg-primary/5 mr-8">
              <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                <BotIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="text-sm">
                  {currentTypingText.substring(0, typingIndex)}
                  <span className="animate-pulse">▋</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
        
        {/* Text input for typing commands */}
        <form onSubmit={handleTextSubmit} className="mt-4 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a command to LARK..."
            className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            disabled={speaking || showTypingEffect}
            aria-label="Command input"
            onKeyDown={(e) => {
              // Allow Enter key to submit the form
              if (e.key === 'Enter' && inputText.trim() && !speaking && !showTypingEffect) {
                e.preventDefault();
                handleTextSubmit(e as any);
              }
            }}
          />
          <button 
            type="submit" 
            className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            disabled={!inputText.trim() || speaking || showTypingEffect}
            aria-label="Send command"
          >
            <SendIcon size={18} />
          </button>
        </form>

        {showDebug && (
          <div className="mt-4 p-3 bg-card rounded-lg border border-border">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-primary"><BugIcon size={16} /> Debug Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-muted/30 rounded flex items-center gap-1.5"><InfoIcon size={14} className="text-primary" /> <span className="font-medium">Voice State:</span> {voiceContext?.recognitionState || 'unknown'}</div>
              <div className="p-2 bg-muted/30 rounded flex items-center gap-1.5"><MicIcon size={14} className="text-primary" /> <span className="font-medium">Wake Word Active:</span> {wakeWordActive.toString()}</div>
              <div className="p-2 bg-muted/30 rounded flex items-center gap-1.5"><ActivityIcon size={14} className="text-primary" /> <span className="font-medium">Listening:</span> {voiceContext?.isListening?.toString()}</div>
              <div className="p-2 bg-muted/30 rounded flex items-center gap-1.5"><VolumeIcon size={14} className="text-primary" /> <span className="font-medium">Speaking:</span> {speaking.toString()}</div>
              <div className="p-2 bg-muted/30 rounded flex items-center gap-1.5"><ArrowRightIcon size={14} className="text-primary" /> <span className="font-medium">Last Command:</span> {voiceContext?.lastCommand || 'none'}</div>
              <div className="p-2 bg-muted/30 rounded flex items-center gap-1.5"><SettingsIcon size={14} className="text-primary" /> <span className="font-medium">Wake Word Enabled:</span> {settings.wakeWordEnabled.toString()}</div>
              <div className="p-2 bg-muted/30 rounded flex items-center gap-1.5"><CloudIcon size={14} className="text-primary" /> <span className="font-medium">Online Mode:</span> active</div>
            </div>
          </div>
        )}

        {showAnalytics && (
          <div className="mt-4 p-3 bg-card rounded-lg border border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5 text-primary pb-2 border-b border-border"><BarChart2Icon size={16} /> Voice Analytics Dashboard</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-xs font-medium flex items-center gap-1.5"><ActivityIcon size={14} className="text-primary" /> Recognition Accuracy</h4>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-success rounded-full" 
                    style={{ width: `${Math.max(0, recognitionAccuracy * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-right font-mono">{(recognitionAccuracy * 100).toFixed(1)}%</p>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-medium flex items-center gap-1.5"><BookTextIcon size={14} className="text-primary" /> Command Success Rate</h4>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-success rounded-full" 
                    style={{ 
                      width: `${analyticsData.commandSuccess + analyticsData.commandFailure > 0 ? 
                        (analyticsData.commandSuccess / (analyticsData.commandSuccess + analyticsData.commandFailure) * 100) : 0}%` 
                    }}
                  />
                </div>
                <p className="text-xs text-right font-mono">
                  {analyticsData.commandSuccess + analyticsData.commandFailure > 0 ? 
                    (analyticsData.commandSuccess / (analyticsData.commandSuccess + analyticsData.commandFailure) * 100).toFixed(1) : 
                    '0'}%
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-medium flex items-center gap-1.5"><BrainIcon size={14} className="text-primary" /> Command Complexity</h4>
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-lg p-2">
                  <div>
                    <span className="font-medium block">Multi-Command Success:</span> 
                    <span className="font-mono">{analyticsData.multiCommandSuccess || 0}</span>
                  </div>
                  <div>
                    <span className="font-medium block">Avg Commands Per Chain:</span> 
                    <span className="font-mono">{(analyticsData.averageCommandsPerChain || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-medium flex items-center gap-1.5"><CloudIcon size={14} className="text-primary" /> Online Performance</h4>
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-lg p-2">
                  <div>
                    <span className="font-medium block">Response Time:</span> 
                    <span className="font-mono">{(analyticsData.averageResponseTime || 0).toFixed(2)}ms</span>
                  </div>
                  <div>
                    <span className="font-medium block">Commands Processed:</span> 
                    <span className="font-mono">{analyticsData.commandSuccess || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${settings.wakeWordEnabled ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
            <p className="text-sm font-medium">
              {settings.wakeWordEnabled ? 
                speaking ? 'Assistant Speaking...' : 
                listeningForCommand ? 'Listening for Command...' : 
                'Voice Recognition Active - Say "Hey Lark"' 
                : 'Voice Recognition Disabled'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {voiceContext?.isListening ? (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => voiceContext.stopListening()}
                className="h-9"
              >
                <StopCircleIcon className="h-4 w-4 mr-1.5" />
                Stop Listening
              </Button>
            ) : (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => {
                  // Check microphone permission before starting
                  if (voiceContext?.micPermission === 'denied') {
                    // Show message about needing permission
                    setMessages(prev => [...prev, {
                      type: 'assistant',
                      content: 'Microphone permission is required. Please allow microphone access in your browser settings.',
                      timestamp: Date.now()
                    }]);
                  } else if (voiceContext?.micPermission === 'unknown' || voiceContext?.micPermission === 'prompt') {
                    // Request permission explicitly
                    voiceContext.requestMicrophonePermission().then(granted => {
                      if (granted) {
                        console.log('Microphone permission granted, starting listening');
                        voiceContext.startListening();
                      } else {
                        console.error('Microphone permission denied');
                        setMessages(prev => [...prev, {
                          type: 'assistant',
                          content: 'Microphone permission is required for voice recognition.',
                          timestamp: Date.now()
                        }]);
                      }
                    });
                  } else {
                    // Permission already granted, start listening
                    voiceContext.startListening();
                  }
                }}
                className="h-9"
                disabled={!settings.wakeWordEnabled}
              >
                <MicIcon className="h-4 w-4 mr-1.5" />
                Start Listening
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // Test microphone and voice recognition
                console.log('Testing voice recognition...');
                
                // Show initial debug info
                setMessages(prev => [...prev, {
                  type: 'assistant',
                  content: 'Testing voice recognition system. Current state: ' + 
                    (voiceContext?.recognitionState || 'unknown') + 
                    ', Microphone permission: ' + (voiceContext?.micPermission || 'unknown'),
                  timestamp: Date.now()
                }]);
                
                // Force reinitialize voice recognition
                if (voiceContext?.requestMicrophonePermission) {
                  try {
                    const granted = await voiceContext.requestMicrophonePermission();
                    
                    if (granted) {
                      // Success message with instructions
                      setMessages(prev => [...prev, {
                        type: 'assistant',
                        content: '✅ Microphone permission granted! Voice recognition is now ready. Try saying "Hey Lark" followed by a command like "read me my Miranda rights in Spanish".',
                        timestamp: Date.now()
                      }]);
                      
                      // Automatically start listening after permission granted
                      if (voiceContext.startListening && settings.wakeWordEnabled) {
                        setTimeout(() => {
                          voiceContext.startListening();
                          console.log('Auto-started listening after mic permission granted');
                        }, 500);
                      }
                    } else {
                      // Detailed error message with troubleshooting steps
                      setMessages(prev => [...prev, {
                        type: 'assistant',
                        content: '❌ Microphone permission denied. Please check your browser settings:\n\n' +
                          '1. Click the lock/info icon in your browser address bar\n' +
                          '2. Find microphone permissions and set to "Allow"\n' +
                          '3. Reload the page and try again',
                        timestamp: Date.now()
                      }]);
                    }
                  } catch (error) {
                    console.error('Error requesting microphone permission:', error);
                    // Technical error details for debugging
                    setMessages(prev => [...prev, {
                      type: 'assistant',
                      content: `❌ Error requesting microphone permission: ${error.message || 'Unknown error'}. Please try reloading the page.`,
                      timestamp: Date.now()
                    }]);
                  }
                }
              }}
              className="h-9"
            >
              <BugIcon className="h-4 w-4 mr-1.5" />
              Test Mic
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log('Settings clicked')}
              className="h-9"
            >
              <SettingsIcon className="h-4 w-4 mr-1.5" />
              Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistantV2;
