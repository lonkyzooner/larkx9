import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useLiveKitVoice } from '../hooks/useLiveKitVoice';
import { processVoiceCommand, getGeneralKnowledge, assessTacticalSituation } from '../lib/openai-service';
import { processOfflineCommand } from '../lib/offline-commands';
import { useSettings } from '../lib/settings-store';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
  ArrowRightIcon
} from 'lucide-react';

// Define the response type for processVoiceCommand
interface CommandResponse {
  action: string;
  executed: boolean;
  result?: string;
  error?: string;
  parameters?: {
    language?: string;
    threat?: string;
    statute?: string;
  };
}

export function VoiceAssistant() {
  // State management
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [latestAction, setLatestAction] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [typingIndex, setTypingIndex] = useState(0);
  const [showTypingEffect, setShowTypingEffect] = useState(false);
  const [currentTypingText, setCurrentTypingText] = useState('');
  
  // Get settings from store
  const { settings } = useSettings();

  // Function to personalize messages with officer name
  const getPersonalizedMessage = useCallback((baseMsg: string) => {
    const officerName = settings.officerName || localStorage.getItem('lark-officer-name');
    return officerName ? `${baseMsg}, Officer ${officerName}` : baseMsg;
  }, [settings.officerName]);

  // Helper functions for audio feedback
  const getUrgencyPrefix = useCallback((action: string) => {
    switch (action.toLowerCase()) {
      case 'threat':
      case 'emergency':
        return '🚨 ';
      case 'miranda':
      case 'rights':
        return '📢 ';
      case 'statute':
      case 'law':
        return '📚 ';
      default:
        return '';
    }
  }, []);

  const playAudioFeedback = useCallback((action: string) => {
    const audio = new Audio();
    switch (action.toLowerCase()) {
      case 'threat':
      case 'emergency':
        audio.src = '/sounds/alert.mp3';
        break;
      case 'miranda':
      case 'rights':
        audio.src = '/sounds/notification.mp3';
        break;
      case 'statute':
      case 'law':
        audio.src = '/sounds/info.mp3';
        break;
      default:
        audio.src = '/sounds/success.mp3';
    }
    audio.play().catch(console.error);
  }, []);
  
  // Hooks
  const { 
    transcript, 
    listening, 
    startListening, 
    stopListening, 
    hasRecognitionSupport,
    error: recognitionError,
    wakeWordDetected,
    setWakeWordDetected
  } = useSpeechRecognition();
  
  const { speak, isSpeaking: speaking, stopSpeaking: stop } = useLiveKitVoice();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Debug state for tracking recognition status
  const [debugStatus, setDebugStatus] = useState('');
  const lastTranscriptRef = useRef('');
  
  // Track last command to prevent duplicates
  const lastCommandRef = useRef<string>('');
  const lastCommandTimeRef = useRef<number>(0);

  // Callback functions
  const simulateTypingEffect = useCallback((text: string) => {
    setCurrentTypingText(text);
    setTypingIndex(0);
    setShowTypingEffect(true);
    setMessages(prev => [...prev, { role: 'assistant', content: text }]);
  }, []);

  // First define the event handlers without the command handling logic
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      simulateTypingEffect('Internet connection restored. All features are now available.');
    };

    const handleOffline = () => {
      setIsOffline(true);
      simulateTypingEffect('Internet connection lost. Only basic commands are available.');
    };
    
    const handleOfficerNameUpdate = (event: CustomEvent) => {
      const { name } = event.detail;
      if (name) {
        simulateTypingEffect(`Officer profile updated. I'll address you as Officer ${name}.`);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('officerNameUpdated', handleOfficerNameUpdate as EventListener);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('officerNameUpdated', handleOfficerNameUpdate as EventListener);
    };
  }, [simulateTypingEffect]);
  
  // Command handling function - moved up to fix the lint error
  const handleCommand = useCallback(async (command: string) => {
    if (!command?.trim()) return;
    
    const now = Date.now();
    const commandLower = command.toLowerCase().trim();
    
    // Prevent duplicate commands within 2 seconds
    if (commandLower === lastCommandRef.current && 
        now - lastCommandTimeRef.current < 2000) {
      console.log('Ignoring duplicate command:', command);
      return;
    }
    
    // Update last command tracking
    lastCommandRef.current = commandLower;
    lastCommandTimeRef.current = now;
    
    // Special handling for "can you hear me"
    if (commandLower.includes('can you hear me')) {
      const response = getPersonalizedMessage('Yes, I can hear you clearly. How can I assist you?');
      simulateTypingEffect(response);
      await speak(response);
      return;
    }
    
    // Check internet connection
    if (isOffline) {
      if (settings.offlineMode.enableCache) {
        // Try to process command using cached data
        const offlineResponse = await processOfflineCommand(command);
        if (offlineResponse) {
          simulateTypingEffect(offlineResponse.result || 'Command processed from cache');
          await speak(offlineResponse.result || 'Command processed from cache');
          return;
        }
      }
      
      const offlineMsg = getPersonalizedMessage('No internet connection. Only basic commands are available');
      simulateTypingEffect(offlineMsg);
      await speak(offlineMsg);
      return;
    }
    
    // Stop current speech if any
    if (speaking) {
      stop();
    }
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: command }]);
    
    // Prevent processing during handling
    setIsProcessing(true);
    console.log('Processing command:', command); // Add logging
    
    try {
      // Process the command with retry logic
      let response: CommandResponse | null = null;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (!response && retryCount <= maxRetries) {
        try {
          response = await processVoiceCommand(command);
          break;
        } catch (error) {
          console.error(`Command processing attempt ${retryCount + 1} failed:`, error);
          retryCount++;
          
          if (retryCount <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          }
        }
      }
      
      if (!response) {
        throw new Error('Failed to process command after retries');
      }
      
      // Set the latest action for UI indication
      setLatestAction(response.action);
      
      // If command wasn't executed successfully, handle the error
      if (!response.executed) {
        const errorMessage = response.error || 'Unable to process command';
        simulateTypingEffect(errorMessage);
        await speak(errorMessage);
        return;
      }
      
      // Handle the command result
      const replyMessage = response.result || 'Command processed successfully';
      
      // Update UI based on action type
      switch (response.action) {
        case 'miranda':
          // Trigger Miranda Rights module
          document.dispatchEvent(new CustomEvent('triggerMiranda', { 
            detail: { language: response.parameters?.language || 'english' } 
          }));
          break;
          
        case 'threat':
          // Trigger threat assessment mode
          document.dispatchEvent(new CustomEvent('triggerThreatScan', { 
            detail: { threat: response.parameters?.threat } 
          }));
          break;
          
        case 'statute':
          // Trigger statute lookup
          document.dispatchEvent(new CustomEvent('triggerStatuteLookup', { 
            detail: { statute: response.parameters?.statute } 
          }));
          break;
          
        case 'tactical':
          // Update tactical display
          document.dispatchEvent(new CustomEvent('updateTacticalDisplay', { 
            detail: { assessment: replyMessage } 
          }));
          break;
      }
      
      // Use typing effect for reply and speak response
      simulateTypingEffect(replyMessage);
      await speak(replyMessage);
      
      // Add visual feedback for command execution with timestamp and urgency level
      const timestamp = new Date().toLocaleTimeString();
      const urgencyPrefix = settings.voicePreferences.urgencyLevels 
        ? getUrgencyPrefix(response.action)
        : '';
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `[${timestamp}] ${urgencyPrefix}\u2713 ${response.action.toUpperCase()} command executed: ${replyMessage}` 
      }]);
      
      // Play audio feedback if enabled
      if (settings.voicePreferences.audioFeedback) {
        playAudioFeedback(response.action);
      }
      
    } catch (error) {
      console.error('Error processing command:', error);
      const timestamp = new Date().toLocaleTimeString();
      let errorMsg = "Sorry, I encountered an error processing your command.";
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to process command after retries')) {
          errorMsg = "I'm having trouble connecting to the server. Please check your connection and try again.";
        } else if (error.message.includes('speech recognition')) {
          errorMsg = "I'm having trouble understanding your voice. Please speak clearly and try again.";
        }
      }
      
      simulateTypingEffect(errorMsg);
      await speak(errorMsg);
      
      // Add detailed error feedback
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `[${timestamp}] \u26a0\ufe0f Error: ${errorMsg}` 
      }]);
      
      // Auto-restart listening after error
      setTimeout(() => {
        if (isActive && !listening) {
          startListening();
        }
      }, 2000);
    } finally {
      setIsProcessing(false);
      setLatestAction(null);
      
      // Resume listening if still active after a short delay
      if (isActive) {
        setTimeout(() => {
          console.log('Resuming listening after command processing');
          if (!listening && isActive) {
            startListening();
          }
        }, 500);
      }
    }
  }, [speak, stop, speaking, simulateTypingEffect, isActive, stopListening, startListening, isOffline, settings, messages, setMessages, listening, getPersonalizedMessage, getUrgencyPrefix, playAudioFeedback]);
  
  // Now set up speech recognition event listeners after handleCommand is defined
  useEffect(() => {
    // Handle speech recognition events
    const handleWakeWordDetected = () => {
      console.log('Wake word detected event received!');
      setDebugStatus('Wake word detected!');
      // Visual feedback that wake word was detected
      setIsActive(true);
    };
    
    const handleCommandDetected = (event: CustomEvent) => {
      const { command } = event.detail;
      console.log('Command detected event received:', command);
      setDebugStatus(`Command detected: ${command}`);
      
      if (command && command.trim()) {
        // Process the voice command
        handleCommand(command);
      }
    };
    
    const handleInterimTranscript = (event: CustomEvent) => {
      const { transcript } = event.detail;
      if (transcript && transcript.trim() && transcript !== lastTranscriptRef.current) {
        lastTranscriptRef.current = transcript;
        setDebugStatus(`Hearing: ${transcript}`);
      }
    };
    
    const handleAudioDetected = () => {
      // Flash some visual feedback when audio is detected
      const indicator = document.getElementById('audio-indicator');
      if (indicator) {
        indicator.classList.add('audio-active');
        setTimeout(() => {
          indicator.classList.remove('audio-active');
        }, 500);
      }
    };
    
    // Add speech recognition event listeners
    window.addEventListener('lark-wake-word-detected', handleWakeWordDetected);
    window.addEventListener('lark-command-detected', handleCommandDetected as EventListener);
    window.addEventListener('lark-interim-transcript', handleInterimTranscript as EventListener);
    window.addEventListener('lark-audio-detected', handleAudioDetected);

    return () => {      
      // Remove speech recognition event listeners
      window.removeEventListener('lark-wake-word-detected', handleWakeWordDetected);
      window.removeEventListener('lark-command-detected', handleCommandDetected as EventListener);
      window.removeEventListener('lark-interim-transcript', handleInterimTranscript as EventListener);
      window.removeEventListener('lark-audio-detected', handleAudioDetected);
    };
  }, [handleCommand]);

  // handleCommand is declared above this line

  // handleCommand is now defined above

  const toggleActivation = useCallback(() => {
    if (isActive) {
      setIsActive(false);
      if (listening) stopListening();
      if (speaking) stop();
      setMessages([]); // Clear messages when deactivating
      setWakeWordDetected(false); // Reset wake word detection state
      setDebugStatus('LARK deactivated');
    } else {
      setIsActive(true);
      setIsProcessing(false);
      setDebugStatus('LARK activated');
      
      // Welcome message with typing effect
      const welcomeMsg = isOffline
        ? 'LARK activated in offline mode. Only basic commands are available.'
        : 'LARK is ready to roll, how can I assist you?';
      
      simulateTypingEffect(welcomeMsg);
      speak(welcomeMsg).then(() => {
        // Wait a bit before starting to listen to avoid picking up the welcome message
        setTimeout(() => {
          if (!recognitionError) {
            // Make sure we're not already listening before starting
            if (!listening) {
              startListening();
              console.log('Started listening after welcome message');
              setDebugStatus('Listening...');
            }
          } else {
            console.error('Speech recognition error:', recognitionError);
            setDebugStatus(`Error: ${recognitionError}`);
            simulateTypingEffect('Sorry, I\'m having trouble with voice recognition. Please try refreshing the page.');
          }
        }, 800); // Reduced delay to ensure faster response
      });
    }
  }, [isActive, listening, speaking, stopListening, stop, startListening, setWakeWordDetected, simulateTypingEffect, speak, isOffline, recognitionError]);
  
  // Ensure listening starts when component mounts if active
  useEffect(() => {
    if (isActive && !listening && !recognitionError) {
      console.log('Auto-starting speech recognition');
      startListening();
      setDebugStatus('Listening started on mount/update');
    }
  }, [isActive, listening, startListening, recognitionError]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    const clearedMessage = "Conversation history cleared.";
    simulateTypingEffect(clearedMessage);
    speak(clearedMessage);
  }, [simulateTypingEffect, speak]);



  // Function to explicitly request microphone permissions
  const requestMicrophonePermission = useCallback(async () => {
    try {
      console.log('Explicitly requesting microphone permission');
      setDebugStatus('Requesting microphone permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      console.log('Microphone permission granted');
      
      // Store permission status in localStorage to remember it
      localStorage.setItem('lark_microphone_permission', 'granted');
      
      // Clean up the stream immediately to avoid holding it unnecessarily
      stream.getTracks().forEach(track => track.stop());
      
      // Now start listening
      setDebugStatus('Microphone access granted. Starting voice recognition...');
      startListening();
      
      // Provide user feedback
      simulateTypingEffect('Microphone access granted! I can hear you now. Try saying "Hey LARK" to activate me.');
      speak('Microphone access granted! I can hear you now. Try saying "Hey LARK" to activate me.');
      
      return true;
    } catch (error) {
      console.error('Failed to get microphone permission:', error);
      setDebugStatus('Microphone permission denied');
      
      // Store permission status in localStorage
      localStorage.setItem('lark_microphone_permission', 'denied');
      
      // Provide user feedback
      simulateTypingEffect('Microphone access denied. Please check your browser settings and try again.');
      speak('Microphone access denied. Please check your browser settings and try again.');
      
      return false;
    }
  }, [setDebugStatus, startListening, simulateTypingEffect, speak]);
  
  // Handle microphone events
  useEffect(() => {
    const handleMicrophoneRequest = () => {
      setDebugStatus('Permission requested by speech recognition system');
    };
    
    const handleMicrophoneError = (event: CustomEvent) => {
      const { message } = event.detail;
      setDebugStatus(`Microphone error: ${message || 'Access denied'}`);
      
      // Show a visual prompt to the user
      const permissionContainer = document.getElementById('permission-request');
      if (permissionContainer) {
        permissionContainer.style.display = 'flex';
      }
    };
    
    // Listen for microphone-related events
    window.addEventListener('lark-requesting-microphone', handleMicrophoneRequest);
    window.addEventListener('lark-microphone-error', handleMicrophoneError as EventListener);
    
    return () => {
      window.removeEventListener('lark-requesting-microphone', handleMicrophoneRequest);
      window.removeEventListener('lark-microphone-error', handleMicrophoneError as EventListener);
    };
  }, []);

  // Track microphone permission state to prevent spazzing
  const [micPermissionState, setMicPermissionState] = useState<'unknown' | 'granted' | 'denied'>(() => {
    const storedPermission = localStorage.getItem('lark_microphone_permission');
    if (storedPermission === 'granted') return 'granted';
    if (storedPermission === 'denied') return 'denied';
    return 'unknown';
  });
  
  // Helper function to check if we should attempt to listen
  const shouldAttemptListening = useCallback(() => {
    return micPermissionState !== 'denied';
  }, [micPermissionState]);

  // Ensure continuous listening when active
  useEffect(() => {
    // Only attempt to restart listening if microphone permission is not denied
    if (isActive && !listening && !speaking && !isProcessing && shouldAttemptListening()) {
      console.log('Restarting listening - detected inactive state');
      setTimeout(() => {
        if (isActive && !listening && !speaking && !isProcessing && shouldAttemptListening()) {
          console.log('Initiating listening after state check');
          startListening();
          
          // Add visual indicator that LARK is listening
          const statusElement = document.querySelector('.listening-status');
          if (statusElement) {
            statusElement.textContent = 'Listening...';
            statusElement.classList.add('listening-active');
          }
          
          // Play a subtle sound to indicate listening started
          try {
            const audioFeedback = new Audio();
            audioFeedback.src = '/sounds/success.mp3';
            audioFeedback.volume = 0.2;
            audioFeedback.play();
          } catch (err) {
            console.error('Could not play listening sound:', err);
          }
        }
      }, 300);
    }
    
    // Setup a periodic check to ensure listening is active - but only if permission is granted
    const listeningCheck = setInterval(() => {
      // Check localStorage each time to get the latest permission status
      const currentPermission = localStorage.getItem('lark_microphone_permission');
      if (currentPermission === 'granted') {
        setMicPermissionState('granted');
      } else if (currentPermission === 'denied') {
        setMicPermissionState('denied');
      }
      
      if (isActive && !listening && !speaking && !isProcessing && shouldAttemptListening()) {
        console.log('Periodic listening check - restarting listening');
        startListening();
      }
    }, 5000); // Check every 5 seconds
    
    return () => {
      clearInterval(listeningCheck);
    };
  }, [isActive, listening, speaking, isProcessing, startListening, micPermissionState]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isProcessing]);

  // Typing effect animation
  useEffect(() => {
    if (!showTypingEffect) return;
    
    if (typingIndex < currentTypingText.length) {
      const timerId = setTimeout(() => {
        setTypingIndex(prev => prev + 1);
      }, 30); // Adjust speed as needed
      
      return () => clearTimeout(timerId);
    } else {
      setShowTypingEffect(false);
    }
  }, [typingIndex, currentTypingText, showTypingEffect]);

  // Process transcript when it changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (transcript && isActive && !isProcessing) {
      // Add a small delay to allow for complete sentences
      timeoutId = setTimeout(() => {
        console.log('Processing command with transcript:', transcript);
        setDebugStatus(`Processing: ${transcript}`);
        
        // Add visual feedback that command was heard
        const feedbackElement = document.createElement('div');
        feedbackElement.id = 'voice-feedback';
        feedbackElement.textContent = `Command heard: ${transcript}`;
        feedbackElement.style.position = 'fixed';
        feedbackElement.style.bottom = '20px';
        feedbackElement.style.left = '50%';
        feedbackElement.style.transform = 'translateX(-50%)';
        feedbackElement.style.backgroundColor = 'rgba(10, 132, 255, 0.8)';
        feedbackElement.style.color = 'white';
        feedbackElement.style.padding = '10px 20px';
        feedbackElement.style.borderRadius = '20px';
        feedbackElement.style.zIndex = '9999';
        document.body.appendChild(feedbackElement);
        
        // Update the audio indicator to show active processing
        const indicator = document.getElementById('audio-indicator');
        if (indicator) {
          indicator.style.backgroundColor = '#10b981'; // Green for active
          indicator.style.boxShadow = '0 0 8px #10b981';
          
          // Reset after 1 second
          setTimeout(() => {
            if (indicator) {
              indicator.style.backgroundColor = '';
              indicator.style.boxShadow = '';
            }
          }, 1000);
        }
        
        // Remove feedback after 3 seconds
        setTimeout(() => {
          if (document.body.contains(feedbackElement)) {
            document.body.removeChild(feedbackElement);
          }
        }, 3000);
        
        handleCommand(transcript);
      }, 500); // Reduced delay for faster response
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [transcript, isActive, isProcessing, handleCommand]);

  // Thinking dots animation
  useEffect(() => {
    if (!isProcessing) return;
    
    const animateDots = () => {
      // Removed thinking dots animation
    };
    
    const intervalId = setInterval(animateDots, 500);
    return () => clearInterval(intervalId);
  }, [isProcessing]);

  // Render UI for browsers that don't support speech recognition
  if (!hasRecognitionSupport) {
    return (
      <div className="p-6">
        <div className="bg-[#1c1c1e] rounded-xl p-6 border border-[#2c2c2e] shadow-lg">
          {/* Audio status indicator */}
          <div className="mb-3 flex items-center justify-between bg-[#2c2c2e] px-3 py-2 rounded-lg">
            <div className="text-xs text-[#8e8e93]">
              {listening ? 'Listening for wake word "Hey LARK"...' : 'Voice recognition inactive'}
            </div>
            <div id="audio-indicator" className="h-3 w-3 rounded-full bg-[#8e8e93] transition-all duration-300"></div>
          </div>
          <h2 className="text-[#ff453a] text-lg font-medium mb-3">Speech Recognition Not Supported</h2>
          <p className="text-[#8e8e93] mb-4">
            Your browser doesn't support speech recognition. LARK requires a modern browser with speech recognition capabilities.
          </p>
          <div className="bg-[#2c2c2e] p-4 rounded-lg">
            <h3 className="text-white text-sm font-medium mb-2">Recommended browsers:</h3>
            <ul className="text-[#8e8e93] text-sm space-y-1">
              <li>• Google Chrome (recommended)</li>
              <li>• Microsoft Edge</li>
              <li>• Safari (macOS)</li>
              <li>• Opera</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="p-0 h-[530px] relative overflow-hidden">
      {/* Microphone Permission Request Overlay */}
      <div id="permission-request" style={{ 
        display: 'none', 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        backgroundColor: 'rgba(0,0,0,0.8)', 
        zIndex: 1000,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{ 
          backgroundColor: '#1c1c1e', 
          padding: '2rem', 
          borderRadius: '1rem',
          maxWidth: '500px',
          textAlign: 'center',
          border: '1px solid #2c2c2e'
        }}>
          <h2 style={{ marginBottom: '1rem', color: 'white' }}>Microphone Access Required</h2>
          <p style={{ marginBottom: '1.5rem', color: '#8e8e93' }}>LARK needs access to your microphone to listen for voice commands. Without this permission, voice recognition won't work.</p>
          <Button 
            onClick={requestMicrophonePermission} 
            className="bg-[#0a84ff] hover:bg-[#419cff] text-white shadow-[0_0_10px_rgba(10,132,255,0.3)] border-0 px-4 py-2 rounded-full"
          >
            Grant Microphone Access
          </Button>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#8e8e93' }}>You can also manually enable microphone access in your browser settings.</p>
        </div>
      </div>
      
      <div className="absolute inset-0 bg-[#1c1c1e] opacity-50 -z-10"></div>
      
      {/* Top control bar */}
      <div className="p-5 backdrop-blur-sm border-b border-[#2c2c2e]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BotIcon className="h-5 w-5 text-[#0a84ff]" />
            <h2 className="text-white text-lg font-medium">LARK Assistant</h2>
            <Badge 
              className={isActive 
                ? "bg-[#30d158] border-0 text-black font-medium text-xs rounded-full px-2.5 py-0.5 animate-pulse" 
                : "bg-[#2c2c2e] border-0 text-[#8e8e93] font-medium text-xs rounded-full px-2.5 py-0.5"}
            >
              {isActive ? "ACTIVE" : "INACTIVE"}
            </Badge>
            {isActive && (
              <span className="listening-status text-xs text-[#0a84ff] ml-2">
                {listening ? "Listening..." : "Ready"}
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearConversation}
                className="rounded-full h-9 w-9 p-0 flex items-center justify-center bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#8e8e93] transition-colors"
                disabled={isProcessing}
              >
                <RefreshCwIcon className="h-4 w-4" />
              </Button>
            )}
            
            {/* Microphone permission button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={requestMicrophonePermission}
              className="rounded-full h-9 w-9 p-0 flex items-center justify-center bg-[#2c2c2e] hover:bg-[#3a3a3c] text-[#8e8e93] transition-colors"
              title="Grant microphone access"
            >
              <MicIcon className="h-4 w-4" />
            </Button>
            
            <Button 
              onClick={toggleActivation}
              className={`rounded-full h-9 px-4 border-0 transition-all ${isActive 
                ? "bg-[#ff453a] hover:bg-[#ff6961] text-white shadow-[0_0_10px_rgba(255,69,58,0.3)]" 
                : "bg-[#0a84ff] hover:bg-[#419cff] text-white shadow-[0_0_10px_rgba(10,132,255,0.3)]"}`}
            >
              {isActive ? "Stop" : "Start"}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Messages area */}
      <div className="px-5 py-3 overflow-hidden h-[400px]">
        <div className="overflow-y-auto h-full pr-1 scrollbar-thin scrollbar-thumb-[#3a3a3c] scrollbar-track-transparent">
          {messages.length === 0 ? (
            <div className="h-full min-h-[340px] flex items-center justify-center flex-col gap-4">
              <div className="w-16 h-16 rounded-full bg-[#0a84ff]/10 flex items-center justify-center">
                <BrainIcon className="w-8 h-8 text-[#0a84ff]" />
              </div>
              <div className="text-center max-w-xs">
                <p className="text-white font-medium">Activate LARK to begin</p>
                <p className="text-sm mt-2 text-[#8e8e93]">Ask me anything about law enforcement, procedures, or legal questions.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-[#2c2c2e] flex-shrink-0 flex items-center justify-center mr-2 mt-1">
                      <BotIcon className="w-4 h-4 text-[#0a84ff]" />
                    </div>
                  )}
                  
                  <div 
                    className={`rounded-2xl px-4 py-3 max-w-[85%] transition-all ${
                      msg.role === 'user' 
                        ? 'bg-[#0a84ff] text-white rounded-tr-none shadow-lg shadow-[#0a84ff]/10' 
                        : 'bg-[#2c2c2e] text-white rounded-tl-none shadow-lg shadow-black/5'
                    }`}
                  >
                    {index === messages.length - 1 && msg.role === 'assistant' && showTypingEffect ? (
                      <p className="text-sm leading-relaxed whitespace-pre-line">
                        {currentTypingText.substring(0, typingIndex)}
                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-400 animate-blink align-text-bottom"></span>
                      </p>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                    )}
                  </div>
                  
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-[#0a84ff] flex-shrink-0 flex items-center justify-center ml-2 mt-1">
                      <UserIcon className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              
              {isProcessing && !showTypingEffect && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-[#2c2c2e] flex-shrink-0 flex items-center justify-center mr-2 mt-1">
                    <BotIcon className="w-4 h-4 text-[#0a84ff]" />
                  </div>
                  <div className="bg-[#2c2c2e] text-white rounded-2xl rounded-tl-none px-4 py-3 shadow-lg shadow-black/5">
                    <div className="flex items-center gap-2 h-6">
                      {latestAction === 'miranda' && <BookTextIcon className="h-4 w-4 text-[#0a84ff]" />}
                      {latestAction === 'statute' && <ShieldIcon className="h-4 w-4 text-[#0a84ff]" />}
                      {latestAction === 'threat' && <AlertTriangleIcon className="h-4 w-4 text-[#0a84ff]" />}
                      {latestAction === 'tactical' && <ShieldIcon className="h-4 w-4 text-[#0a84ff]" />}
                      {(latestAction === 'general_query' || !latestAction) && <BrainIcon className="h-4 w-4 text-[#0a84ff]" />}
                      
                      <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-[#0a84ff] animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-[#0a84ff] animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                        <span className="w-2 h-2 rounded-full bg-[#0a84ff] animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
      
      {/* Input area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#2c2c2e] backdrop-blur-md bg-[#1c1c1e]/70">
        <div className="flex items-center relative">
          <div className="flex-1 text-[#8e8e93] text-sm">
            {listening ? (
              <div className="bg-[#2c2c2e] rounded-full px-4 py-3 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff453a] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff453a]"></span>
                </span>
                <span className="flex-1">Listening...</span>
                <Button 
                  size="icon" 
                  className="rounded-full h-7 w-7 p-0 bg-[#3a3a3c] hover:bg-[#48484a] border-0 text-[#ff453a]"
                  onClick={stopListening}
                >
                  <StopCircleIcon size={15} />
                </Button>
              </div>
            ) : (
              <div className="bg-[#2c2c2e] rounded-full px-4 py-3 flex items-center gap-2">
                <InfoIcon className="h-4 w-4 text-[#8e8e93]" />
                <span className="flex-1">{isActive ? "Say something..." : "Start LARK to begin voice assistant"}</span>
                {isActive && (
                  <Button 
                    size="icon" 
                    className="rounded-full h-7 w-7 p-0 bg-[#3a3a3c] hover:bg-[#48484a] border-0 text-[#0a84ff]"
                    onClick={startListening}
                    disabled={!isActive}
                  >
                    <MicIcon size={15} />
                  </Button>
                )}
              </div>
            )}
          </div>
          
          {isActive && !listening && !isProcessing && (
            <Button 
              className="ml-2 rounded-full h-10 w-10 p-0 bg-[#0a84ff] hover:bg-[#419cff] border-0 text-white shadow-lg shadow-[#0a84ff]/20"
            >
              <ArrowRightIcon size={18} />
            </Button>
          )}
          
          {speaking && (
            <Button 
              size="icon" 
              className="ml-2 rounded-full h-10 w-10 p-0 bg-[#ff9500] hover:bg-[#ffaa33] border-0 text-white shadow-lg shadow-[#ff9500]/20"
              onClick={stop}
            >
              <VolumeIcon size={18} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
