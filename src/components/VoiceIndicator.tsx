import React, { useEffect, useState, useCallback, useRef } from 'react';
import { voiceRecognitionService } from '../services/voice/VoiceRecognitionService';

export function VoiceIndicator() {
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'exiting'>('entering');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any existing timeout to prevent memory leaks
  const clearActiveTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Handle showing and hiding the indicator with proper animation states
  const showIndicator = useCallback((text: string, conf: number) => {
    clearActiveTimeout();
    
    // Update state immediately
    setTranscript(text);
    setConfidence(conf);
    setIsActive(true);
    setAnimationState('entering');
    
    // After a brief delay, change to visible state
    setTimeout(() => {
      setAnimationState('visible');
    }, 50);
    
    // Set timeout to hide after delay
    timeoutRef.current = setTimeout(() => {
      setAnimationState('exiting');
      
      // After exit animation completes, hide completely
      setTimeout(() => {
        setIsActive(false);
      }, 300); // Match this with CSS transition duration
    }, 2000);
  }, [clearActiveTimeout]);

  useEffect(() => {
    // Subscribe to voice recognition events with optimized handler
    let subscription;
    try {
      subscription = voiceRecognitionService.getEvents().subscribe(event => {
        if (event.type === 'interim_transcript' || event.type === 'command_detected') {
          const transcriptText = event.payload.transcript || '';
          const confidenceValue = event.payload.confidence || 0;
          
          // Show indicator with the new text and confidence
          showIndicator(transcriptText, confidenceValue);
          
          // Dispatch custom event for backward compatibility
          // Use requestAnimationFrame for better performance
          requestAnimationFrame(() => {
            const customEvent = new CustomEvent('lark-interim-transcript', {
              detail: {
                transcript: transcriptText,
                confidence: confidenceValue
              }
            });
            window.dispatchEvent(customEvent);
          });
        }
      });
    } catch (error) {
      console.warn('Voice recognition service initialization failed:', error);
      // Use a dummy subscription that can be safely unsubscribed
      subscription = { unsubscribe: () => {} };
      
      // Show a message indicating development mode
      showIndicator('Dev Mode: API Keys Not Set', 1);
    }
    
    // Also keep the original event listeners for backward compatibility but with improved performance
    const handleAudioDetected = useCallback((event: CustomEvent) => {
      const transcriptText = event.detail.transcript || '';
      const confidenceValue = event.detail.confidence || 0;
      
      // Use the same show indicator function for consistency
      showIndicator(transcriptText, confidenceValue);
    }, [showIndicator]);

    const handleInterimTranscript = useCallback((event: CustomEvent) => {
      const transcriptText = event.detail.transcript || '';
      const confidenceValue = event.detail.confidence || 0;
      
      // Use the same show indicator function for consistency
      showIndicator(transcriptText, confidenceValue);
    }, [showIndicator]);

    // Add event listeners
    window.addEventListener('lark-audio-detected', handleAudioDetected as EventListener);
    window.addEventListener('lark-interim-transcript', handleInterimTranscript as EventListener);
    
    // Clean up
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      window.removeEventListener('lark-audio-detected', handleAudioDetected as EventListener);
      window.removeEventListener('lark-interim-transcript', handleInterimTranscript as EventListener);
    };
  }, []);

  // Only render when active
  if (!isActive) return null;

  // Apply different animation classes based on state
  const animationClasses = {
    entering: 'animate-fadeIn opacity-0',
    visible: 'opacity-100',
    exiting: 'animate-fadeOut'
  }[animationState];

  return (
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 
                    bg-blue-600/90 text-white px-4 py-2 rounded-full 
                    shadow-lg flex items-center gap-2 transition-opacity duration-300 ${animationClasses}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
        <div className="relative h-3 w-3 bg-blue-300 rounded-full"></div>
      </div>
      <div className="text-sm font-medium truncate max-w-[200px]">
        {transcript ? `Heard: "${transcript}"` : "Voice detected"}
      </div>
      {confidence > 0 && (
        <div className="text-xs bg-blue-700/50 px-2 py-0.5 rounded-full">
          {Math.round(confidence * 100)}%
        </div>
      )}
    </div>
  );
}
