
import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeechRecognitionHook {
  listening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  hasRecognitionSupport: boolean;
  error: string | null;
  wakeWordDetected: boolean;
  setWakeWordDetected: (detected: boolean) => void;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasRecognitionSupport, setHasRecognitionSupport] = useState(false);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    console.log('Initializing speech recognition...');
    // Check if browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech Recognition API not supported');
      setError('Speech recognition not supported in this browser.');
      return;
    }

    try {
      console.log('Speech Recognition API supported, setting up instance...');
      setHasRecognitionSupport(true);
      
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true; // Enable continuous mode for faster response
      recognitionInstance.interimResults = true; // Enable interim results for real-time feedback
      recognitionInstance.maxAlternatives = 1; // Only need one alternative to improve performance
      recognitionInstance.lang = 'en-US';
      
      // Handle results
      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const current = event.resultIndex;
        const result = event.results[current];
        const transcriptText = result[0].transcript;
        const confidence = result[0].confidence;
        
        // Only log final results to reduce console noise
        if (result.isFinal) {
          console.log('Final transcript:', transcriptText, 'Confidence:', confidence);
          setTranscript(transcriptText);
          
          // Dispatch event for other components to react to
          const customEvent = new CustomEvent('lark-audio-detected', {
            detail: {
              transcript: transcriptText,
              confidence: confidence,
              isFinal: true
            }
          });
          window.dispatchEvent(customEvent);
        } else {
          // For interim results, dispatch event but don't log
          const customEvent = new CustomEvent('lark-interim-transcript', {
            detail: {
              transcript: transcriptText,
              confidence: confidence,
              isFinal: false
            }
          });
          window.dispatchEvent(customEvent);
        }
      };
      
      // Handle start event
      recognitionInstance.onstart = () => {
        console.log('Speech recognition started successfully');
        setListening(true);
        setError(null);
      };
      
      // Handle end event
      recognitionInstance.onend = () => {
        console.log('Speech recognition ended');
        setListening(false);
        
        // Auto-restart if we're supposed to be listening, with a small delay to prevent rapid restarts
        if (listening) {
          // Clear any existing restart timeout
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          
          // Set a short delay before restarting to prevent excessive CPU usage
          restartTimeoutRef.current = setTimeout(() => {
            console.log('Auto-restarting speech recognition...');
            try {
              recognitionInstance.start();
            } catch (e) {
              console.error('Error auto-restarting speech recognition:', e);
              setError('Failed to restart speech recognition.');
            }
          }, 300); // 300ms delay is short enough to be imperceptible but helps prevent rapid cycling
        }
      };
      
      // Handle errors
      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error, event);
        
        let errorMessage = 'Speech recognition error';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected. Please try speaking again.';
            break;
          case 'audio-capture':
            errorMessage = 'No microphone detected. Please check your audio settings.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access.';
            break;
          case 'network':
            errorMessage = 'Network error. Please check your internet connection.';
            break;
          case 'aborted':
            errorMessage = 'Speech recognition was aborted.';
            break;
          case 'language-not-supported':
            errorMessage = 'The selected language is not supported.';
            break;
        }
        
        console.log('Setting error message:', errorMessage);
        setError(errorMessage);
        setListening(false);
      };
      
      // Handle audio start
      recognitionInstance.onaudiostart = () => {
        console.log('Audio capturing started');
      };
      
      // Handle audio end
      recognitionInstance.onaudioend = () => {
        console.log('Audio capturing ended');
      };
      
      // Handle sound start
      recognitionInstance.onsoundstart = () => {
        console.log('Sound detected');
      };
      
      // Handle sound end
      recognitionInstance.onsoundend = () => {
        console.log('Sound ended');
      };
      
      // Handle speech start
      recognitionInstance.onspeechstart = () => {
        console.log('Speech started');
      };
      
      // Handle speech end
      recognitionInstance.onspeechend = () => {
        console.log('Speech ended');
      };
      
      recognitionRef.current = recognitionInstance;
      console.log('Speech recognition instance created successfully');
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      setError('Failed to initialize speech recognition.');
    }
    
    // Cleanup function
    return () => {
      console.log('Cleaning up speech recognition...');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          // Remove all event listeners
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.onstart = null;
          recognitionRef.current.onaudiostart = null;
          recognitionRef.current.onaudioend = null;
          recognitionRef.current.onsoundstart = null;
          recognitionRef.current.onsoundend = null;
          recognitionRef.current.onspeechstart = null;
          recognitionRef.current.onspeechend = null;
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      }
    };
  }, []); // Empty dependency array since we only want to initialize once

  const startListening = useCallback(() => {
    console.log('Starting speech recognition...');
    if (!recognitionRef.current) {
      console.error('Speech recognition not initialized');
      setError('Speech recognition not initialized. Please refresh the page.');
      return;
    }

    try {
      // Stop any existing recognition
      if (listening) {
        console.log('Stopping existing recognition before starting new one');
        recognitionRef.current.stop();
      }

      // Clear previous transcript
      setTranscript('');
      setError(null);
      
      // Start new recognition
      recognitionRef.current.start();
      console.log('Speech recognition start command issued');
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError('Failed to start speech recognition. Please try again.');
      setListening(false);
    }
  }, [listening]);

  const stopListening = useCallback(() => {
    console.log('Stopping speech recognition...');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setListening(false);
        console.log('Speech recognition stopped successfully');
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  }, []);

  return {
    listening,
    transcript,
    startListening,
    stopListening,
    hasRecognitionSupport,
    error,
    wakeWordDetected,
    setWakeWordDetected
  };
}
