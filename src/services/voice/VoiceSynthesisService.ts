import { BehaviorSubject, Subject } from 'rxjs';
import { indexedDBService } from '../../lib/indexeddb-service';
import { v4 as uuidv4 } from 'uuid';
import { liveKitVoiceService } from '../livekit/LiveKitVoiceService';

// Constants for voice synthesis configuration
const DEFAULT_VOICE = 'ash'; // Standard voice for all LARK components using OpenAI realtime voice through LiveKit
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Log initialization
console.log('[VoiceSynthesis] Service initializing with OpenAI voice synthesis');

// Error handling configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 10000; // 10 seconds
const PLAYBACK_TIMEOUT = 30000; // 30 seconds

// Define types for voice synthesis events and states
export type SynthesisState = 'idle' | 'synthesizing' | 'speaking' | 'error';

export interface VoiceSynthesisEvent {
  type: 'synthesis_start' | 'synthesis_complete' | 'playback_start' | 'playback_complete' | 'error' | 'state_change' | 'network_issue' | 'api_issue';
  payload: any;
}

export class VoiceSynthesisService {
  private isSpeaking = new BehaviorSubject<boolean>(false);
  private currentAudio: HTMLAudioElement | null = null;
  private speakQueue: string[] = [];
  private isProcessing = false;
  private retryCount = 0;
  private errorEvent = new BehaviorSubject<any>(null);
  private synthesisState = new BehaviorSubject<SynthesisState>('idle');
  private events = new Subject<VoiceSynthesisEvent>();
  private networkStatus = navigator.onLine;
  private lastSynthesisTime = 0;
  private synthesisAttempts = 0;
  private synthesisSuccesses = 0;

  constructor() {
    console.log('[VoiceSynthesis] Service initialized with OpenAI voice synthesis');
    this.validateConfiguration();
    
    // Monitor network status for better error handling
    window.addEventListener('online', this.handleNetworkChange.bind(this));
    window.addEventListener('offline', this.handleNetworkChange.bind(this));
  }

  private validateConfiguration(): void {
    if (!OPENAI_API_KEY) {
      console.error('[VoiceSynthesis] OpenAI API key not configured');
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
      console.warn('[VoiceSynthesis] Network connection lost');
      this.emitEvent('network_issue', { 
        online: false,
        message: 'Network connection lost. Voice synthesis may be unavailable.'
      });
    } else {
      console.log('[VoiceSynthesis] Network connection restored');
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
   * Preprocess text to ensure correct pronunciation
   * This handles special cases like ensuring LARK is pronounced as a word
   */
  private preprocessTextForSpeech(text: string): string {
    // Replace LARK with Lark to ensure it's pronounced as a word, not spelled out
    // Using word boundaries to only match the standalone word
    let processedText = text.replace(/\bLARK\b/g, 'Lark');
    
    // Add more pronunciation corrections as needed
    
    return processedText;
  }

  /**
   * Speak text using LiveKit voice service with fallback to OpenAI voice
   */
  public async speak(text: string, voice = DEFAULT_VOICE): Promise<void> {
    if (!text || text.trim() === '') {
      throw new Error('Cannot synthesize empty text');
    }
    
    // Preprocess text for correct pronunciation
    const processedText = this.preprocessTextForSpeech(text);

    // Update state
    this.isSpeaking.next(true);
    this.synthesisState.next('synthesizing');
    this.emitEvent('synthesis_start', { text: processedText, timestamp: Date.now() });
    
    // Try to use LiveKit voice service first (with fallback mechanisms)
    try {
      // Use the singleton instance of LiveKitVoiceService
      console.log('[VoiceSynthesis] Attempting to use LiveKit voice service');
      
      // Set up event listeners to update our state
      const onSpeakingChange = (isSpeaking: boolean) => {
        console.log('[VoiceSynthesis] Speaking state changed:', isSpeaking);
        this.isSpeaking.next(isSpeaking);
        if (!isSpeaking) {
          this.synthesisState.next('idle');
          this.emitEvent('playback_complete', { timestamp: Date.now() });
        }
      };
      
      const onStateChange = (state: string) => {
        console.log('[VoiceSynthesis] Synthesis state changed:', state);
        if (state === 'speaking') {
          this.synthesisState.next('speaking');
          this.emitEvent('playback_start', { timestamp: Date.now() });
        } else if (state === 'error') {
          // Let the error handling below catch this
          throw new Error('LiveKit voice synthesis error');
        }
      };
      
      // Subscribe to events
      const isSpeakingSub = liveKitVoiceService.getSpeakingState().subscribe(onSpeakingChange);
      const stateSub = liveKitVoiceService.getSynthesisState().subscribe(onStateChange);
      
      // Speak the text using LiveKit (with fallback mechanisms)
      // Always use 'ash' voice for OpenAI realtime voice through LiveKit
      console.log('[VoiceSynthesis] Using OpenAI realtime voice: ash through LiveKit');
      console.log('[VoiceSynthesis] Original text:', text);
      console.log('[VoiceSynthesis] Processed text for pronunciation:', processedText);
      await liveKitVoiceService.speak(processedText, 'ash');
      
      // Cleanup subscriptions
      setTimeout(() => {
        isSpeakingSub.unsubscribe();
        stateSub.unsubscribe();
      }, 1000);
      
      // If we get here, LiveKit successfully handled the speech
      return;
    } catch (liveKitError) {
      console.warn('[VoiceSynthesis] LiveKit voice synthesis failed, attempting direct OpenAI fallback:', liveKitError);
      // Don't set fallback flag, instead try direct OpenAI approach
      try {
        console.log('[VoiceSynthesis] Using OpenAI API directly as fallback');
        await this.synthesizeWithOpenAIDirectly(processedText, 'ash');
        return;
      } catch (openAIError) {
        console.error('[VoiceSynthesis] Direct OpenAI fallback also failed:', openAIError);
        // Now continue with other fallbacks
      }
    }
    
    // First check if we have this audio cached
    try {
      const cachedAudio = await this.findCachedAudio(processedText);
      if (cachedAudio) {
        console.log('[VoiceSynthesis] Using cached audio');
        return this.playAudioFromBlob(cachedAudio.audio, processedText);
      }
    } catch (cacheError) {
      console.warn('[VoiceSynthesis] Cache check failed:', cacheError);
      // Continue with online synthesis
    }
    
    // If we're offline, try to find a similar cached audio
    if (!navigator.onLine) {
      try {
        const similarAudio = await this.findSimilarCachedAudio(text);
        if (similarAudio) {
          console.log('[VoiceSynthesis] Using similar cached audio while offline');
          this.emitEvent('network_issue', { 
            online: false,
            message: 'Using cached audio while offline.',
            timestamp: Date.now()
          });
          return this.playAudioFromBlob(similarAudio.audio, text);
        }
      } catch (offlineError) {
        console.warn('[VoiceSynthesis] Offline fallback failed:', offlineError);
      }
    }
    
    try {
      // Log synthesis attempt for analytics
      this.synthesisAttempts++;
      this.lastSynthesisTime = Date.now();
      
      // Prepare request with enhanced error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      
      try {
        // Prepare request for OpenAI TTS
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'tts-1',
            voice: voice,
            input: text,
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
              errorMessage = errorData.detail?.message || errorData.detail || errorData.message || response.statusText || 'API error';
              console.error('[VoiceSynthesis] ElevenLabs API error:', errorData);
            } catch (parseError) {
              errorMessage = errorText || `HTTP error ${response.status}`;
              console.error('[VoiceSynthesis] ElevenLabs API error:', response.status, response.statusText, errorText);
            }
          } catch (textError) {
            errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
            console.error('[VoiceSynthesis] ElevenLabs API error:', response.status, response.statusText);
          }
          throw new Error(`ElevenLabs API error: ${errorMessage}`);
        }
        
        // Process audio
        const audioBlob = await response.blob();
        if (audioBlob.size === 0) {
          throw new Error('Received empty audio response');
        }
        
        // Cache the audio for offline use
        await this.cacheAudioForOffline(text, audioBlob);
        
        // Play the audio
        await this.playAudioFromBlob(audioBlob, text);
        
        this.emitEvent('synthesis_complete', { success: true, timestamp: Date.now() });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      this.handleError(error);
      // Reset state
      this.isSpeaking.next(false);
      this.synthesisState.next('error');
      
      // Retry if appropriate
      if (this.shouldRetry(error)) {
        await this.retrySynthesis(text);
      } else {
        throw error; // Re-throw if we shouldn't retry
      }
    }
  }

  private async retrySynthesis(text: string): Promise<void> {
    if (this.retryCount >= MAX_RETRIES) {
      this.retryCount = 0;
      throw new Error(`Failed to synthesize speech after ${MAX_RETRIES} attempts`);
    }
    
    this.retryCount++;
    const delay = RETRY_DELAY * Math.pow(2, this.retryCount - 1);
    
    console.log(`[VoiceSynthesis] Retry attempt ${this.retryCount} of ${MAX_RETRIES} after ${delay}ms delay`);
    this.emitEvent('state_change', { state: 'retrying', attempt: this.retryCount, maxRetries: MAX_RETRIES });
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      // Call speak but bypass the retry mechanism to avoid infinite recursion
      await this.speakWithoutRetry(text);
      this.retryCount = 0; // Reset on success
    } catch (error) {
      // If still failing, try again or give up
      await this.retrySynthesis(text);
    }
  }
  
  /**
   * Synthesize speech directly with OpenAI API
   * @param text Text to synthesize
   * @param voice Voice to use (should be 'ash')
   */
  private async synthesizeWithOpenAIDirectly(text: string, voice: string = 'ash'): Promise<void> {
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }
    
    this.synthesisState.next('synthesizing');
    this.emitEvent('synthesis_start', { timestamp: Date.now() });
    
    // Make request to OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'ash', // Always use ash voice
        input: text,
        response_format: 'mp3',
        speed: 1.0
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    // Get audio data
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Create audio element if it doesn't exist
    if (!this.currentAudio) {
      this.currentAudio = new Audio();
    }
    
    // Set up event handlers
    this.currentAudio.onplay = () => {
      console.log('[VoiceSynthesis] OpenAI direct audio playback started');
      this.synthesisState.next('speaking');
      this.isSpeaking.next(true);
      this.emitEvent('playback_start', { timestamp: Date.now() });
    };
    
    this.currentAudio.onended = () => {
      console.log('[VoiceSynthesis] OpenAI direct audio playback ended');
      this.synthesisState.next('idle');
      this.isSpeaking.next(false);
      this.emitEvent('playback_complete', { timestamp: Date.now() });
      URL.revokeObjectURL(audioUrl); // Clean up
    };
    
    // Set source and play
    this.currentAudio.src = audioUrl;
    await this.currentAudio.play();
    
    // Cache the audio for future use
    try {
      await this.cacheAudioForOffline(text, audioBlob, 'ash');
    } catch (cacheError) {
      console.warn('[VoiceSynthesis] Failed to cache audio:', cacheError);
    }
  }

  /**
   * Internal method to speak without retry logic to avoid recursion
   */
  private async speakWithoutRetry(text: string, voice = DEFAULT_VOICE): Promise<void> {
    // Similar to speak() but without the retry logic
    // This prevents infinite recursion in the retry mechanism
    this.isSpeaking.next(true);
    this.synthesisState.next('synthesizing');
    
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: voice,
          input: text
        }),
      });
      
      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.onended = () => {
        this.isSpeaking.next(false);
        this.synthesisState.next('idle');
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };
      
      await this.currentAudio.play();
    } catch (error) {
      this.isSpeaking.next(false);
      this.synthesisState.next('error');
      throw error;
    }
  }
  
  /**
   * Determine if we should retry based on the error
   */
  private shouldRetry(error: any): boolean {
    // Don't retry for certain error types
    if (!error) return false;
    
    const errorMessage = error.message || '';
    
    // Don't retry for these cases
    if (errorMessage.includes('API key')) return false; // Auth issues won't be resolved by retry
    if (errorMessage.includes('empty text')) return false; // Invalid input won't be resolved by retry
    if (errorMessage.includes('exceeded your quota')) return false; // Quota issues won't be resolved by retry
    
    // Retry for network and temporary issues
    return (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      !navigator.onLine ||
      this.retryCount < MAX_RETRIES
    );
  }

  /**
   * Stop current speech
   */
  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isSpeaking.next(false);
    this.speakQueue = [];
    this.isProcessing = false;
    this.synthesisState.next('idle');
    this.emitEvent('state_change', { state: 'stopped' });
  }
  
  /**
   * Cache audio for offline use
   */
  private async cacheAudioForOffline(text: string, audioBlob: Blob, voice = DEFAULT_VOICE): Promise<void> {
    try {
      // Only cache if IndexedDB is available
      if (!indexedDBService) return;
      
      // Convert blob to base64 for storage
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data);
        };
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(audioBlob);
      const base64data = await base64Promise;
      
      // Store in IndexedDB
      await indexedDBService.cacheAudio({
        id: uuidv4(),
        text: text.toLowerCase().trim(),
        audioData: base64data,
        timestamp: Date.now(),
        voiceId: voice
      });
      
      console.log('[VoiceSynthesis] Audio cached successfully for offline use');
    } catch (error) {
      console.error('[VoiceSynthesis] Error caching audio:', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Process the speech queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.speakQueue.length > 0) {
      const text = this.speakQueue[0];
      let success = false;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`[VoiceSynthesis] Retry attempt ${attempt + 1} of ${MAX_RETRIES}`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
          }

          // Request speech from OpenAI with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

          const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'tts-1',
              voice: DEFAULT_VOICE,
              input: text
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            let errorMessage: string;
            try {
              const errorData = await response.json();
              errorMessage = errorData.detail || response.statusText;
            } catch {
              errorMessage = response.statusText;
            }

            // Handle specific error types
            if (response.status === 429) {
              throw new Error('OpenAI rate limit exceeded');
            } else if (response.status === 401 || response.status === 403) {
              throw new Error('Invalid OpenAI API key');
            } else if (response.status === 404) {
              throw new Error('OpenAI TTS endpoint not found');
            } else {
              throw new Error(`OpenAI API error: ${errorMessage}`);
            }
          }

          // Get audio blob and create URL
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);

          // Play the audio with timeout
          await new Promise<void>((resolve, reject) => {
            this.currentAudio = new Audio(audioUrl);
            
            const cleanup = () => {
              if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio = null;
              }
              this.isSpeaking.next(false);
              URL.revokeObjectURL(audioUrl);
            };

            // Set up playback timeout
            const playbackTimeoutId = setTimeout(() => {
              cleanup();
              reject(new Error('Audio playback timed out'));
            }, PLAYBACK_TIMEOUT);

            this.currentAudio.onplay = () => {
              this.isSpeaking.next(true);
            };

            this.currentAudio.onended = () => {
              clearTimeout(playbackTimeoutId);
              cleanup();
              resolve();
            };

            this.currentAudio.onerror = (e) => {
              clearTimeout(playbackTimeoutId);
              cleanup();
              reject(new Error('Audio playback failed: ' + e));
            };

            // Start playing
            this.currentAudio.play().catch(error => {
              clearTimeout(playbackTimeoutId);
              cleanup();
              reject(new Error('Failed to start audio playback: ' + error));
            });
          });

          success = true;
          break;

        } catch (error: any) {
          this.handleError(error);

          // Don't retry on certain errors
          if (error.message === 'Invalid OpenAI API key' || 
              error.message === 'OpenAI TTS endpoint not found' || 
              error.name === 'AbortError' || 
              attempt === MAX_RETRIES - 1) {
            throw error;
          }
        }
      }

      // Handle the current queue item
      if (success) {
        this.speakQueue.shift(); // Remove after successful playback
      } else {
        console.error('[VoiceSynthesis] Failed to synthesize after all retries');
        this.speakQueue.shift(); // Remove failed item and continue
      }
    }

    this.isProcessing = false;
  }

  private handleError(error: Error) {
    console.error('[VoiceSynthesis] Error:', error);
    let userFriendlyMessage = 'An unknown error occurred. Please try again later.';
    let errorType = 'unknown';
    let recoverable = true;
    let retryDelay = 2000; // Default retry delay in ms

    // Customize user feedback based on error type
    if (error.message.includes('Invalid ElevenLabs API key')) {
      userFriendlyMessage = 'Invalid API key. Please check your configuration.';
      errorType = 'api_key_error';
      recoverable = false;
    } else if (error.message.includes('rate limit')) {
      userFriendlyMessage = 'Rate limit exceeded. Please try again later.';
      errorType = 'rate_limit';
      retryDelay = 5000; // Longer delay for rate limits
    } else if (error.message.includes('not found')) {
      userFriendlyMessage = 'Requested voice ID not found. Please check your configuration.';
      errorType = 'voice_not_found';
      recoverable = false;
    } else if (error.message.includes('network') || error.name === 'NetworkError') {
      userFriendlyMessage = 'Network connection issue. Please check your internet connection.';
      errorType = 'network_error';
      retryDelay = 3000;
    } else if (error.name === 'AbortError') {
      userFriendlyMessage = 'Request timed out. Please try again.';
      errorType = 'timeout';
    } else if (error.message.includes('playback')) {
      userFriendlyMessage = 'Audio playback failed. Please try again.';
      errorType = 'playback_error';
    }

    // Update synthesis state
    this.synthesisState.next('error');
    
    // Log error for analytics
    this.logErrorToAnalytics(errorType, error.message || error.toString());

    // Emit error event for UI feedback
    this.emitEvent('error', { 
      type: errorType,
      message: userFriendlyMessage,
      recoverable,
      timestamp: Date.now(),
      retryDelay
    });
  }
  
  /**
   * Log errors to analytics for monitoring and improvement
   */
  private logErrorToAnalytics(errorType: string, errorDetails: string): void {
    try {
      // Store error in IndexedDB for later analysis
      indexedDBService.addItem('error_logs', {
        id: uuidv4(),
        errorType,
        errorDetails,
        timestamp: new Date().toISOString(),
        synthesisAttempts: this.synthesisAttempts,
        synthesisSuccesses: this.synthesisSuccesses,
        userAgent: navigator.userAgent,
        service: 'VoiceSynthesisService'
      });
    } catch (e) {
      console.error('Failed to log error to analytics:', e);
    }
  }

  /**
   * Find cached audio by exact text match
   */
  private async findCachedAudio(text: string): Promise<any> {
    try {
      // Only attempt if IndexedDB is available
      if (!indexedDBService) return null;
      
      // Normalize text for better matching
      const normalizedText = text.toLowerCase().trim();
      
      // Use a transaction to get items from the audio cache store
      return new Promise((resolve, reject) => {
        try {
          // Get the database transaction
          const transaction = indexedDBService['db']?.transaction(['audio_cache'], 'readonly');
          if (!transaction) {
            console.warn('[VoiceSynthesis] No database transaction available');
            return resolve(null);
          }
          
          const store = transaction.objectStore('audio_cache');
          const index = store.index('text');
          
          // Look for exact text match
          const request = index.get(normalizedText);
          
          request.onsuccess = () => {
            const match = request.result;
            if (match) {
              console.log('[VoiceSynthesis] Found exact match in cache');
              resolve(match);
            } else {
              resolve(null);
            }
          };
          
          request.onerror = (event) => {
            console.error('[VoiceSynthesis] Error accessing cache:', event);
            resolve(null); // Resolve with null on error for graceful degradation
          };
        } catch (error) {
          console.error('[VoiceSynthesis] Error accessing audio cache:', error);
          resolve(null);
        }
      });
    } catch (error) {
      console.error('[VoiceSynthesis] Error finding cached audio:', error);
      return null;
    }
  }
  
  /**
   * Find similar cached audio for offline fallback
   */
  private async findSimilarCachedAudio(text: string): Promise<any> {
    try {
      // Only attempt if IndexedDB is available
      if (!indexedDBService) return null;
      
      // Normalize text for better matching
      const normalizedText = text.toLowerCase().trim();
      
      // Use a transaction to get all items from the audio cache store
      return new Promise((resolve, reject) => {
        try {
          // Get the database transaction
          const transaction = indexedDBService['db']?.transaction(['audio_cache'], 'readonly');
          if (!transaction) {
            console.warn('[VoiceSynthesis] No database transaction available');
            return resolve(null);
          }
          
          const store = transaction.objectStore('audio_cache');
          const request = store.getAll();
          
          request.onsuccess = () => {
            const cachedItems = request.result || [];
            
            if (cachedItems.length === 0) {
              return resolve(null);
            }
            
            // First try to find items where the text is contained in a cached item
            const containedMatch = cachedItems.find(item => 
              item.text && item.text.toLowerCase().includes(normalizedText));
            
            if (containedMatch) {
              console.log('[VoiceSynthesis] Found contained match in cache');
              return resolve(containedMatch);
            }
            
            // Then try to find items where a cached item is contained in the text
            const containingMatch = cachedItems.find(item => 
              item.text && normalizedText.includes(item.text.toLowerCase()));
            
            if (containingMatch) {
              console.log('[VoiceSynthesis] Found containing match in cache');
              return resolve(containingMatch);
            }
            
            // If all else fails, return the most recent cached item
            const mostRecent = cachedItems.sort((a, b) => b.timestamp - a.timestamp)[0];
            console.log('[VoiceSynthesis] Using most recent cache item as fallback');
            return resolve(mostRecent);
          };
          
          request.onerror = (event) => {
            console.error('[VoiceSynthesis] Error accessing cache:', event);
            resolve(null); // Resolve with null on error for graceful degradation
          };
        } catch (error) {
          console.error('[VoiceSynthesis] Error accessing audio cache:', error);
          resolve(null);
        }
      });
    } catch (error) {
      console.error('[VoiceSynthesis] Error finding similar cached audio:', error);
      return null;
    }
  }
  
  /**
   * Play audio from a blob
   */
  private async playAudioFromBlob(audioBlob: Blob, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Create and configure audio element
        this.currentAudio = new Audio(audioUrl);
        
        // Set up event handlers
        this.currentAudio.onplay = () => {
          this.synthesisState.next('speaking');
          this.emitEvent('playback_start', { text, timestamp: Date.now() });
        };
        
        // Set up playback timeout to prevent hanging
        const playbackTimeoutId = setTimeout(() => {
          if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
            URL.revokeObjectURL(audioUrl);
            const timeoutError = new Error('Audio playback timeout');
            this.handleError(timeoutError);
            reject(timeoutError);
          }
        }, PLAYBACK_TIMEOUT);
        
        this.currentAudio.onended = () => {
          clearTimeout(playbackTimeoutId);
          this.synthesisState.next('idle');
          this.isSpeaking.next(false);
          this.emitEvent('playback_complete', { text, timestamp: Date.now() });
          URL.revokeObjectURL(audioUrl); // Clean up
          this.currentAudio = null;
          this.synthesisSuccesses++;
          resolve();
        };
        
        this.currentAudio.onerror = (e) => {
          clearTimeout(playbackTimeoutId);
          const error = new Error(`Audio playback error: ${e}`);
          this.handleError(error);
          URL.revokeObjectURL(audioUrl); // Clean up
          this.currentAudio = null;
          reject(error);
        };
        
        // Start playback
        this.currentAudio.play().catch(playError => {
          clearTimeout(playbackTimeoutId);
          this.handleError(playError);
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          reject(playError);
        });
      } catch (error) {
        this.handleError(error);
        reject(error);
      }
    });
  }
  
  private emitEvent(eventType: VoiceSynthesisEvent['type'], payload: any) {
    // Special handling for error events to maintain backward compatibility
    if (eventType === 'error') {
      this.errorEvent.next(payload);
    }
    
    // Emit to the general events stream
    this.events.next({
      type: eventType,
      payload: {
        ...payload,
        timestamp: Date.now()
      }
    });
  }
}

// Create singleton instance
export const voiceSynthesisService = new VoiceSynthesisService();
