import { useEffect, useState } from 'react';

export function VoiceIndicator() {
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);

  useEffect(() => {
    // Listen for audio detection events
    const handleAudioDetected = (event: CustomEvent) => {
      setIsActive(true);
      setTranscript(event.detail.transcript);
      setConfidence(event.detail.confidence || 0);
      
      // Show the indicator for 3 seconds
      setTimeout(() => {
        setIsActive(false);
      }, 3000);
    };

    // Listen for interim transcript events
    const handleInterimTranscript = (event: CustomEvent) => {
      setIsActive(true);
      setTranscript(event.detail.transcript);
      
      // Show the indicator for 2 seconds
      setTimeout(() => {
        setIsActive(false);
      }, 2000);
    };

    // Add event listeners
    window.addEventListener('lark-audio-detected', handleAudioDetected as EventListener);
    window.addEventListener('lark-interim-transcript', handleInterimTranscript as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('lark-audio-detected', handleAudioDetected as EventListener);
      window.removeEventListener('lark-interim-transcript', handleInterimTranscript as EventListener);
    };
  }, []);

  if (!isActive) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 
                    bg-blue-600/90 text-white px-4 py-2 rounded-full 
                    shadow-lg flex items-center gap-2 animate-fadeIn">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
        <div className="relative h-3 w-3 bg-blue-300 rounded-full"></div>
      </div>
      <div className="text-sm font-medium">
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
