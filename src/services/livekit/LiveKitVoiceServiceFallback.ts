import { BehaviorSubject, Subject } from 'rxjs';
import { Room, RoomEvent, ConnectionState } from 'livekit-client';
import { generateUserToken } from './tokenService';
import { isMobileDevice } from '../../utils/deviceDetection';

// Define synthesis state type
export type SynthesisState = 'idle' | 'synthesizing' | 'speaking' | 'error';

// Type guard for ConnectionState string values
function isConnectionStateValue(state: string): state is 'connected' | 'connecting' | 'disconnected' | 'failed' {
  return ['connected', 'connecting', 'disconnected', 'failed'].includes(state);
}

// Constants for LiveKit configuration
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://lark-za4hpayr.livekit.cloud';
const LIVEKIT_API_KEY = import.meta.env.VITE_LIVEKIT_API_KEY || 'APIriVQTTMAvLQ4';
const LIVEKIT_API_SECRET = import.meta.env.VITE_LIVEKIT_API_SECRET || 'fleSOaoOdQ0v5fOatkISxYqvNygclQAeSilRMZ1kLbwB';

// Define types for voice synthesis events
export type VoiceSynthesisEvent = {
  type: 'synthesis_start' | 'synthesis_complete' | 'playback_start' | 'playback_complete' | 'error' | 'state_change' | 'network_issue' | 'api_issue' | 'streaming_progress' | 'permission_change';
  payload: any;
};

// Define types for microphone permission status
export type MicrophonePermission = 'unknown' | 'granted' | 'denied' | 'prompt';

/**
 * LiveKitVoiceServiceFallback - Modified version that can work without microphone permissions
 * 
 * This service provides a fallback mechanism when microphone access is denied,
 * allowing text-to-speech functionality to still work.
 */
class LiveKitVoiceServiceFallback {
  private isSpeaking = new BehaviorSubject<boolean>(false);
  private synthesisState = new BehaviorSubject<SynthesisState>('idle');
  private events = new Subject<VoiceSynthesisEvent>();
  private errorEvent = new BehaviorSubject<any>(null);
  private room: Room | null = null;
  private audioContext: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private networkStatus = navigator.onLine;
  private roomName = '';
  private token = '';
  private micPermission = new BehaviorSubject<MicrophonePermission>('unknown');
  private useNativeTTS = false;
  private speechSynthesis: SpeechSynthesis | null = null;
  private speechUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    console.log('[LiveKitVoiceFallback] Service initialized');
    
    // Monitor network status for better error handling
    window.addEventListener('online', this.handleNetworkChange.bind(this));
    window.addEventListener('offline', this.handleNetworkChange.bind(this));
    
    // Check microphone permission on initialization
    this.checkMicrophonePermission();
    
    // Initialize browser's speech synthesis if available
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.speechSynthesis = window.speechSynthesis;
    }
  }

  /**
   * Handle network status changes
   */
  private handleNetworkChange(): void {
    const isOnline = navigator.onLine;
    this.networkStatus = isOnline;
    
    this.events.next({
      type: 'network_issue',
      payload: { online: isOnline }
    });
    
    if (!isOnline) {
      // If we go offline, switch to native TTS as fallback
      this.useNativeTTS = true;
      console.log('[LiveKitVoiceFallback] Network offline, switching to native TTS');
    }
  }

  /**
   * Check microphone permission status
   */
  private async checkMicrophonePermission(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        this.micPermission.next('denied');
        this.useNativeTTS = true;
        return;
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      if (audioInputs.length === 0) {
        // No audio input devices found
        this.micPermission.next('denied');
        this.useNativeTTS = true;
        return;
      }
      
      // Check if we have permission info
      if (audioInputs.some(device => device.label)) {
        // If we can see labels, permission is granted
        this.micPermission.next('granted');
        this.useNativeTTS = false;
      } else {
        // No labels means permission not granted yet
        this.micPermission.next('prompt');
        
        // For mobile devices, default to native TTS to avoid permission prompts
        if (isMobileDevice()) {
          this.useNativeTTS = true;
        }
      }
    } catch (error) {
      console.error('[LiveKitVoiceFallback] Error checking microphone permission:', error);
      this.micPermission.next('denied');
      this.useNativeTTS = true;
      
      this.events.next({
        type: 'permission_change',
        payload: { permission: 'denied', error }
      });
    }
  }

  /**
   * Request microphone permission explicitly
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    try {
      // If we're on a mobile device, don't try to request mic permission
      // Just use the fallback TTS
      if (isMobileDevice()) {
        this.useNativeTTS = true;
        this.micPermission.next('denied');
        return false;
      }
      
      // Otherwise try to get permission
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.micPermission.next('denied');
        this.useNativeTTS = true;
        return false;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop all tracks immediately - we just needed the permission
      stream.getTracks().forEach(track => track.stop());
      
      this.micPermission.next('granted');
      this.useNativeTTS = false;
      
      this.events.next({
        type: 'permission_change',
        payload: { permission: 'granted' }
      });
      
      return true;
    } catch (error) {
      console.error('[LiveKitVoiceFallback] Error requesting microphone permission:', error);
      this.micPermission.next('denied');
      this.useNativeTTS = true;
      
      this.events.next({
        type: 'permission_change',
        payload: { permission: 'denied', error }
      });
      
      return false;
    }
  }

  /**
   * Initialize the LiveKit service
   * This is modified to work even without microphone permissions
   */
  public async initialize(roomName: string, token: string): Promise<void> {
    try {
      this.roomName = roomName;
      this.token = token;
      
      // If using native TTS, we don't need to connect to LiveKit
      if (this.useNativeTTS) {
        console.log('[LiveKitVoiceFallback] Using native TTS, skipping LiveKit connection');
        return;
      }
      
      // Otherwise proceed with LiveKit connection
      if (!this.room) {
        this.room = new Room({
          adaptiveStream: true,
          dynacast: true
          // Don't use audioCaptureDefaults as it's not in the type definition
        });
        
        this.setupRoomEventListeners();
      }
      
      // Connect to the room without publishing any tracks
      await this.room.connect(LIVEKIT_URL, token, {
        autoSubscribe: true
        // Remove publishDefaults as it's not in the type definition
      });
      
      console.log(`[LiveKitVoiceFallback] Connected to room: ${roomName}`);
    } catch (error) {
      console.error('[LiveKitVoiceFallback] Error initializing:', error);
      this.errorEvent.next({
        type: 'initialization_error',
        message: error instanceof Error ? error.message : 'Unknown error during initialization',
        error
      });
      
      // Fall back to native TTS
      this.useNativeTTS = true;
      throw error;
    }
  }

  /**
   * Set up event listeners for the LiveKit room
   */
  private setupRoomEventListeners(): void {
    if (!this.room) return;
    
    this.room
      .on(RoomEvent.Connected, () => {
        this.events.next({
          type: 'state_change',
          payload: { state: 'connected', room: this.roomName }
        });
      })
      .on(RoomEvent.Disconnected, () => {
        this.events.next({
          type: 'state_change',
          payload: { state: 'disconnected', room: this.roomName }
        });
      })
      .on(RoomEvent.ConnectionStateChanged, (state: string) => {
        if (isConnectionStateValue(state)) {
          this.events.next({
            type: 'state_change',
            payload: { connectionState: state }
          });
        }
      })
      .on(RoomEvent.ConnectionQualityChanged, () => {
        // Handle connection quality changes
      })
      .on(RoomEvent.TrackSubscribed, () => {
        // Handle track subscriptions
      })
      .on(RoomEvent.TrackUnsubscribed, () => {
        // Handle track unsubscriptions
      })
      .on(RoomEvent.MediaDevicesError, (error: Error) => {
        console.error('[LiveKitVoiceFallback] Media devices error:', error);
        this.errorEvent.next({
          type: 'media_devices_error',
          message: error.message,
          error
        });
        
        // Switch to native TTS on media device errors
        this.useNativeTTS = true;
      });
  }

  /**
   * Disconnect from LiveKit room
   */
  public disconnect(): void {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    
    // Stop any ongoing speech
    this.stop();
  }

  /**
   * Speak text using either LiveKit or native TTS as fallback
   */
  public async speak(text: string, voice?: string): Promise<void> {
    try {
      this.synthesisState.next('synthesizing');
      this.events.next({
        type: 'synthesis_start',
        payload: { text: text.substring(0, 50) + (text.length > 50 ? '...' : '') }
      });
      
      // If using native TTS, use the browser's speech synthesis
      if (this.useNativeTTS) {
        await this.speakWithNativeTTS(text, voice);
        return;
      }
      
      // Otherwise use LiveKit for speech
      if (!this.room || this.room.state !== ConnectionState.Connected) {
        throw new Error('Not connected to LiveKit room');
      }
      
      // Here you would implement the LiveKit speech synthesis
      // This is a placeholder for the actual implementation
      console.log('[LiveKitVoiceFallback] Speaking with LiveKit:', text.substring(0, 50));
      
      // Simulate speech synthesis with LiveKit
      this.isSpeaking.next(true);
      
      // Simulate completion after a delay based on text length
      const duration = Math.min(30000, 500 + text.length * 50);
      setTimeout(() => {
        this.isSpeaking.next(false);
        this.synthesisState.next('idle');
        this.events.next({
          type: 'playback_complete',
          payload: { text: text.substring(0, 50) + (text.length > 50 ? '...' : '') }
        });
      }, duration);
    } catch (error) {
      console.error('[LiveKitVoiceFallback] Error speaking:', error);
      this.synthesisState.next('error');
      this.isSpeaking.next(false);
      
      this.errorEvent.next({
        type: 'speech_error',
        message: error instanceof Error ? error.message : 'Unknown error during speech',
        error
      });
      
      // Try native TTS as fallback
      if (!this.useNativeTTS) {
        this.useNativeTTS = true;
        await this.speakWithNativeTTS(text, voice);
      }
    }
  }

  /**
   * Speak text using the browser's native SpeechSynthesis API
   */
  private async speakWithNativeTTS(text: string, voice?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.speechSynthesis) {
          throw new Error('Speech synthesis not available');
        }
        
        // Stop any ongoing speech
        this.speechSynthesis.cancel();
        
        // Create a new utterance
        const utterance = new SpeechSynthesisUtterance(text);
        this.speechUtterance = utterance;
        
        // Set voice if specified
        if (voice) {
          const voices = this.speechSynthesis.getVoices();
          const selectedVoice = voices.find(v => 
            v.name.toLowerCase().includes(voice.toLowerCase()) || 
            v.voiceURI.toLowerCase().includes(voice.toLowerCase())
          );
          
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }
        }
        
        // Set event handlers
        utterance.onstart = () => {
          this.isSpeaking.next(true);
          this.synthesisState.next('speaking');
          this.events.next({
            type: 'playback_start',
            payload: { text: text.substring(0, 50) + (text.length > 50 ? '...' : '') }
          });
        };
        
        utterance.onend = () => {
          this.isSpeaking.next(false);
          this.synthesisState.next('idle');
          this.events.next({
            type: 'playback_complete',
            payload: { text: text.substring(0, 50) + (text.length > 50 ? '...' : '') }
          });
          resolve();
        };
        
        utterance.onerror = (event) => {
          this.isSpeaking.next(false);
          this.synthesisState.next('error');
          this.events.next({
            type: 'error',
            payload: { error: event.error }
          });
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };
        
        // Start speaking
        this.speechSynthesis.speak(utterance);
      } catch (error) {
        this.isSpeaking.next(false);
        this.synthesisState.next('error');
        this.errorEvent.next({
          type: 'native_tts_error',
          message: error instanceof Error ? error.message : 'Unknown error during native TTS',
          error
        });
        reject(error);
      }
    });
  }

  /**
   * Stop speaking
   */
  public stop(): void {
    // Stop native TTS if active
    if (this.useNativeTTS && this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }
    
    // Reset state
    this.isSpeaking.next(false);
    this.synthesisState.next('idle');
  }

  // Observable getters
  public getSpeakingState() {
    return this.isSpeaking.asObservable();
  }
  
  public getSynthesisState() {
    return this.synthesisState.asObservable();
  }
  
  public getEvents() {
    return this.events.asObservable();
  }
  
  public getErrorEvent() {
    return this.errorEvent.asObservable();
  }
  
  public getMicPermission() {
    return this.micPermission.asObservable();
  }
  
  public isUsingNativeTTS(): boolean {
    return this.useNativeTTS;
  }
}

// Create singleton instance
export const liveKitVoiceServiceFallback = new LiveKitVoiceServiceFallback();
