import { CommandResponse } from './openai-service';

interface CachedCommand {
  command: string;
  response: CommandResponse;
  timestamp: number;
  context?: {
    location?: string;
    timeOfDay?: string;
    previousCommand?: string;
  };
}

interface CachedStatute {
  id: string;
  content: string;
  lastAccessed: number;
  accessCount: number;
}

interface CachedVoiceData {
  text: string;
  audioBuffer: ArrayBuffer;
  voiceId: string;
  timestamp: number;
}

class IndexedDBService {
  private static instance: IndexedDBService;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'lark_offline_db';
  private readonly DB_VERSION = 1;

  private constructor() {}

  static getInstance(): IndexedDBService {
    if (!IndexedDBService.instance) {
      IndexedDBService.instance = new IndexedDBService();
    }
    return IndexedDBService.instance;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for command responses
        const commandStore = db.createObjectStore('commands', { keyPath: 'command' });
        commandStore.createIndex('timestamp', 'timestamp');

        // Store for statutes
        const statuteStore = db.createObjectStore('statutes', { keyPath: 'id' });
        statuteStore.createIndex('lastAccessed', 'lastAccessed');
        statuteStore.createIndex('accessCount', 'accessCount');

        // Store for voice data
        const voiceStore = db.createObjectStore('voiceData', { keyPath: 'text' });
        voiceStore.createIndex('timestamp', 'timestamp');
        voiceStore.createIndex('voiceId', 'voiceId');

        // Store for sync queue
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      };
    });
  }

  async cacheCommand(command: string, response: CommandResponse, context?: CachedCommand['context']): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction('commands', 'readwrite');
    const store = transaction.objectStore('commands');

    const cachedCommand: CachedCommand = {
      command: command.toLowerCase(),
      response,
      timestamp: Date.now(),
      context,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(cachedCommand);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getCachedCommand(command: string): Promise<CachedCommand | null> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction('commands', 'readonly');
    const store = transaction.objectStore('commands');

    return new Promise((resolve, reject) => {
      const request = store.get(command.toLowerCase());
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async cacheStatute(id: string, content: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction('statutes', 'readwrite');
    const store = transaction.objectStore('statutes');

    const statute: CachedStatute = {
      id,
      content,
      lastAccessed: Date.now(),
      accessCount: 1,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(statute);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async cacheVoiceData(text: string, audioBuffer: ArrayBuffer, voiceId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction('voiceData', 'readwrite');
    const store = transaction.objectStore('voiceData');

    const voiceData: CachedVoiceData = {
      text,
      audioBuffer,
      voiceId,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(voiceData);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getVoiceData(text: string): Promise<CachedVoiceData | null> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction('voiceData', 'readonly');
    const store = transaction.objectStore('voiceData');

    return new Promise((resolve, reject) => {
      const request = store.get(text);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async addToSyncQueue(data: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');

    return new Promise((resolve, reject) => {
      const request = store.add(data);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const cutoffTime = Date.now() - maxAge;
    const stores = ['commands', 'voiceData'];

    for (const storeName of stores) {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('timestamp');

      const range = IDBKeyRange.upperBound(cutoffTime);
      index.openCursor(range).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }
  }
}

export const indexedDBService = IndexedDBService.getInstance();
