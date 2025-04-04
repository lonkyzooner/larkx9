/**
 * IndexedDB Service
 * 
 * This service provides a wrapper around IndexedDB for offline storage capabilities.
 * It supports storing and retrieving command results, voice processing data, and other
 * application state for offline use.
 */

// Database configuration
const DB_NAME = 'lark_offline_db';
const DB_VERSION = 3; // Incrementing version to trigger upgrade
const STORES = {
  COMMANDS: 'commands',
  VOICE_CACHE: 'voice_cache',
  SETTINGS: 'settings',
  ANALYTICS: 'analytics',
  UNPROCESSED_VOICE: 'unprocessed_voice', // New store for unprocessed voice data
  ERROR_LOGS: 'error_logs', // Store for error logs and diagnostics
  AUDIO_CACHE: 'audio_cache' // Store for synthesized audio data
};

// Types
export interface CommandCache {
  id: string;
  command: string;
  response: string;
  timestamp: number;
  success: boolean;
  action?: string;
  module?: string;
  metadata?: Record<string, any>;
}

export interface VoiceCache {
  id: string;
  transcript: string;
  processed: boolean;
  timestamp: number;
  alternatives?: string[];
}

export interface AudioCache {
  id: string;
  text: string;
  audioData: string; // Base64 encoded audio data
  timestamp: number;
  voiceId: string;
}

export interface AnalyticsData {
  id: string;
  type: 'command_success' | 'command_error' | 'command_processed' | 'command_cache_hit' | 
        'voice_recognition' | 'usage_pattern' | 'debug_log' | 'network_state_change' | 
        'sync_completed' | 'sync_failed' | 'network_loss';
  data: any;
  timestamp: number;
}

/**
 * IndexedDB Service Class
 */
class IndexedDBService {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<boolean>;
  private dbReadyResolve!: (value: boolean) => void;
  
  constructor() {
    // Create a promise that will be resolved when the DB is ready
    this.dbReady = new Promise<boolean>((resolve) => {
      this.dbReadyResolve = resolve;
    });
    
    // Initialize the database
    this.initDB();
    
    console.log('[IndexedDB] Service initialized');
  }
  
  /**
   * Initialize the IndexedDB database
   */
  private initDB(): void {
    if (!window.indexedDB) {
      console.error('[IndexedDB] Your browser doesn\'t support IndexedDB');
      this.dbReadyResolve(false);
      return;
    }
    
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('[IndexedDB] Error opening database:', event);
      this.dbReadyResolve(false);
    };
    
    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      console.log('[IndexedDB] Database opened successfully');
      this.dbReadyResolve(true);
      
      // Listen for database errors
      this.db.onerror = (event) => {
        console.error('[IndexedDB] Database error:', event);
      };
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;
      
      // Create or update object stores
      if (!db.objectStoreNames.contains(STORES.COMMANDS)) {
        const commandStore = db.createObjectStore(STORES.COMMANDS, { keyPath: 'id' });
        commandStore.createIndex('timestamp', 'timestamp', { unique: false });
        commandStore.createIndex('command', 'command', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.VOICE_CACHE)) {
        const voiceStore = db.createObjectStore(STORES.VOICE_CACHE, { keyPath: 'id' });
        voiceStore.createIndex('timestamp', 'timestamp', { unique: false });
        voiceStore.createIndex('processed', 'processed', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORES.ANALYTICS)) {
        const analyticsStore = db.createObjectStore(STORES.ANALYTICS, { keyPath: 'id' });
        analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
        analyticsStore.createIndex('type', 'type', { unique: false });
      }

      // Add new store for unprocessed voice data in version 2
      if (oldVersion < 2 && !db.objectStoreNames.contains(STORES.UNPROCESSED_VOICE)) {
        const unprocessedVoiceStore = db.createObjectStore(STORES.UNPROCESSED_VOICE, { keyPath: 'id' });
        unprocessedVoiceStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Add error logs store
      if (!db.objectStoreNames.contains(STORES.ERROR_LOGS)) {
        const errorLogsStore = db.createObjectStore(STORES.ERROR_LOGS, { keyPath: 'id' });
        errorLogsStore.createIndex('timestamp', 'timestamp', { unique: false });
        errorLogsStore.createIndex('errorType', 'errorType', { unique: false });
      }
      
      // Add audio cache store in version 3
      if (oldVersion < 3 && !db.objectStoreNames.contains(STORES.AUDIO_CACHE)) {
        const audioCacheStore = db.createObjectStore(STORES.AUDIO_CACHE, { keyPath: 'id' });
        audioCacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        audioCacheStore.createIndex('text', 'text', { unique: false });
        audioCacheStore.createIndex('voiceId', 'voiceId', { unique: false });
      }
      
      console.log('[IndexedDB] Database schema created/upgraded');
    };
  }
  
  /**
   * Wait for the database to be ready
   */
  private async waitForDB(): Promise<boolean> {
    return this.dbReady;
  }
  
  /**
   * Store a command result in the cache
   */
  public async cacheCommand(command: CommandCache): Promise<string> {
    await this.waitForDB();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.COMMANDS], 'readwrite');
      
      transaction.onerror = (event) => {
        reject(`Transaction error: ${event}`);
      };
      
      const store = transaction.objectStore(STORES.COMMANDS);
      const request = store.add(command);
      
      request.onsuccess = () => {
        resolve(command.id);
        console.log(`[IndexedDB] Command cached: ${command.command}`);
      };
      
      request.onerror = (event) => {
        reject(`Error caching command: ${event}`);
      };
    });
  }
  
  /**
   * Get a cached command by its command text
   */
  public async getCommandByText(commandText: string): Promise<CommandCache | null> {
    await this.waitForDB();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.COMMANDS], 'readonly');
      const store = transaction.objectStore(STORES.COMMANDS);
      const index = store.index('command');
      
      // Get all commands with this text
      const request = index.getAll(IDBKeyRange.only(commandText.toLowerCase()));
      
      request.onsuccess = () => {
        const commands = request.result;
        if (commands && commands.length > 0) {
          // Return the most recent command
          const sortedCommands = commands.sort((a, b) => b.timestamp - a.timestamp);
          resolve(sortedCommands[0]);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = (event) => {
        reject(`Error retrieving command: ${event}`);
      };
    });
  }
  
  /**
   * Store voice recognition data in the cache
   */
  /**
   * Store analytics data
   */
  public async storeAnalyticsData(data: AnalyticsData): Promise<string> {
    await this.waitForDB();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ANALYTICS], 'readwrite');
      
      transaction.onerror = (event) => {
        reject(`Transaction error: ${event}`);
      };
      
      const store = transaction.objectStore(STORES.ANALYTICS);
      const request = store.add(data);
      
      request.onsuccess = () => {
        resolve(data.id);
        console.log(`[IndexedDB] Analytics data stored: ${data.type}`);
      };
      
      request.onerror = (event) => {
        reject(`Error storing analytics data: ${event}`);
      };
    });
  }
  
  /**
   * Cache synthesized audio for offline use
   */
  public async cacheAudio(data: AudioCache): Promise<string> {
    await this.waitForDB();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.AUDIO_CACHE], 'readwrite');
      
      transaction.onerror = (event) => {
        reject(`Transaction error: ${event}`);
      };
      
      const store = transaction.objectStore(STORES.AUDIO_CACHE);
      
      // Check if we already have audio for this text to avoid duplicates
      const index = store.index('text');
      const textRequest = index.getAll(IDBKeyRange.only(data.text));
      
      textRequest.onsuccess = () => {
        const existingEntries = textRequest.result;
        
        // If we already have this text with the same voice ID, update it instead of adding
        const existingEntry = existingEntries.find(entry => entry.voiceId === data.voiceId);
        
        let storeRequest;
        if (existingEntry) {
          // Update existing entry
          existingEntry.audioData = data.audioData;
          existingEntry.timestamp = data.timestamp;
          storeRequest = store.put(existingEntry);
        } else {
          // Add new entry
          storeRequest = store.add(data);
        }
        
        storeRequest.onsuccess = () => {
          console.log(`[IndexedDB] Audio cached for text: ${data.text.substring(0, 20)}...`);
          resolve(data.id);
        };
        
        storeRequest.onerror = (event) => {
          reject(`Error caching audio: ${event}`);
        };
      };
      
      textRequest.onerror = (event) => {
        reject(`Error checking for existing audio: ${event}`);
      };
    });
  }

  /**
   * Get analytics data by type
   */
  public async getAnalyticsByType(type: AnalyticsData['type']): Promise<AnalyticsData[]> {
    await this.waitForDB();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ANALYTICS], 'readonly');
      const store = transaction.objectStore(STORES.ANALYTICS);
      const index = store.index('type');
      
      const request = index.getAll(IDBKeyRange.only(type));
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = (event) => {
        reject(`Error retrieving analytics data: ${event}`);
      };
    });
  }

  public async cacheVoiceData(voiceData: VoiceCache): Promise<string> {
    await this.waitForDB();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Store in both voice cache and unprocessed voice stores
        const transaction = this.db!.transaction([STORES.VOICE_CACHE, STORES.UNPROCESSED_VOICE], 'readwrite');
        
        // Add to voice cache
        const voiceStore = transaction.objectStore(STORES.VOICE_CACHE);
        voiceStore.add(voiceData);
        
        // Add to unprocessed voice store if not processed
        if (!voiceData.processed) {
          const unprocessedStore = transaction.objectStore(STORES.UNPROCESSED_VOICE);
          unprocessedStore.add(voiceData);
        }
        
        transaction.oncomplete = () => {
          console.log('[IndexedDB] Voice data cached successfully:', voiceData.id);
          resolve(voiceData.id);
        };
        
        transaction.onerror = (event) => {
          console.error('[IndexedDB] Error in voice caching transaction:', event);
          reject(new Error('Failed to cache voice data'));
        };
      } catch (error) {
        console.error('[IndexedDB] Error accessing voice stores:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Get all unprocessed voice data with retry mechanism
   */
  public async getUnprocessedVoiceData(): Promise<VoiceCache[]> {
    await this.waitForDB();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([STORES.UNPROCESSED_VOICE], 'readonly');
        const store = transaction.objectStore(STORES.UNPROCESSED_VOICE);
        const request = store.getAll();
        
        request.onsuccess = () => {
          resolve(request.result || []);
          console.log(`[IndexedDB] Retrieved ${request.result?.length || 0} unprocessed voice entries`);
        };
        
        request.onerror = (event) => {
          console.error('[IndexedDB] Error retrieving unprocessed voice data:', event);
          resolve([]); // Return empty array on error for graceful degradation
        };

        transaction.onerror = (event) => {
          console.error('[IndexedDB] Transaction error in getUnprocessedVoiceData:', event);
          resolve([]); // Return empty array on transaction error
        };
      } catch (error) {
        console.error('[IndexedDB] Error accessing unprocessed voice store:', error);
        resolve([]); // Return empty array if store doesn't exist
      }
    });
  }
  
  /**
   * Mark voice data as processed and remove from unprocessed store
   */
  public async markVoiceDataAsProcessed(id: string): Promise<void> {
    await this.waitForDB();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([STORES.VOICE_CACHE, STORES.UNPROCESSED_VOICE], 'readwrite');
        const voiceStore = transaction.objectStore(STORES.VOICE_CACHE);
        const unprocessedStore = transaction.objectStore(STORES.UNPROCESSED_VOICE);
        
        // Update processed flag in voice cache
        const getRequest = voiceStore.get(id);
        
        getRequest.onsuccess = () => {
          const data = getRequest.result;
          if (data) {
            data.processed = true;
            voiceStore.put(data);
            
            // Remove from unprocessed store
            unprocessedStore.delete(id);
          }
        };
        
        transaction.oncomplete = () => {
          console.log('[IndexedDB] Voice data marked as processed:', id);
          resolve();
        };
        
        transaction.onerror = (event) => {
          console.error('[IndexedDB] Error marking voice data as processed:', event);
          reject(new Error('Failed to mark voice data as processed'));
        };
      } catch (error) {
        console.error('[IndexedDB] Error accessing stores:', error);
        reject(error);
      }
    });
  }
  

  
  /**
   * Add an item to any store in the database
   * Generic method to add items to any store
   */
  public async addItem(storeName: string, item: any): Promise<string> {
    await this.waitForDB();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    // Check if the store exists
    if (!Object.values(STORES).includes(storeName)) {
      console.warn(`[IndexedDB] Store ${storeName} does not exist, creating it`);
      // Create the store if it doesn't exist on next DB upgrade
      // For now, fallback to analytics store
      storeName = STORES.ANALYTICS;
    }
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const request = store.add(item);
        
        request.onsuccess = () => {
          console.log(`[IndexedDB] Item added to ${storeName}:`, item.id);
          resolve(item.id);
        };
        
        request.onerror = (event) => {
          console.error(`[IndexedDB] Error adding item to ${storeName}:`, event);
          reject(new Error(`Failed to add item to ${storeName}`));
        };
      } catch (error) {
        console.error(`[IndexedDB] Error accessing store ${storeName}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Clear old data from the cache (data retention policy)
   */
  public async clearOldData(maxAgeDays: number = 30): Promise<void> {
    await this.waitForDB();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const maxAgeTimestamp = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    
    // Clear old commands
    await this.clearOldStoreData(STORES.COMMANDS, maxAgeTimestamp);
    
    // Clear old voice data
    await this.clearOldStoreData(STORES.VOICE_CACHE, maxAgeTimestamp);
    
    // Clear old analytics data
    await this.clearOldStoreData(STORES.ANALYTICS, maxAgeTimestamp);
    
    console.log(`[IndexedDB] Cleared data older than ${maxAgeDays} days`);
  }
  
  /**
   * Clear old data from a specific store
   */
  private async clearOldStoreData(storeName: string, maxAgeTimestamp: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('timestamp');
      
      const range = IDBKeyRange.upperBound(maxAgeTimestamp);
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = (event) => {
        reject(`Error clearing old data: ${event}`);
      };
    });
  }
}

// Create singleton instance
export const indexedDBService = new IndexedDBService();
