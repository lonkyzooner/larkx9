import React, { useState, useRef, useEffect, useCallback, useContext, useMemo, memo } from 'react';
import VoiceContext from '../contexts/VoiceContext';
import LiveKitVoiceContext from '../contexts/LiveKitVoiceContext';
import { useSettings } from '../lib/settings-store';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { SendIcon, VolumeIcon, StopCircleIcon, Mic, MicOff, AlertCircle, Info } from 'lucide-react';
import { saveMessage, getMessages, queueOfflineMessage, getOfflineQueue, clearOfflineQueue } from '../lib/chat-storage';
import { queryOpenAI } from '../utils/openAIService';
import { huggingFaceService } from '../services/huggingface/HuggingFaceService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

type ChatHistory = Message[];

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Memoized message component to prevent unnecessary re-renders
const MessageBubble = memo(({ message, onSpeakText }: { message: Message, onSpeakText: (text: string) => void }) => {
  // Format the timestamp
  const formattedTime = useMemo(() => {
    const date = new Date(message.timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [message.timestamp]);

  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-5`}
      data-message-id={message.timestamp.toString()}
    >
      {message.role === 'assistant' && (
        <div className="flex-shrink-0 mr-3">
          <div className="w-10 h-10 rounded-full bg-[#003087] flex items-center justify-center text-white font-semibold shadow-md ring-2 ring-white/30">
            L
          </div>
        </div>
      )}
      <div
        className={`max-w-[85%] px-5 py-4 rounded-2xl shadow-md ${
          message.role === 'user'
            ? 'bg-gradient-to-br from-[#003087] to-[#004db3] text-white rounded-tr-none border border-blue-400/20'
            : 'bg-white/90 text-gray-800 rounded-tl-none border border-gray-200/50 backdrop-blur-sm'
        }`}
      >
        <div className="whitespace-pre-wrap text-[15px]">{message.content}</div>
        
        <div className={`mt-2 flex ${message.role === 'assistant' ? 'justify-between' : 'justify-end'}`}>
          <span className="text-xs opacity-70">{formattedTime}</span>
          
          {message.role === 'assistant' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => onSpeakText(message.content)}
                    className="text-xs flex items-center bg-white/80 hover:bg-white px-2 py-1 rounded-full shadow-sm transition-colors border border-gray-200/50"
                  >
                    <VolumeIcon className="h-3 w-3 mr-1 text-[#003087]" />
                    <span className="text-gray-700">Listen</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Read this message aloud</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      {message.role === 'user' && (
        <div className="flex-shrink-0 ml-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-800 font-semibold shadow-sm">
            U
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the message content or timestamp changes
  return prevProps.message.content === nextProps.message.content && 
         prevProps.message.timestamp === nextProps.message.timestamp;
});

export function LarkChat() {
  const voice = useContext(VoiceContext);
  const liveKitVoice = useContext(LiveKitVoiceContext);
  const { getOfficerName, getOfficerRank, getOfficerCodename } = useSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null); // Add info message state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInitialized, setIsInitialized] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  // Initialize OpenAI Chat
  useEffect(() => {
    const initializeChat = async () => {
      try {
        console.log('Initializing OpenAI chat model...');
        
        // Set initialized to true regardless of outcome to allow offline functionality
        setIsInitialized(true);
        
        if (!OPENAI_API_KEY) {
          console.error('OpenAI API key is missing. Please check your environment variables.');
          setError('API key configuration is missing. Using offline mode only.');
          return;
        }
        
        try {
          // Test the OpenAI connection with a simple request
          console.log('Testing connection to OpenAI API...');
          try {
            const testResponse = await queryOpenAI('Test connection');
            
            if (testResponse && !testResponse.includes('Unable to process')) {
              console.log('Successfully connected to OpenAI API');
              chatRef.current = { initialized: true };

// Just mark as initialized since we're using the queryOpenAI function
              console.log('Chat model initialized successfully');
            } else {
              throw new Error('Empty or error response from API test');
            }
          } catch (apiError) {
            console.error('API test failed:', apiError);
            throw new Error('API test failed');
          }
        } catch (testError) {
          console.error('Failed to connect to OpenAI API:', testError);
          setError('Could not connect to AI service. Using offline mode only. Voice commands will still work.');
          return;
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
        setError('Failed to initialize the chat assistant. Using offline mode only.');
      }
    };

    initializeChat();
  }, []);

  const scrollToBottom = () => {
    // Use a more controlled scroll with a short delay to prevent jumping
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Load messages from IndexedDB and handle online/offline status
  useEffect(() => {
    const loadMessages = async () => {
      try {
        console.log('Loading messages from database...');
        const savedMessages = await getMessages();
        console.log(`Loaded ${savedMessages.length} messages`);
        
        if (savedMessages.length === 0) {
          console.log('No messages found, adding welcome message');
          
          // Get officer details from settings
          const officerName = getOfficerName();
          const officerRank = getOfficerRank();
          const officerCodename = getOfficerCodename();
          
          // Personalize welcome message if officer details are available
          let welcomeContent = "Hello! I'm LARK, your law enforcement assistant. How can I help you today?";
          
          if (officerCodename) {
            welcomeContent = `Hello ${officerCodename}! I'm LARK, your law enforcement assistant. How can I help you today?`;
          } else if (officerName) {
            welcomeContent = `Hello ${officerRank} ${officerName}! I'm LARK, your law enforcement assistant. How can I help you today?`;
          }
          
          // Add welcome message if no messages exist
          const welcomeMessage: Message = {
            role: 'assistant',
            content: welcomeContent,
            timestamp: Date.now()
          };

          const saved = await saveMessage(welcomeMessage);
          if (saved) {
            console.log('Welcome message saved successfully');
          } else {
            console.warn('Failed to save welcome message, but will display it anyway');
          }
          setMessages([welcomeMessage]);
        } else {
          setMessages(savedMessages);
        }
        setIsInitialized(true);
      } catch (error) {
        console.error('Error loading messages:', error);
        // Initialize with empty state rather than failing
        setMessages([]);
        setIsInitialized(true);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      processOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    loadMessages();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };

  }, []);

  // Process any messages that were queued while offline
  const processOfflineQueue = useCallback(async () => {
    try {
      const queue = await getOfflineQueue();
      if (queue.length > 0) {
        for (const item of queue) {
          await processMessage(item.message);
        }
        await clearOfflineQueue();
      }
    } catch (error) {
      console.error('Error processing offline queue:', error);
    }
  }, []);

  // Listen for voice recognition changes and errors
  useEffect(() => {
    if (voice.transcript && voice.transcript.trim() !== '') {
      processMessage(voice.transcript);
      voice.stopListening(); // Stop listening after processing the command
    }

    // Handle voice errors
    const handleVoiceError = (event: CustomEvent) => {
      const { type, message } = event.detail;
      let errorMessage = message;

      // Customize error messages based on type
      switch (type) {
        case 'permission_denied':
          errorMessage = 'Please enable microphone access to use voice commands. Click the microphone icon to try again.';
          break;
        case 'no_device':
          errorMessage = 'No microphone found. Please connect a microphone to use voice commands.';
          break;
        case 'device_error':
          errorMessage = 'Could not access microphone. It may be in use by another application.';
          break;
        case 'timeout':
          errorMessage = 'Voice command timed out. Please try again.';
          break;
      }

      setError(errorMessage);
      
      // Auto-clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    };

    document.addEventListener('voice_error', handleVoiceError as EventListener);
    return () => document.removeEventListener('voice_error', handleVoiceError as EventListener);
  }, [voice.transcript]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Set up subscription to voice synthesis service speaking state
  useEffect(() => {
    // Use the LiveKitVoiceContext's isSpeaking state directly
    setIsSpeaking(liveKitVoice.isSpeaking);
  }, [liveKitVoice.isSpeaking]);
  
  // Use LiveKitVoiceContext for stopping speech
  const stopSpeaking = () => {
    if (isSpeaking) {
      liveKitVoice.stopSpeaking();
      setIsSpeaking(false);
    }
  };

  const speakText = async (text: string) => {
    try {
      if (!text || text.trim() === '') {
        setError('Cannot speak empty text. Please enter a message.');
        return;
      }

      stopSpeaking();
      setIsSpeaking(true); // Set speaking state to true immediately
      
      console.log('[LarkChat] Requesting speech synthesis for text:', text.substring(0, 30) + (text.length > 30 ? '...' : ''));
      
      try {
        // First try with regular speak method which will automatically fall back if needed
        await liveKitVoice.speak(text, 'ash');
      } catch (speakError) {
        console.warn('[LarkChat] Primary speech method failed, using OpenAI fallback:', speakError);
        // If the regular speak method fails, use OpenAI fallback directly
        try {
          await liveKitVoice.speakWithOpenAIFallback(text, 'ash');
        } catch (fallbackError) {
          console.error('[LarkChat] Even fallback speech failed:', fallbackError);
          setError('Speech synthesis failed. Please try again later.');
          setIsSpeaking(false);
          return;
        }
      }
      
      // Monitor speaking state
      const checkSpeakingInterval = setInterval(() => {
        if (!liveKitVoice.isSpeaking) {
          setIsSpeaking(false);
          clearInterval(checkSpeakingInterval);
        }
      }, 500);
      
      // Clear interval after 30 seconds as a safety measure
      setTimeout(() => {
        clearInterval(checkSpeakingInterval);
        setIsSpeaking(false);
      }, 30000);
      
    } catch (error: any) {
      console.error('Error generating speech:', error);
      setIsSpeaking(false);

      // Handle specific errors
      if (error.message?.includes('rate limit')) {
        setError('Voice synthesis rate limit reached. Please try again in a moment.');
      } else if (error.message?.includes('API key')) {
        setError('Voice synthesis authentication error. Please check your configuration.');
      } else if (error.message?.includes('timed out')) {
        setError('Voice synthesis timed out. Please try again.');
      } else {
        setError('Failed to generate speech. Please try again.');
      }

      // Auto-clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    }
  };

  const processMessage = useCallback(async (userMessage: string, isOfflineQueued = false) => {
    try {
      setIsProcessing(true);
      setError(null); // Clear any previous errors
      
      // Add user message to chat
      const userMsg: Message = { role: 'user', content: userMessage, timestamp: Date.now() };

      const savedUserMsg = await saveMessage(userMsg);
      if (!savedUserMsg) {
        console.warn('Failed to save user message to database, but continuing with in-memory processing');
      }
      
      // Analyze emotion using Hugging Face (don't await to avoid blocking)
      huggingFaceService.detectEmotion(userMessage)
        .then((emotionResult) => {
          console.log(`[LarkChat] Detected emotion: ${emotionResult.emotion} (${emotionResult.score.toFixed(2)})`);
        })
        .catch((error: unknown) => {
          console.error('[LarkChat] Error detecting emotion:', error);
        });
      
      const updatedMessages: ChatHistory = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput('');

      // If offline and not already queued, add to offline queue
      if (!isOnline && !isOfflineQueued) {
        await queueOfflineMessage(userMessage);
        const offlineMsg: Message = {
          role: 'assistant',
          content: 'I am currently offline. Your message has been queued and will be processed when the connection is restored.',
          timestamp: Date.now()
        };

        await saveMessage(offlineMsg);
        setMessages(prev => [...prev, offlineMsg]);
        setIsProcessing(false);
        return;
      }

      // Process the message
      let response = '';
      let detectedEmotion = 'neutral';
      
      // Try to get emotion detection result
      try {
        const emotionResult = await huggingFaceService.detectEmotion(userMessage);
        detectedEmotion = emotionResult.emotion;
        console.log(`[LarkChat] Using detected emotion for response: ${detectedEmotion}`);
        
        // Show empathetic message for strong negative emotions
        if (['anger', 'fear', 'sadness', 'disgust'].includes(detectedEmotion) && emotionResult.score > 0.7) {
          setInfo(`I notice you might be feeling ${detectedEmotion}. I'm here to help.`);
          setTimeout(() => setInfo(null), 5000);
        }
      } catch (error) {
        console.error('[LarkChat] Could not get emotion for response:', error);
      }
      
      // First try voice command processing if appropriate
      if (!isOfflineQueued) {
        try {
          console.log('Attempting to process as voice command:', userMessage);
          const voiceResult = await voice.processCommand(userMessage);
          if (voiceResult && voiceResult.success) {
            response = voiceResult.response;
            console.log('Successfully processed as voice command');
          }
        } catch (error) {
          console.error('Voice command processing failed, falling back to Gemini:', error);
        }
      }
      
      // If voice processing didn't yield a response, use OpenAI if available
      if (!response) {
        if (!chatRef.current) {
          console.log('Chat not initialized, using offline fallback response');
          // Provide a fallback response when OpenAI is not available
          response = "I'm currently operating in offline mode. I can process voice commands, but advanced AI responses are unavailable. Please check your internet connection and API configuration."; 
        }
        
        console.log('Processing with OpenAI...');
        try {
          // Add a timeout to prevent hanging requests
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timed out')), 30000);
          });
          
          // Include emotion in the OpenAI query
          const messagePromise = queryOpenAI(userMessage, detectedEmotion);
          const result = await Promise.race([messagePromise, timeoutPromise]) as string;
          
          if (!result || result.includes('Unable to process')) {
            throw new Error('Received error response from AI service');
          }
          
          response = result;
          console.log('Received response from OpenAI:', response ? 'Success' : 'Empty response');
          
          if (!response || response.trim() === '') {
            throw new Error('Received empty response from AI service');
          }
        } catch (openaiError) {
          console.error('Error with OpenAI API:', openaiError);
          // Provide a fallback response instead of throwing an error
          response = "I'm having trouble connecting to my AI service right now. I can still process voice commands, but for more complex queries, please check your internet connection and try again later.";
        }
      }

      // Add assistant response to chat
      const assistantMsg: Message = { 
        role: 'assistant', 
        content: response, 
        timestamp: Date.now() 
      };

      
      const savedAssistantMsg = await saveMessage(assistantMsg);
      if (!savedAssistantMsg) {
        console.warn('Failed to save assistant message to database, but continuing with in-memory display');
      }
      
      setMessages([...updatedMessages, assistantMsg]);
      console.log('Added assistant response to chat');

      // Try to speak the response, but don't block on errors
      try {
        if (response && response.trim() !== '') {
          await speakText(response);
        }
      } catch (speechError) {
        console.error('Error speaking response:', speechError);
        // Don't throw here, just log the error
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMsg: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: Date.now()
      };

      await saveMessage(errorMsg);
      setMessages(prev => [...prev, errorMsg]);
      setError('Failed to process message. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [messages, isOnline, chatRef, voice, speakText, saveMessage]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      processMessage(input.trim());
    }
  }, [input, isProcessing, processMessage]);

  // Monitor LiveKitVoice errors and microphone permission changes
  useEffect(() => {
    // Check for errors in LiveKitVoice context
    if (liveKitVoice.error) {
      console.error('[LarkChat] LiveKit error:', liveKitVoice.error);
      
      const errorStr = String(liveKitVoice.error).toLowerCase();
      
      // Handle different types of errors with improved user messages
      if (errorStr.includes('openai') || errorStr.includes('api key')) {
        // Better OpenAI API error handling
        setInfo('Voice services are operating in limited mode. Text chat is fully functional.');
        console.log('OpenAI API configuration issue detected, using fallback services');
        setTimeout(() => setInfo(null), 7000);
      } else if (errorStr.includes('microphone') || errorStr.includes('permission')) {
        // More informative microphone error message
        setInfo('Microphone access unavailable. You can still use text chat and receive voice responses.');
        setTimeout(() => setInfo(null), 6000);
      } else {
        // For other errors, provide a clearer message
        setError(`Service connection issue: ${errorStr.length > 50 ? errorStr.substring(0, 50) + '...' : errorStr}`);
        setTimeout(() => setError(null), 5000);
      }
    }
  }, [liveKitVoice.error]);
  
  // Monitor microphone permission changes with improved guidance
  useEffect(() => {
    if (liveKitVoice.micPermission === 'denied') {
      setInfo('Microphone access denied. You can continue using LARK by typing your messages or grant permission in your browser settings.');
      // Log useful information for debugging
      console.log('Microphone permission status:', liveKitVoice.micPermission);
      // Extend display duration for better visibility
      setTimeout(() => setInfo(null), 8000);
    } else if (liveKitVoice.micPermission === 'granted') {
      // Show positive confirmation when microphone is connected
      setInfo('Microphone connected. Voice commands are now available.');
      setTimeout(() => setInfo(null), 3000);
    }
  }, [liveKitVoice.micPermission]);

  // Memoize the error and info messages to prevent re-renders
  const errorMessage = useMemo(() => {
    if (!error) return null;
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-lg flex items-center space-x-2 animate-in fade-in duration-300">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }, [error]);

  const infoMessage = useMemo(() => {
    if (!info) return null;
    return (
      <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-3 rounded-lg flex items-center space-x-2 animate-in fade-in duration-300">
        <Info className="h-5 w-5 flex-shrink-0" />
        <span>{info}</span>
      </div>
    );
  }, [info]);
  
  // Memoize the message list to prevent re-renders when other state changes
  const messageList = useMemo(() => {
    return messages.map((message, index) => (
      <MessageBubble 
        key={`${message.timestamp}-${index}`} 
        message={message} 
        onSpeakText={speakText} 
      />
    ));
  }, [messages, speakText]);

  return (
    <div className="flex flex-col h-[80vh] max-w-2xl mx-auto p-4 space-y-4">
      {/* Error message */}
      {errorMessage}
      
      {/* Info message */}
      {infoMessage}
      
      <ScrollArea className="flex-1 p-4 rounded-lg border border-border/30 bg-white/90 shadow-md backdrop-blur-sm" style={{ height: '500px', position: 'relative', overflow: 'hidden' }}>
        <div className="space-y-6" style={{ minHeight: 'calc(100% - 50px)', paddingBottom: '20px' }}>
          {messageList}
          <div ref={messagesEndRef} style={{ height: '10px', padding: '12px 0', margin: '10px 0' }} />
        </div>
      </ScrollArea>

      {!isInitialized ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003087]"></div>
        </div>
      ) : (
        <div className="flex flex-col space-y-2">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isProcessing}
              className="flex-1 text-black border-border/30 focus:border-[#003087] focus:ring-[#003087] rounded-full py-6 px-4 shadow-sm bg-white/90 backdrop-blur-sm"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    type="submit" 
                    disabled={isProcessing || !input.trim()}
                    variant="default"
                    className="bg-[#003087] hover:bg-[#004db3] transition-colors rounded-full p-6 h-auto w-auto shadow-md"
                  >
                    <SendIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Send message</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {isSpeaking ? (
                    <Button
                      type="button"
                      onClick={stopSpeaking}
                      variant="destructive"
                      className="transition-colors"
                    >
                      <StopCircleIcon className="h-5 w-5" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        const lastAssistantMessage = [...messages]
                          .reverse()
                          .find(m => m.role === 'assistant');
                        if (lastAssistantMessage) {
                          speakText(lastAssistantMessage.content);
                        }
                      }}
                      variant="outline"
                      disabled={!messages.some(m => m.role === 'assistant')}
                      className="border-gray-300 hover:bg-gray-100 transition-colors"
                    >
                      <VolumeIcon className="h-5 w-5" />
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isSpeaking ? "Stop speaking" : "Speak last message"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-300 hover:bg-gray-100 transition-colors"
                    onClick={async () => {
                      if (voice.isListening) {
                        voice.stopListening();
                      } else {
                        // Request microphone permission if needed
                        if (voice.micPermission === 'denied' || voice.micPermission === 'prompt') {
                          const granted = await voice.requestMicrophonePermission();
                          if (!granted) {
                            setError('Microphone access is required for voice commands. Using text input instead.');
                            setInfo('You can still use LARK by typing your messages in the text box below.');
                            setTimeout(() => {
                              setError(null);
                              setTimeout(() => setInfo(null), 3000);
                            }, 3000);
                            return;
                          }
                        }
                        voice.startListening();
                      }
                    }}
                    disabled={!isOnline}
                  >
                    {voice.isListening ? (
                      <Mic className="h-5 w-5 text-green-500 animate-pulse" />
                    ) : voice.micPermission === 'denied' ? (
                      <MicOff className="h-5 w-5 text-red-500" />
                    ) : (
                      <Mic className="h-5 w-5 text-gray-500" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{voice.isListening ? "Stop listening" : voice.micPermission === 'denied' ? "Microphone access denied" : "Start voice input"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </form>
          
          {isProcessing && (
            <div className="text-center text-sm text-gray-500 mt-2">
              <div className="inline-block animate-pulse">Processing your request...</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LarkChat;
