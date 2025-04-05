import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { indexedDBService } from '../../lib/indexeddb-service';
import { v4 as uuidv4 } from 'uuid';
import { whisperService } from '../whisper/WhisperService';

// Define the SpeechRecognition type for better TypeScript support
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Define SpeechRecognition interfaces for TypeScript
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// Define key types
export type RecognitionState = 'inactive' | 'active' | 'listening' | 'processing' | 'error';
export type WakeWordState = 'inactive' | 'detected' | 'listening_for_command';
export type MicrophonePermission = 'unknown' | 'granted' | 'denied' | 'prompt';

export interface VoiceEvent {
  type: 'wake_word_detected' | 'command_detected' | 'interim_transcript' | 'error' | 'state_change' | 'debug' | 'permission_required';
  payload: any;
}

/**
 * Core Voice Recognition Service
 * 
 * This service handles all voice recognition functionality using the Web Speech API.
 * It manages microphone permissions, wake word detection, and command processing.
 * Enhanced with tactical-grade voice recognition capabilities for law enforcement scenarios.
 */
export class VoiceRecognitionService {
  // Private properties
  private recognition: SpeechRecognition | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isListening: boolean = false;
  private _startingListening: boolean = false; // Flag to prevent multiple simultaneous start attempts
  private manualStop: boolean = false;
  private wakeWordDetected: boolean = false;
  private isSystemSpeaking: boolean = false;
  private isProcessingCommand: boolean = false;
  private isOfflineMode: boolean = false;
  private lastPermissionCheck: number = 0; // Timestamp of last permission check
  private wakeWordState = new BehaviorSubject<WakeWordState>('inactive');
  private recognitionState = new BehaviorSubject<RecognitionState>('inactive');
  private micPermission = new BehaviorSubject<MicrophonePermission>('unknown');
  private transcript = new BehaviorSubject<string>('');
  private events = new Subject<VoiceEvent>();
  private commandListeningTimeout: NodeJS.Timeout | null = null;
  private recognitionAttempts: number = 0;
  private recognitionSuccesses: number = 0;
  private lastRecognitionAccuracy: number = 0;
  private debugMode: boolean = true; // Set to true for development
  private commandProcessingDelay: number = 150; // Further reduced from 200ms to 150ms for faster response
  private extendedListeningTime: number = 2500; // Further reduced from 3000ms to 2500ms for faster response
  private wakeWords: string[] = ['lark', 'hey lark', 'ok lark', 'hey assistant']; // Wake words to listen for

  constructor() {
    this.initializeRecognition();
    this.checkMicrophonePermission();
    this.initializeAudioContext();
    
    // Subscribe to network status
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
    this.isOfflineMode = !navigator.onLine;
  }

  /**
   * Initialize the speech recognition object
   */
  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new AudioContext();
    } catch (error) {
      console.error('Error initializing AudioContext:', error);
    }
  }

  private handleNetworkChange(isOnline: boolean): void {
    this.isOfflineMode = !isOnline;
    if (this.isListening) {
      this.restartRecognition(); // Restart to switch between online/offline mode
    }
  }

  private initializeRecognition(): void {
    // Check if browser supports speech recognition
    if (!this.checkBrowserSupport()) {
      this.debug('Speech recognition not supported in this browser');
      this.emitEvent('error', { message: 'Speech recognition not supported in this browser' });
      return;
    }
    
    try {
      // Create speech recognition instance
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      // Dispose of any existing recognition instance
      if (this.recognition) {
        try {
          this.recognition.onend = null;
          this.recognition.onerror = null;
          this.recognition.onresult = null;
          this.recognition.abort();
          this.debug('Disposed of existing speech recognition instance');
        } catch (disposeError) {
          this.debug('Error disposing of existing speech recognition instance:', disposeError);
        }
      }
      
      // Create a new instance
      this.recognition = new SpeechRecognition();
      
      // Initialize recognition if needed
      if (!this.recognition) {
        this.initializeRecognition();
      }
      
      // Configure recognition settings
      if (this.recognition) {
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 3;
        this.recognition.lang = 'en-US';
        
        // Set up event handlers
        this.recognition.onresult = this.handleResult.bind(this);
        this.recognition.onerror = this.handleError.bind(this);
        this.recognition.onend = this.handleEnd.bind(this);
        this.recognition.onstart = this.handleStart.bind(this);
        this.recognition.onaudiostart = () => this.debug('Audio started');
        this.recognition.onsoundstart = () => this.debug('Sound started');
        this.recognition.onsoundend = () => this.debug('Sound ended');
        this.recognition.onnomatch = () => this.debug('No speech detected');
        
        this.debug('Speech recognition initialized successfully');
        this.emitEvent('state_change', { state: 'initialized' });
      } else {
        this.debug('Failed to create speech recognition instance');
        this.emitEvent('error', { message: 'Failed to create speech recognition instance' });
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Check if browser supports speech recognition
   */
  private checkBrowserSupport(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Check microphone permission
   */
  private async checkMicrophonePermission(): Promise<void> {
    try {
      // First, check if permission is already granted using a cached approach
      if (this.micPermission.value !== 'unknown') {
        // If we already know the permission state, avoid unnecessary permission checks
        if (this.micPermission.value === 'granted') {
          return;
        } else if (this.micPermission.value === 'denied') {
          this.emitEvent('permission_required', {
            permission: 'microphone',
            ...this.getBrowserPermissionInstructions()
          });
          return;
        }
      }
      
      // Only query permissions API if we don't know the state
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      if (permissionStatus.state === 'granted') {
        this.micPermission.next('granted');
        return;
      } else if (permissionStatus.state === 'denied') {
        this.micPermission.next('denied');
        this.emitEvent('permission_required', {
          permission: 'microphone',
          ...this.getBrowserPermissionInstructions()
        });
        return;
      } else {
        this.micPermission.next('prompt');
      }
      
      // Request microphone access
      try {
        // Use a more efficient approach to get user media
        const constraints = { 
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.micPermission.next('granted');
        this.lastPermissionCheck = Date.now();
        
        // Stop the stream immediately - we don't need it yet
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        this.debug('Microphone permission denied:', error);
        this.micPermission.next('denied');
        this.emitEvent('permission_required', {
          permission: 'microphone',
          ...this.getBrowserPermissionInstructions()
        });
        return;
      }
    } catch (error) {
      this.debug('Unexpected error checking microphone permission:', error);
      this.handleError(error);
    }
  }

  /**
   * Explicitly request microphone permission
   * This can be called by the UI to prompt the user for permission
   * @returns Promise<boolean> - Whether permission was granted
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    this.debug('Explicitly requesting microphone permission');
    
    try {
      // First, check if permission is already granted using a cached approach
      if (this.micPermission.value === 'granted') {
        this.debug('Microphone permission already granted');
        return true;
      }
      
      // Check if permissions API is available and current state
      if ('permissions' in navigator) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          
          if (permissionStatus.state === 'granted') {
            this.micPermission.next('granted');
            this.debug('Microphone permission already granted');
            await this.initializeRecognition();
            
            // Notify about successful permission
            document.dispatchEvent(new CustomEvent('permission_granted', { 
              detail: { 
                type: 'microphone',
                timestamp: Date.now()
              } 
            }));
            
            return true;
          } else if (permissionStatus.state === 'denied') {
            this.micPermission.next('denied');
            this.emitEvent('error', { 
              type: 'permission_denied',
              message: 'Microphone access is blocked. Please enable it in your browser settings.'
            });
            this.debug('Microphone permission blocked in browser settings');
            
            // Guide user to browser settings
            document.dispatchEvent(new CustomEvent('permission_blocked', { 
              detail: { 
                type: 'microphone',
                timestamp: Date.now(),
                browserHelp: this.getBrowserPermissionInstructions()
              } 
            }));
            
            return false;
          }
          
          // Listen for permission changes
          permissionStatus.onchange = () => {
            this.debug(`Microphone permission status changed to: ${permissionStatus.state}`);
            if (permissionStatus.state === 'granted') {
              this.micPermission.next('granted');
              this.initializeRecognition();
            } else if (permissionStatus.state === 'denied') {
              this.micPermission.next('denied');
            } else {
              this.micPermission.next('prompt');
            }
          };
        } catch (permError) {
          this.debug('Error querying permission status:', permError);
          // Continue to getUserMedia as fallback
        }
      }
      
      // Request microphone permission with timeout
      const constraints = { 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      };
      
      const permissionPromise = navigator.mediaDevices.getUserMedia(constraints);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Permission request timed out')), 10000);
      });

      const stream = await Promise.race([permissionPromise, timeoutPromise]) as MediaStream;
      
      // Update permission state
      this.micPermission.next('granted');
      
      // Stop the stream immediately but keep track info
      const trackInfo = stream.getAudioTracks()[0].getSettings();
      stream.getTracks().forEach(track => track.stop());
      
      // Log success with device info
      this.debug('Microphone permission explicitly granted', {
        deviceId: trackInfo.deviceId,
        groupId: trackInfo.groupId,
        sampleRate: trackInfo.sampleRate,
        channelCount: trackInfo.channelCount
      });
      
      this.emitEvent('state_change', { 
        state: 'permission_granted',
        deviceInfo: trackInfo
      });
      
      // Reinitialize recognition with the new permissions
      await this.initializeRecognition();
      
      return true;
      
    } catch (error: any) {
      this.handleError(error);
      return false;
    }
  }

  /**
   * Start listening for voice commands
   */
  public startListening(): void {
    // Use a flag to prevent multiple simultaneous start attempts
    if (this.isListening || this._startingListening) {
      this.debug('Already listening or starting to listen, ignoring start request');
      return;
    }
    
    // Set a flag to indicate we're in the process of starting
    this._startingListening = true;
    
    // Initialize recognition if needed
    if (!this.recognition) {
      this.initializeRecognition();
    }
    
    // Start listening
    try {
      this.recognition!.start();
      this.isListening = true;
      this._startingListening = false; // Clear the starting flag
      this.recognitionState.next('listening');
      this.debug('Started listening');
    } catch (error) {
      this._startingListening = false; // Clear the starting flag even on error
      this.debug('Error starting recognition:', error);
      this.recognition = null; // Reset recognition on error
      this.initializeRecognition();
      this.restartRecognition();
    }
  }

  /**
   * Handle speech recognition result
   */
  private handleResult(event: SpeechRecognitionEvent): void {
    // Get the transcript from the result
    const transcript = event.results[0][0].transcript;
    
    // Check if wake word is detected
    if (this.isWakeWordDetected(transcript)) {
      this.handleWakeWordDetected();
      return;
    }
    
    // Check for Miranda command even during system speech
    if (transcript.includes('miranda')) {
      this.debug('Miranda command detected during system speech, prioritizing');
      this.processCommand(transcript, true); // Process as high priority
      return;
    }
    
    // Ignore speech while system is speaking
    if (this.isSystemSpeaking) {
      return;
    }
    
    // Process the command
    this.processCommand(transcript);
  }

  /**
   * Handle speech recognition error
   */
  private handleError(error: unknown): void {
    let errorMessage: string;
    let errorName: string;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorName = error.name;
    } else if ((error as SpeechRecognitionErrorEvent).error) {
      errorMessage = (error as SpeechRecognitionErrorEvent).error;
      errorName = (error as SpeechRecognitionErrorEvent).error;
    } else {
      errorMessage = String(error);
      errorName = 'UnknownError';
    }
    console.error('[VoiceRecognition] Error:', errorMessage);
    let userFriendlyMessage = 'An unknown error occurred. Please try again later.';
    let errorType = errorName || 'unknown';
    let recoverable = true;

    // Customize user feedback based on error type
    if (errorMessage.includes('Permission request timed out')) {
      userFriendlyMessage = 'Microphone permission request timed out. Please try again.';
      errorType = 'permission_timeout';
    } else if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      userFriendlyMessage = 'Microphone access denied. Please enable microphone access in your settings.';
      errorType = 'permission_denied';
      recoverable = false;
      this.micPermission.next('denied');
    } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      userFriendlyMessage = 'No microphone found. Please connect a microphone to use voice commands.';
      errorType = 'device_not_found';
      recoverable = false;
    } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      userFriendlyMessage = 'Microphone is currently in use by another application.';
      errorType = 'device_busy';
    } else if (errorName === 'NetworkError' || errorMessage.includes('network')) {
      userFriendlyMessage = 'Network connection issue. Please check your internet connection.';
      errorType = 'network_error';
    } else if (errorName === 'AbortError') {
      userFriendlyMessage = 'Voice recognition was interrupted. Please try again.';
      errorType = 'aborted';
    } else if (errorName === 'AudioCapturingError') {
      userFriendlyMessage = 'Problem capturing audio. Please check your microphone settings.';
      errorType = 'audio_capture_error';
    }

    // Update recognition state
    this.recognitionState.next('error');
    
    // Log error for analytics
    this.logErrorToAnalytics(errorType, errorMessage);

    // Emit error event for UI feedback
    this.emitEvent('error', { 
      type: errorType,
      message: userFriendlyMessage,
      recoverable,
      timestamp: Date.now()
    });
    
    // Attempt recovery for recoverable errors
    if (recoverable) {
      this.attemptErrorRecovery(errorType);
    }
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
        recognitionAttempts: this.recognitionAttempts,
        recognitionSuccesses: this.recognitionSuccesses,
        userAgent: navigator.userAgent
      });
    } catch (e) {
      console.error('Failed to log error to analytics:', e);
    }
  }
  
  /**
   * Attempt to recover from errors based on error type
   */
  private attemptErrorRecovery(errorType: string): void {
    switch (errorType) {
      case 'network_error':
        // For network errors, retry with exponential backoff
        setTimeout(() => this.restartRecognition(), 2000 * Math.min(this.recognitionAttempts, 5));
        break;
      
      case 'audio_capture_error':
      case 'device_busy':
        // For device issues, wait longer before retry
        setTimeout(() => this.restartRecognition(), 3000);
        break;
        
      case 'permission_timeout':
        // For permission timeouts, prompt user to try again
        this.emitEvent('permission_required', { 
          message: 'Please grant microphone access to use voice commands'
        });
        break;
        
      case 'aborted':
        // For aborted operations, restart quickly
        setTimeout(() => this.restartRecognition(), 500);
        break;
        
      default:
        // For other errors, use standard restart logic
        this.restartRecognition();
        break;
    }
  }

  /**
   * Handle speech recognition end event
   */
  private handleEnd(): void {
    this.debug('Speech recognition ended');
    this.isListening = false;
    
    // Restart recognition if it wasn't manually stopped
    if (!this.manualStop) {
      this.restartRecognition();
    }
  }

  /**
   * Handle speech recognition start event
   */
  private handleStart(): void {
    this.debug('Speech recognition started');
    this.isListening = true;
    this.recognitionState.next('listening');
  }

  /**
   * Restart recognition with enhanced error handling
   * This is a utility method used by various error recovery mechanisms
   */
  private restartRecognition(): void {
    // Increment attempt counter
    this.recognitionAttempts++;

    // Use an even more aggressive backoff strategy for faster recovery
    // Start with a smaller delay and cap at a lower maximum
    const delay = Math.min(150 * Math.pow(1.2, Math.min(this.recognitionAttempts - 1, 3)), 3000);
    
    // Use setTimeout directly for better browser compatibility
    setTimeout(() => {
      if (!this.manualStop) {
        // Reset the recognition object if it's in a bad state, but do it sooner
        if (this.recognitionAttempts > 1) { // Further reduced threshold from 2 to 1 for faster recovery
          this.debug('Multiple restart attempts, reinitializing recognition');
          this.recognition = null;
          this.initializeRecognition();
        }
        
        this.startListening();
      }
    }, delay);
  }

  /**
   * Set the system speaking state to avoid processing its own output
   */
  public setSystemSpeaking(speaking: boolean): void {
    this.isSystemSpeaking = speaking;
    this.debug('System speaking state:', speaking);
  }

  /**
   * Debug logging function
   */
  private debug(...args: any[]): void {
    if (this.debugMode) {
      console.log('[VoiceRecognition]', ...args);
    }
  }

  /**
   * Emit an event to subscribers
   */
  private emitEvent(type: VoiceEvent['type'], payload: any): void {
    this.events.next({ type, payload });
  }

  /**
   * Get microphone permission observable
   */
  public getMicPermission(): Observable<MicrophonePermission> {
    return this.micPermission.asObservable();
  }

  /**
   * Get recognition state observable
   */
  public getRecognitionState(): Observable<RecognitionState> {
    return this.recognitionState.asObservable();
  }

  /**
   * Get wake word state observable
   */
  public getWakeWordState(): Observable<WakeWordState> {
    return this.wakeWordState.asObservable();
  }

  /**
   * Get transcript observable
   */
  public getTranscript(): Observable<string> {
    return this.transcript.asObservable();
  }

  /**
   * Get events observable
   */
  public getEvents(): Observable<VoiceEvent> {
    return this.events.asObservable();
  }
  
  /**
   * Get browser-specific instructions for enabling microphone permissions
   * @returns Object with browser name and instructions
   */
  private getBrowserPermissionInstructions(): { browser: string; instructions: string } {
    const userAgent = navigator.userAgent.toLowerCase();
    let browser = 'unknown';
    let instructions = 'Please check your browser settings to enable microphone access.';
    
    // Detect browser and provide specific instructions
    if (userAgent.includes('chrome') || userAgent.includes('chromium')) {
      browser = 'Chrome';
      instructions = 'Click the lock icon in the address bar, then select "Site Settings" and change Microphone permission to "Allow".';
    } else if (userAgent.includes('firefox')) {
      browser = 'Firefox';
      instructions = 'Click the lock icon in the address bar, then select "Connection Secure" > "More Information" > "Permissions" and change Microphone permission.';
    } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      browser = 'Safari';
      instructions = 'Open Safari Preferences > Websites > Microphone and set the permission for this website to "Allow".';
    } else if (userAgent.includes('edge')) {
      browser = 'Edge';
      instructions = 'Click the lock icon in the address bar, then select "Site Permissions" and change Microphone permission to "Allow".';
    }
    
    return { browser, instructions };
  }

  /**
   * Get current voice recognition accuracy
   */
  public getRecognitionAccuracy(): number {
    return this.lastRecognitionAccuracy;
  }

  /**
   * Force wake word detection (for testing/debugging)
   */
  public forceWakeWordDetection(): void {
    this.handleWakeWordDetected();
  }
}

// Create singleton instance
export const voiceRecognitionService = new VoiceRecognitionService();
