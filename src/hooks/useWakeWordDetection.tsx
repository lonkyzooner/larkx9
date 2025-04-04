import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { processVoiceCommand } from '../lib/openai-service';

const WAKE_WORDS = ['hey lark', 'hey l.a.r.k', 'ok lark', 'activate lark'];

export function useWakeWordDetection() {
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [isListeningForCommand, setIsListeningForCommand] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    transcript,
    listening,
    startListening,
    stopListening,
    hasRecognitionSupport
  } = useSpeechRecognition();
  
  // Start listening for wake word
  const startWakeWordDetection = useCallback(() => {
    setIsWakeWordActive(true);
    startListening();
  }, [startListening]);
  
  // Stop wake word detection
  const stopWakeWordDetection = useCallback(() => {
    setIsWakeWordActive(false);
    setIsListeningForCommand(false);
    stopListening();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [stopListening]);
  
  // Process transcript for wake word
  useEffect(() => {
    if (!transcript || !isWakeWordActive) return;
    
    const normalizedTranscript = transcript.toLowerCase().trim();
    
    // Check if transcript contains wake word
    const isWakeWord = WAKE_WORDS.some(word => 
      normalizedTranscript.includes(word)
    );
    
    if (isWakeWord) {
      console.log('Wake word detected');
      setIsListeningForCommand(true);
      
      // Stop listening after 10 seconds if no command is received
      timeoutRef.current = setTimeout(() => {
        setIsListeningForCommand(false);
      }, 10000);
      
      // Remove the wake word from transcript
      const commandText = WAKE_WORDS.reduce(
        (text, word) => text.replace(word, '').trim(),
        normalizedTranscript
      );
      
      // If there's additional text after wake word, process it as a command
      if (commandText) {
        processVoiceCommand(commandText);
      }
    }
  }, [transcript, isWakeWordActive]);
  
  return {
    isWakeWordActive,
    isListeningForCommand,
    startWakeWordDetection,
    stopWakeWordDetection,
    hasRecognitionSupport
  };
}
