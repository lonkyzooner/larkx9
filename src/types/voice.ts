export interface VoiceContextType {
  isListening: boolean;
  recognitionState: RecognitionState;
  lastCommand: string | null;
  voice: VoiceService;
  startListening: () => void;
  stopListening: () => void;
}

export interface VoiceService {
  processCommand: (command: string) => Promise<void>;
  isListening: boolean;
  isEnabled: boolean;
  isSpeaking: boolean;
  accuracy: number;
  lastCommand: string | null;
  wakeWord: string;
  commands: string[];
  settings: VoiceSettings;
}

export interface VoiceSettings {
  wakeWord: string;
  voiceId: string;
  voiceSpeed: number;
  voicePitch: number;
  voiceVolume: number;
  useOfflineMode: boolean;
  useCache: boolean;
  debug: boolean;
  enableVoice: boolean;
  multiCommand: boolean;
}

export type RecognitionState = 'idle' | 'listening' | 'processing';

export interface VoiceEvent {
  type: VoiceEventType;
  payload?: VoiceEventPayload;
}

export type VoiceEventType =
  | 'WAKE_WORD_DETECTED'
  | 'COMMAND_DETECTED'
  | 'COMMAND_PROCESSED'
  | 'COMMAND_ERROR'
  | 'RECOGNITION_STATE_CHANGED';

export interface VoiceEventPayload {
  command?: string;
  state?: RecognitionState;
  success?: boolean;
  error?: string;
  data?: {
    success: boolean;
    isMultiCommand?: boolean;
    chainId?: string;
    index?: number;
    total?: number;
  };
}

export interface AnalyticsData {
  commandSuccess: number;
  commandFailure: number;
  voiceAccuracy: number;
  cacheHits: number;
  multiCommandSuccess: number;
  averageCommandsPerChain: number;
}

export interface CommandEvent {
  command: string;
  isMultiCommand?: boolean;
  chainId?: string;
  index?: number;
  total?: number;
}

export interface VoiceData {
  accuracy: number;
  timestamp: number;
  fromCache?: boolean;
  data?: {
    success: boolean;
    isMultiCommand?: boolean;
    chainId?: string;
  };
}
