import React, { useState, useEffect } from 'react';
import { useVoice } from '../contexts/VoiceContext';
import { openAIVoiceService, SynthesisState, VoiceSynthesisEvent } from '../services/voice/OpenAIVoiceService';
import { LoaderIcon, VolumeIcon, StopCircleIcon, AlertCircleIcon, CheckCircleIcon } from 'lucide-react';

// Sample text for demonstration
const SAMPLE_TEXT = "Hello, I'm LARK, your Law Enforcement Assistant for Reconnaissance and Knowledge. How can I help you today?";

// Available voices
const VOICES = [
  { id: 'alloy', name: 'Alloy', description: 'Versatile, neutral voice' },
  { id: 'echo', name: 'Echo', description: 'Balanced, clear voice' },
  { id: 'fable', name: 'Fable', description: 'Expressive, narrative voice' },
  { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative voice' },
  { id: 'nova', name: 'Nova', description: 'Warm, friendly voice' },
  { id: 'shimmer', name: 'Shimmer', description: 'Bright, optimistic voice' }
];

const OpenAIVoiceTest: React.FC = () => {
  // State
  const [text, setText] = useState(SAMPLE_TEXT);
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [status, setStatus] = useState('Ready to test OpenAI voice synthesis');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [synthesisState, setSynthesisState] = useState<SynthesisState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Get voice context
  const voiceContext = useVoice();

  // Subscribe to voice service events
  useEffect(() => {
    // Subscribe to speaking state
    const speakingSubscription = openAIVoiceService.getSpeakingState().subscribe(speaking => {
      setIsSpeaking(speaking);
    });

    // Subscribe to synthesis state
    const stateSubscription = openAIVoiceService.getSynthesisState().subscribe(state => {
      setSynthesisState(state);
      
      // Update status based on state
      switch (state) {
        case 'idle':
          setStatus('Ready to test OpenAI voice synthesis');
          break;
        case 'synthesizing':
          setStatus('Generating audio from text...');
          break;
        case 'speaking':
          setStatus(`Speaking with ${selectedVoice} voice...`);
          break;
        case 'error':
          setStatus('Error occurred during voice synthesis');
          break;
      }
    });

    // Subscribe to error events
    const errorSubscription = openAIVoiceService.getErrorEvent().subscribe(err => {
      if (err) {
        setError(err.message || 'Unknown error occurred');
        setStatus(`Error: ${err.message || 'Unknown error'}`);
      } else {
        setError(null);
      }
    });

    // Subscribe to voice events
    const eventsSubscription = openAIVoiceService.getEvents().subscribe((event: VoiceSynthesisEvent) => {
      console.log('[OpenAIVoiceTest] Event:', event.type, event.payload);
      
      // Handle network events
      if (event.type === 'network_issue') {
        setIsOnline(event.payload.online);
      }
      
      // Handle playback events
      if (event.type === 'playback_complete') {
        setStatus('Playback completed successfully');
      }
    });

    // Network status listener
    const handleNetworkChange = () => {
      setIsOnline(navigator.onLine);
    };
    
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    // Cleanup subscriptions
    return () => {
      speakingSubscription.unsubscribe();
      stateSubscription.unsubscribe();
      errorSubscription.unsubscribe();
      eventsSubscription.unsubscribe();
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, [selectedVoice]);

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setError(null); // Clear any errors when text changes
  };

  // Handle voice selection
  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVoice(e.target.value);
  };

  // Handle speak button click
  const handleSpeak = async () => {
    if (!text.trim()) {
      setStatus('Please enter text to speak');
      return;
    }
    
    setError(null);
    
    try {
      // Use the voice context if available, otherwise use the service directly
      if (voiceContext && voiceContext.speak) {
        await voiceContext.speak(text, selectedVoice);
      } else {
        // Fallback to direct service call
        await openAIVoiceService.speak(text, selectedVoice);
      }
    } catch (err) {
      console.error('Error speaking:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Handle stop button click
  const handleStop = () => {
    if (voiceContext && voiceContext.stopSpeaking) {
      voiceContext.stopSpeaking();
    } else {
      // Fallback to direct service call
      openAIVoiceService.stop();
    }
    setStatus('Speech stopped');
  };

  return (
    <div className="space-y-4 text-white/90">
      {/* Network status alert */}
      {!isOnline && (
        <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 p-2 rounded flex items-center gap-2">
          <AlertCircleIcon className="h-4 w-4" />
          <span className="text-xs">Network offline. Voice synthesis requires internet connection.</span>
        </div>
      )}
      
      {/* Error alert */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 p-2 rounded flex items-center gap-2">
          <AlertCircleIcon className="h-4 w-4" />
          <span className="text-xs">{error}</span>
        </div>
      )}
      
      {/* Text input */}
      <div className="space-y-2">
        <label className="text-xs text-blue-300">Text to speak:</label>
        <textarea
          value={text}
          onChange={handleTextChange}
          className="w-full h-24 bg-black/70 border border-blue-900/50 rounded p-2 text-white/90"
          placeholder="Enter text to speak..."
        />
      </div>
      
      {/* Voice selection */}
      <div className="space-y-2">
        <label className="text-xs text-blue-300">Select voice:</label>
        <select 
          value={selectedVoice}
          onChange={handleVoiceChange}
          className="w-full bg-black/70 border border-blue-900/50 rounded p-2 text-white/90"
        >
          {VOICES.map(voice => (
            <option key={voice.id} value={voice.id}>
              {voice.name} - {voice.description}
            </option>
          ))}
        </select>
      </div>
      
      {/* Control buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSpeak}
          disabled={isSpeaking || !isOnline}
          className={`px-4 py-2 rounded flex items-center gap-1 ${
            isSpeaking || !isOnline ? 'bg-blue-900/30 text-blue-300/50' : 'bg-blue-700 hover:bg-blue-800 text-white'
          }`}
        >
          {synthesisState === 'synthesizing' ? (
            <>
              <LoaderIcon className="h-4 w-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : synthesisState === 'speaking' ? (
            <>
              <VolumeIcon className="h-4 w-4 animate-pulse" />
              <span>Speaking...</span>
            </>
          ) : (
            <>
              <VolumeIcon className="h-4 w-4" />
              <span>Speak</span>
            </>
          )}
        </button>
        
        <button
          onClick={handleStop}
          disabled={!isSpeaking}
          className={`px-4 py-2 rounded flex items-center gap-1 ${
            !isSpeaking ? 'bg-red-900/30 text-red-300/50' : 'bg-red-700 hover:bg-red-800 text-white'
          }`}
        >
          <StopCircleIcon className="h-4 w-4" />
          <span>Stop</span>
        </button>
      </div>
      
      {/* Status */}
      <div className="border border-blue-900/50 bg-black/70 p-3 rounded flex items-center gap-2">
        {synthesisState === 'synthesizing' && <LoaderIcon className="h-4 w-4 text-blue-400 animate-spin" />}
        {synthesisState === 'speaking' && <VolumeIcon className="h-4 w-4 text-blue-400 animate-pulse" />}
        {synthesisState === 'idle' && !error && <CheckCircleIcon className="h-4 w-4 text-green-400" />}
        {synthesisState === 'error' && <AlertCircleIcon className="h-4 w-4 text-red-400" />}
        <p className="text-sm">{status}</p>
      </div>
      
      {/* Sample texts */}
      <div className="space-y-2">
        <label className="text-xs text-blue-300">Sample texts:</label>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setText("Hello, I'm LARK, your Law Enforcement Assistant for Reconnaissance and Knowledge. How can I help you today?")}
            className="text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 px-2 py-1 rounded"
            disabled={isSpeaking}
          >
            Greeting
          </button>
          <button 
            onClick={() => setText("Miranda warning: You have the right to remain silent. Anything you say can and will be used against you in a court of law. You have the right to an attorney. If you cannot afford an attorney, one will be provided for you.")}
            className="text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 px-2 py-1 rounded"
            disabled={isSpeaking}
          >
            Miranda
          </button>
          <button 
            onClick={() => setText("Tactical situation assessment: Three suspects observed at the north entrance. Proceed with caution and maintain visual contact. Backup units are en route to your location.")}
            className="text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 px-2 py-1 rounded"
            disabled={isSpeaking}
          >
            Tactical
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenAIVoiceTest;
