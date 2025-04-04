// Constants for LiveKit configuration
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://lark-za4hpayr.livekit.cloud';

// API URL for the backend server
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// For development fallback only - should not be used in production
import { AccessToken } from 'livekit-server-sdk';
const DEV_LIVEKIT_API_KEY = 'APIEm6ouy8xmioi';
const DEV_LIVEKIT_API_SECRET = 'FbPHdgLMFZVna03ncZ9URmqrq1wO1ijlBgh5ZLNvM3G';

// Token generation will now use the proper API secret instead of a pre-generated demo token

/**
 * Get a secure token from the backend API
 * This is the recommended approach for production use
 * 
 * @param roomName The name of the room to join
 * @param identity The participant identity
 * @returns The token
 */
export async function getSecureToken(roomName: string, identity: string): Promise<string> {
  try {
    // Generate a random session ID to make the room name unique
    const sessionId = Math.random().toString(36).substring(2, 15);
    const uniqueRoomName = `${roomName}-${sessionId}`;
    
    console.log(`[TokenService] Getting token for room: ${uniqueRoomName}, identity: ${identity}`);
    
    // First try to get the token from our secure backend
    try {
      return await getTokenFromBackend(uniqueRoomName, identity);
    } catch (backendError) {
      console.warn('[TokenService] Backend token generation failed, using fallback:', backendError);
      
      // Fallback to local token generation for development only
      if (import.meta.env.DEV) {
        console.warn('[TokenService] Using development fallback for token generation');
        return await generateDevFallbackToken(uniqueRoomName, identity);
      }
      
      // In production, we should not expose API keys, so we rethrow the error
      throw backendError;
    }
  } catch (error) {
    console.error('[TokenService] Error getting token:', error);
    throw error;
  }
}

/**
 * Get a token from our secure backend API
 * This is the recommended approach for production use
 * @param roomName Room to create token for
 * @param identity User identity
 * @returns Generated token
 */
async function getTokenFromBackend(roomName: string, identity: string): Promise<string> {
  try {
    console.log(`[TokenService] Requesting token from backend for room: ${roomName}, identity: ${identity}`);
    
    const response = await fetch(`${API_BASE_URL}/api/livekit/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomName, userId: identity }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to get token: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('[TokenService] Error getting token from backend:', error);
    throw error;
  }
}

/**
 * Generate a LiveKit token locally - FOR DEVELOPMENT ONLY
 * This should never be used in production as it exposes API keys
 * @param roomName Room to create token for
 * @param identity User identity
 * @returns Generated token
 */
async function generateDevFallbackToken(roomName: string, identity: string): Promise<string> {
  try {
    console.log(`[TokenService] Generating development fallback token for room: ${roomName}, identity: ${identity}`);
    
    // Create a new token
    const token = new AccessToken(DEV_LIVEKIT_API_KEY, DEV_LIVEKIT_API_SECRET, {
      identity: identity,
      ttl: 24 * 60 * 60, // 24 hours expiry
    });
    
    // Add grants to the token
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    
    // Generate the token string
    return token.toJwt();
  } catch (error) {
    console.error('[TokenService] Error generating token:', error);
    throw error;
  }
}

/**
 * Get a token for a LiveKit agent
 * @param roomName The name of the room to join
 * @returns The generated token
 */
export async function generateAgentToken(roomName: string): Promise<string> {
  return getSecureToken(roomName, 'lark-agent');
}

/**
 * Get a token for a LiveKit user
 * @param roomName The name of the room to join
 * @param userId The user ID
 * @returns The generated token
 */
export async function generateUserToken(roomName: string, userId: string): Promise<string> {
  return getSecureToken(roomName, `user-${userId}`);
}
