import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { processVoiceCommand, getGeneralKnowledge, assessTacticalSituation } from '../lib/openai-service';
import { processOfflineCommand } from '../lib/offline-commands';
import { useSettings } from '../lib/settings-store';
import { useVoice } from '../contexts/VoiceContext';
import { 
  MicIcon, 
  StopCircleIcon, 
  VolumeIcon, 
  RefreshCwIcon, 
  ShieldIcon, 
  InfoIcon,
  BotIcon,
  UserIcon,
  ArrowRightIcon,
  Volume2Icon,
  AlertTriangleIcon
} from 'lucide-react';
import '../styles/enhanced-voice-assistant.css';

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

export function EnhancedVoiceAssistant() {
  // State management
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [latestAction, setLatestAction] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [currentlyListening, setCurrentlyListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [visualFeedback, setVisualFeedback] = useState<{
    active: boolean,
    intensity: number,
    transcript?: string,
    confidence?: number
  }>({
    active: false,
    intensity: 0
  });
  
  // Get settings from store
  const { settings } = useSettings();

  // Refs for animation
  const audioVisualizerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Function to personalize messages with officer name
  const getPersonalizedMessage = useCallback((baseMsg: string) => {
    const officerName = settings.officerName || localStorage.getItem('lark-officer-name');
    return officerName ? `${baseMsg}, Officer ${officerName}` : baseMsg;
  }, [settings.officerName]);

  // Helper functions for audio feedback
  const playActivationSound = useCallback(() => {
    const audio = new Audio('/sounds/activation.mp3');
    audio.volume = 0.7;
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
  
  // Use the VoiceContext for voice operations
  const { 
    speak, 
    stopSpeaking: stop, 
    isSpeaking: speaking,
    synthesisState
  } = useVoice();

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle wake word detection
  useEffect(() => {
    const handleWakeWordDetected = () => {
      console.log('Wake word detected!');
      setCurrentlyListening(true);
      setVisualFeedback({
        active: true,
        intensity: 0.8
      });
      
      // Add wake word acknowledgment
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: getPersonalizedMessage("I'm listening") 
      }]);
      
      // Speak acknowledgment
      speak(getPersonalizedMessage("I'm listening"));
    };
    
    const handleCommandDetected = (event: CustomEvent) => {
      if (!event.detail?.command) return;
      
      const command = event.detail.command;
      console.log('Command detected:', command);
      
      // Add command to messages
      setMessages(prev => [...prev, { 
        role: 'user', 
        content: command 
      }]);
      
      // Process command
      processCommand(command);
    };
    
    // Add event listeners
    window.addEventListener('lark-wake-word-detected', handleWakeWordDetected as EventListener);
    window.addEventListener('lark-command-detected', handleCommandDetected as EventListener);
    
    return () => {
      window.removeEventListener('lark-wake-word-detected', handleWakeWordDetected as EventListener);
      window.removeEventListener('lark-command-detected', handleCommandDetected as EventListener);
    };
  }, [getPersonalizedMessage, speak]);
  
  // Handle interim transcripts
  useEffect(() => {
    const handleInterimTranscript = (event: CustomEvent) => {
      if (!event.detail?.transcript) return;
      
      setInterimTranscript(event.detail.transcript);
    };
    
    window.addEventListener('lark-interim-transcript', handleInterimTranscript as EventListener);
    
    return () => {
      window.removeEventListener('lark-interim-transcript', handleInterimTranscript as EventListener);
    };
  }, []);
  
  // Handle audio detection visualization
  useEffect(() => {
    const handleAudioDetected = (event: CustomEvent) => {
      if (!event.detail) return;
      
      const { transcript, confidence } = event.detail;
      setVisualFeedback({
        active: true,
        intensity: Math.min(confidence * 2, 1) || 0.5,
        transcript,
        confidence
      });
      
      // Fade out the visualization after 2 seconds
      setTimeout(() => {
        setVisualFeedback(prev => ({...prev, active: false}));
      }, 2000);
    };
    
    window.addEventListener('lark-audio-detected', handleAudioDetected as EventListener);
    
    return () => {
      window.removeEventListener('lark-audio-detected', handleAudioDetected as EventListener);
    };
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Internet connection restored. All features are now available.' 
      }]);
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Internet connection lost. Working in offline mode with limited functionality.' 
      }]);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-start listening on component mount
  useEffect(() => {
    if (hasRecognitionSupport) {
      startListening();
      
      // Initial greeting message
      const initialMessage = getPersonalizedMessage("LARK is ready to roll. How can I assist you?");
      
      setMessages([{ 
        role: 'assistant', 
        content: initialMessage 
      }]);
      
      // Speak the initial greeting with a slight delay to ensure voice context is initialized
      setTimeout(() => {
        console.log('Speaking initial greeting');
        speak(initialMessage);
      }, 1000);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [hasRecognitionSupport, getPersonalizedMessage, startListening, speak]);

  // Process commands
  const processCommand = async (command: string) => {
    if (!command.trim()) return;
    
    setIsProcessing(true);
    
    try {
      let response: CommandResponse;
      
      if (isOffline) {
        // Process command offline
        response = await processOfflineCommand(command);
      } else {
        // Process command online
        response = await processVoiceCommand(command);
      }
      
      // Handle the response
      if (response.executed) {
        setLatestAction(response.action || null);
        
        // Add response to messages
        if (response.result) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: response.result 
          }]);
          
          // Speak the result using LiveKit voice service
          // This will work for both typed and spoken input
          console.log('[EnhancedVoiceAssistant] Speaking command result:', response.result.substring(0, 50) + (response.result.length > 50 ? '...' : ''));
          speak(response.result);
        }
      } else if (response.error) {
        // Handle error
        const errorMessage = `Sorry, I encountered an error: ${response.error}`;
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: errorMessage 
        }]);
        
        // Provide vocal feedback for the error using LiveKit
        console.log('[EnhancedVoiceAssistant] Speaking error message:', errorMessage);
        speak(errorMessage);
      } else if (command.toLowerCase().includes('threat') || command.toLowerCase().includes('danger')) {
        // Special handling for threat assessment
        handleThreatAssessment(command);
      } else {
        // General knowledge query
        handleGeneralQuery(command);
      }
    } catch (error) {
      console.error('Error processing command:', error);
      
      const errorMessage = `Sorry, I couldn't process that command. Please try again.`;
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage 
      }]);
      
      // Provide vocal feedback for the error using LiveKit
      speak(errorMessage);
    } finally {
      setIsProcessing(false);
      setWakeWordDetected(false);
      setCurrentlyListening(false);
      
      // Reset the visual feedback
      setVisualFeedback({
        active: false,
        intensity: 0
      });
    }
  };
  
  // Handle threat assessment
  const handleThreatAssessment = async (query: string) => {
    try {
      const processingMessage = `Analyzing potential threats. Stand by...`;
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: processingMessage 
      }]);
      
      // Provide vocal feedback using LiveKit
      speak(processingMessage);
      
      const threatAnalysis = await assessTacticalSituation(query);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: threatAnalysis 
      }]);
      
      // Speak the threat analysis using LiveKit
      speak(threatAnalysis);
    } catch (error) {
      console.error('Error in threat assessment:', error);
      
      const errorMessage = `Sorry, I couldn't complete the threat assessment. Please try again.`;
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage 
      }]);
      
      // Provide vocal feedback for the error using LiveKit
      speak(errorMessage);
    }
  };
  
  // Handle general knowledge queries
  const handleGeneralQuery = async (query: string) => {
    try {
      const knowledge = await getGeneralKnowledge(query);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: knowledge 
      }]);
      
      // Speak the knowledge response using LiveKit
      speak(knowledge);
    } catch (error) {
      console.error('Error in general query:', error);
      
      const errorMessage = `Sorry, I couldn't find an answer to that. Please try again.`;
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage 
      }]);
      
      // Provide vocal feedback for the error using LiveKit
      speak(errorMessage);
    }
  };

  // UI Controls
  const handleToggleListening = () => {
    if (listening) {
      stopListening();
      setCurrentlyListening(false);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Voice recognition paused.' 
      }]);
    } else {
      startListening();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Voice recognition activated.' 
      }]);
    }
  };
  
  // Reset recognition if it encounters an error
  const handleReset = () => {
    stopListening();
    setTimeout(() => {
      startListening();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Voice recognition system reset.' 
      }]);
    }, 500);
  };

  // Handle text input submission
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && !isProcessing) {
      // Add user message
      setMessages(prev => [...prev, { role: 'user', content: textInput }]);
      
      // Process command - this will trigger voice response via the VoiceContext
      processCommand(textInput);
      
      // Clear input
      setTextInput('');
    }
  };

  // Render the UI with Tesla-inspired design
  return (
    <div className="enhanced-voice-assistant">
      {/* Status indicator - Tesla-inspired */}
      <div className={`lark-status ${currentlyListening ? 'active' : ''}`}>
        <div className="status-indicator">
          <div className="status-dot"></div>
          <div className="status-label">{currentlyListening ? 'Listening' : (listening ? 'Active' : 'Standby')}</div>
        </div>
        
        {interimTranscript && currentlyListening && (
          <div className="interim-transcript">
            {interimTranscript}
          </div>
        )}
      </div>
      
      {/* Tesla-inspired conversation interface */}
      <div className="conversation-container">
        <div className="messages-container">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className="message-icon">
                {message.role === 'user' ? (
                  <UserIcon className="h-4 w-4" />
                ) : (
                  <BotIcon className="h-4 w-4" />
                )}
              </div>
              <div className="message-content">{message.content}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Tesla-inspired control panel */}
        {/* Text input for typed questions */}
        <div className="text-input-container">
          <form onSubmit={handleTextSubmit}>
            <div className="input-wrapper">
              <input 
                type="text" 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your question here..."
                className="text-input"
                disabled={isProcessing}
              />
              <button 
                type="submit" 
                className="send-button"
                disabled={!textInput.trim() || isProcessing}
              >
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        <div className="control-panel">
          <button 
            className={`control-button ${listening ? 'active' : ''}`} 
            onClick={handleToggleListening}
            aria-label={listening ? 'Stop listening' : 'Start listening'}
          >
            {listening ? (
              <StopCircleIcon className="h-5 w-5" />
            ) : (
              <MicIcon className="h-5 w-5" />
            )}
            <span>{listening ? 'Stop' : 'Start'}</span>
          </button>
          
          <button 
            className="control-button" 
            onClick={handleReset}
            aria-label="Reset voice recognition"
          >
            <RefreshCwIcon className="h-5 w-5" />
            <span>Reset</span>
          </button>
          
          <button 
            className={`control-button ${isProcessing ? 'processing' : ''}`}
            disabled={true}
            aria-label="Processing status"
          >
            <ShieldIcon className="h-5 w-5" />
            <span>{isProcessing ? 'Processing' : 'Ready'}</span>
          </button>
          
          {isOffline && (
            <div className="offline-indicator">
              <AlertTriangleIcon className="h-4 w-4" />
              <span>Offline Mode</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Visual feedback when LARK detects audio */}
      <div 
        className={`audio-visualizer ${visualFeedback.active ? 'active' : ''}`}
        ref={audioVisualizerRef}
        style={{
          opacity: visualFeedback.active ? 1 : 0,
        }}
      >
        <div className="visualizer-container">
          <div 
            className="visualizer-bars"
            style={{
              transform: `scale(${visualFeedback.intensity}, ${visualFeedback.intensity})`
            }}
          >
            {[...Array(12)].map((_, index) => (
              <div 
                key={index} 
                className="visualizer-bar"
                style={{
                  height: `${20 + Math.random() * 30}px`,
                  animationDelay: `${index * 0.05}s`
                }}
              ></div>
            ))}
          </div>
          
          {visualFeedback.transcript && (
            <div className="transcript-display">
              <div className="transcript-text">{visualFeedback.transcript}</div>
              <div className="confidence-meter">
                <div 
                  className="confidence-level" 
                  style={{width: `${(visualFeedback.confidence || 0) * 100}%`}}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Error display */}
      {recognitionError && (
        <div className="error-message">
          <AlertTriangleIcon className="h-4 w-4" />
          <span>{recognitionError}</span>
        </div>
      )}
      
      {/* Wake word instruction */}
      <div className="wake-word-instruction">
        <Volume2Icon className="h-4 w-4" />
        <span>Say "Hey LARK" to activate</span>
      </div>
    </div>
  );
}
