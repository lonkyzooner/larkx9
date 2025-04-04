import { BehaviorSubject, Subject } from 'rxjs';

// Constants for voice synthesis configuration
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const DEFAULT_VOICE = 'ash'; // Standard voice for all LARK components (OpenAI voices: alloy, echo, fable, onyx, nova, shimmer, ash)
const DEFAULT_MODEL = 'tts-1'; // OpenAI TTS models: tts-1 (faster) or tts-1-hd (higher quality)
const DEFAULT_RESPONSE_FORMAT = 'mp3'; // Response formats: mp3, opus, aac, flac

// Streaming configuration
const ENABLE_STREAMING = true; // Enable streaming by default for better responsiveness
const STREAM_CHUNK_SIZE = 1024; // Size of chunks to process when streaming

// Error handling configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Define types for voice synthesis events and states
export type SynthesisState = 'idle' | 'synthesizing' | 'speaking' | 'error';

export interface VoiceSynthesisEvent {
  type: 'synthesis_start' | 'synthesis_complete' | 'playback_start' | 'playback_complete' | 'error' | 'state_change' | 'network_issue' | 'api_issue' | 'streaming_progress';
  payload: any;
}

// Define type for speech queue items
export interface SpeechQueueItem {
  text: string;
  voice: string;
  streamingEnabled?: boolean;
}

export class OpenAIVoiceService {
  private isSpeaking = new BehaviorSubject<boolean>(false);
  private currentAudio: HTMLAudioElement | null = null;
  private speakQueue: SpeechQueueItem[] = [];
  private isProcessing = false;
  private retryCount = 0;
  private errorEvent = new BehaviorSubject<any>(null);
  private synthesisState = new BehaviorSubject<SynthesisState>('idle');
  private events = new Subject<VoiceSynthesisEvent>();
  private networkStatus = navigator.onLine;
  private lastSynthesisTime = 0;
  private synthesisAttempts = 0;
  private synthesisSuccesses = 0;
  private audioContext: AudioContext | null = null;
  private mediaSource: MediaSource | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;

  constructor() {
    console.log('[OpenAIVoice] Service initialized');
    this.validateConfiguration();
    
    // Monitor network status for better error handling
    window.addEventListener('online', this.handleNetworkChange.bind(this));
    window.addEventListener('offline', this.handleNetworkChange.bind(this));
  }

  private validateConfiguration(): void {
    if (!OPENAI_API_KEY) {
      console.error('[OpenAIVoice] OpenAI API key not configured');
      this.emitEvent('error', { 
        type: 'configuration_error',
        message: 'OpenAI API key not configured',
        recoverable: false
      });
      this.synthesisState.next('error');
    }
  }
  
  /**
   * Handle network status changes
   */
  private handleNetworkChange(): void {
    const isOnline = navigator.onLine;
    this.networkStatus = isOnline;
    
    if (!isOnline) {
      console.warn('[OpenAIVoice] Network connection lost');
      this.emitEvent('network_issue', { 
        online: false,
        message: 'Network connection lost. Voice synthesis may be unavailable.'
      });
    } else {
      console.log('[OpenAIVoice] Network connection restored');
      this.emitEvent('network_issue', { 
        online: true,
        message: 'Network connection restored.'
      });
      
      // Retry any pending synthesis if we're back online
      if (this.speakQueue.length > 0 && !this.isProcessing) {
        this.processQueue();
      }
    }
  }

  /**
   * Get the current speaking state
   */
  public getSpeakingState() {
    return this.isSpeaking.asObservable();
  }

  /**
   * Get the synthesis state
   */
  public getSynthesisState() {
    return this.synthesisState.asObservable();
  }

  /**
   * Get the error event
   */
  public getErrorEvent() {
    return this.errorEvent.asObservable();
  }
  
  /**
   * Get all voice synthesis events
   */
  public getEvents() {
    return this.events.asObservable();
  }

  /**
   * Speak text using OpenAI TTS
   * @param text The text to synthesize
   * @param voice The voice to use (alloy, echo, fable, onyx, nova, shimmer)
   * @param streamingEnabled Whether to enable streaming (default: true)
   */
  public async speak(text: string, voice = DEFAULT_VOICE, streamingEnabled = ENABLE_STREAMING): Promise<void> {
    if (!text || text.trim() === '') {
      throw new Error('Cannot synthesize empty text');
    }

    // Update state
    this.isSpeaking.next(true);
    this.synthesisState.next('synthesizing');
    this.emitEvent('synthesis_start', { text, timestamp: Date.now() });
    
    // Add to queue with voice parameter and streaming option
    this.speakQueue.push({ text, voice, streamingEnabled });
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Process the speak queue
   */
  private async processQueue(): Promise<void> {
    if (this.speakQueue.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const text = this.speakQueue[0];
      
      // Log synthesis attempt for analytics
      this.synthesisAttempts++;
      this.lastSynthesisTime = Date.now();
      
      try {
        // Create request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        
        const queueItem = text as SpeechQueueItem;
        const voiceToUse = queueItem.voice || DEFAULT_VOICE;
        const streamingEnabled = queueItem.streamingEnabled ?? ENABLE_STREAMING;
        const responseFormat = streamingEnabled ? 'opus' : DEFAULT_RESPONSE_FORMAT;
        
        // Make request to OpenAI TTS API
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            voice: voiceToUse,
            input: queueItem.text,
            response_format: responseFormat,
            speed: 1.0
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          let errorMessage = 'Unknown error';
          try {
            const errorText = await response.text();
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.error?.message || errorData.error || 'API error';
              console.error('[OpenAIVoice] OpenAI API error:', errorData);
            } catch (parseError) {
              errorMessage = errorText || `HTTP error ${response.status}`;
              console.error('[OpenAIVoice] OpenAI API error:', response.status, response.statusText, errorText);
            }
          } catch (textError) {
            errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
            console.error('[OpenAIVoice] OpenAI API error:', response.status, response.statusText);
          }
          throw new Error(`OpenAI API error: ${errorMessage}`);
        }
        
        // Process audio based on streaming preference
        if (streamingEnabled) {
          // Handle streaming response
          await this.handleStreamingResponse(response, queueItem.text);
        } else {
          // Handle regular response
          const audioBlob = await response.blob();
          if (audioBlob.size === 0) {
            throw new Error('Received empty audio response');
          }
          
          // Play the audio
          await this.playAudioFromBlob(audioBlob, queueItem.text);
        }
        
        // Remove from queue
        this.speakQueue.shift();
        
        this.emitEvent('synthesis_complete', { success: true, timestamp: Date.now() });
        this.synthesisSuccesses++;
        
        // Reset retry count on success
        this.retryCount = 0;
      } catch (error: any) {
        console.error('[OpenAIVoice] Error synthesizing speech:', error);
        
        // Handle specific error types
        if (error.name === 'AbortError') {
          console.warn('[OpenAIVoice] Request timed out, retrying...');
          // Keep in queue for retry
        } else if (error.message?.includes('API key')) {
          // API key error - critical
          this.errorEvent.next({
            type: 'api_key_error',
            message: 'Invalid API key. Please check your OpenAI API key configuration.',
            timestamp: Date.now(),
            recoverable: false
          });
          // Remove from queue as retrying won't help
          this.speakQueue.shift();
        } else if (error.message?.includes('network') || !navigator.onLine) {
          // Network error - can retry
          this.errorEvent.next({
            type: 'network_error',
            message: 'Network error. Please check your internet connection.',
            timestamp: Date.now(),
            recoverable: true
          });
          // Keep in queue for retry
        } else {
          // Other API errors
          this.errorEvent.next({
            type: 'api_error',
            message: error.message || 'Error synthesizing speech',
            timestamp: Date.now(),
            recoverable: this.retryCount < MAX_RETRIES
          });
          
          // Increment retry count
          this.retryCount++;
          
          // Remove from queue if max retries reached
          if (this.retryCount >= MAX_RETRIES) {
            console.error('[OpenAIVoice] Max retries reached, removing from queue');
            this.speakQueue.shift();
            this.retryCount = 0;
          }
        }
        
        this.emitEvent('error', { 
          error: error.message || 'Unknown error',
          timestamp: Date.now()
        });
      }
    } finally {
      this.isProcessing = false;
      
      // If queue is not empty, process next item
      if (this.speakQueue.length > 0) {
        // Add small delay before next request
        setTimeout(() => this.processQueue(), RETRY_DELAY);
      } else {
        // Reset speaking state when queue is empty
        this.isSpeaking.next(false);
        this.synthesisState.next('idle');
      }
    }
  }

  /**
   * Handle streaming response from OpenAI API
   */
  private async handleStreamingResponse(response: Response, text: string): Promise<void> {
    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Initialize audio context if needed
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Set up media source if needed
    if (typeof MediaSource !== 'undefined') {
      this.mediaSource = new MediaSource();
    } else {
      console.warn('[OpenAIVoice] MediaSource API not supported, falling back to non-streaming mode');
      const blob = await response.blob();
      return this.playAudioFromBlob(blob, text);
    }

    // Create a reader for the response body stream
    const reader = response.body.getReader();
    
    // Create a new audio element for streaming
    const audio = new Audio();
    this.currentAudio = audio;
    
    // Set up event handlers
    audio.onplay = () => {
      this.synthesisState.next('speaking');
      this.emitEvent('playback_start', { text, timestamp: Date.now() });
    };
    
    audio.onended = () => {
      this.emitEvent('playback_complete', { text, timestamp: Date.now() });
      this.currentAudio = null;
    };
    
    audio.onerror = (error) => {
      console.error('[OpenAIVoice] Audio playback error:', error);
      this.emitEvent('error', { 
        type: 'playback_error',
        message: 'Error playing audio',
        timestamp: Date.now()
      });
      this.currentAudio = null;
    };

    try {
      // Create a buffer to collect chunks
      const chunks: Uint8Array[] = [];
      let totalLength = 0;
      
      // Read chunks from the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        totalLength += value.length;
        
        // Emit progress event
        this.emitEvent('streaming_progress', { 
          bytesReceived: totalLength,
          timestamp: Date.now() 
        });
      }
      
      // Combine all chunks into a single Uint8Array
      const allChunks = new Uint8Array(totalLength);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }
      
      // Convert to blob and play
      const audioBlob = new Blob([allChunks], { type: 'audio/opus' });
      const audioUrl = URL.createObjectURL(audioBlob);
      audio.src = audioUrl;
      
      await audio.play();
      
      return new Promise((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.emitEvent('playback_complete', { text, timestamp: Date.now() });
          this.currentAudio = null;
          resolve();
        };
      });
    } catch (error) {
      console.error('[OpenAIVoice] Error streaming audio:', error);
      throw error;
    }
  }

  /**
   * Play audio from blob
   */
  private async playAudioFromBlob(audioBlob: Blob, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Stop any currently playing audio
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio = null;
        }
        
        // Create audio URL
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;
        
        // Set up event handlers
        audio.onplay = () => {
          this.synthesisState.next('speaking');
          this.emitEvent('playback_start', { 
            text, 
            timestamp: Date.now() 
          });
        };
        
        audio.onended = () => {
          this.emitEvent('playback_complete', { 
            text, 
            timestamp: Date.now() 
          });
          
          // Clean up
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          
          resolve();
        };
        
        audio.onerror = (error) => {
          console.error('[OpenAIVoice] Audio playback error:', error);
          this.emitEvent('error', { 
            type: 'playback_error',
            message: 'Error playing audio',
            timestamp: Date.now()
          });
          
          // Clean up
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          
          reject(new Error('Audio playback error'));
        };
        
        // Start playback
        audio.play().catch(error => {
          console.error('[OpenAIVoice] Audio play error:', error);
          reject(error);
        });
      } catch (error) {
        console.error('[OpenAIVoice] Error in playAudioFromBlob:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop current speech
   */
  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    
    // Clear queue
    this.speakQueue = [];
    this.isProcessing = false;
    this.isSpeaking.next(false);
    this.synthesisState.next('idle');
  }

  /**
   * Emit event
   */
  private emitEvent(type: VoiceSynthesisEvent['type'], payload: any): void {
    this.events.next({ type, payload });
  }
}

// Create singleton instance
export const openAIVoiceService = new OpenAIVoiceService();
