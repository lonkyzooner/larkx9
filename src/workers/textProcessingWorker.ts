/**
 * Text processing web worker
 * 
 * This worker handles CPU-intensive text processing tasks to keep the main thread responsive.
 * It includes functions for text analysis, sentiment detection, and keyword extraction.
 */

// Define the worker context
const ctx: Worker = self as any;

// Message handler
ctx.addEventListener('message', (event) => {
  const { id, action, payload } = event.data;
  
  try {
    let result;
    
    switch (action) {
      case 'analyzeText':
        result = analyzeText(payload.text);
        break;
      case 'extractKeywords':
        result = extractKeywords(payload.text);
        break;
      case 'detectSentiment':
        result = detectSentiment(payload.text);
        break;
      case 'processTranscript':
        result = processTranscript(payload.text);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Send successful result back to main thread
    ctx.postMessage({
      id,
      success: true,
      result
    });
  } catch (error) {
    // Send error back to main thread
    ctx.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Analyze text for key information
 * @param text Text to analyze
 */
function analyzeText(text: string) {
  // Simple text analysis implementation
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const characterCount = text.length;
  const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
  
  // Calculate reading time (average reading speed: 200 words per minute)
  const readingTimeMinutes = wordCount / 200;
  const readingTimeSeconds = Math.ceil(readingTimeMinutes * 60);
  
  return {
    wordCount,
    characterCount,
    sentenceCount,
    readingTimeSeconds
  };
}

/**
 * Extract keywords from text
 * @param text Text to extract keywords from
 */
function extractKeywords(text: string) {
  // Simple keyword extraction implementation
  // In a real implementation, this would use TF-IDF or a similar algorithm
  
  // Normalize text
  const normalizedText = text.toLowerCase();
  
  // Remove common stop words
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about'
  ]);
  
  // Split text into words and filter out stop words
  const words = normalizedText
    .split(/\W+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Count word frequencies
  const wordFrequencies: Record<string, number> = {};
  words.forEach(word => {
    wordFrequencies[word] = (wordFrequencies[word] || 0) + 1;
  });
  
  // Sort by frequency and get top keywords
  const keywords = Object.entries(wordFrequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, frequency]) => ({ word, frequency }));
  
  return keywords;
}

/**
 * Detect sentiment in text
 * @param text Text to detect sentiment in
 */
function detectSentiment(text: string) {
  // Simple sentiment analysis implementation
  // In a real implementation, this would use a proper NLP model
  
  // Positive and negative word lists
  const positiveWords = new Set([
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
    'happy', 'pleased', 'delighted', 'glad', 'positive', 'nice',
    'love', 'like', 'enjoy', 'appreciate', 'thank', 'thanks'
  ]);
  
  const negativeWords = new Set([
    'bad', 'terrible', 'awful', 'horrible', 'poor', 'negative',
    'sad', 'unhappy', 'angry', 'upset', 'disappointed', 'hate',
    'dislike', 'annoyed', 'frustrated', 'sorry', 'problem', 'issue'
  ]);
  
  // Normalize text
  const normalizedText = text.toLowerCase();
  
  // Split text into words
  const words = normalizedText.split(/\W+/).filter(Boolean);
  
  // Count positive and negative words
  let positiveCount = 0;
  let negativeCount = 0;
  
  words.forEach(word => {
    if (positiveWords.has(word)) {
      positiveCount++;
    } else if (negativeWords.has(word)) {
      negativeCount++;
    }
  });
  
  // Calculate sentiment score (-1 to 1)
  const totalWords = words.length;
  const sentimentScore = totalWords > 0
    ? (positiveCount - negativeCount) / totalWords
    : 0;
  
  // Determine sentiment label
  let sentiment;
  if (sentimentScore > 0.05) {
    sentiment = 'positive';
  } else if (sentimentScore < -0.05) {
    sentiment = 'negative';
  } else {
    sentiment = 'neutral';
  }
  
  return {
    score: sentimentScore,
    sentiment,
    positiveCount,
    negativeCount,
    totalWords
  };
}

/**
 * Process transcript for law enforcement context
 * @param text Transcript to process
 */
function processTranscript(text: string) {
  // Simple implementation for processing law enforcement transcripts
  
  // Keywords related to law enforcement
  const lawEnforcementKeywords = new Set([
    'arrest', 'detain', 'suspect', 'officer', 'police', 'crime', 'criminal',
    'law', 'legal', 'illegal', 'weapon', 'gun', 'knife', 'evidence', 'witness',
    'victim', 'scene', 'investigation', 'report', 'rights', 'miranda',
    'warrant', 'search', 'seizure', 'court', 'judge', 'attorney', 'lawyer'
  ]);
  
  // Potential threat indicators
  const threatKeywords = new Set([
    'threat', 'kill', 'hurt', 'harm', 'danger', 'weapon', 'gun', 'knife',
    'attack', 'fight', 'violent', 'violence', 'assault', 'shoot', 'stab',
    'bomb', 'explosive', 'die', 'death', 'blood', 'injured', 'wound'
  ]);
  
  // Normalize text
  const normalizedText = text.toLowerCase();
  
  // Split text into words
  const words = normalizedText.split(/\W+/).filter(Boolean);
  
  // Find law enforcement keywords
  const foundLawKeywords = words.filter(word => lawEnforcementKeywords.has(word));
  const uniqueLawKeywords = Array.from(new Set(foundLawKeywords));
  
  // Find threat keywords
  const foundThreatKeywords = words.filter(word => threatKeywords.has(word));
  const uniqueThreatKeywords = Array.from(new Set(foundThreatKeywords));
  
  // Calculate threat level (0-1)
  const threatLevel = uniqueThreatKeywords.length > 0
    ? Math.min(1, uniqueThreatKeywords.length / 5)
    : 0;
  
  // Determine if Miranda rights might be needed
  // Simple heuristic: if "arrest" or "detain" is mentioned
  const mirandaNeeded = words.some(word => word === 'arrest' || word === 'detain');
  
  return {
    lawEnforcementKeywords: uniqueLawKeywords,
    threatKeywords: uniqueThreatKeywords,
    threatLevel,
    mirandaNeeded
  };
}

// Signal that the worker is ready
ctx.postMessage({ type: 'ready' });
