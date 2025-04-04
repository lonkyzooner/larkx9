import { useState, useEffect, useCallback } from 'react';
import { liveKitVoiceService } from '../services/livekit/LiveKitVoiceService';
import { SynthesisState } from '../services/livekit/LiveKitVoiceService';

/**
 * Custom hook for using LiveKit voice services in components
 * Provides a simple interface for speaking text and managing speech state
 */
export const useLiveKitVoice = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [synthesisState, setSynthesisState] = useState<SynthesisState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Set up subscriptions to LiveKitVoiceService observables
  useEffect(() => {
    const speakingSubscription = liveKitVoiceService.getSpeakingState().subscribe(speaking => {
      setIsSpeaking(speaking);
    });

    const stateSubscription = liveKitVoiceService.getSynthesisState().subscribe(state => {
      setSynthesisState(state);
    });

    const errorSubscription = liveKitVoiceService.getErrorEvent().subscribe(err => {
      if (err) {
        setError(err.message || 'Unknown error in voice synthesis');
        console.error('[useLiveKitVoice] Error:', err);
      } else {
        setError(null);
      }
    });

    return () => {
      speakingSubscription.unsubscribe();
      stateSubscription.unsubscribe();
      errorSubscription.unsubscribe();
    };
  }, []);

  // Speak text using LiveKit voice service
  const speak = useCallback(async (text: string, voice?: string) => {
    if (!text) return;
    
    try {
      // Log the request for both typed and spoken input
      console.log(`[useLiveKitVoice] Speaking text (${voice || 'default voice'}): ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      
      // Use the LiveKit voice service to speak the text
      await liveKitVoiceService.speak(text, voice);
    } catch (err) {
      console.error('[useLiveKitVoice] Error speaking text:', err);
      setError(err instanceof Error ? err.message : 'Unknown error speaking text');
    }
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    liveKitVoiceService.stop();
  }, []);

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    synthesisState,
    error
  };
};

export default useLiveKitVoice;
