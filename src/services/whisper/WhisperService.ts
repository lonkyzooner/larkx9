import { pipeline } from '@xenova/transformers';
import { BehaviorSubject } from 'rxjs';

class WhisperService {
  private transcriptionPipeline: any = null;
  private isInitialized = new BehaviorSubject<boolean>(false);
  private isProcessing = new BehaviorSubject<boolean>(false);

  constructor() {
    this.initializeWhisper();
  }

  private async initializeWhisper() {
    try {
      // Initialize the Whisper model for transcription
      this.transcriptionPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
      this.isInitialized.next(true);
    } catch (error) {
      console.error('Error initializing Whisper:', error);
      this.isInitialized.next(false);
    }
  }

  public async transcribeAudio(audioData: Float32Array): Promise<{ text: string; confidence: number }> {
    if (!this.isInitialized.value) {
      throw new Error('Whisper is not initialized');
    }

    this.isProcessing.next(true);
    try {
      // Convert audio data to the format expected by Whisper
      const result = await this.transcriptionPipeline(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'en',
        task: 'transcribe'
      });

      return {
        text: result.text,
        confidence: result.confidence || 0.0
      };
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    } finally {
      this.isProcessing.next(false);
    }
  }

  public getInitializationState() {
    return this.isInitialized.asObservable();
  }

  public getProcessingState() {
    return this.isProcessing.asObservable();
  }
}

export const whisperService = new WhisperService();
