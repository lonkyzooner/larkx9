/**
 * Secure credential management for LARK
 */

import { settingsDB } from './indexedDB';
import { memoize } from '../utils/performanceUtils';

// Default LiveKit credentials from project memory
const DEFAULT_CREDENTIALS = {
  LIVEKIT_URL: 'wss://lark-za4hpayr.livekit.cloud',
  LIVEKIT_API_KEY: 'APIriVQTTMAvLQ4',
  LIVEKIT_API_SECRET: 'fleSOaoOdQ0v5fOatkISxYqvNygclQAeSilRMZ1kLbwB'
};

// Environment variables take precedence over stored credentials
const ENV_CREDENTIALS = {
  LIVEKIT_URL: import.meta.env.VITE_LIVEKIT_URL,
  LIVEKIT_API_KEY: import.meta.env.VITE_LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: import.meta.env.VITE_LIVEKIT_API_SECRET,
  OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY
};

// Credential types
export interface LiveKitCredentials {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export interface OpenAICredentials {
  apiKey: string;
}

/**
 * Get LiveKit credentials with fallbacks
 * Priority: Environment variables > Stored credentials > Default credentials
 */
export const getLiveKitCredentials = memoize(async (): Promise<LiveKitCredentials> => {
  // Check environment variables first
  if (ENV_CREDENTIALS.LIVEKIT_URL && ENV_CREDENTIALS.LIVEKIT_API_KEY && ENV_CREDENTIALS.LIVEKIT_API_SECRET) {
    return {
      url: ENV_CREDENTIALS.LIVEKIT_URL,
      apiKey: ENV_CREDENTIALS.LIVEKIT_API_KEY,
      apiSecret: ENV_CREDENTIALS.LIVEKIT_API_SECRET
    };
  }
  
  // Try to get stored credentials
  const storedCredentials = await settingsDB.getSetting('livekit_credentials');
  if (storedCredentials?.url && storedCredentials?.apiKey && storedCredentials?.apiSecret) {
    return storedCredentials;
  }
  
  // Fall back to default credentials
  return {
    url: DEFAULT_CREDENTIALS.LIVEKIT_URL,
    apiKey: DEFAULT_CREDENTIALS.LIVEKIT_API_KEY,
    apiSecret: DEFAULT_CREDENTIALS.LIVEKIT_API_SECRET
  };
});

/**
 * Save LiveKit credentials
 */
export async function saveLiveKitCredentials(credentials: LiveKitCredentials): Promise<boolean> {
  return await settingsDB.saveSetting('livekit_credentials', credentials);
}

/**
 * Get OpenAI API key with fallbacks
 */
export const getOpenAICredentials = memoize(async (): Promise<OpenAICredentials> => {
  // Check environment variables first
  if (ENV_CREDENTIALS.OPENAI_API_KEY) {
    return {
      apiKey: ENV_CREDENTIALS.OPENAI_API_KEY
    };
  }
  
  // Try to get stored credentials
  const storedCredentials = await settingsDB.getSetting('openai_credentials');
  if (storedCredentials?.apiKey) {
    return storedCredentials;
  }
  
  // Return empty credentials if none found
  return {
    apiKey: ''
  };
});

/**
 * Save OpenAI credentials
 */
export async function saveOpenAICredentials(credentials: OpenAICredentials): Promise<boolean> {
  return await settingsDB.saveSetting('openai_credentials', credentials);
}

/**
 * Check if credentials are valid
 */
export async function validateCredentials(): Promise<{
  livekit: boolean;
  openai: boolean;
}> {
  const livekit = await getLiveKitCredentials();
  const openai = await getOpenAICredentials();
  
  return {
    livekit: !!(livekit.url && livekit.apiKey && livekit.apiSecret),
    openai: !!openai.apiKey
  };
}

/**
 * Reset credentials to defaults
 */
export async function resetToDefaultCredentials(): Promise<boolean> {
  try {
    await settingsDB.saveSetting('livekit_credentials', {
      url: DEFAULT_CREDENTIALS.LIVEKIT_URL,
      apiKey: DEFAULT_CREDENTIALS.LIVEKIT_API_KEY,
      apiSecret: DEFAULT_CREDENTIALS.LIVEKIT_API_SECRET
    });
    return true;
  } catch (error) {
    console.error('Error resetting credentials:', error);
    return false;
  }
}
