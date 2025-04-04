/**
 * Utilities for working with Web Workers
 */

import { trackApiCall } from './performanceMonitor';

// Generate a unique ID for each worker request
const generateRequestId = () => `req_${Math.random().toString(36).substring(2, 11)}`;

/**
 * Create a wrapper for a web worker that provides a Promise-based interface
 * @param worker The web worker instance
 * @returns An object with methods to call worker functions
 */
interface WorkerCallback {
  resolve: Function;
  reject: Function;
  startTime: number;
  operation: string;
}

export function createWorkerInterface(worker: Worker) {
  const callbacks = new Map<string, WorkerCallback>();
  
  // Set up message handler
  worker.addEventListener('message', (event) => {
    const { id, result, error, type } = event.data;
    
    // Handle ready message
    if (type === 'ready') {
      console.log('Worker is ready');
      return;
    }
    
    if (id && callbacks.has(id)) {
      const { resolve, reject, startTime, operation } = callbacks.get(id)!;
      
      // Track performance for this worker operation
      trackApiCall(`worker_${operation}`, startTime, !!error);
      
      if (error) {
        reject(new Error(error));
      } else {
        resolve(result);
      }
      
      // Clean up callback
      callbacks.delete(id);
    }
  });
  
  // Handle worker errors
  worker.addEventListener('error', (event) => {
    console.error('Worker error:', event);
    
    // Reject all pending callbacks
    callbacks.forEach(({ reject }) => {
      reject(new Error('Worker error occurred'));
    });
    
    // Clear all callbacks
    callbacks.clear();
  });
  
  return {
    /**
     * Send a message to the worker and return a promise for the result
     * @param type The type of message to send
     * @param payload The data to send to the worker
     * @returns A promise that resolves with the worker's response
     */
    sendMessage<T, R>(action: string, payload: T): Promise<R> {
      return new Promise((resolve, reject) => {
        const id = generateRequestId();
        const startTime = performance.now();
        
        // Store callbacks with timing information
        callbacks.set(id, { 
          resolve, 
          reject, 
          startTime,
          operation: action
        });
        
        // Send message to worker
        worker.postMessage({ id, action, payload });
        
        // Set timeout to prevent memory leaks from unresolved promises
        setTimeout(() => {
          if (callbacks.has(id)) {
            const { reject } = callbacks.get(id)!;
            reject(new Error('Worker request timed out'));
            callbacks.delete(id);
            
            // Track timeout as an error
            trackApiCall(`worker_${action}_timeout`, startTime, true);
          }
        }, 30000); // 30 second timeout
      });
    },
    
    /**
     * Terminate the worker
     */
    terminate() {
      // Reject all pending callbacks
      callbacks.forEach(({ reject }) => {
        reject(new Error('Worker was terminated'));
      });
      
      // Clear all callbacks
      callbacks.clear();
      
      // Terminate the worker
      worker.terminate();
    }
  };
}

/**
 * Create a text processing worker interface
 * @returns An interface for the text processing worker
 */
export function createTextProcessingWorker() {
  // Create worker
  const worker = new Worker(new URL('../workers/textProcessingWorker.ts', import.meta.url), { type: 'module' });
  const workerInterface = createWorkerInterface(worker);
  
  return {
    /**
     * Analyze text (word count, sentence count, etc.)
     * @param text The text to analyze
     * @returns Analysis results
     */
    analyzeText(text: string) {
      return workerInterface.sendMessage<{text: string}, any>('analyzeText', { text });
    },
    
    /**
     * Extract keywords from text
     * @param text The text to extract keywords from
     * @returns Extracted keywords with frequencies
     */
    extractKeywords(text: string) {
      return workerInterface.sendMessage<{text: string}, any>('extractKeywords', { text });
    },
    
    /**
     * Detect sentiment in text
     * @param text The text to analyze for sentiment
     * @returns Sentiment analysis results
     */
    detectSentiment(text: string) {
      return workerInterface.sendMessage<{text: string}, any>('detectSentiment', { text });
    },
    
    /**
     * Process transcript for law enforcement context
     * @param text The transcript to process
     * @returns Processed transcript with law enforcement context
     */
    processTranscript(text: string) {
      return workerInterface.sendMessage<{text: string}, any>('processTranscript', { text });
    },
    
    /**
     * Terminate the worker
     */
    terminate() {
      workerInterface.terminate();
    }
  };
}

/**
 * Singleton instance of the text processing worker
 */
let textProcessingWorkerInstance: ReturnType<typeof createTextProcessingWorker> | null = null;

/**
 * Get the text processing worker instance (creates it if it doesn't exist)
 * @returns The text processing worker instance
 */
export function getTextProcessingWorker() {
  if (!textProcessingWorkerInstance) {
    textProcessingWorkerInstance = createTextProcessingWorker();
  }
  return textProcessingWorkerInstance;
}
