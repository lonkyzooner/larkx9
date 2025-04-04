/**
 * Enhanced IndexedDB wrapper for better offline support
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Message } from '../types/chat';

// Define database schema
interface LarkDB extends DBSchema {
  messages: {
    key: number;
    value: Message;
    indexes: {
      'by-timestamp': number;
      'by-role': string;
    };
  };
  offlineQueue: {
    key: number;
    value: {
      id: number;
      message: string;
      timestamp: number;
      processed: boolean;
    };
    indexes: {
      'by-processed': boolean;
    };
  };
  settings: {
    key: string;
    value: any;
  };
  statutes: {
    key: string;
    value: {
      id: string;
      title: string;
      content: string;
      lastUpdated: number;
    };
    indexes: {
      'by-title': string;
    };
  };
}

// Database version
const DB_VERSION = 1;
const DB_NAME = 'lark-database';

// Database connection
let dbPromise: Promise<IDBPDatabase<LarkDB>>;

/**
 * Initialize the database
 */
export async function initDatabase(): Promise<void> {
  dbPromise = openDB<LarkDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create messages store
      if (!db.objectStoreNames.contains('messages')) {
        const messagesStore = db.createObjectStore('messages', { 
          keyPath: 'timestamp' 
        });
        messagesStore.createIndex('by-timestamp', 'timestamp');
        messagesStore.createIndex('by-role', 'role');
      }
      
      // Create offline queue store
      if (!db.objectStoreNames.contains('offlineQueue')) {
        const queueStore = db.createObjectStore('offlineQueue', { 
          keyPath: 'id',
          autoIncrement: true
        });
        queueStore.createIndex('by-processed', 'processed');
      }
      
      // Create settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      
      // Create statutes store
      if (!db.objectStoreNames.contains('statutes')) {
        const statutesStore = db.createObjectStore('statutes', { 
          keyPath: 'id' 
        });
        statutesStore.createIndex('by-title', 'title');
      }
    }
  });
}

/**
 * Get database connection
 */
async function getDB(): Promise<IDBPDatabase<LarkDB>> {
  if (!dbPromise) {
    await initDatabase();
  }
  return dbPromise;
}

/**
 * Messages API
 */
export const messagesDB = {
  /**
   * Save a message to the database
   */
  async saveMessage(message: Message): Promise<boolean> {
    try {
      const db = await getDB();
      await db.put('messages', message);
      return true;
    } catch (error) {
      console.error('Error saving message:', error);
      return false;
    }
  },
  
  /**
   * Get all messages
   */
  async getMessages(): Promise<Message[]> {
    try {
      const db = await getDB();
      return await db.getAllFromIndex('messages', 'by-timestamp');
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  },
  
  /**
   * Get messages by role
   */
  async getMessagesByRole(role: 'user' | 'assistant'): Promise<Message[]> {
    try {
      const db = await getDB();
      return await db.getAllFromIndex('messages', 'by-role', role);
    } catch (error) {
      console.error(`Error getting ${role} messages:`, error);
      return [];
    }
  },
  
  /**
   * Delete all messages
   */
  async clearMessages(): Promise<boolean> {
    try {
      const db = await getDB();
      await db.clear('messages');
      return true;
    } catch (error) {
      console.error('Error clearing messages:', error);
      return false;
    }
  },
  
  /**
   * Delete a specific message
   */
  async deleteMessage(timestamp: number): Promise<boolean> {
    try {
      const db = await getDB();
      await db.delete('messages', timestamp);
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }
};

/**
 * Offline queue API
 */
export const offlineQueueDB = {
  /**
   * Add a message to the offline queue
   */
  async queueMessage(message: string): Promise<boolean> {
    try {
      const db = await getDB();
      await db.add('offlineQueue', {
        message,
        timestamp: Date.now(),
        processed: false
      });
      return true;
    } catch (error) {
      console.error('Error queuing message:', error);
      return false;
    }
  },
  
  /**
   * Get all unprocessed messages in the queue
   */
  async getUnprocessedMessages(): Promise<{ id: number; message: string; timestamp: number }[]> {
    try {
      const db = await getDB();
      const items = await db.getAllFromIndex('offlineQueue', 'by-processed', false);
      return items.map(item => ({
        id: item.id,
        message: item.message,
        timestamp: item.timestamp
      }));
    } catch (error) {
      console.error('Error getting unprocessed messages:', error);
      return [];
    }
  },
  
  /**
   * Mark a message as processed
   */
  async markAsProcessed(id: number): Promise<boolean> {
    try {
      const db = await getDB();
      const item = await db.get('offlineQueue', id);
      if (item) {
        item.processed = true;
        await db.put('offlineQueue', item);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking message as processed:', error);
      return false;
    }
  },
  
  /**
   * Clear the offline queue
   */
  async clearQueue(): Promise<boolean> {
    try {
      const db = await getDB();
      await db.clear('offlineQueue');
      return true;
    } catch (error) {
      console.error('Error clearing offline queue:', error);
      return false;
    }
  }
};

/**
 * Settings API
 */
export const settingsDB = {
  /**
   * Save a setting
   */
  async saveSetting(key: string, value: any): Promise<boolean> {
    try {
      const db = await getDB();
      await db.put('settings', { key, value });
      return true;
    } catch (error) {
      console.error('Error saving setting:', error);
      return false;
    }
  },
  
  /**
   * Get a setting
   */
  async getSetting(key: string): Promise<any> {
    try {
      const db = await getDB();
      const setting = await db.get('settings', key);
      return setting?.value;
    } catch (error) {
      console.error('Error getting setting:', error);
      return null;
    }
  },
  
  /**
   * Get all settings
   */
  async getAllSettings(): Promise<Record<string, any>> {
    try {
      const db = await getDB();
      const settings = await db.getAll('settings');
      return settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, any>);
    } catch (error) {
      console.error('Error getting all settings:', error);
      return {};
    }
  },
  
  /**
   * Delete a setting
   */
  async deleteSetting(key: string): Promise<boolean> {
    try {
      const db = await getDB();
      await db.delete('settings', key);
      return true;
    } catch (error) {
      console.error('Error deleting setting:', error);
      return false;
    }
  }
};

/**
 * Statutes API
 */
export const statutesDB = {
  /**
   * Save a statute
   */
  async saveStatute(statute: { id: string; title: string; content: string }): Promise<boolean> {
    try {
      const db = await getDB();
      await db.put('statutes', {
        ...statute,
        lastUpdated: Date.now()
      });
      return true;
    } catch (error) {
      console.error('Error saving statute:', error);
      return false;
    }
  },
  
  /**
   * Get a statute by ID
   */
  async getStatute(id: string): Promise<{ id: string; title: string; content: string; lastUpdated: number } | null> {
    try {
      const db = await getDB();
      return await db.get('statutes', id);
    } catch (error) {
      console.error('Error getting statute:', error);
      return null;
    }
  },
  
  /**
   * Search statutes by title
   */
  async searchStatutes(query: string): Promise<{ id: string; title: string; content: string; lastUpdated: number }[]> {
    try {
      const db = await getDB();
      const allStatutes = await db.getAll('statutes');
      
      // Simple search implementation
      const lowerQuery = query.toLowerCase();
      return allStatutes.filter(statute => 
        statute.title.toLowerCase().includes(lowerQuery) || 
        statute.content.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('Error searching statutes:', error);
      return [];
    }
  },
  
  /**
   * Get all statutes
   */
  async getAllStatutes(): Promise<{ id: string; title: string; content: string; lastUpdated: number }[]> {
    try {
      const db = await getDB();
      return await db.getAll('statutes');
    } catch (error) {
      console.error('Error getting all statutes:', error);
      return [];
    }
  },
  
  /**
   * Delete a statute
   */
  async deleteStatute(id: string): Promise<boolean> {
    try {
      const db = await getDB();
      await db.delete('statutes', id);
      return true;
    } catch (error) {
      console.error('Error deleting statute:', error);
      return false;
    }
  }
};
