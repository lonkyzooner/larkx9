
// Get API key from environment variable with fallback options
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key') || '';

// Fallback API key for development/testing (should be configured in production)
const FALLBACK_API_KEY = 'sk-fallback-dev-mode-key';

// Check if we're in development mode to use fallback in non-production environments
const IS_DEV_MODE = import.meta.env.DEV || window.location.hostname === 'localhost';

// Function to get the best available API key
function getAPIKey(): string {
  if (OPENAI_API_KEY) {
    return OPENAI_API_KEY;
  }
  
  // Only use fallback in development mode
  if (IS_DEV_MODE) {
    console.log('Using development fallback API key - replace in production');
    return FALLBACK_API_KEY;
  }
  
  console.error('OpenAI API key is missing. Please check your environment variables.');
  return '';  
}

// Simple in-memory cache
interface CacheEntry {
  response: string;
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes cache TTL
const MAX_CACHE_SIZE = 50; // Maximum number of cached responses

// Pending requests to avoid duplicate API calls for the same prompt
const pendingRequests = new Map<string, Promise<string>>();

/**
 * Generate a cache key from the prompt and emotion
 */
function generateCacheKey(prompt: string, emotion: string): string {
  return `${prompt}|${emotion}`;
}

/**
 * Clean old entries from the cache
 */
function cleanCache(): void {
  const now = Date.now();
  let entriesToDelete: string[] = [];
  
  // Find expired entries
  responseCache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL) {
      entriesToDelete.push(key);
    }
  });
  
  // Delete expired entries
  entriesToDelete.forEach(key => responseCache.delete(key));
  
  // If still too many entries, remove oldest ones
  if (responseCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(responseCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const excessEntries = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    excessEntries.forEach(([key]) => responseCache.delete(key));
  }
}

/**
 * Query OpenAI with caching and request deduplication
 */
export async function queryOpenAI(prompt: string, emotion: string = 'neutral'): Promise<string> {
  // Clean cache periodically
  cleanCache();
  
  const cacheKey = generateCacheKey(prompt, emotion);
  
  // Check cache first
  if (responseCache.has(cacheKey)) {
    const cached = responseCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log("Using cached OpenAI response for:", prompt.substring(0, 30));
      return cached.response;
    }
    // Cache expired, remove it
    responseCache.delete(cacheKey);
  }
  
  // Check if there's already a pending request for this prompt
  if (pendingRequests.has(cacheKey)) {
    console.log("Using pending OpenAI request for:", prompt.substring(0, 30));
    return pendingRequests.get(cacheKey)!;
  }
  
  // Create a new request
  const requestPromise = (async () => {
    try {
      console.log("Sending query to OpenAI:", prompt.substring(0, 30));
      
      // Get the API key using our helper function
      const apiKey = getAPIKey();
      
      // Check if we have a valid API key
      if (!apiKey) {
        throw new Error('No valid API key available - cannot make OpenAI request');
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are LARK (Law Enforcement Assistance and Response Kit), an AI assistant for police officers in Louisiana. Provide concise, accurate information about Louisiana laws, procedures, and assist officers in the field. Keep responses brief and professional.

The user's detected emotional state is: ${emotion}. Adjust your tone accordingly while maintaining professionalism.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 300
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API error:', errorData);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content.trim();
      
      // Cache the response
      responseCache.set(cacheKey, {
        response: aiResponse,
        timestamp: Date.now()
      });
      
      console.log("OpenAI response cached:", aiResponse.substring(0, 30));
      return aiResponse;
    } catch (error) {
      console.error('Error querying OpenAI:', error);
      return 'Unable to process your request at this time. Please try again later.';
    } finally {
      // Remove from pending requests
      pendingRequests.delete(cacheKey);
    }
  })();
  
  // Store the pending request
  pendingRequests.set(cacheKey, requestPromise);
  
  return requestPromise;
}
