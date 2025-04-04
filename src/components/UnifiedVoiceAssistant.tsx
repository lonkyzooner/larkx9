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
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip } from './ui/tooltip';
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
      stopListening();
      setCurrentlyListening(false);
      setVisualFeedback({
        active: false,
        intensity: 0
      });
    } else {
      if (hasRecognitionSupport) {
        startListening();
        setCurrentlyListening(true);
      } else {
        toast({
          title: "Speech Recognition Not Supported",
          description: "Your browser doesn't support speech recognition. Please use text input instead.",
          variant: "destructive"
        });
      }
    }
  }, [currentlyListening, hasRecognitionSupport, startListening, stopListening]);

  // Handle user input (voice or text)
  const handleUserInput = async (input: string) => {
    if (!input || input.trim() === '') return;
    
    // Add user message
    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setTextInput('');
    setIsProcessing(true);
    
    try {
      let response: CommandResponse;
      
      // Process command based on network status
      if (isOffline) {
        response = await processOfflineCommand(input);
      } else if (useGroq && groqService.isAvailable()) {
        // Use Groq for faster command processing
        try {
          console.log('[UnifiedVoiceAssistant] Using Groq for command processing');
          const groqResult = await groqService.processCommand(input, {
            officerName: settings.officerName || 'Officer',
            location: settings.location || 'Louisiana',
            previousCommand: messages.length > 0 ? messages[messages.length - 2]?.content : '',
            previousResponse: messages.length > 0 ? messages[messages.length - 1]?.content : ''
          });
          
          // Convert Groq result to CommandResponse format
          response = {
            action: groqResult.action || 'general_response',
            executed: true,
            result: groqResult.response,
            parameters: {
              confidence: groqResult.confidence
            }
          };
        } catch (error) {
          console.error('[UnifiedVoiceAssistant] Error using Groq, falling back to OpenAI:', error);
          // Fall back to OpenAI if Groq fails
          if (input.toLowerCase().includes('situation') || input.toLowerCase().includes('assessment')) {
            response = await assessTacticalSituation(input) as CommandResponse;
          } else if (input.toLowerCase().includes('what is') || input.toLowerCase().includes('who is') || input.toLowerCase().includes('how to')) {
            response = await getGeneralKnowledge(input) as CommandResponse;
          } else {
            response = await processVoiceCommand(input);
          }
        }
      } else {
        // Use OpenAI for command processing
        console.log('[UnifiedVoiceAssistant] Using OpenAI for command processing');
        if (input.toLowerCase().includes('situation') || input.toLowerCase().includes('assessment')) {
          response = await assessTacticalSituation(input) as CommandResponse;
        } else if (input.toLowerCase().includes('what is') || input.toLowerCase().includes('who is') || input.toLowerCase().includes('how to')) {
          response = await getGeneralKnowledge(input) as CommandResponse;
        } else {
          response = await processVoiceCommand(input);
        }
      }
      
      // Handle response
      if (response) {
        const assistantMessage = { 
          role: 'assistant' as const, 
          content: personalizeMessage(response.result || 'I processed your request.') 
        };
        setMessages(prev => [...prev, assistantMessage]);
        setLatestAction(response.action);
        
        // Speak the response
        speakResponse(assistantMessage.content);
      }
    } catch (error) {
      console.error('Error processing command:', error);
      const errorMessage = { 
        role: 'assistant' as const, 
        content: 'Sorry, I encountered an error processing your request. Please try again.' 
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Speak the error message
      speakResponse(errorMessage.content);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle text input submission
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      handleUserInput(textInput);
    }
  };

  // Speak response using voice synthesis
  const speakResponse = async (text: string) => {
    if (!text) return;
    
    try {
      // Use OpenAI voice service with the "ash" voice for high-quality speech synthesis
      console.log('[UnifiedVoiceAssistant] Using OpenAI voice service with Ash voice');
      await openAIVoiceService.speak(text, 'ash');
    } catch (openAIError) {
      console.error('Error using OpenAI voice service:', openAIError);
      setVoiceStatus('fallback');
      
      try {
        // Fall back to standard voice synthesis service if OpenAI fails
        console.log('[UnifiedVoiceAssistant] Falling back to standard voice synthesis');
        await voiceSynthesisService.speak(text);
      } catch (fallbackError) {
        console.error('Error with fallback voice synthesis:', fallbackError);
        setVoiceStatus('error');
        toast({
          title: "Voice Synthesis Error",
          description: "There was an error with voice synthesis. Please check console for details.",
          variant: "destructive"
        });
      }
    }
  };

  // Stop speaking
  const stopSpeaking = () => {
    voiceSynthesisService.stop();
    setIsSpeaking(false);
    setVoiceStatus('idle');
  };

  // Reset the assistant
  const resetAssistant = () => {
    setMessages([]);
    setLatestAction(null);
    stopSpeaking();
    if (currentlyListening) {
      stopListening();
      setCurrentlyListening(false);
    }
    resetTranscript();
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
                {getMicStatusIcon()}
                <span>Mic</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{`Microphone: ${micStatus}`}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="status-indicator">
                {getVoiceStatusIcon()}
                <span>Voice</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{`Voice: ${voiceStatus}`}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="status-indicator">
                {isOffline ? 
                  <AlertTriangleIcon className="text-yellow-500" size={16} /> : 
                  <CheckCircleIcon className="text-green-500" size={16} />
                }
                <span>{isOffline ? "Offline" : "Online"}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isOffline ? "Offline Mode" : "Online Mode"}</p>
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
            onClick={resetAssistant}
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
