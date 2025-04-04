import { BehaviorSubject, Subject } from 'rxjs';

// Constants for Groq configuration
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

// Define types for Groq service
export type GroqServiceState = 'idle' | 'processing' | 'error';

export interface GroqServiceEvent {
  type: 'processing_start' | 'processing_complete' | 'error';
  payload: any;
}

// Define interface for command processing results
export interface CommandProcessingResult {
  response: string;
  action?: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

/**
 * GroqService - Handles interactions with the Groq API for fast inference
 * Used for audio analysis and command processing with lower latency than OpenAI
 */
export class GroqService {
  private state = new BehaviorSubject<GroqServiceState>('idle');
  private events = new Subject<GroqServiceEvent>();
  private errorEvent = new BehaviorSubject<any>(null);
  private processingCount = 0;
  private networkStatus = navigator.onLine;
  
  constructor() {
    console.log('[GroqService] Service initialized');
    this.validateConfiguration();
    
    // Monitor network status for better error handling
    window.addEventListener('online', this.handleNetworkChange.bind(this));
    window.addEventListener('offline', this.handleNetworkChange.bind(this));
  }
  
  /**
   * Generates text using the Groq API
   * @param prompt The prompt to send to Groq
   * @returns The generated text
   */
  public async generateText(prompt: string): Promise<string> {
    if (!GROQ_API_KEY) {
      throw new Error('Groq API key not configured');
    }

    try {
      this.state.next('processing');
      this.events.next({ type: 'processing_start', payload: { prompt } });

      const response = await fetch('https://api.groq.com/v1/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.statusText}`);
      }

      const data = await response.json();
      const generatedText = data.choices[0]?.message?.content || '';

      this.state.next('idle');
      this.events.next({ type: 'processing_complete', payload: { generatedText } });

      return generatedText;
    } catch (error) {
      this.state.next('error');
      this.events.next({ type: 'error', payload: { error } });
      throw error;
    }
  }

  private validateConfiguration(): void {
    if (!GROQ_API_KEY) {
      console.warn('[GroqService] Groq API key not configured, service will be limited');
      this.errorEvent.next({
        type: 'configuration_error',
        message: 'Groq API key not configured. Falling back to OpenAI for processing.',
        timestamp: Date.now(),
        recoverable: true
      });
    }
  }
  
  /**
   * Handle network status changes
   */
  private handleNetworkChange(): void {
    this.networkStatus = navigator.onLine;
    console.log(`[GroqService] Network status changed: ${this.networkStatus ? 'online' : 'offline'}`);
  }
  
  /**
   * Get the current service state
   */
  public getState() {
    return this.state.asObservable();
  }
  
  /**
   * Get all service events
   */
  public getEvents() {
    return this.events.asObservable();
  }
  
  /**
   * Get error events
   */
  public getErrorEvent() {
    return this.errorEvent.asObservable();
  }
  
  /**
   * Emit an event
   */
  private emitEvent(type: GroqServiceEvent['type'], payload: any): void {
    this.events.next({ type, payload });
  }
  
  /**
   * Analyze audio for threats using Groq API
   * @param audioData Audio data as base64 string or transcribed text
   * @returns Analysis results
   */
  public async analyzeAudio(audioData: string): Promise<{ 
    threats: Array<{ type: string, confidence: number, description: string }>,
    summary: string
  }> {
    if (!GROQ_API_KEY) {
      throw new Error('Groq API key not configured');
    }
    
    try {
      this.processingCount++;
      this.state.next('processing');
      this.emitEvent('processing_start', { timestamp: Date.now() });
      
      console.log('[GroqService] Analyzing audio for threats');
      
      // Determine if input is text or audio
      const isText = !audioData.includes('/') && !audioData.includes('+') && !audioData.includes('=');
      
      // Prepare the prompt for threat detection
      const prompt = isText 
        ? `Analyze the following audio transcript for potential threats or safety concerns: "${audioData}"`
        : "Analyze the provided audio for potential threats or safety concerns.";
      
      // Call Groq API for threat analysis
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [
            {
              role: 'system',
              content: 'You are a law enforcement threat detection system. Analyze audio for potential threats like gunshots, raised voices, or concerning language. Provide a structured response with identified threats and a brief summary.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      const analysisText = result.choices[0].message.content;
      
      // Parse the JSON response
      let analysis;
      try {
        analysis = JSON.parse(analysisText);
      } catch (error) {
        // If parsing fails, create a structured response from the text
        analysis = {
          threats: [],
          summary: analysisText
        };
      }
      
      console.log('[GroqService] Audio analysis complete');
      this.emitEvent('processing_complete', { 
        result: analysis,
        timestamp: Date.now() 
      });
      
      return analysis;
    } catch (error) {
      console.error('[GroqService] Error analyzing audio:', error);
      this.errorEvent.next({
        type: 'analysis_error',
        message: error instanceof Error ? error.message : 'Failed to analyze audio',
        timestamp: Date.now()
      });
      
      this.emitEvent('error', { 
        error: error instanceof Error ? error.message : 'Failed to analyze audio',
        timestamp: Date.now()
      });
      
      // Return a default response on error
      return {
        threats: [],
        summary: 'Unable to analyze audio due to an error.'
      };
    } finally {
      this.processingCount--;
      if (this.processingCount === 0) {
        this.state.next('idle');
      }
    }
  }
  
  /**
   * Process a command using Groq API
   * @param command The command to process
   * @param context Additional context for the command
   * @returns Processed response with metadata
   */
  public async processCommand(command: string, context: any = {}): Promise<CommandProcessingResult> {
    if (!GROQ_API_KEY) {
      throw new Error('Groq API key not configured');
    }
    
    try {
      this.processingCount++;
      this.state.next('processing');
      this.emitEvent('processing_start', { timestamp: Date.now() });
      
      console.log('[GroqService] Processing command:', command);
      
      // Prepare context string
      const contextString = Object.entries(context)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      // Call Groq API for command processing
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [
            {
              role: 'system',
              content: 'You are LARK (Law Enforcement Assistance and Response Kit), a body-mounted AI assistant for solo police officers. Provide concise, helpful responses to officer commands and questions. Focus on safety, clarity, and actionable information.'
            },
            {
              role: 'user',
              content: `Command: ${command}\n\nContext:\n${contextString}`
            }
          ],
          temperature: 0.3,
          max_tokens: 150
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      const responseText = result.choices[0].message.content.trim();
      
      console.log('[GroqService] Command processing complete');
      this.emitEvent('processing_complete', { 
        result: responseText,
        timestamp: Date.now() 
      });
      
      // Convert string response to CommandProcessingResult format
      return {
        response: responseText,
        action: 'general_response',
        confidence: 0.9
      };
    } catch (error) {
      console.error('[GroqService] Error processing command:', error);
      this.errorEvent.next({
        type: 'processing_error',
        message: error instanceof Error ? error.message : 'Failed to process command',
        timestamp: Date.now()
      });
      
      this.emitEvent('error', { 
        error: error instanceof Error ? error.message : 'Failed to process command',
        timestamp: Date.now()
      });
      
      // Return a default response on error
      return {
        response: 'I apologize, but I was unable to process that command. Please try again.',
        action: 'error',
        confidence: 0
      };
    } finally {
      this.processingCount--;
      if (this.processingCount === 0) {
        this.state.next('idle');
      }
    }
  }
  
  /**
   * Check if Groq service is available
   * @returns Boolean indicating if Groq service is available
   */
  public isAvailable(): boolean {
    return !!GROQ_API_KEY && this.networkStatus;
  }
}

// Create a singleton instance
export const groqService = new GroqService();
