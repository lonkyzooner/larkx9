import { useState, useEffect, useCallback, useRef } from 'react';
import { liveKitVoiceService } from '../services/livekit/LiveKitVoiceService';

interface TTSOptions {
  volume?: number;
  voice?: string;
  streamingEnabled?: boolean;
}

interface SimulatedTTSHook {
  speaking: boolean;
  speak: (text: string, options?: TTSOptions) => Promise<void>;
  stop: () => void;
  error: string | null;
}

// OpenAI realtime voice 'ash' through LiveKit is consistently used for all LARK speech output
export function useSimulatedTTS(): SimulatedTTSHook {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Set up subscriptions to LiveKitVoiceService observables
  useEffect(() => {
    const speakingSubscription = liveKitVoiceService.getSpeakingState().subscribe(isSpeaking => {
      setSpeaking(isSpeaking);
    });

    const errorSubscription = liveKitVoiceService.getErrorEvent().subscribe(err => {
      if (err) {
        setError(`TTS Error: ${err.message || 'Unknown error'}`);
      } else {
        setError(null);
      }
    });

    return () => {
      speakingSubscription.unsubscribe();
      errorSubscription.unsubscribe();
    };
  }, []);

  const stop = useCallback(() => {
    liveKitVoiceService.stop();
  }, []);

  const speak = useCallback(async (text: string, options?: TTSOptions) => {
    try {
      if (speaking) {
        stop();
      }
      setError(null); // Clear any previous errors
      
      console.log('Using OpenAI realtime voice "ash" through LiveKit for TTS with text:', text.substring(0, 50) + '...');
      
      // Always use 'ash' voice for consistency across all components
      await liveKitVoiceService.speak(text, 'ash');
      
      console.log('Successfully initiated speech synthesis with LiveKit');
    } catch (error) {
      console.error('LiveKit TTS error:', error);
      
      // More descriptive error message for users
      let errorMessage = 'Unknown TTS error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = 'Error converting TTS error to string';
        }
      }
      
      // Log additional information for debugging
      console.log('LiveKit API Error Details:', errorMessage);
      
      setError(`TTS Error: ${errorMessage}`);
    }
  }, [speaking, stop]);

  return {
    speaking,
    speak,
    stop,
    error
  };
}
