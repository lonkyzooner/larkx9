
import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeechRecognitionHook {
  listening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  hasRecognitionSupport: boolean;
  error: string | null;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasRecognitionSupport, setHasRecognitionSupport] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
      recognitionInstance.continuous = false; // Set to single utterance mode
      recognitionInstance.interimResults = false; // Disable interim results for more stability
      recognitionInstance.lang = 'en-US';
      
      // Handle results
      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        console.log('Speech recognition result received:', event);
        const current = event.resultIndex;
        const result = event.results[current];
        const transcriptText = result[0].transcript;
        console.log('Transcript text:', transcriptText, 'Confidence:', result[0].confidence);
        setTranscript(transcriptText);
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
        
        // Auto-restart if we're supposed to be listening
        if (listening) {
          console.log('Auto-restarting speech recognition...');
          try {
            recognitionInstance.start();
          } catch (e) {
            console.error('Error auto-restarting speech recognition:', e);
            setError('Failed to restart speech recognition.');
          }
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
    error
  };
}
