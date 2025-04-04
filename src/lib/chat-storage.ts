/**
 * Simple localStorage-based chat storage implementation
 * This replaces the IndexedDB implementation to avoid Vercel build issues
 */

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface OfflineQueueItem {
  message: string;
  timestamp: number;
}

// Storage keys
const MESSAGES_KEY = 'lark-chat-messages';
const OFFLINE_QUEUE_KEY = 'lark-chat-offline-queue';

// Helper function to safely parse JSON from localStorage
function safeJSONParse<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) as T : defaultValue;
  } catch (error) {
    console.error(`Error parsing data from localStorage key ${key}:`, error);
    return defaultValue;
  }
}

// Helper function to safely store JSON in localStorage
function safeJSONStore<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Error storing data in localStorage key ${key}:`, error);
    return false;
  }
}

export const saveMessage = async (message: ChatMessage): Promise<boolean> => {
  if (!message.role || !message.content || !message.timestamp) {
    console.error('Invalid message structure:', message);
    throw new Error('Invalid message structure. Ensure role, content, and timestamp are provided.');
  }
  try {
    // Get existing messages
    const messages = safeJSONParse<ChatMessage[]>(MESSAGES_KEY, []);
    
    // Add new message
    messages.push(message);
    
    // Save back to localStorage
    return safeJSONStore(MESSAGES_KEY, messages);
  } catch (error) {
    console.error('Error saving message:', error);
    // Don't throw, just return false to indicate failure
    return false;
  }
};

export const getMessages = async (limit = 100): Promise<ChatMessage[]> => {
  try {
    // Get all messages from localStorage
    const messages = safeJSONParse<ChatMessage[]>(MESSAGES_KEY, []);
    
    // Sort by timestamp (just to be safe)
    messages.sort((a, b) => a.timestamp - b.timestamp);
    
    // Return only the most recent messages up to the limit
    return messages.slice(-limit);
  } catch (error) {
    console.error('Error retrieving messages:', error);
    // Return empty array instead of throwing
    return [];
  }
};

export const queueOfflineMessage = async (message: string): Promise<void> => {
  if (!message) {
    throw new Error('Message cannot be empty.');
  }
  try {
    // Get existing queue
    const queue = safeJSONParse<OfflineQueueItem[]>(OFFLINE_QUEUE_KEY, []);
    
    // Add new message to queue
    queue.push({
      message,
      timestamp: Date.now()
    });
    
    // Save back to localStorage
    const saved = safeJSONStore(OFFLINE_QUEUE_KEY, queue);
    if (!saved) {
      throw new Error('Failed to store offline message in localStorage');
    }
  } catch (error) {
    console.error('Error queuing offline message:', error);
    throw new Error('Failed to queue offline message.');
  }
};

export const getOfflineQueue = async (): Promise<OfflineQueueItem[]> => {
  return safeJSONParse<OfflineQueueItem[]>(OFFLINE_QUEUE_KEY, []);
};

export const clearOfflineQueue = async (): Promise<void> => {
  safeJSONStore(OFFLINE_QUEUE_KEY, []);
};
