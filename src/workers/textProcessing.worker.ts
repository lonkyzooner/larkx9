/**
 * Web Worker for text processing tasks
 * This runs in a separate thread to avoid blocking the UI
 */

// Define message types
type WorkerMessageData = {
  type: 'ANALYZE_TEXT' | 'TOKENIZE' | 'PREPROCESS';
  payload: any;
  id: string;
};

// Process incoming messages
self.addEventListener('message', (event: MessageEvent<WorkerMessageData>) => {
  const { type, payload, id } = event.data;
  
  switch (type) {
    case 'ANALYZE_TEXT':
      analyzeText(payload, id);
      break;
    case 'TOKENIZE':
      tokenizeText(payload, id);
      break;
    case 'PREPROCESS':
      preprocessText(payload, id);
      break;
    default:
      self.postMessage({
        error: 'Unknown command',
        id
      });
  }
});

/**
 * Basic text analysis (word count, sentence count, etc.)
 */
function analyzeText(text: string, id: string) {
  try {
    // Count words
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    
    // Count sentences (simple approximation)
    const sentences = text.split(/[.!?]+/).filter(Boolean).length;
    
    // Estimate reading time (average reading speed: 200 words per minute)
    const readingTimeSeconds = Math.ceil((words / 200) * 60);
    
    // Return analysis results
    self.postMessage({
      result: {
        words,
        sentences,
        readingTimeSeconds,
        characters: text.length,
        charactersExcludingSpaces: text.replace(/\s/g, '').length
      },
      id
    });
  } catch (error) {
    self.postMessage({
      error: 'Error analyzing text',
      id
    });
  }
}

/**
 * Simple tokenization for text processing
 */
function tokenizeText(text: string, id: string) {
  try {
    // Simple word tokenization
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    
    // Count token frequencies
    const frequencies: Record<string, number> = {};
    tokens.forEach(token => {
      frequencies[token] = (frequencies[token] || 0) + 1;
    });
    
    // Return tokenization results
    self.postMessage({
      result: {
        tokens,
        uniqueTokens: Object.keys(frequencies).length,
        frequencies,
        totalTokens: tokens.length
      },
      id
    });
  } catch (error) {
    self.postMessage({
      error: 'Error tokenizing text',
      id
    });
  }
}

/**
 * Preprocess text for NLP tasks
 */
function preprocessText(text: string, id: string) {
  try {
    // Convert to lowercase
    let processed = text.toLowerCase();
    
    // Remove special characters and numbers
    processed = processed.replace(/[^\w\s]/g, '').replace(/\d+/g, '');
    
    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ').trim();
    
    // Return preprocessed text
    self.postMessage({
      result: {
        processed,
        original: text
      },
      id
    });
  } catch (error) {
    self.postMessage({
      error: 'Error preprocessing text',
      id
    });
  }
}

// Export empty object to satisfy TypeScript
export {};
