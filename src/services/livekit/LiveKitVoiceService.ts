import { BehaviorSubject, Subject } from 'rxjs';
import { 
  Room, 
  RoomEvent, 
  RemoteParticipant, 
  RemoteTrackPublication, 
  Track, 
  LocalParticipant, 
  ConnectionState, 
  ConnectionQuality 
} from 'livekit-client';
import { generateUserToken } from './tokenService';
import { translationService } from '../translation/TranslationService';
import { huggingFaceService } from '../huggingface/HuggingFaceService';

// Define synthesis state type locally instead of importing from OpenAIVoiceService
export type SynthesisState = 'idle' | 'synthesizing' | 'speaking' | 'error';

// Type guard for ConnectionState string values
function isConnectionStateValue(state: string): state is 'connected' | 'connecting' | 'disconnected' | 'failed' {
  return ['connected', 'connecting', 'disconnected', 'failed'].includes(state);
}

// Constants for LiveKit configuration
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://lark-za4hpayr.livekit.cloud';

// API URL for the backend server
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Constants for performance optimization
const MIC_PERMISSION_TIMEOUT = 5000; // 5 seconds
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 3;

// Define types for voice synthesis events
export type VoiceSynthesisEvent = {
  type: 'synthesis_start' | 'synthesis_complete' | 'playback_start' | 'playback_complete' | 'error' | 'state_change' | 'network_issue' | 'api_issue' | 'streaming_progress' | 'permission_change' | 'translation_start' | 'translation_complete';
  payload: any;
};

// Define types for microphone permission status
export type MicrophonePermission = 'unknown' | 'granted' | 'denied' | 'prompt';

/**
 * LiveKitVoiceService - Handles voice synthesis using LiveKit and OpenAI Realtime API
 */
class LiveKitVoiceService {
  private isSpeaking = new BehaviorSubject<boolean>(false);
  private synthesisState = new BehaviorSubject<SynthesisState>('idle');
  private events = new Subject<VoiceSynthesisEvent>();
  private errorEvent = new BehaviorSubject<any>(null);
  private room: Room | null = null;
  private useFallbackTTS: boolean = false;
  private audioContext: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private networkStatus = navigator.onLine;
  private roomName = '';
  private token = '';
  private micPermission = new BehaviorSubject<MicrophonePermission>('unknown');
  private isTranslating = new BehaviorSubject<boolean>(false);
  private lastDetectedLanguage = '';
  private autoTranslateEnabled = false;

  constructor() {
    console.log('[LiveKitVoice] Service initialized');
    
    // Monitor network status for better error handling
    window.addEventListener('online', this.handleNetworkChange.bind(this));
    window.addEventListener('offline', this.handleNetworkChange.bind(this));
    
    // Check microphone permission on initialization
    this.checkMicrophonePermission();
    
    // Initialize audio context lazily when needed
    this.initAudioContextOnUserGesture();
  }
  
  /**
   * Initialize audio context on user gesture to avoid autoplay restrictions
   */
  private initAudioContextOnUserGesture(): void {
    const initAudio = () => {
      if (!this.audioContext) {
        try {
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          console.log('[LiveKitVoice] AudioContext initialized on user gesture');
        } catch (error) {
          console.error('[LiveKitVoice] Failed to initialize AudioContext:', error);
        }
      }
      
      // Remove event listeners once initialized
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
    
    // Add event listeners for user gestures
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
  }
  
  /**
   * Check microphone permission
   */
  private async checkMicrophonePermission(): Promise<void> {
    try {
      // Check if the browser supports the permissions API
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          
          if (permissionStatus.state === 'granted') {
            this.micPermission.next('granted');
            console.log('[LiveKitVoice] Microphone permission already granted');
            
            this.emitEvent('permission_change', {
              permission: 'granted',
              timestamp: Date.now()
            });
          } else if (permissionStatus.state === 'denied') {
            this.micPermission.next('denied');
            console.error('[LiveKitVoice] Microphone access denied');
            console.log('[LiveKitVoice] Microphone permission blocked in browser settings');
            
            this.emitEvent('permission_change', {
              permission: 'denied',
              timestamp: Date.now()
            });
            
            this.errorEvent.next({
              type: 'permission_error',
              message: 'Microphone access is blocked. Please enable it in your browser settings.',
              timestamp: Date.now(),
              recoverable: false
            });
          } else {
            // prompt state - need to request permission
            this.micPermission.next('prompt');
            console.log('[LiveKitVoice] Microphone permission needs to be requested');
            
            this.emitEvent('permission_change', {
              permission: 'prompt',
              timestamp: Date.now()
            });
          }
          
          // Listen for permission changes
          permissionStatus.addEventListener('change', () => {
            this.micPermission.next(permissionStatus.state as MicrophonePermission);
            console.log(`[LiveKitVoice] Microphone permission changed to: ${permissionStatus.state}`);
            
            this.emitEvent('permission_change', {
              permission: permissionStatus.state,
              timestamp: Date.now()
            });
          });
        } catch (error) {
          console.error('[LiveKitVoice] Error querying microphone permission:', error);
          this.micPermission.next('prompt'); // Assume we need to prompt if we can't check
        }
      } else {
        // Browser doesn't support permissions API, we'll need to request directly
        this.micPermission.next('prompt');
        console.log('[LiveKitVoice] Browser does not support permissions API, will prompt for microphone');
      }
    } catch (error) {
      console.error('[LiveKitVoice] Unexpected error checking microphone permission:', error);
      this.micPermission.next('prompt'); // Default to prompt on error
    }
  }
  
  /**
   * Request microphone permission explicitly
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    console.log('[LiveKitVoice] Explicitly requesting microphone permission');
    
    try {
      // Create a timeout promise to handle cases where the browser hangs
      const timeoutPromise = new Promise<MediaStream>((_, reject) => {
        setTimeout(() => reject(new Error('Microphone permission request timed out')), 5000);
      });
      
      // Request microphone access with timeout
      const mediaPromise = navigator.mediaDevices.getUserMedia({ audio: true });
      const stream = await Promise.race([mediaPromise, timeoutPromise]);
      
      // Successfully got microphone access
      this.micPermission.next('granted');
      
      this.emitEvent('permission_change', {
        permission: 'granted',
        timestamp: Date.now()
      });
      
      console.log('[LiveKitVoice] Microphone permission explicitly granted');
      
      // Clean up the stream since we just needed it for the permission
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.error('[LiveKitVoice] Error requesting microphone permission:', error);
      
      // Handle specific permission errors
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError' || error.message.includes('timed out')) {
          this.micPermission.next('denied');
          
          // Automatically enable fallback TTS when microphone permission is denied
          this.useFallbackTTS = true;
          console.log('[LiveKitVoice] Automatically enabling fallback TTS due to microphone denial');
          
          this.emitEvent('permission_change', {
            permission: 'denied',
            error: error.message,
            timestamp: Date.now()
          });
          
          this.errorEvent.next({
            type: 'permission_error',
            message: 'Microphone access denied. Using text-to-speech fallback instead.',
            timestamp: Date.now(),
            recoverable: true
          });
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          // Also enable fallback TTS for device errors
          this.useFallbackTTS = true;
          console.log('[LiveKitVoice] Automatically enabling fallback TTS due to missing microphone');
          
          this.errorEvent.next({
            type: 'device_error',
            message: 'No microphone device was found. Using text-to-speech fallback instead.',
            timestamp: Date.now(),
            recoverable: true
          });
        }
      }
      
      return false;
    }
  }

  /**
   * Handle network status changes
   */
  private handleNetworkChange(): void {
    const wasOnline = this.networkStatus;
    this.networkStatus = navigator.onLine;
    console.log('Network status changed:', this.networkStatus ? 'online' : 'offline');
    
    if (wasOnline && !this.networkStatus) {
      console.warn('[LiveKitVoice] Network connection lost');
      this.emitEvent('network_issue', { 
        status: 'offline',
        timestamp: Date.now()
      });
    } else if (!wasOnline && this.networkStatus) {
      console.log('[LiveKitVoice] Network connection restored');
      this.emitEvent('network_issue', { 
        status: 'online',
        timestamp: Date.now()
      });
      
      // Reconnect to the room if we were speaking
      if (this.isSpeaking.value) {
        console.log('[LiveKitVoice] Reconnecting to the room...');
        this.reconnect();
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
   * Set the fallback TTS flag
   */
  public setFallbackTTS(useFallback: boolean) {
    console.log(`[LiveKitVoice] Setting fallback TTS to: ${useFallback}`);
    this.useFallbackTTS = useFallback;
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
   * Get microphone permission status
   */
  public getMicPermission() {
    return this.micPermission.asObservable();
  }

  /**
   * Initialize the LiveKit room
   * @param roomName The name of the room to join
   * @param token The token for authentication
   */
  public async initialize(roomName: string, token: string, requireMicrophone: boolean = false): Promise<void> {
    console.log('[LiveKitVoice] Initializing with room:', roomName, 'requireMicrophone:', requireMicrophone);
    this.roomName = roomName;
    this.token = token;
    
    try {
      // Always check microphone permission, but only require it if specified
      await this.checkMicrophonePermission();
      
      // If microphone is required and permission is denied, throw error
      if (requireMicrophone && this.micPermission.value === 'denied') {
        throw new Error('Microphone permission denied. Please enable microphone access in your browser settings.');
      }
      
      // If microphone is required and permission is prompt, request it
      if (requireMicrophone && this.micPermission.value === 'prompt') {
        const permissionStatus = await this.requestMicrophonePermission();
        if (!permissionStatus) {
          throw new Error('Microphone permission denied. Please enable microphone access in your browser settings.');
        }
      }
      
      // If microphone permission is denied but not required, use fallback TTS
      if (this.micPermission.value === 'denied' && !requireMicrophone) {
        console.warn('[LiveKitVoice] Microphone permission denied, will use fallback TTS methods');
        this.useFallbackTTS = true;
      }
      
      // Log microphone status
      console.log('[LiveKitVoice] Microphone permission status:', this.micPermission.value);
      
      // Create a new room with optimized settings
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        // Use valid Room configuration options
        // This allows for better performance with or without microphone
        publishDefaults: {
          simulcast: true,
          stopMicTrackOnMute: false
        }
      });

      // Set up event listeners
      this.setupRoomEventListeners();
      
      // Connect to the room
      await this.room.connect(LIVEKIT_URL, token);
      console.log('[LiveKitVoice] Connected to room:', roomName);
      
      // Initialize audio context
      this.audioContext = new AudioContext();
      
      this.emitEvent('state_change', { 
        state: 'connected',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[LiveKitVoice] Error initializing room:', error);
      
      // Handle specific permission errors
      if (error instanceof Error && 
          (error.message.includes('permission') || 
           error.message.includes('Permission') || 
           error.message.includes('microphone') || 
           error.message.includes('Microphone'))) {
        this.micPermission.next('denied');
        this.emitEvent('permission_change', {
          permission: 'denied',
          timestamp: Date.now()
        });
      }
      
      this.errorEvent.next({
        type: 'initialization_error',
        message: error instanceof Error ? error.message : 'Failed to initialize LiveKit room',
        timestamp: Date.now(),
        recoverable: true
      });
      
      this.emitEvent('error', { 
        error: error instanceof Error ? error.message : 'Failed to initialize LiveKit room',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Set up event listeners for the LiveKit room
   */
  private setupRoomEventListeners(): void {
    if (!this.room) return;

    // Handle participant joined event
    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log('[LiveKitVoice] Participant connected:', participant.identity);
    });

    // Handle track subscribed event
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('[LiveKitVoice] Track subscribed:', track.kind, 'from', participant.identity);
      
      if (track.kind === Track.Kind.Audio) {
        this.handleAudioTrack(track);
      }
    });

    // Handle disconnection
    this.room.on(RoomEvent.Disconnected, () => {
      console.log('[LiveKitVoice] Disconnected from room');
      this.synthesisState.next('idle');
      this.isSpeaking.next(false);
      
      this.emitEvent('state_change', { 
        state: 'disconnected',
        timestamp: Date.now()
      });
    });

    // Handle connection state changes
    this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.log('[LiveKitVoice] Connection state changed:', state);
      
      // Check connection state using string values
      const stateStr = state.toString();
      if (isConnectionStateValue(stateStr) && (stateStr === 'failed' || stateStr === 'disconnected')) {
        this.errorEvent.next({
          type: 'connection_error',
          message: `LiveKit connection ${state}`,
          timestamp: Date.now(),
          recoverable: true
        });
        
        this.emitEvent('error', { 
          error: `LiveKit connection ${state}`,
          timestamp: Date.now()
        });
      }
    });
    
    // Handle local track permission errors
    this.room.localParticipant?.on('mediaDevicesError', (error: Error) => {
      console.error('[LiveKitVoice] Media devices error:', error);
      
      if (error.message.includes('Permission') || error.message.includes('permission') || 
          error.message.includes('Microphone') || error.message.includes('microphone')) {
        this.micPermission.next('denied');
        
        this.emitEvent('permission_change', {
          permission: 'denied',
          error: error.message,
          timestamp: Date.now()
        });
        
        this.errorEvent.next({
          type: 'permission_error',
          message: 'Microphone access denied. Please enable microphone access in your browser settings.',
          timestamp: Date.now(),
          recoverable: false
        });
      }
    });
  }

  /**
   * Handle audio track from LiveKit
   * @param track The audio track to handle
   */
  private handleAudioTrack(track: Track): void {
    if (track.kind !== Track.Kind.Audio) return;
    
    // Create audio element if it doesn't exist
    if (!this.audioElement) {
      this.audioElement = new Audio();
      this.audioElement.autoplay = true;
      
      // Set up event handlers
      this.audioElement.onplay = () => {
        console.log('[LiveKitVoice] Audio playback started');
        this.synthesisState.next('speaking');
        this.isSpeaking.next(true);
        
        this.emitEvent('playback_start', { 
          timestamp: Date.now()
        });
      };
      
      this.audioElement.onended = () => {
        console.log('[LiveKitVoice] Audio playback ended');
        this.synthesisState.next('idle');
        this.isSpeaking.next(false);
        
        this.emitEvent('playback_complete', { 
          timestamp: Date.now()
        });
      };
      
      this.audioElement.onerror = (error) => {
        console.error('[LiveKitVoice] Audio playback error:', error);
        this.synthesisState.next('error');
        this.isSpeaking.next(false);
        
        this.errorEvent.next({
          type: 'playback_error',
          message: 'Error during audio playback',
          timestamp: Date.now(),
          recoverable: true
        });
        
        this.emitEvent('error', { 
          error: 'Error during audio playback',
          timestamp: Date.now()
        });
      };
    }
    
    // Attach the track to the audio element
    track.attach(this.audioElement);
    
    this.emitEvent('synthesis_complete', { 
      timestamp: Date.now()
    });
  }

  /**
   * Speak text using LiveKit voice synthesis
   * @param text The text to speak
   * @param voice The voice to use (default: 'ash')
   */
  /**
   * Use OpenAI's API directly as a fallback when LiveKit connection fails
   * This ensures we still use the OpenAI voice even when LiveKit connection fails
   * @param text Text to speak
   * @param voice Voice to use (should be 'ash' for consistency)
   */
  public async speakWithOpenAIFallback(text: string, voice: string = 'ash'): Promise<void> {
    // Try to use OpenAI directly instead of browser fallback
    try {
      console.log('[LiveKitVoice] Using OpenAI API directly as fallback');
      
      // Make request to OpenAI TTS API
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
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
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      
      // Get audio data
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create audio element if it doesn't exist
      if (!this.audioElement) {
        this.audioElement = new Audio();
      }
      
      // Set up event handlers
      this.audioElement.onplay = () => {
        console.log('[LiveKitVoice] OpenAI fallback audio playback started');
        this.synthesisState.next('speaking');
        this.isSpeaking.next(true);
        this.emitEvent('playback_start', { timestamp: Date.now() });
      };
      
      this.audioElement.onended = () => {
        console.log('[LiveKitVoice] OpenAI fallback audio playback ended');
        this.synthesisState.next('idle');
        this.isSpeaking.next(false);
        this.emitEvent('playback_complete', { timestamp: Date.now() });
        URL.revokeObjectURL(audioUrl); // Clean up
      };
      
      // Set source and play
      this.audioElement.src = audioUrl;
      await this.audioElement.play();
      
      return;
    } catch (error) {
      console.error('[LiveKitVoice] Error using OpenAI fallback:', error);
      // Fall back to browser speech synthesis as a last resort
      this.speakWithBrowserFallback(text, voice);
    }
  }
  
  /**
   * Use browser's native SpeechSynthesis API as a last resort fallback
   * @param text Text to speak
   * @param voice Voice to use (may not be supported by browser)
   */
  private speakWithBrowserFallback(text: string, voice?: string): void {
    if (!('speechSynthesis' in window)) {
      console.warn('[LiveKitVoice] Browser does not support speech synthesis');
      // Try audio beep fallback as last resort
      this.speakWithAudioBeepFallback(text);
      return;
    }
    
    try {
      console.log('[LiveKitVoice] Using browser fallback for speech synthesis');
      
      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set voice if available
      if (voice && window.speechSynthesis) {
        // Force voices to load if they haven't already
        if (window.speechSynthesis.getVoices().length === 0) {
          // This is a workaround for some browsers that don't load voices immediately
          window.speechSynthesis.onvoiceschanged = () => {
            this.setupUtteranceVoice(utterance, voice);
          };
        } else {
          this.setupUtteranceVoice(utterance, voice);
        }
      }
      
      // Set other properties for better speech quality
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Set up event handlers
      utterance.onstart = () => {
        console.log('[LiveKitVoice] Browser speech synthesis started');
        this.synthesisState.next('speaking');
        this.isSpeaking.next(true);
        this.emitEvent('playback_start', { timestamp: Date.now() });
      };
      
      utterance.onend = () => {
        console.log('[LiveKitVoice] Browser speech synthesis ended');
        this.synthesisState.next('idle');
        this.isSpeaking.next(false);
        this.emitEvent('playback_complete', { timestamp: Date.now() });
      };
      
      utterance.onerror = (event) => {
        console.error('[LiveKitVoice] Browser speech synthesis error:', event);
        this.synthesisState.next('error');
        this.isSpeaking.next(false);
        this.emitEvent('error', { 
          error: 'Browser speech synthesis error',
          timestamp: Date.now()
        });
        
        // Try audio beep fallback as last resort
        this.speakWithAudioBeepFallback(text);
      };
      
      // Speak the text
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('[LiveKitVoice] Error using browser speech synthesis:', error);
      this.synthesisState.next('error');
      this.isSpeaking.next(false);
      
      // Try audio beep fallback as last resort
      this.speakWithAudioBeepFallback(text);
    }
  }
  
  /**
   * Set up the voice for the utterance
   * @param utterance The SpeechSynthesisUtterance to set the voice for
   * @param preferredVoice The preferred voice name
   */
  private setupUtteranceVoice(utterance: SpeechSynthesisUtterance, preferredVoice: string): void {
    const voices = window.speechSynthesis.getVoices();
    
    // Try to find a voice that matches the preferred voice name
    let selectedVoice = voices.find(v => 
      v.name.toLowerCase().includes(preferredVoice.toLowerCase())
    );
    
    // If no match found, try to find an English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => 
        v.lang.toLowerCase().startsWith('en')
      );
    }
    
    // If still no match, use the first available voice
    if (!selectedVoice && voices.length > 0) {
      selectedVoice = voices[0];
    }
    
    // Set the voice if found
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log(`[LiveKitVoice] Using voice: ${selectedVoice.name} (${selectedVoice.lang})`);
    } else {
      console.warn('[LiveKitVoice] No suitable voice found for speech synthesis');
    }
  }
  
  /**
   * Last resort fallback using a simple audio beep
   * This is used when browser speech synthesis fails
   * @param text The text that would have been spoken
   */
  private speakWithAudioBeepFallback(text: string): void {
    console.log('[LiveKitVoice] Using audio beep fallback');
    
    try {
      // Create an audio element with a simple beep sound
      // This is a minimal WAV file encoded as a data URL
      const audioElement = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU9vT18AAAAAAA==');
      
      // Set up event handlers
      audioElement.onplay = () => {
        this.synthesisState.next('speaking');
        this.isSpeaking.next(true);
        
        this.emitEvent('playback_start', {
          timestamp: Date.now()
        });
        
        // Log the text that would have been spoken
        console.log('[LiveKitVoice] Text that would have been spoken:', text);
      };
      
      audioElement.onended = () => {
        this.synthesisState.next('idle');
        this.isSpeaking.next(false);
        
        this.emitEvent('playback_complete', {
          timestamp: Date.now()
        });
      };
      
      // Play the audio
      audioElement.play().catch(error => {
        console.error('[LiveKitVoice] Error playing audio beep fallback:', error);
        this.synthesisState.next('error');
        this.isSpeaking.next(false);
      });
    } catch (error) {
      console.error('[LiveKitVoice] Error with audio beep fallback:', error);
      this.synthesisState.next('error');
      this.isSpeaking.next(false);
    }
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
   * Detect the language of the provided text
   * @param text Text to analyze
   * @returns Promise with the detected language
   */
  public async detectLanguage(text: string): Promise<string> {
    try {
      const detection = await translationService.detectLanguage(text);
      this.lastDetectedLanguage = detection.detectedLanguage;
      return detection.detectedLanguage;
    } catch (error) {
      console.error('[LiveKitVoice] Language detection error:', error);
      return 'english'; // Default to English on error
    }
  }
  
  /**
   * Translate text to the specified language
   * @param text Text to translate
   * @param targetLanguage Target language
   * @param sourceLanguage Source language (optional)
   * @returns Promise with the translated text
   */
  public async translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
    try {
      this.isTranslating.next(true);
      this.emitEvent('translation_start', {
        text,
        targetLanguage,
        sourceLanguage,
        timestamp: Date.now()
      });
      
      const result = await translationService.translate({
        text,
        targetLanguage,
        sourceLanguage
      });
      
      this.isTranslating.next(false);
      this.emitEvent('translation_complete', {
        result,
        timestamp: Date.now()
      });
      
      return result.translatedText;
    } catch (error) {
      this.isTranslating.next(false);
      console.error('[LiveKitVoice] Translation error:', error);
      this.emitEvent('error', {
        type: 'translation_error',
        error: error instanceof Error ? error.message : 'Translation failed',
        timestamp: Date.now()
      });
      return text; // Return original text on error
    }
  }
  
  /**
   * Enable or disable automatic translation
   * @param enabled Whether to enable automatic translation
   */
  public setAutoTranslate(enabled: boolean): void {
    this.autoTranslateEnabled = enabled;
    console.log(`[LiveKitVoice] Auto-translate ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Get the translation status
   */
  public getTranslationStatus() {
    return this.isTranslating.asObservable();
  }

  public async speak(text: string, voice = 'ash', targetLanguage?: string): Promise<void> {
    // Always use Ash voice for OpenAI
    voice = 'ash';
    // Don't attempt to speak empty text
    if (!text || text.trim() === '') {
      console.warn('[LiveKitVoice] Attempted to speak empty text');
      return;
    }
    
    // First, detect the language if auto-translate is enabled
    if (this.autoTranslateEnabled && !targetLanguage) {
      try {
        await this.detectLanguage(text);
        console.log(`[LiveKitVoice] Detected language: ${this.lastDetectedLanguage}`);
      } catch (error) {
        console.error('[LiveKitVoice] Error detecting language:', error);
        // Continue with original text if detection fails
      }
    }
    
    // Preprocess text for correct pronunciation
    let processedText = this.preprocessTextForSpeech(text);
    
    // Handle translation if needed
    if (targetLanguage) {
      console.log(`[LiveKitVoice] Translating to ${targetLanguage}`);
      try {
        processedText = await this.translateText(processedText, targetLanguage);
        console.log('[LiveKitVoice] Translation successful');
      } catch (error) {
        console.error('[LiveKitVoice] Translation failed:', error);
        // Continue with original text if translation fails
      }
    } else if (this.autoTranslateEnabled && this.lastDetectedLanguage && 
               this.lastDetectedLanguage !== 'english' && this.lastDetectedLanguage !== 'unknown') {
      // Auto-translate non-English text to English if auto-translate is enabled
      console.log(`[LiveKitVoice] Auto-translating from ${this.lastDetectedLanguage} to English`);
      try {
        processedText = await this.translateText(processedText, 'english', this.lastDetectedLanguage);
        console.log('[LiveKitVoice] Auto-translation successful');
      } catch (error) {
        console.error('[LiveKitVoice] Auto-translation failed:', error);
        // Continue with original text if translation fails
      }
    }
    
    console.log('[LiveKitVoice] Original text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    console.log('[LiveKitVoice] Final text for speech:', processedText.substring(0, 50) + (processedText.length > 50 ? '...' : ''));
    
    // Skip LiveKit connection and use OpenAI directly to avoid microphone permission issues
    console.log('[LiveKitVoice] Using OpenAI directly for speech synthesis');
    try {
      await this.speakWithOpenAIFallback(processedText, voice);
      return;
    } catch (error) {
      console.error('[LiveKitVoice] OpenAI direct synthesis failed, trying browser fallback:', error);
      this.speakWithBrowserFallback(processedText, voice);
      return;
    }
    
    // Check microphone permission status
    if (this.micPermission.value === 'denied') {
      console.log('[LiveKitVoice] Microphone permission denied, but we will still try to use LiveKit for OpenAI voice');
      // Don't set useFallbackTTS to true, we'll try to use LiveKit anyway
      // Instead, we'll just acknowledge the permission issue but continue
    }
    
    // Only use fallback if explicitly set elsewhere (not just for microphone permission)
    if (this.useFallbackTTS && this.micPermission.value !== 'denied') {
      console.log('[LiveKitVoice] Using fallback TTS due to other issues (not microphone permission)');
      this.isSpeaking.next(true);
      this.synthesisState.next('speaking');
      this.emitEvent('playback_start', { timestamp: Date.now() });
      await this.speakWithOpenAIFallback(processedText, voice);
      return;
    }
    
    // Check connection status and attempt to reconnect if needed
    if (!this.room || (this.room && this.room.state !== 'connected')) {
      console.warn('[LiveKitVoice] Not connected to a room, attempting to connect');
      
      // Try to reconnect with retries
      let retryCount = 0;
      const maxRetries = 1; // Reduced retries to fail faster to fallback
      
      while (retryCount < maxRetries) {
        try {
          // Pass false for requireMicrophone to allow fallback if needed
          await this.reconnect(false);
          console.log('[LiveKitVoice] Successfully reconnected to room');
          break; // Break out of retry loop if successful
        } catch (error) {
          retryCount++;
          console.error(`[LiveKitVoice] Reconnection attempt ${retryCount} failed:`, error);
          
          if (retryCount >= maxRetries) {
            console.warn('[LiveKitVoice] Failed to connect to LiveKit, using OpenAI fallback');
            // Use OpenAI fallback instead of browser fallback
            this.speakWithOpenAIFallback(processedText, voice);
            return;
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 500)); // Reduced wait time
        }
      }
    }
    
    try {
      this.synthesisState.next('synthesizing');
      this.isSpeaking.next(true);
      
      this.emitEvent('synthesis_start', { 
        text: processedText,
        voice,
        timestamp: Date.now()
      });
      
      // Send the text to the LiveKit agent for speech synthesis
      // This is done by publishing a data message to the room
      if (this.room) {
        // Create a structured message for the agent
        const message = {
          type: 'speech_synthesis',
          payload: {
            text: processedText,
            voice: 'ash', // Using Ash voice for OpenAI realtime voice through LiveKit
            requestId: `speech_${Date.now()}`,
            timestamp: Date.now()
          }
        };
        
        console.log('[LiveKitVoice] Using OpenAI realtime voice: ash for synthesis');
        
        // Publish the message to the room
        // This will be received by the LiveKit agent
        if (this.room && this.room.localParticipant) {
          await this.room.localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify(message)),
            { reliable: true }
          );
        } else {
          throw new Error('Room or local participant not available');
        }
        
        console.log('[LiveKitVoice] Speech synthesis request sent to agent');
      } else {
        throw new Error('Room connection not available');
      }
      
      // The audio response will be received through the audio track subscription
      // which is handled by the handleAudioTrack method
      
    } catch (error) {
      console.error('[LiveKitVoice] Error speaking text:', error);
      this.synthesisState.next('error');
      this.isSpeaking.next(false);
      
      this.errorEvent.next({
        type: 'synthesis_error',
        message: error instanceof Error ? error.message : 'Error synthesizing speech',
        timestamp: Date.now(),
        recoverable: true
      });
      
      this.emitEvent('error', { 
        error: error instanceof Error ? error.message : String(error || 'Error synthesizing speech'),
        timestamp: Date.now()
      });
      
      // Fall back to browser speech synthesis
      console.warn('[LiveKitVoice] Falling back to browser speech synthesis after LiveKit error');
      this.speakWithBrowserFallback(processedText, voice);
    }
  }

  /**
   * Reconnect to the LiveKit room
   * @param requireMicrophone Whether microphone permission is required
   */
  private async reconnect(requireMicrophone: boolean = false): Promise<void> {
    console.log('[LiveKitVoice] Attempting to reconnect...');
    
    // Clean up existing room connection
    if (this.room) {
      try {
        this.room.disconnect();
      } catch (error) {
        console.warn('[LiveKitVoice] Error during disconnect:', error);
      }
      this.room = null;
    }
    
    // Generate new token if needed
    if (!this.token || !this.roomName) {
      console.log('[LiveKitVoice] No existing token/room, generating new ones');
      this.roomName = `lark-room-${Date.now()}`;
      const userId = `user-${Date.now()}`;
      
      try {
        // Generate a new token for the LiveKit room
        this.token = await generateUserToken(this.roomName, userId);
      } catch (error) {
        console.error('[LiveKitVoice] Failed to generate token:', error);
        throw new Error('Failed to generate authentication token');
      }
    }
    
    // Initialize with existing or new credentials
    // Pass requireMicrophone parameter to allow fallback if needed
    await this.initialize(this.roomName, this.token, requireMicrophone);
    
    // Verify connection was successful
    if (!this.isConnected()) {
      throw new Error('Failed to establish connection after reconnect');
    }
    
    console.log('[LiveKitVoice] Reconnection successful');
  }

  /**
   * Stop current speech
   */
  public stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    
    this.synthesisState.next('idle');
    this.isSpeaking.next(false);
    
    this.emitEvent('state_change', { 
      state: 'stopped',
      timestamp: Date.now()
    });
  }

  /**
   * Disconnect from the LiveKit room
   */
  public disconnect(): void {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.synthesisState.next('idle');
    this.isSpeaking.next(false);
    
    this.emitEvent('state_change', { 
      state: 'disconnected',
      timestamp: Date.now()
    });
  }
  
  /**
   * Check if the service is currently connected to a LiveKit room
   * @returns boolean indicating if connected to a room
   */
  public isConnected(): boolean {
    // In LiveKit, the Room.state is of type ConnectionState
    // Check if it's connected using string comparison
    const stateStr = this.room?.state.toString() || '';
    return !!this.room && isConnectionStateValue(stateStr) && stateStr === 'connected';
  }

  /**
   * Emit event
   * @param type The event type
   * @param payload The event payload
   */
  private emitEvent(type: VoiceSynthesisEvent['type'], payload: any): void {
    this.events.next({ type, payload });
  }
}

// Create singleton instance
export const liveKitVoiceService = new LiveKitVoiceService();
