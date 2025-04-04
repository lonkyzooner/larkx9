import { useState, useEffect, useRef } from 'react';
import { useUniHikerVoice } from '../contexts/UniHikerVoiceContext';
import { Activity, Mic, Volume2, AlertTriangle, CheckCircle2, BatteryMedium, WifiIcon } from 'lucide-react';
import { Button } from './ui/button';
import '../styles/voice-first.css';

// Define the possible states for the voice assistant
type AssistantState = 'idle' | 'listening' | 'processing' | 'responding' | 'error';

/**
 * VoiceFirstInterface - A simplified, voice-driven interface for LARK on UniHiker
 * 
 * This component implements a single-screen, always-listening interface that
 * responds to "Hey LARK" as a wake word and provides visual feedback about
 * the current state of the assistant.
 */
const VoiceFirstInterface = () => {
  // State
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [isWakeWordActive, setIsWakeWordActive] = useState<boolean>(true);
  const [batteryLevel, setBatteryLevel] = useState<number>(85);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [showDebug, setShowDebug] = useState<boolean>(false);
  
  // References
  const recognitionRef = useRef<any>(null);
  const wakeWordTimerRef = useRef<number | null>(null);
  
  // Get voice context
  const { 
    speak, 
    isSpeaking, 
    stopSpeaking, 
    connect, 
    isConnected,
    requestMicrophonePermission,
    micPermission,
    debugInfo
  } = useUniHikerVoice();

  // Connect to voice service on component mount
  useEffect(() => {
    const initializeVoice = async () => {
      try {
        if (!isConnected) {
          await connect();
          console.log('[VoiceFirstInterface] Connected to voice service');
        }
      } catch (error) {
        console.error('[VoiceFirstInterface] Error connecting to voice service:', error);
        setAssistantState('error');
      }
    };

    initializeVoice();
    
    // Request microphone permission
    const requestMic = async () => {
      const result = await requestMicrophonePermission();
      if (result) {
        initializeWakeWordDetection();
      } else {
        console.warn('[VoiceFirstInterface] Microphone permission denied, wake word detection disabled');
        // We can still use text-to-speech with our fallback
      }
    };
    
    requestMic();
    
    // Simulate battery drain
    const batteryInterval = setInterval(() => {
      setBatteryLevel(prev => Math.max(prev - 1, 10));
    }, 300000); // Every 5 minutes
    
    // Check network status
    const handleNetworkChange = () => {
      setIsOnline(navigator.onLine);
    };
    
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    
    // Cleanup
    return () => {
      clearInterval(batteryInterval);
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      if (wakeWordTimerRef.current) {
        clearTimeout(wakeWordTimerRef.current);
      }
    };
  }, [connect, isConnected, requestMicrophonePermission]);

  // Initialize wake word detection
  const initializeWakeWordDetection = () => {
    // Check if the browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('[VoiceFirstInterface] Speech recognition not supported');
      return;
    }
    
    // Create a new recognition instance
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    // Configure recognition
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    // Handle results
    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.toLowerCase();
      
      console.log('[VoiceFirstInterface] Transcript:', transcript);
      setTranscript(transcript);
      
      // Check for wake word
      if (isWakeWordActive && (transcript.includes('hey lark') || transcript.includes('hey clark') || transcript.includes('hey mark'))) {
        handleWakeWord();
      }
    };
    
    // Handle errors
    recognition.onerror = (event: any) => {
      console.error('[VoiceFirstInterface] Recognition error:', event.error);
      
      // Restart recognition after error
      if (event.error !== 'no-speech') {
        recognition.stop();
        setTimeout(() => {
          if (isWakeWordActive) {
            recognition.start();
          }
        }, 1000);
      }
    };
    
    // Handle end of recognition
    recognition.onend = () => {
      // Restart recognition if it ends and wake word is active
      if (isWakeWordActive) {
        recognition.start();
      }
    };
    
    // Start recognition
    try {
      recognition.start();
      console.log('[VoiceFirstInterface] Wake word detection started');
    } catch (error) {
      console.error('[VoiceFirstInterface] Error starting recognition:', error);
    }
  };

  // Handle wake word detection
  const handleWakeWord = () => {
    console.log('[VoiceFirstInterface] Wake word detected!');
    
    // Stop the current recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    // Disable wake word detection temporarily
    setIsWakeWordActive(false);
    
    // Update state
    setAssistantState('listening');
    
    // Provide audio feedback with Ash voice
    speak('I\'m listening', 'ash');
    
    // Start a new recognition session for the command
    startCommandRecognition();
    
    // Set a timeout to go back to wake word detection if no command is received
    wakeWordTimerRef.current = window.setTimeout(() => {
      setAssistantState('idle');
      setIsWakeWordActive(true);
      initializeWakeWordDetection();
    }, 10000); // 10 seconds timeout
  };

  // Start command recognition
  const startCommandRecognition = () => {
    // Check if the browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('[VoiceFirstInterface] Speech recognition not supported');
      return;
    }
    
    // Create a new recognition instance for the command
    const commandRecognition = new SpeechRecognition();
    
    // Configure recognition
    commandRecognition.continuous = false;
    commandRecognition.interimResults = false;
    commandRecognition.lang = 'en-US';
    
    // Handle results
    commandRecognition.onresult = (event: any) => {
      const command = event.results[0][0].transcript;
      console.log('[VoiceFirstInterface] Command received:', command);
      
      // Clear the wake word timer
      if (wakeWordTimerRef.current) {
        clearTimeout(wakeWordTimerRef.current);
        wakeWordTimerRef.current = null;
      }
      
      // Process the command
      processCommand(command);
    };
    
    // Handle errors
    commandRecognition.onerror = (event: any) => {
      console.error('[VoiceFirstInterface] Command recognition error:', event.error);
      setAssistantState('error');
      
      // Go back to wake word detection
      setIsWakeWordActive(true);
      initializeWakeWordDetection();
    };
    
    // Handle end of recognition
    commandRecognition.onend = () => {
      // If we're still in listening state, it means no command was recognized
      if (assistantState === 'listening') {
        setAssistantState('idle');
        setIsWakeWordActive(true);
        initializeWakeWordDetection();
      }
    };
    
    // Start recognition
    try {
      commandRecognition.start();
    } catch (error) {
      console.error('[VoiceFirstInterface] Error starting command recognition:', error);
      setAssistantState('error');
      
      // Go back to wake word detection
      setIsWakeWordActive(true);
      initializeWakeWordDetection();
    }
  };

  // Process the command
  const processCommand = async (command: string) => {
    try {
      setLastCommand(command);
      setAssistantState('processing');
      
      // Simple command handling for demonstration
      let response = '';
      
      // Process different command types
      if (command.toLowerCase().includes('miranda')) {
        response = "You have the right to remain silent. Anything you say can and will be used against you in a court of law. You have the right to an attorney. If you cannot afford an attorney, one will be provided for you.";
      } 
      else if (command.toLowerCase().includes('statute') || command.toLowerCase().includes('law')) {
        response = "Louisiana Revised Statute 14:67 defines theft as the misappropriation or taking of anything of value which belongs to another, either without the consent of the other to the misappropriation or taking, or by means of fraudulent conduct, practices, or representations.";
      }
      else if (command.toLowerCase().includes('threat') || command.toLowerCase().includes('danger')) {
        response = "Scanning environment for threats. No immediate threats detected. Remain vigilant and maintain situational awareness.";
      }
      else if (command.toLowerCase().includes('battery') || command.toLowerCase().includes('power')) {
        response = `Current battery level is ${batteryLevel} percent.`;
      }
      else if (command.toLowerCase().includes('help') || command.toLowerCase().includes('what can you do')) {
        response = "I can read Miranda rights, look up Louisiana statutes, scan for threats, report battery status, and assist with various law enforcement tasks. Just ask me what you need.";
      }
      else {
        // Default response
        response = "I'm sorry, I didn't understand that command. You can ask me about Miranda rights, Louisiana statutes, threat detection, or say 'help' for more options.";
      }
      
      setResponse(response);
      setAssistantState('responding');
      
      // Speak the response with Ash voice
      await speak(response, 'ash');
      
      // Reset after speaking
      setAssistantState('idle');
      setIsWakeWordActive(true);
      initializeWakeWordDetection();
    } catch (error) {
      console.error('[VoiceFirstInterface] Error processing command:', error);
      setAssistantState('error');
      
      // Go back to wake word detection
      setIsWakeWordActive(true);
      initializeWakeWordDetection();
    }
  };

  // Manual trigger for testing
  const handleManualTrigger = () => {
    if (assistantState === 'idle') {
      handleWakeWord();
    } else if (assistantState === 'responding' && isSpeaking) {
      stopSpeaking();
      setAssistantState('idle');
      setIsWakeWordActive(true);
      initializeWakeWordDetection();
    }
  };

  // Render assistant state icon
  const renderStateIcon = () => {
    switch (assistantState) {
      case 'idle':
        return <Mic className="state-icon pulse-slow" />;
      case 'listening':
        return <Mic className="state-icon pulse" />;
      case 'processing':
        return <Activity className="state-icon spin" />;
      case 'responding':
        return <Volume2 className="state-icon wave" />;
      case 'error':
        return <AlertTriangle className="state-icon shake" />;
      default:
        return <Mic className="state-icon" />;
    }
  };

  // Render assistant state text
  const getStateText = () => {
    switch (assistantState) {
      case 'idle':
        return 'Say "Hey LARK" to activate';
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'responding':
        return 'Responding...';
      case 'error':
        return 'Error occurred';
      default:
        return 'Ready';
    }
  };

  return (
    <div className="voice-first-container">
      {/* Status bar */}
      <div className="status-bar">
        <div className="status-item">
          <BatteryMedium className={`status-icon ${batteryLevel < 20 ? 'text-destructive' : ''}`} />
          <span>{batteryLevel}%</span>
        </div>
        <div className="status-item">
          <WifiIcon className={`status-icon ${isOnline ? 'text-success' : 'text-destructive'}`} />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        {micPermission === 'granted' ? (
          <div className="status-item text-success">
            <Mic className="status-icon" />
            <span>Active</span>
          </div>
        ) : (
          <div className="status-item text-destructive">
            <Mic className="status-icon" />
            <span>Disabled</span>
          </div>
        )}
      </div>
      
      {/* Main content */}
      <div className="main-content">
        <div className="logo-container">
          <h1 className="logo">
            <span className="text-primary">L</span>ARK
          </h1>
          <p className="subtitle">Law Enforcement Assistance and Response Kit</p>
        </div>
        
        <div className="state-container">
          <div className={`state-indicator ${assistantState}`}>
            {renderStateIcon()}
          </div>
          <p className="state-text">{getStateText()}</p>
        </div>
        
        {lastCommand && (
          <div className="transcript-container">
            <p className="transcript-label">Last command:</p>
            <p className="transcript">{lastCommand}</p>
          </div>
        )}
        
        {response && assistantState === 'responding' && (
          <div className="response-container">
            <p className="response">{response}</p>
          </div>
        )}
        
        <div className="controls">
          <Button 
            variant="outline" 
            size="lg" 
            className="control-button"
            onClick={handleManualTrigger}
          >
            {assistantState === 'responding' ? 'Stop' : 'Activate LARK'}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="debug-button"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </Button>
        </div>
      </div>
      
      {/* Debug panel */}
      {showDebug && (
        <div className="debug-panel">
          <h3>Debug Information</h3>
          <p>Microphone: {micPermission}</p>
          <p>Assistant State: {assistantState}</p>
          <p>Wake Word Active: {isWakeWordActive ? 'Yes' : 'No'}</p>
          <p>Speaking: {isSpeaking ? 'Yes' : 'No'}</p>
          <div className="debug-log">
            {debugInfo.slice(-5).map((log, index) => (
              <p key={index} className="debug-log-entry">{log}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceFirstInterface;
