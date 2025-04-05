import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BehaviorSubject } from 'rxjs';
import { 
  MicIcon, 
  StopCircleIcon, 
  VolumeIcon, 
  Volume2Icon,
  Volume1Icon,
  VolumeXIcon,
  RefreshCwIcon, 
  ShieldIcon, 
  InfoIcon,
  BotIcon,
  UserIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  Loader2Icon,
  ZapIcon
} from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { processVoiceCommand, getGeneralKnowledge, assessTacticalSituation } from '../lib/openai-service';
import { processOfflineCommand } from '../lib/offline-commands';
import { useSettings } from '../lib/settings-store';
import { liveKitVoiceService } from '../services/livekit/LiveKitVoiceService';
import { voiceSynthesisService } from '../services/voice/VoiceSynthesisService';
import { openAIVoiceService } from '../services/voice/OpenAIVoiceService';
import { groqService } from '../services/groq/GroqService';
import { commandProcessingService } from '../services/voice/CommandProcessingService';
import { voiceRecognitionService } from '../services/voice/VoiceRecognitionService';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { useToast } from './ui/use-toast';
import '../styles/unified-voice-assistant.css';

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

// Define CommandResult interface to match expected properties
interface CommandResult {
  executed: boolean;
  result?: string;
  parameters?: {
    language?: string;
    threat?: string;
    statute?: string;
  };
}

// Define CommandProcessingResult interface
interface CommandProcessingResult {
  result: string;
}

// Voice synthesis status types
type VoiceSynthesisStatus = 'idle' | 'speaking' | 'error' | 'fallback';
type MicrophoneStatus = 'unknown' | 'granted' | 'denied' | 'prompt';

export function UnifiedVoiceAssistant() {
  // State management
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [latestAction, setLatestAction] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [currentlyListening, setCurrentlyListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceSynthesisStatus>('idle');
  const [micStatus, setMicStatus] = useState<MicrophoneStatus>('unknown');
  const [useGroq, setUseGroq] = useState(true); // Use Groq by default for faster processing
  const [visualFeedback, setVisualFeedback] = useState<{
    active: boolean,
    intensity: number,
    transcript?: string,
    confidence?: number
  }>({
    active: false,
    intensity: 0
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const audioVisualizerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Get settings from store
  const { settings } = useSettings();
  const { toast } = useToast();

  // Speech recognition hook
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
  
  // We'll implement our own interim results handling
  const resetTranscript = () => setTextInput('');

  // Function to personalize messages with officer name
  const personalizeMessage = (message: string): string => {
    if (settings.officerName && message.includes('[OFFICER_NAME]')) {
      return message.replace(/\[OFFICER_NAME\]/g, settings.officerName);
    }
    return message;
  };

  // Initialize voice synthesis and microphone status
  useEffect(() => {
    // Subscribe to LiveKit voice service speaking state
    const speakingSub = voiceSynthesisService.getSpeakingState().subscribe(speaking => {
      setIsSpeaking(speaking);
      if (speaking) {
        setVoiceStatus('speaking');
      } else if (voiceStatus === 'speaking') {
        setVoiceStatus('idle');
      }
    });

    // Subscribe to LiveKit voice service synthesis state
    const synthesisSub = voiceSynthesisService.getSynthesisState().subscribe(state => {
      if (state === 'error') {
        setVoiceStatus('error');
        toast({
          title: "Voice Synthesis Error",
          description: "There was an error with voice synthesis. Using fallback method.",
          variant: "destructive"
        });
      } else if (state === 'idle' && voiceStatus === 'speaking') {
        setVoiceStatus('idle');
      }
    });

    // Check microphone permission
    const checkMicPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStatus('granted');
        // Store the stream for visualization
        micStreamRef.current = stream;
        setupAudioVisualization(stream);
        return stream;
      } catch (error) {
        console.warn('Microphone permission denied or error:', error);
        setMicStatus('denied');
        return null;
      }
    };

    checkMicPermission();

    // Setup network status monitoring
    const handleNetworkChange = () => {
      setIsOffline(!navigator.onLine);
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    // Cleanup
    return () => {
      speakingSub.unsubscribe();
      synthesisSub.unsubscribe();
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Setup audio visualization
  const setupAudioVisualization = (stream: MediaStream) => {
    if (!audioVisualizerRef.current) return;

    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;

    // Create analyzer
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Connect microphone to analyzer
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    // Start visualization
    visualizeAudio();
  };

  // Audio visualization function
  const visualizeAudio = () => {
    if (!analyserRef.current || !audioVisualizerRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (!analyserRef.current || !audioVisualizerRef.current) return;
      
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      // Update visual feedback
      if (currentlyListening) {
        setVisualFeedback({
          active: true,
          intensity: average / 255,
          transcript: interimTranscript || transcript,
          confidence: 0.8 // Placeholder, could be calculated from recognition results
        });
      } else {
        setVisualFeedback({
          active: false,
          intensity: 0
        });
      }
    };
    
    draw();
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle transcript changes
  useEffect(() => {
    if (listening && transcript) {
      setInterimTranscript(transcript);
    } else if (!listening) {
      setInterimTranscript('');
    }
  }, [listening, transcript]);

  // Process final transcript
  useEffect(() => {
    if (!listening && transcript && transcript.trim() !== '') {
      handleUserInput(transcript);
      resetTranscript();
    }
  }, [listening, transcript]);

  // Toggle listening state
  const toggleListening = useCallback(() => {
    if (currentlyListening) {
      stopVoiceRecognition();
    } else {
      startVoiceRecognition();
    }
  }, [currentlyListening]);

  // Start voice recognition
  const startVoiceRecognition = () => {
    voiceRecognitionService.startListening();
    setCurrentlyListening(true);
  };

  // Stop voice recognition
  const stopVoiceRecognition = () => {
    // Call the method to stop listening
    voiceRecognitionService.stopListening();
    setCurrentlyListening(false);
    setInterimTranscript('');
  };

  // Handle user input (voice or text) with improved performance
  const handleUserInput = async (input: string) => {
    if (!input.trim()) return;
    
    // Update UI immediately for better responsiveness
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setIsProcessing(true);
    setTextInput('');
    
    // Scroll to bottom immediately for better UX
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 0);
    
    try {
      let response: string;
      
      // Check if we're offline
      if (isOffline) {
        // Process command offline
        const offlineResponse = await processOfflineCommand(input);
        response = offlineResponse.result || 'Command processed offline';
        setLatestAction(offlineResponse.action);
        
        // Handle special command responses
        if (commandResponse.parameters) {
          // Process all command parameters in parallel for better performance
          const promises: Promise<void>[] = [];
          
          if (commandResponse.parameters.language) {
            // Trigger Miranda rights in the specified language
            promises.push(new Promise<void>(resolve => {
              document.dispatchEvent(new CustomEvent('miranda-language-selected', {
                detail: { language: commandResponse.parameters.language }
              }));
              resolve();
            }));
          }
          
          if (commandResponse.parameters.threat) {
            // Trigger threat detection with the specified type
            promises.push(new Promise<void>(resolve => {
              document.dispatchEvent(new CustomEvent('threat-detected', {
                detail: { type: commandResponse.parameters.threat }
              }));
              resolve();
            }));
          }
          
          if (commandResponse.parameters.statute) {
            // Trigger statute lookup
            promises.push(new Promise<void>(resolve => {
              document.dispatchEvent(new CustomEvent('statute-lookup', {
                detail: { code: commandResponse.parameters.statute }
              }));
              resolve();
            }));
          }
          
          // Wait for all events to be dispatched
          if (promises.length > 0) {
            await Promise.all(promises);
          }
        }
      } else {
        // Try to process as a command first
        try {
          const commandResult = await commandProcessingService.processCommand(input);
          const typedResult = commandResult as any;
          
          if (typedResult && typedResult.executed) {
            // It was a valid command
            if (typedResult.result) {
              response = typedResult.result;
              setLatestAction(typedResult.result);
            } else {
              response = 'Command executed successfully';
            }
            
            // Handle special command parameters
            if (typedResult.parameters) {
              // Process all command parameters in parallel for better performance
              const promises: Promise<void>[] = [];
              
              if (typedResult.parameters.language) {
                // Trigger Miranda rights in the specified language
                promises.push(new Promise<void>(resolve => {
                  document.dispatchEvent(new CustomEvent('miranda-language-selected', {
                    detail: { language: typedResult.parameters.language }
                  }));
                  resolve();
                }));
              }
              
              if (typedResult.parameters.threat) {
                // Trigger threat detection with the specified type
                promises.push(new Promise<void>(resolve => {
                  document.dispatchEvent(new CustomEvent('threat-detected', {
                    detail: { type: typedResult.parameters.threat }
                  }));
                  resolve();
                }));
              }
              
              if (typedResult.parameters.statute) {
                // Trigger statute lookup
                promises.push(new Promise<void>(resolve => {
                  document.dispatchEvent(new CustomEvent('statute-lookup', {
                    detail: { code: typedResult.parameters.statute }
                  }));
                  resolve();
                }));
              }
              
              // Wait for all events to be dispatched
              if (promises.length > 0) {
                await Promise.all(promises);
              }
            }
          } else {
            // Not a command, get a general response
            // Start both Groq and tactical assessment in parallel if needed
            const responsePromise = useGroq ? 
              groqService.processCommand(input).then(res => {
                const typedRes = res as any;
                return typedRes && typedRes.result ? typedRes.result : '';
              }) : 
              getGeneralKnowledge(input);
            
            // Check if we need tactical assessment
            const needsTactical = input.toLowerCase().includes('tactical') || 
              input.toLowerCase().includes('situation') ||
              input.toLowerCase().includes('assess');
            
            let tacticalPromise: Promise<string> | null = null;
            if (needsTactical) {
              // Start tactical assessment in parallel
              tacticalPromise = assessTacticalSituation(input) as Promise<string>;
            }
            
            // Wait for the main response with a timeout
            const timeoutPromise = new Promise<string>(resolve => {
              setTimeout(() => resolve('I\'m still processing your request...'), 2000);
            });
            
            response = await Promise.race([responsePromise, timeoutPromise]);
            
            // If we got a timeout message, update it when the real response arrives
            if (response === 'I\'m still processing your request...') {
              // Continue waiting for the real response in the background
              responsePromise.then(realResponse => {
                // Update the message once we have the real response
                setMessages(prev => {
                  const newMessages = [...prev];
                  if (newMessages.length > 0) {
                    newMessages[newMessages.length - 1] = { 
                      role: 'assistant', 
                      content: personalizeMessage(realResponse)
                    };
                  }
                  return newMessages;
                });
                // Speak the response once we have it
                speakResponse(personalizeMessage(realResponse));
              }).catch(error => {
                console.error('Error getting response:', error);
              });
            }
            
            // If we need tactical assessment and have a response, append it
            if (needsTactical && tacticalPromise) {
              try {
                // Set a timeout to ensure we don't wait too long
                const tacticalTimeoutPromise = new Promise<string>(resolve => {
                  setTimeout(() => resolve(''), 2500);
                });
                
                const tacticalAssessment = await Promise.race([tacticalPromise, tacticalTimeoutPromise]);
                
                // Append tactical assessment if available
                if (tacticalAssessment) {
                  response += '\n\nTACTICAL ASSESSMENT: ' + tacticalAssessment;
                }
              } catch (tacticalError) {
                console.warn('Error getting tactical assessment:', tacticalError);
              }
            }
          }
        } catch (commandError) {
          console.error('Error processing command:', commandError);
          // Fallback to general knowledge
          response = await getGeneralKnowledge(input);
        }
      
      // Try LiveKit first, then OpenAI, then browser synthesis
      try {
        await Promise.race([liveKitPromise, timeoutPromise]);
        console.log('Used LiveKit for voice synthesis');
        setVoiceStatus('idle');
      } catch (liveKitError) {
        // Try OpenAI next
        try {
          await Promise.race([openAIPromise, timeoutPromise]);
          console.log('Used OpenAI for voice synthesis');
          setVoiceStatus('fallback');
        } catch (openAIError) {
          // Finally try browser synthesis
          try {
            await Promise.race([browserPromise, timeoutPromise]);
            console.log('Used browser for voice synthesis');
            setVoiceStatus('fallback');
          } catch (browserError) {
            console.error('All voice synthesis methods failed');
            setVoiceStatus('error');
            toast({
              title: 'Voice Synthesis Error',
              description: 'Unable to speak response. Please check your audio settings.',
              variant: 'destructive'
            });
          }
        }
      }
    } catch (error) {
      console.error('Voice synthesis error:', error);
      setVoiceStatus('error');
    } finally {
      setIsSpeaking(false);
      voiceRecognitionService.setSystemSpeaking(false);
    }
  };

  // Stop speaking - optimized to run in parallel with improved error handling
  const stopSpeaking = async () => {
    if (!isSpeaking) return;
    
    // Update UI immediately for better responsiveness
    setIsSpeaking(false);
    setVoiceStatus('idle');
    
    try {
      // Stop all voice services in parallel with individual error handling
      const stopPromises = [
        liveKitVoiceService.stop().catch(err => {
          console.warn('Error stopping LiveKit speech:', err);
          return false;
        }),
        openAIVoiceService.stop().catch(err => {
          console.warn('Error stopping OpenAI speech:', err);
          return false;
        }),
        voiceSynthesisService.stop().catch(err => {
          console.warn('Error stopping browser speech:', err);
          return false;
        })
      ];
      
      // Wait for all stop attempts to complete with a timeout
      const timeoutPromise = new Promise<boolean[]>(resolve => {
        setTimeout(() => resolve([false, false, false]), 500); // Don't wait more than 500ms
      });
      
      await Promise.race([Promise.all(stopPromises), timeoutPromise]);
    } catch (error) {
      console.error('Error stopping speech:', error);
    } finally {
      // Ensure the voice recognition service knows we're not speaking
      voiceRecognitionService.setSystemSpeaking(false);
    }
    setInterimTranscript('');
    setTextInput('');
    setVisualFeedback({
      active: false,
      intensity: 0
    });
  };

  // Get microphone status icon
  const getMicStatusIcon = () => {
    switch (micStatus) {
      case 'granted':
        return <CheckCircleIcon className="text-green-500" size={16} />;
      case 'denied':
        return <XCircleIcon className="text-red-500" size={16} />;
      case 'prompt':
        return <AlertTriangleIcon className="text-yellow-500" size={16} />;
      default:
        return <InfoIcon className="text-gray-500" size={16} />;
    }
  };

  // Get voice status icon
  const getVoiceStatusIcon = () => {
    switch (voiceStatus) {
      case 'speaking':
        return <Volume2Icon className="text-green-500" size={16} />;
      case 'error':
        return <VolumeXIcon className="text-red-500" size={16} />;
      case 'fallback':
        return <Volume1Icon className="text-yellow-500" size={16} />;
      default:
        return <VolumeIcon className="text-gray-500" size={16} />;
    }
  };

  // Get microphone status class
  const getMicStatusClass = () => {
    switch (micStatus) {
      case 'granted':
        return 'mic-granted';
      case 'denied':
        return 'mic-denied';
      case 'prompt':
        return 'mic-prompt';
      default:
        return 'mic-prompt';
    }
  };

  // Get microphone status text
  const getMicStatusText = () => {
    switch (micStatus) {
      case 'granted':
        return 'Microphone access granted';
      case 'denied':
        return 'Microphone access denied';
      case 'prompt':
        return 'Microphone access prompt';
      default:
        return 'Microphone access prompt';
    }
  };

  // Get voice status class
  const getVoiceStatusClass = () => {
    switch (voiceStatus) {
      case 'speaking':
        return 'voice-speaking';
      case 'error':
        return 'voice-error';
      case 'fallback':
        return 'voice-fallback';
      default:
        return 'voice-idle';
    }
  };

  // Get voice status text
  const getVoiceStatusText = () => {
    switch (voiceStatus) {
      case 'speaking':
        return 'Voice synthesis active';
      case 'error':
        return 'Voice synthesis error';
      case 'fallback':
        return 'Voice synthesis fallback';
      default:
        return 'Voice synthesis idle';
    }
  };

  // Render the component
  return (
    <div className="unified-voice-assistant">
      <div className="assistant-header">
        <div className="assistant-title">
          <ZapIcon className="text-primary" size={24} />
          <h2>L.A.R.K. Voice Assistant</h2>
        </div>
        <div className="assistant-status">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="status-indicator">
                {isOffline ? 
                  <Badge variant="outline" className="status-badge offline">Offline</Badge> :
                  <Badge variant="outline" className="status-badge online">Online</Badge>
                }
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isOffline ? 'Offline Mode' : 'Online Mode'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="status-indicator">
                <Badge variant="outline" className={`status-badge ${getMicStatusClass()}`}>
                  {getMicStatusIcon()}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {getMicStatusText()}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="status-indicator">
                <Badge variant="outline" className={`status-badge ${getVoiceStatusClass()}`}>
                  {getVoiceStatusIcon()}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {getVoiceStatusText()}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <BotIcon size={48} className="text-primary opacity-50" />
            <p>Start a conversation with L.A.R.K.</p>
            <p className="text-sm text-muted-foreground">
              Ask a question or give a command using your voice or text.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className="message-avatar">
                {message.role === 'user' ? 
                  <UserIcon size={18} /> : 
                  <BotIcon size={18} />
                }
              </div>
              <div className="message-content">
                <p>{message.content}</p>
                {message.role === 'assistant' && index === messages.length - 1 && (
                  <div className="message-actions">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => speakResponse(message.content)}
                      disabled={isSpeaking}
                    >
                      <VolumeIcon size={16} className="mr-1" />
                      {isSpeaking ? 'Speaking...' : 'Listen'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {currentlyListening && (
        <div className="listening-indicator">
          <div 
            ref={audioVisualizerRef}
            className="audio-visualizer"
            style={{
              '--intensity': visualFeedback.intensity
            } as React.CSSProperties}
          >
            <div className="visualizer-bars">
              {Array.from({ length: 20 }).map((_, i) => (
                <div 
                  key={i} 
                  className="visualizer-bar"
                  style={{
                    height: `${Math.min(100, visualFeedback.intensity * 100 * (0.5 + Math.random() * 0.5))}%`,
                    animationDelay: `${i * 0.05}s`
                  }}
                />
              ))}
            </div>
          </div>
          <div className="interim-transcript">
            {interimTranscript || "Listening..."}
          </div>
        </div>
      )}

      <div className="input-container">
        <form onSubmit={handleTextSubmit} className="text-input-form">
          <input
            type="text"
            ref={textInputRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isProcessing}
            className="text-input"
          />
          <Button 
            type="submit" 
            disabled={isProcessing || !textInput.trim()}
            className="send-button"
          >
            <ArrowRightIcon size={18} />
          </Button>
        </form>

        <div className="voice-controls">
          <Button
            variant={currentlyListening ? "destructive" : "default"}
            size="icon"
            onClick={toggleListening}
            disabled={isProcessing || !hasRecognitionSupport}
            className="voice-button"
          >
            {currentlyListening ? <StopCircleIcon size={20} /> : <MicIcon size={20} />}
          </Button>

          {isSpeaking && (
            <Button
              variant="outline"
              size="icon"
              onClick={stopSpeaking}
              className="voice-button"
            >
              <VolumeXIcon size={20} />
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              // Reset the assistant state
              setMessages([]);
              setLatestAction(null);
              setInterimTranscript('');
              setTextInput('');
              stopVoiceRecognition();
              stopSpeaking();
            }}
            className="reset-button"
          >
            <RefreshCwIcon size={20} />
          </Button>
        </div>
      </div>

      {isProcessing && (
        <div className="processing-overlay">
          <Loader2Icon className="animate-spin" size={24} />
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
}
