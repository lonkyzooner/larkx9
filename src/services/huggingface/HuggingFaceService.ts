import { BehaviorSubject } from 'rxjs';

// API URL for the backend server
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

export interface EmotionDetectionResult {
  emotion: string;
  score: number;
  timestamp: number;
}

export interface SentimentAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  timestamp: number;
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * Service for interacting with Hugging Face models
 * Optimized with caching and error handling
 */
export class HuggingFaceService {
  private isProcessing = new BehaviorSubject<boolean>(false);
  private lastEmotion = new BehaviorSubject<EmotionDetectionResult | null>(null);
  private lastSentiment = new BehaviorSubject<SentimentAnalysisResult | null>(null);
  private useDirectApi: boolean;
  private cache = new Map<string, CacheItem<any>>();
  private requestQueue: Promise<any>[] = [];
  private maxConcurrentRequests = 2;

  constructor() {
    // In development, we might still use direct API calls with local key as fallback
    this.useDirectApi = import.meta.env.DEV && !!import.meta.env.VITE_HUGGINGFACE_API_KEY;
  }

  /**
   * Make API request with queuing to limit concurrent requests
   * @param apiCall Function that makes the actual API call
   * @returns Promise with the API response
   */
  private async queueRequest<T>(apiCall: () => Promise<T>): Promise<T> {
    // If we're already at max concurrent requests, wait for one to finish
    while (this.requestQueue.length >= this.maxConcurrentRequests) {
      await Promise.race(this.requestQueue);
    }
    
    // Add this request to the queue
    const request = apiCall();
    this.requestQueue.push(request);
    
    try {
      return await request;
    } finally {
      // Remove from queue when done
      const index = this.requestQueue.indexOf(request);
      if (index !== -1) this.requestQueue.splice(index, 1);
    }
  }

  /**
   * Get cached data or execute function to get fresh data
   * @param cacheKey Key to store in cache
   * @param fetchFn Function to execute if cache miss
   * @returns Promise with data
   */
  private async getCachedOrFresh<T>(
    cacheKey: string, 
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    
    // Return cached data if it exists and is not expired
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }
    
    // Get fresh data
    const data = await fetchFn();
    
    // Cache the result
    this.cache.set(cacheKey, { data, timestamp: now });
    return data;
  }

  /**
   * Detect emotion in text using Hugging Face model
   * @param text Text to analyze
   * @returns Promise with emotion detection result
   */
  public async detectEmotion(text: string): Promise<EmotionDetectionResult> {
    if (!text || text.trim() === '') {
      return { emotion: 'neutral', score: 1.0, timestamp: Date.now() };
    }

    const trimmedText = text.trim();
    const cacheKey = `emotion:${trimmedText}`;
    
    try {
      this.isProcessing.next(true);
      
      return await this.getCachedOrFresh(cacheKey, async () => {
        let response;
        
        // Try to use the secure backend API first
        try {
          response = await this.queueRequest(() => fetch(
            `${API_BASE_URL}/api/huggingface/models/j-hartmann/emotion-english-distilroberta-base`, 
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ inputs: trimmedText })
            }
          ));
        } catch (backendError) {
          console.warn('[HuggingFace] Backend API call failed:', backendError);
          
          // Fallback to direct API call in development only if we have an API key
          if (!this.useDirectApi) {
            throw new Error('Backend API unavailable and no fallback configured');
          }
          
          response = await this.queueRequest(() => fetch(
            'https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base', 
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ inputs: trimmedText })
            }
          ));
        }

        if (!response.ok) {
          throw new Error(`Hugging Face API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Find the emotion with the highest score
        let highestScore = 0;
        let detectedEmotion = 'neutral';
        
        if (Array.isArray(data) && data.length > 0) {
          for (const result of data[0]) {
            if (result.score > highestScore) {
              highestScore = result.score;
              detectedEmotion = result.label;
            }
          }
        }
        
        const result = {
          emotion: detectedEmotion,
          score: highestScore,
          timestamp: Date.now()
        };
        
        this.lastEmotion.next(result);
        return result;
      });
    } catch (error) {
      console.error('[HuggingFace] Error detecting emotion:', error);
      // Return neutral as fallback
      return { emotion: 'neutral', score: 1.0, timestamp: Date.now() };
    } finally {
      this.isProcessing.next(false);
    }
  }

  /**
   * Analyze sentiment in text using Hugging Face model
   * @param text Text to analyze
   * @returns Promise with sentiment analysis result
   */
  public async analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
    if (!text || text.trim() === '') {
      return { sentiment: 'neutral', score: 1.0, timestamp: Date.now() };
    }

    const trimmedText = text.trim();
    const cacheKey = `sentiment:${trimmedText}`;
    
    try {
      this.isProcessing.next(true);
      
      return await this.getCachedOrFresh(cacheKey, async () => {
        let response;
        
        // Try to use the secure backend API first
        try {
          response = await this.queueRequest(() => fetch(
            `${API_BASE_URL}/api/huggingface/models/distilbert-base-uncased-finetuned-sst-2-english`, 
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ inputs: trimmedText })
            }
          ));
        } catch (backendError) {
          console.warn('[HuggingFace] Backend API call failed:', backendError);
          
          // Fallback to direct API call in development only if we have an API key
          if (!this.useDirectApi) {
            throw new Error('Backend API unavailable and no fallback configured');
          }
          
          response = await this.queueRequest(() => fetch(
            'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english', 
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ inputs: trimmedText })
            }
          ));
        }

        if (!response.ok) {
          throw new Error(`Hugging Face API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
        let score = 0.5;
        
        if (Array.isArray(data) && data.length > 0) {
          for (const result of data[0]) {
            if (result.label === 'POSITIVE' && result.score > 0.6) {
              sentiment = 'positive';
              score = result.score;
            } else if (result.label === 'NEGATIVE' && result.score > 0.6) {
              sentiment = 'negative';
              score = result.score;
            }
          }
        }
        
        const result = {
          sentiment,
          score,
          timestamp: Date.now()
        };
        
        this.lastSentiment.next(result);
        return result;
      });
    } catch (error) {
      console.error('[HuggingFace] Error analyzing sentiment:', error);
      // Return neutral as fallback
      return { sentiment: 'neutral', score: 0.5, timestamp: Date.now() };
    } finally {
      this.isProcessing.next(false);
    }
  }

  /**
   * Get processing state
   */
  public getProcessingState() {
    return this.isProcessing.asObservable();
  }

  /**
   * Get last detected emotion
   */
  public getLastEmotion() {
    return this.lastEmotion.asObservable();
  }

  /**
   * Get last analyzed sentiment
   */
  public getLastSentiment() {
    return this.lastSentiment.asObservable();
  }
  
  /**
   * Clear the cache
   */
  public clearCache() {
    this.cache.clear();
  }
}

// Create and export a singleton instance
export const huggingFaceService = new HuggingFaceService();
