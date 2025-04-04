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
  private manualStop: boolean = false;
  private wakeWordDetected: boolean = false;
  private isSystemSpeaking: boolean = false;
  private isProcessingCommand: boolean = false;
  private isOfflineMode: boolean = false;
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
  private commandProcessingDelay: number = 500; // ms delay before processing commands
  private extendedListeningTime: number = 5000; // ms to continue listening after wake word
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
      // First check if permission is already granted using Permissions API
      if ('permissions' in navigator) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          
          if (permissionStatus.state === 'granted') {
            this.micPermission.next('granted');
            this.debug('Microphone permission already granted');
            return;
          } else if (permissionStatus.state === 'denied') {
            this.micPermission.next('denied');
            this.emitEvent('error', { 
              type: 'permission_denied',
              message: 'Microphone access is blocked. Please enable it in your browser settings.'
            });
            console.error('Microphone access denied:', {});
            this.debug('Microphone permission blocked in browser settings');
            return;
          }
        } catch (permissionQueryError) {
          this.debug('Error querying permission status:', permissionQueryError);
          // Continue to getUserMedia as fallback
        }
      }
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.micPermission.next('prompt');
        this.debug('Media devices API not available');
        this.emitEvent('error', { 
          type: 'api_unavailable',
          message: 'Your browser does not support microphone access'
        });
        return;
      }

      // Try to get microphone access with timeout
      try {
        const permissionPromise = navigator.mediaDevices.getUserMedia({ audio: true });
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Permission request timed out')), 10000);
        });

        const stream = await Promise.race([permissionPromise, timeoutPromise]) as MediaStream;
        
        // Successfully got microphone access
        this.micPermission.next('granted');
        
        // Stop the stream immediately after permission check
        stream.getTracks().forEach(track => track.stop());
        
        this.debug('Microphone permission granted');
        this.emitEvent('state_change', { state: 'permission_granted' });
      } catch (micError: any) {
        // Handle specific error types
        this.micPermission.next('denied');
        console.error('Microphone access denied:', micError);
        
        if (micError.name === 'NotAllowedError' || micError.name === 'PermissionDeniedError') {
          this.emitEvent('error', { 
            type: 'permission_denied',
            message: 'Microphone access was denied. Voice features will be limited.',
            error: micError
          });
          this.debug('User denied microphone permission');
          
          // Dispatch a permission required event to notify UI components
          this.emitEvent('permission_required', {
            type: 'microphone',
            message: 'Microphone access is required for voice recognition features.',
            timestamp: Date.now()
          });
          
          // Also dispatch a DOM event for components that might not be subscribed to our events
          document.dispatchEvent(new CustomEvent('permission_required', { 
            detail: { 
              type: 'microphone',
              timestamp: Date.now(),
              error: micError.toString()
            } 
          }));
        } else if (micError.name === 'NotFoundError') {
          this.emitEvent('error', { 
            type: 'device_not_found',
            message: 'No microphone device was found. Please connect a microphone.',
            error: micError
          });
          this.debug('No microphone device found');
        } else {
          this.handleError(micError);
        }
      }
    } catch (error: any) {
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
      // First check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.micPermission.next('prompt');
        this.debug('Media devices API not available');
        this.emitEvent('error', { 
          type: 'api_unavailable',
          message: 'Your browser does not support microphone access'
        });
        
        // Notify UI components about browser incompatibility
        document.dispatchEvent(new CustomEvent('browser_incompatible', { 
          detail: { 
            feature: 'microphone',
            timestamp: Date.now(),
            message: 'Your browser does not support microphone access'
          } 
        }));
        
        return false;
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
      const permissionPromise = navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
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
  private startRecording(): void {
    if (!this.audioContext) return;

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
          this.audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioData = await this.audioContext!.decodeAudioData(arrayBuffer);
          const float32Array = audioData.getChannelData(0);

          try {
            const result = await whisperService.transcribeAudio(float32Array);
            this.handleWhisperResult(result);
          } catch (error) {
            console.error('Error processing audio with Whisper:', error);
            this.handleError(error instanceof Error ? error : new Error(String(error)));
          }
        };

        this.mediaRecorder.start();
        this.isListening = true;
        this.recognitionState.next('active');
        this.debug('Started recording for offline transcription');
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        this.handleError(error instanceof Error ? error : new Error(String(error)));
      });
  }

  private handleWhisperResult(result: { text: string; confidence: number }): void {
    if (result.text) {
      const transcript = result.text.toLowerCase();
      if (this.containsWakeWord(transcript)) {
        this.handleWakeWordDetected();
      } else if (this.wakeWordDetected) {
        this.processCommand(transcript);
      }
      this.transcript.next(transcript);
    }
  }

  public startListening(): void {
    if (this.isOfflineMode) {
      this.startRecording();
    } else {
      if (!this.recognition) {
        this.initializeRecognition();
        if (!this.recognition) {
          this.debug('Failed to initialize speech recognition');
          return;
        }
      }

      if (this.isListening) {
        this.debug('Already listening');
        return;
      }

      try {
        this.manualStop = false;
        this.recognition.start();
        this.isListening = true;
        this.recognitionState.next('active');
        this.debug('Started listening for voice commands');
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Stop listening for voice commands
   */
  public stopListening(): void {
    if (this.isOfflineMode) {
      if (this.mediaRecorder && this.isListening) {
        this.mediaRecorder.stop();
        this.isListening = false;
        this.recognitionState.next('inactive');
      }
    } else if (this.recognition && this.isListening) {
      try {
        this.manualStop = true;
        this.recognition.stop();
        this.isListening = false;
        this.recognitionState.next('inactive');
        this.debug('Stopped listening');
        this.emitEvent('state_change', { state: 'inactive' });
      } catch (error) {
        this.handleError(error);
      }
    }
  }

  /**
   * Handle speech recognition result
   */
  private handleResult(event: SpeechRecognitionEvent): void {
    if (!event.results || event.results.length === 0) {
      return;
    }

    const result = event.results[event.results.length - 1];
    if (!result) return;

    const transcript = result[0]?.transcript?.toLowerCase().trim() || '';
    const confidence = result[0]?.confidence || 0;
    this.debug('Speech recognized:', transcript, 'confidence:', confidence, 'isFinal:', result.isFinal);

    // Special handling when system is speaking to avoid feedback loops
    if (this.isSystemSpeaking) {
      // Even while system is speaking, we still want to listen for wake words and Miranda commands
      // This allows officers to interrupt the system in urgent situations
      if (result.isFinal) {
        // Check for wake word
        if (this.containsWakeWord(transcript) && this.wakeWordState.value === 'inactive') {
          this.handleWakeWordDetected();
          return;
        }
        
        // Check for Miranda command even during system speech
        if (transcript.includes('miranda')) {
          this.debug('Miranda command detected during system speech, prioritizing');
          this.processCommand(transcript, true); // Process as high priority
          return;
        }
      }
      return; // Otherwise ignore speech while system is speaking
    }

    // Track recognition success for analytics
    if (result.isFinal && transcript) {
      this.recognitionSuccesses++;
      this.lastRecognitionAccuracy = confidence;
    }

    // Emit interim transcript for UI updates with enhanced feedback
    this.transcript.next(transcript);
    this.emitEvent('interim_transcript', { 
      transcript, 
      confidence, 
      isFinal: result.isFinal,
      processingState: this.wakeWordState.value,
      timestamp: Date.now()
    });

    // If we're already in command listening mode, process this as a command
    if (this.wakeWordState.value === 'listening_for_command' && result.isFinal) {
      // Check for multiple commands in a single utterance
      if (transcript.includes(' and ') || transcript.includes(' then ')) {
        const commands = this.parseCommands(transcript);
        if (commands.length > 1) {
          this.debug(`Detected ${commands.length} commands in utterance: ${commands.join(' | ')}`);
          // Process each command sequentially
          commands.forEach((cmd, index) => {
            // Add a slight delay between commands to prevent overwhelming the system
            setTimeout(() => this.processCommand(cmd, true), index * 300);
          });
          return;
        }
      }
      
      this.processCommand(transcript);
      return;
    }

    // Otherwise, check for wake word, but only if we're not already in an active state
    if (result.isFinal && this.containsWakeWord(transcript) && this.wakeWordState.value === 'inactive') {
      this.handleWakeWordDetected();
    }
  }

  /**
   * Check if the transcript contains a wake word
   */
  private containsWakeWord(transcript: string): boolean {
    const normalizedTranscript = transcript.toLowerCase().trim();
    return this.wakeWords.some(wakeWord => {
      return normalizedTranscript === wakeWord || 
             normalizedTranscript.startsWith(wakeWord + ' ') ||
             normalizedTranscript.includes(' ' + wakeWord + ' ');
    });
  }

  private wakeWordDetectedState: 'inactive' | 'detected' | 'processing' = 'inactive';

  private handleWakeWordDetected(): void {
    if (this.wakeWordDetectedState !== 'inactive') {
      this.debug('Wake word already detected, ignoring duplicate');
      return;
    }

    this.wakeWordDetectedState = 'detected';
    this.wakeWordState.next('detected');
    this.emitEvent('wake_word_detected', { timestamp: Date.now() });

    // Start listening for a command
    this.startListeningForCommand();
  }

  private startListeningForCommand(): void {
    // Clear any existing timeout
    if (this.commandListeningTimeout) {
      clearTimeout(this.commandListeningTimeout);
    }

    // Set wake word state to listening for command
    this.wakeWordState.next('listening_for_command');

    // Set timeout to reset wake word detection after extended listening period
    this.commandListeningTimeout = setTimeout(() => {
      if (this.wakeWordState.value === 'listening_for_command') {
        this.debug('Command listening timeout expired');
        this.wakeWordState.next('inactive');
        this.wakeWordDetectedState = 'inactive';
      }
    }, this.extendedListeningTime);
  }

  private isProcessingCommandState: boolean = false;

  private processCommand(command: string, isMultiCommand: boolean = false): void {
    if (this.isProcessingCommandState && !isMultiCommand) {
      this.debug('Already processing a command, ignoring duplicate');
      return;
    }

    this.isProcessingCommandState = true;

    // Reset wake word state only if this is not part of a multi-command
    if (!isMultiCommand) {
      this.wakeWordState.next('inactive');
      this.wakeWordDetectedState = 'inactive';

      // Clear any existing timeout
      if (this.commandListeningTimeout) {
        clearTimeout(this.commandListeningTimeout);
        this.commandListeningTimeout = null;
      }
    }

    // Check for multiple commands
    const commandParts = this.parseCommands(command);
    if (commandParts.length > 1 && !isMultiCommand) {
      // Process each command in sequence
      this.debug(`Processing ${commandParts.length} commands in sequence`);
      commandParts.forEach((cmd) => {
        this.processCommand(cmd, true);
      });
    } else {
      // Emit single command detected event
      this.emitEvent('command_detected', { command, timestamp: Date.now() });
    }

    // Reset processing flag after a short delay, only if not part of multi-command
    if (!isMultiCommand) {
      setTimeout(() => {
        this.isProcessingCommandState = false;
      }, 1000);
    }
  }

  /**
   * Parse multiple commands from a single utterance
   */
  private parseCommands(utterance: string): string[] {
    const commandSeparators = [
      ' and then ',
      ' then ',
      ' after that ',
      ' next ',
      ' followed by ',
      '; ',
      ' and '
    ];
    
    let commands = [utterance];
    
    // Try each separator and use the one that gives us the most commands
    for (const separator of commandSeparators) {
      if (utterance.toLowerCase().includes(separator)) {
        const parts = utterance
          .split(new RegExp(separator, 'i'))
          .map(cmd => cmd.trim())
          .filter(cmd => cmd.length > 0);
        
        if (parts.length > commands.length) {
          commands = parts;
        }
      }
    }
    
    return commands;
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

    // Implement exponential backoff for repeated failures
    const delay = Math.min(300 * Math.pow(1.5, Math.min(this.recognitionAttempts - 1, 5)), 10000);
    
    setTimeout(() => {
      if (!this.manualStop) {
        // Reset the recognition object if it's in a bad state
        if (this.recognitionAttempts > 3) {
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
