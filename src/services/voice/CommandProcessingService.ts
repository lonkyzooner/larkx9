import { BehaviorSubject, Subject } from 'rxjs';
import { processVoiceCommand, getGeneralKnowledge, assessTacticalSituation } from '../../lib/openai-service';
import { processOfflineCommand } from '../../lib/offline-commands';
import { useSettings } from '../../lib/settings-store';
import { indexedDBService, CommandCache, AnalyticsData } from '../../lib/indexeddb-service';
import { v4 as uuidv4 } from 'uuid';
import { groqService } from '../groq/GroqService';
import { translationService } from '../translation/TranslationService';

// Define store names for IndexedDB
const ANALYTICS_STORE = 'analytics';

// Define analytics event types for better type safety
type AnalyticsEventType = 
  | 'command_processed'
  | 'command_executed'
  | 'command_failed'
  | 'command_cache_hit'
  | 'command_processing_attempt'
  | 'network_recovered'
  | 'network_state_change'
  | 'network_loss'
  | 'sync_completed'
  | 'standard_command_error'
  | 'miranda_command'
  | 'multi_command_processed'
  | 'tactical_assessment'
  | 'tactical_assessment_error'
  | 'knowledge_query'
  | 'knowledge_query_error'
  | 'command_chain_progress'
  | 'command_error'
  | 'command_success'
  | 'translation_request'
  | 'translation_success'
  | 'translation_error';

// Error types for better categorization
export type CommandErrorType = 
  | 'network_error' 
  | 'api_error' 
  | 'timeout_error' 
  | 'permission_error' 
  | 'processing_error' 
  | 'validation_error' 
  | 'unknown_error';

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Interface for error details
export interface CommandErrorDetails {
  type: CommandErrorType;
  message: string;
  severity: ErrorSeverity;
  recoverable: boolean;
  timestamp: number;
  details?: any;
}

// Define the response types for the API functions to match openai-service.ts
interface CommandParameters {
  language?: string;
  statute?: string;
  threat?: string;
  query?: string;
  location?: string;
  context?: CommandContext;
  priority?: number;
  [key: string]: any;
}

interface CommandContext {
  previousCommand?: string;
  previousResult?: string;
  chainId?: string;
  variables: Record<string, any>;
}

interface MultiCommandResult {
  commands: CommandResult[];
  success: boolean;
  chainId: string;
  context: CommandContext;
}

interface CommandResponse {
  command: string;
  action: string;
  parameters?: CommandParameters;
  executed: boolean;
  result?: string;
  error?: string;
}

// Type guard to check if a result is a CommandResponse
function isCommandResponse(result: any): result is CommandResponse {
  return result && typeof result === 'object' && 'executed' in result;
}

export interface CommandResult {
  command: string;
  response: string;
  success: boolean;
  action?: string;
  module?: string;
  metadata?: Record<string, any>;
}

/**
 * Command Processing Service
 * 
 * This service handles processing of voice commands and routing them to the appropriate handlers.
 * It works across the entire application to provide a unified command interface.
 */
class CommandProcessingService {
  // Command processing state
  private processing = new BehaviorSubject<boolean>(false);
  private commandResults = new Subject<CommandResult>();
  private multiCommandResults = new Subject<MultiCommandResult>();
  private lastCommand = '';
  private lastCommandTime = 0; // Track when the last command was processed
  private offlineMode = new BehaviorSubject<boolean>(false);
  private useGroq = true; // Use Groq by default for faster processing
  
  // Command history for analytics
  private commandHistory: CommandResult[] = [];
  
  // Cache settings
  private useCommandCache = true;
  private syncPending = false;
  private syncRetryCount = 0;
  private maxSyncRetries = 3;
  private syncRetryDelay = 5000; // 5 seconds

  // Command queue for handling multiple commands
  private commandQueue: {command: string, alternatives: string[], timestamp: number, retryCount?: number, priority?: number, context?: CommandContext}[] = [];
  private processingQueue = false;
  private consecutiveErrors = 0;
  private maxConsecutiveErrors = 3;
  private lastErrorTime = 0;
  private errorSubject = new Subject<CommandErrorDetails>();
  private suggestedCharges = new Subject<string[]>();
  private errorBackoffTime = 1000; // Base backoff time in ms
  
  // Active command contexts for chaining
  private activeContexts: Map<string, CommandContext> = new Map();
  
  constructor() {
    // Initialize network status monitoring
    this.initNetworkMonitoring();
    
    // Load command history from storage
    this.loadCommandHistory();
    
    console.log('[CommandProcessor] Command Processing Service initialized');
  }

  /**
   * Initialize network status monitoring
   * Sets up event listeners for online/offline events
   */
  private initNetworkMonitoring(): void {
    // Set initial network status
    this.offlineMode.next(!navigator.onLine);
    
    // Add event listeners for network status changes
    window.addEventListener('online', () => {
      console.log('[CommandProcessor] Network connection restored');
      this.offlineMode.next(false);
      this.handleNetworkRecovery();
    });
    
    window.addEventListener('offline', () => {
      console.log('[CommandProcessor] Network connection lost');
      this.offlineMode.next(true);
      this.handleNetworkLoss();
    });
    
    console.log(`[CommandProcessor] Network monitoring initialized, current status: ${navigator.onLine ? 'online' : 'offline'}`);
  }

  /**
   * Handle network recovery
   * Attempts to sync pending commands and clear the command queue
   */
  private async handleNetworkRecovery(): Promise<void> {
    console.log('[CommandProcessor] Handling network recovery');
    
    // Reset sync retry count
    this.syncRetryCount = 0;
    
    // Sync offline commands
    if (this.syncPending) {
      try {
        await this.syncOfflineCommands();
      } catch (error) {
        console.error('[CommandProcessor] Error syncing offline commands:', error);
      }
    }
    
    // Process any queued commands
    if (this.commandQueue.length > 0) {
      console.log(`[CommandProcessor] Processing ${this.commandQueue.length} queued commands`);
      this.processCommandQueue();
    }
    
    // Track analytics for network recovery
    this.trackAnalytics('network_recovered' as AnalyticsEventType, {
      timestamp: Date.now(),
      queuedCommands: this.commandQueue.length,
      syncPending: this.syncPending
    });
  }

  /**
   * Handle network loss
   * Prepares the system for offline operation
   */
  private handleNetworkLoss(): void {
    console.log('[CommandProcessor] Handling network loss');
    
    // Mark sync as pending for when we come back online
    this.syncPending = true;
    
    // Track analytics for network loss
    this.trackAnalytics('network_state_change' as AnalyticsEventType, {
      state: 'offline',
      timestamp: Date.now(),
      queuedCommands: this.commandQueue.length
    });
  }



  /**
   * Save command history to storage
   */
  private saveCommandHistory(): void {
    try {
      // Limit history size to prevent storage issues
      const maxHistorySize = 100;
      if (this.commandHistory.length > maxHistorySize) {
        this.commandHistory = this.commandHistory.slice(-maxHistorySize);
      }
      
      localStorage.setItem('lark_command_history', JSON.stringify(this.commandHistory));
    } catch (error) {
      console.error('[CommandProcessor] Error saving command history:', error);
    }
  }



  /**
   * Debug logging helper
   * @param message The message to log
   * @param data Optional data to include
   */
  private debug(message: string, data?: any): void {
    const debugEnabled = true; // Could be controlled by a setting
    
    if (debugEnabled) {
      if (data) {
        console.log(`[CommandProcessor] ${message}`, data);
      } else {
        console.log(`[CommandProcessor] ${message}`);
      }
    }
  }
  
  // This is a duplicate implementation of syncOfflineCommands and has been removed

  // This is a duplicate implementation of handleNetworkLoss and has been removed

  /**
   * Track analytics events
   * @param eventType The type of event to track
   * @param data The data to track with the event
   */
  private async trackAnalytics(eventType: AnalyticsEventType, data: Record<string, any>): Promise<void> {
    try {
      // Add timestamp if not provided
      if (!data.timestamp) {
        data.timestamp = Date.now();
      }
      
      // Add to analytics database
      await indexedDBService.addItem(ANALYTICS_STORE, {
        type: eventType, // Use 'type' instead of 'eventType' to match AnalyticsData interface
        data,
        timestamp: data.timestamp,
        id: uuidv4()
      });
      
      console.log(`[CommandProcessor] Analytics tracked: ${eventType}`);
    } catch (error) {
      console.error('[CommandProcessor] Error tracking analytics:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Load command history from local storage
   */
  private loadCommandHistory(): void {
    try {
      const storedHistory = localStorage.getItem('lark_command_history');
      if (storedHistory) {
        this.commandHistory = JSON.parse(storedHistory);
        console.log(`[CommandProcessor] Loaded ${this.commandHistory.length} command history items`);
      }
    } catch (error) {
      console.error('[CommandProcessor] Error loading command history:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
  


  /**
   * Process a voice command
   * @param command The command text to process
   * @param alternatives Alternative transcriptions for better accuracy
   * @param isMultiCommand Whether this is part of a multi-command sequence
   * @param context Optional context from previous commands in a chain
   */
  public async processCommand(
    command: string, 
    alternatives: string[] = [], 
    isMultiCommand: boolean = false,
    context?: CommandContext
  ): Promise<CommandResult> {
    if (!command?.trim()) {
      return {
        command: '',
        response: 'No command provided',
        success: false
      };
    }
    
    // For text input from the chat interface, we want to process immediately
    // regardless of processing state to ensure responsiveness
    console.log(`[CommandProcessor] Processing command: "${command}"`);
    
    const commandType = this.identifyCommandType(command);
    if (commandType === 'translation') {
      return this.processTranslationCommand(command);
    }
    
    // Set processing state
    const wasProcessing = this.processing.value;
    this.processing.next(true);
    
    // Check for duplicate command within the last 1.5 seconds (reduced from 2 seconds)
    // to improve responsiveness for text chat while still preventing duplicates
    const isDuplicate = command === this.lastCommand && 
      ((Date.now() - this.lastCommandTime) < 1500) && 
      !command.toLowerCase().includes('miranda');  // Never treat Miranda commands as duplicates
    
    if (isDuplicate && !isMultiCommand) {
      this.debug(`Ignoring duplicate command: "${command}"`);
      return {
        command,
        response: 'Command already processed',
        success: false,
        metadata: { duplicate: true }
      };
    }
    
    // Update last command
    this.lastCommand = command;
    this.lastCommandTime = Date.now();
    
    try {
      console.log(`[CommandProcessor] Processing command: "${command}"`);
      if (alternatives.length > 0) {
        console.log('[CommandProcessor] Alternatives:', alternatives);
      }
      
      // First, check if we have this command cached
      if (this.useCommandCache) {
        try {
          const cachedResult = await this.getCachedCommand(command);
          if (cachedResult) {
            console.log('[CommandProcessor] Using cached command result');
            
            // Add to command history
            this.commandHistory.push(cachedResult);
            
            // Emit result
            this.commandResults.next(cachedResult);
            
            // Track analytics for cache hit
            this.trackAnalytics('command_cache_hit' as AnalyticsEventType, {
              command,
              timestamp: Date.now()
            });
            
            return cachedResult;
          }
        } catch (cacheError) {
          console.warn('[CommandProcessor] Error checking command cache:', cacheError);
          // Continue with normal processing if cache fails
        }
      }
      
      // Determine if we should use offline processing
      const isOffline = this.offlineMode.value;
      
      let result: CommandResult;
      
      if (isOffline) {
        // Process command offline
        result = await this.processOfflineCommand(command);
      } else {
        // Process command online
        result = await this.processOnlineCommand(command, alternatives);
      }
      
      // Add to command history
      this.commandHistory.push(result);
      this.saveCommandHistory();
      
      // Cache the result for future use
      if (this.useCommandCache && result.success) {
        this.cacheCommandResult(result);
      }
      
      // Emit result
      this.commandResults.next(result);
      
      // Track analytics for command processing
      this.trackAnalytics('command_processed' as AnalyticsEventType, {
        command,
        success: result?.success || false,
        offline: isOffline,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error('[CommandProcessor] Error processing command:', error instanceof Error ? error.message : 'Unknown error');
      
      // Special handling for Miranda commands that fail - ensure they still work
      if (command.toLowerCase().includes('miranda')) {
        console.log('[CommandProcessor] Providing fallback for Miranda command that failed');
        
        // Extract language even in error case
        const languageMatch = command.match(/miranda\s+(?:rights\s+)?(?:in\s+)?(\w+)/i);
        const language = languageMatch && languageMatch[1] ? languageMatch[1].toLowerCase() : 'english';
        
        // Create a successful result for Miranda despite the error
        const mirandaResult: CommandResult = {
          command,
          response: `Reading Miranda rights in ${language}. Switching to Miranda tab.`,
          success: true,
          action: 'miranda',
          metadata: { 
            language, 
            fallback: true, 
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now()
          }
        };
        
        // Emit the result
        this.commandResults.next(mirandaResult);
        
        // Track analytics
        this.trackAnalytics('command_processed' as AnalyticsEventType, {
          command,
          success: true,
          action: 'miranda',
          fallback: true,
          timestamp: Date.now()
        });
        
        return mirandaResult;
      }
      
      // For non-Miranda commands, use the error handler
      return this.handleError(error, command);
    } finally {
      // Reset processing state
      this.processing.next(false);
      
      // Check if we need to sync pending offline commands
      if (!this.offlineMode.value && this.syncPending) {
        this.syncOfflineCommands();
      }
    }
  }
  
  /**
   * Process a command offline
   * @param command The command to process offline
   */
  private async processOfflineCommand(command: string): Promise<CommandResult> {
    try {
      // Use the offline command processor
      const result = await processOfflineCommand(command);
      
      return {
        command,
        response: result?.result || 'Command processed offline',
        success: result?.executed || false,
        action: result?.action || 'unknown',
        module: 'offline',
        metadata: result?.parameters || {}
      };
    } catch (error) {
      console.error('[CommandProcessor] Error processing offline command:', error);
      return this.handleError(error, command, 'offline');
    }
  }
  
  /**
   * Process a command online
   */
  private async processOnlineCommand(command: string, alternatives: string[] = []): Promise<CommandResult> {
    try {
      // First, try to identify the command type
      const commandType = this.identifyCommandType(command);
      
      // Use alternatives for better command interpretation
      // If the main command fails, we might try the alternatives
      const hasAlternatives = alternatives && alternatives.length > 0;
      
      this.debug(`Processing ${commandType} command: "${command}"${hasAlternatives ? ` with ${alternatives.length} alternatives` : ''}`);
      
      let result;
      
      switch (commandType) {
        case 'general_knowledge':
          result = await this.processGeneralKnowledgeCommand(command);
          break;
        case 'tactical_situation':
          result = await this.processTacticalSituationCommand(command);
          break;
        default:
          // Default to standard command processing
          result = await this.processStandardCommand(command, alternatives);
          break;
      }
      
      // Reset consecutive error counter on success
      if (result && result.success) {
        this.consecutiveErrors = 0;
      }
      
      return result;
    } catch (error) {
      console.error('[CommandProcessor] Error processing online command:', error);
      return this.handleError(error, command, 'online');
    }
  }
  
  /**
   * Parse multiple commands from a single utterance
   * @param utterance The full voice utterance to parse
   */
  private parseCommands(utterance: string): string[] {
    // Split on common command separators
    const separators = [
      ' and then ',
      ' then ',
      ' after that ',
      ' next ',
      ' followed by ',
      '; ',
      ' and '
    ];
    
    let commands: string[] = [utterance];
    
    for (const separator of separators) {
      if (utterance.toLowerCase().includes(separator)) {
        commands = utterance
          .split(new RegExp(separator, 'i'))
          .map(cmd => cmd.trim())
          .filter(cmd => cmd.length > 0);
        break;
      }
    }
    
    return commands;
  }

  /**
   * Get multi-command results observable
   */
  public getMultiCommandResults(): Subject<MultiCommandResult> {
    return this.multiCommandResults;
  }

  /**
   * Identify the type of command and assign priority
   */
  private identifyCommandType(command: string): 'standard' | 'general_knowledge' | 'tactical_situation' {
    const lowerCommand = command.toLowerCase();
    
    // Check for knowledge queries
    if (lowerCommand.includes('what is') || 
        lowerCommand.includes('who is') || 
        lowerCommand.includes('when') || 
        lowerCommand.includes('where') || 
        lowerCommand.includes('how to') || 
        lowerCommand.includes('tell me about') ||
        lowerCommand.includes('lookup') ||
        lowerCommand.includes('look up') ||
        lowerCommand.includes('search for') ||
        lowerCommand.includes('find information')) {
      console.log('[CommandProcessor] Identified as general knowledge query');
      return 'general_knowledge';
    }
    
    // Check for tactical situation assessment
    if (lowerCommand.includes('assess') || 
        lowerCommand.includes('situation') || 
        lowerCommand.includes('threat') || 
        lowerCommand.includes('danger') || 
        lowerCommand.includes('risk')) {
      console.log('[CommandProcessor] Identified as tactical situation assessment');
      return 'tactical_situation';
    }
    
    // Default to standard command
    console.log('[CommandProcessor] Identified as standard command');
    return 'standard';
  }
  
  /**
   * Process a standard command
   */
  private async processTranslationCommand(command: string): Promise<CommandResult> {
    try {
      const lowerCommand = command.toLowerCase();
      let targetLanguage = 'english';
      let textToTranslate = '';
      
      // Extract target language
      const languageMatches = {
        'in spanish': 'spanish',
        'in french': 'french',
        'in german': 'german',
        'in chinese': 'chinese',
        'in japanese': 'japanese',
        'in korean': 'korean',
        'to spanish': 'spanish',
        'to french': 'french',
        'to german': 'german',
        'to chinese': 'chinese',
        'to japanese': 'japanese',
        'to korean': 'korean'
      };
      
      for (const [phrase, language] of Object.entries(languageMatches)) {
        if (lowerCommand.includes(phrase)) {
          targetLanguage = language;
          textToTranslate = command.replace(new RegExp(phrase, 'i'), '').trim();
          break;
        }
      }
      
      // If no specific language pattern found, try to extract it from general translate command
      if (!textToTranslate) {
        const translateMatch = lowerCommand.match(/translate\s+(.+?)\s+to\s+([a-z]+)/i);
        if (translateMatch) {
          textToTranslate = translateMatch[1];
          targetLanguage = translateMatch[2];
        } else {
          throw new Error('Could not determine the text to translate or target language');
        }
      }
      
      // Perform translation
      const result = await translationService.translate({
        text: textToTranslate,
        targetLanguage: targetLanguage
      });
      
      this.trackAnalytics('translation_success', {
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        confidence: result.confidence
      });
      
      return {
        command,
        response: result.translatedText,
        success: true,
        action: 'translation',
        module: 'translation',
        metadata: {
          sourceLanguage: result.sourceLanguage,
          targetLanguage: result.targetLanguage,
          confidence: result.confidence
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown translation error';
      this.trackAnalytics('translation_error', { error: errorMessage });
      return this.handleError(error, command, 'translation');
    }
  }

  private async processStandardCommand(command: string, alternatives: string[] = []): Promise<CommandResult> {
    try {
      // Get settings for personalization
      const settings = useSettings.getState().settings;
      const officerName = settings.officerName || 'Officer';
      
      console.log('[CommandProcessor] Sending command to OpenAI service:', command);
      
      // Process the command using OpenAI service
      const result = await processVoiceCommand(command);
      console.log('[CommandProcessor] OpenAI service result:', result);
      
      // Handle different return types
      let response: string;
      let success: boolean = true;
      let action: string = 'unknown';
      let metadata: Record<string, any> = {};
      
      if (typeof result === 'string') {
        response = result;
        console.log('[CommandProcessor] Received string response:', response);
      } else if (isCommandResponse(result)) {
        console.log('[CommandProcessor] Received command response:', result);
        // Check for result or error in the response
        response = result?.result || result?.error || 'Command processed';
        success = result?.executed || false;
        action = result?.action || 'unknown';
        
        // Include both parameters and metadata in our metadata object
        metadata = { ...(result?.parameters || {}), ...(result?.metadata || {}) };
        
        // Special handling for Miranda commands
        if (action === 'miranda') {
          // Extract language from parameters or metadata or use default
          // Normalize language to lowercase for consistency
          let language = (result.parameters?.language || result.metadata?.language || 'english').toLowerCase();
          
          // Validate language is supported
          const supportedLanguages = ['english', 'spanish', 'french', 'vietnamese', 'mandarin', 'arabic'];
          if (!supportedLanguages.includes(language)) {
            console.warn(`[CommandProcessor] Unsupported language for Miranda rights: ${language}. Defaulting to English.`);
            language = 'english';
          }
          
          // Ensure metadata includes language
          metadata.language = language;
          
          // Update response message if needed
          if (!response.includes('Miranda')) {
            response = `Miranda rights will be read in ${language}. Please switch to the Miranda tab.`;
          }
          
          console.log('[CommandProcessor] Handling Miranda command with language:', language);
          
          // Track this command for analytics
          this.trackAnalytics('miranda_command' as AnalyticsEventType, {
            command: command,
            action: 'miranda',
            success: true,
            language: language,
            timestamp: Date.now()
          });
        }
        
        // Add officer name to the response for personalization if appropriate
        if (success && response && !response.includes(officerName) && Math.random() > 0.5) {
          const personalizedPrefixes = [
            `${officerName}, `,
            `Got it ${officerName}. `,
            `Yes ${officerName}, `
          ];
          const randomPrefix = personalizedPrefixes[Math.floor(Math.random() * personalizedPrefixes.length)];
          response = randomPrefix + response;
        }
      } else {
        // For unknown result types, provide a default response
        console.log('[CommandProcessor] Received unknown response type:', typeof result);
        response = 'Command processed';
      }
      
      // Track command success for analytics
      this.trackAnalytics('command_executed' as AnalyticsEventType, {
        command,
        commandType: 'standard',
        success,
        action,
        timestamp: Date.now()
      });
      
      return {
        command,
        response,
        success,
        action,
        module: 'standard',
        metadata
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CommandProcessor] Error processing standard command:', errorMessage);
      
      // Log analytics about the error
      this.trackAnalytics('standard_command_error' as AnalyticsEventType, {
        command,
        error: errorMessage,
        timestamp: Date.now()
      });
      
      return {
        command,
        response: `I'm sorry, I couldn't process that command. ${errorMessage}`,
        success: false,
        module: 'standard',
        metadata: { error: errorMessage }
      };
    }
  }

  /**
   * Process the command queue
   * This method processes commands in the queue based on priority
   * and handles retries for failed commands
   */
  private async processCommandQueue(): Promise<void> {
    if (this.processingQueue || this.commandQueue.length === 0) {
      return;
    }

    this.processingQueue = true;
    this.debug(`Processing command queue with ${this.commandQueue.length} items`);

    try {
      // Sort queue by priority (if available) and timestamp
      this.commandQueue.sort((a, b) => {
        // Higher priority comes first
        if (a.priority !== undefined && b.priority !== undefined) {
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
        }
        // Otherwise sort by timestamp (older first)
        return a.timestamp - b.timestamp;
      });

      while (this.commandQueue.length > 0) {
        const queueItem = this.commandQueue[0];
        const { command, alternatives, timestamp, retryCount = 0, context } = queueItem;

        try {
          // Track command processing attempt
          await this.trackAnalytics('command_processing_attempt' as AnalyticsEventType, {
            command,
            timestamp: Date.now(),
            retryCount,
            offlineMode: this.offlineMode.value
          });

          // Temporarily set processing to false to avoid recursion issues
          const wasProcessing = this.processing.value;
          this.processing.next(false);
          
          // Process the command
          const result = await this.processCommand(command, alternatives, false, context);
          
          // Restore processing state
          this.processing.next(wasProcessing);

          // Track command result
          await this.trackAnalytics('command_processed' as AnalyticsEventType, {
            command,
            success: result.success,
            timestamp: Date.now(),
            retryCount,
            offlineMode: this.offlineMode.value
          });

          // Remove the command from queue if successful
          this.commandQueue.shift();
        } catch (error) {
          console.error(`[CommandProcessor] Error processing queued command: ${command}`, error);

          // Track command failure
          await this.trackAnalytics('command_failed' as AnalyticsEventType, {
            command,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
            retryCount,
            offlineMode: this.offlineMode.value
          });

          // If we're offline, keep the command in queue
          if (this.offlineMode.value) {
            break;
          }

          // If we've exceeded retry count, remove the command
          if (retryCount >= this.maxSyncRetries) {
            this.commandQueue.shift();
            continue;
          }

          // Update retry count and move to end of queue
          queueItem.retryCount = retryCount + 1;
          this.commandQueue.push(this.commandQueue.shift()!);
          
          // Add delay before next retry with exponential backoff
          const backoffDelay = this.syncRetryDelay * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }
  

  
  /**
   * Process a tactical situation command
   * @param command The command to process
   */
  private async processTacticalSituationCommand(command: string): Promise<CommandResult> {
    try {
      // Get settings for personalization
      const settings = useSettings.getState().settings;
      const officerName = settings.officerName || 'Officer';
      
      console.log('[CommandProcessor] Processing tactical situation command:', command);
      
      // Process the tactical situation using OpenAI service
      const result = await assessTacticalSituation(command);
      console.log('[CommandProcessor] Tactical situation result:', result);
      
      // Format the response
      let response: string;
      let threatLevel: string = 'unknown';
      let metadata: Record<string, any> = {};
      
      if (typeof result === 'string') {
        response = result;
      } else if (result && typeof result === 'object') {
        const commandResponse = result as CommandResponse;
        response = commandResponse.result || 'Situation assessed';
        threatLevel = commandResponse.parameters?.threat || 'unknown';
        metadata = { ...commandResponse.parameters || {} };
      } else {
        response = 'Situation assessed';
      }
      
      // Add officer name to the response for personalization
      if (response && !response.includes(officerName) && Math.random() > 0.7) {
        const personalizedPrefixes = [
          `${officerName}, situation assessment: `,
          `${officerName}, `,
          `Assessment complete, ${officerName}: `
        ];
        const randomPrefix = personalizedPrefixes[Math.floor(Math.random() * personalizedPrefixes.length)];
        response = randomPrefix + response;
      }
      
      // Track analytics
      this.trackAnalytics('tactical_assessment' as AnalyticsEventType, {
        command,
        threatLevel,
        success: true,
        timestamp: Date.now()
      });
      
      return {
        command,
        response,
        success: true,
        action: 'tactical_assessment',
        module: 'tactical_situation',
        metadata: {
          ...(typeof metadata === 'object' ? metadata : {}),
          threatLevel,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error('[CommandProcessor] Error processing tactical situation command:', error instanceof Error ? error.message : 'Unknown error');
      
      // Track analytics
      this.trackAnalytics('tactical_assessment_error' as AnalyticsEventType, {
        command,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      
      return this.handleError(error, command, 'tactical_situation');
    }
  }
  
  /**
   * Get processing state observable
   */
  public getProcessingState() {
    return this.processing.asObservable();
  }
  
  /**
   * Get command results observable
   */
  public getCommandResults() {
    return this.commandResults.asObservable();
  }
  
  /**
   * Get offline mode observable
   */
  public getOfflineMode() {
    return this.offlineMode.asObservable();
  }
  
  /**
   * Get a cached command result
   */
  private async getCachedCommand(command: string): Promise<CommandResult | null> {
    try {
      const cachedCommand = await indexedDBService.getCommandByText(command.toLowerCase());
      
      if (cachedCommand) {
        // Convert from cache format to CommandResult format
        return {
          command: cachedCommand.command,
          response: cachedCommand.response,
          success: cachedCommand.success,
          action: cachedCommand.action,
          module: cachedCommand.module,
          metadata: cachedCommand.metadata
        };
      }
      
      return null;
    } catch (error) {
      console.error('[CommandProcessor] Error retrieving cached command:', error);
      return null;
    }
  }
  
  /**
   * Cache a command result for future use
   * @param result The command result to cache
   */
  private async cacheCommandResult(result: CommandResult): Promise<void> {
    try {
      const cacheItem: CommandCache = {
        id: uuidv4(),
        command: result.command.toLowerCase(),
        response: result.response,
        timestamp: Date.now(),
        success: result.success,
        action: result.action || '',
        module: result.module || '',
        metadata: result.metadata || {}
      };
      
      await indexedDBService.cacheCommand(cacheItem);
      console.log('[CommandProcessor] Command cached successfully');
    } catch (error) {
      console.error('[CommandProcessor] Error caching command:', error);
    }
  }
  /**
   * Process a general knowledge command
   * @param command The command to process
   */
  private async processGeneralKnowledgeCommand(command: string): Promise<CommandResult> {
    try {
      console.log('[CommandProcessor] Processing general knowledge command:', command);
      
      // Get settings for personalization
      const settings = useSettings.getState().settings;
      const officerName = settings.officerName || 'Officer';
      
      // Extract the query from the command
      const query = this.extractQuery(command);
      console.log('[CommandProcessor] Extracted query:', query);
      
      // Process the query using OpenAI service
      const result = await getGeneralKnowledge(query);
      console.log('[CommandProcessor] General knowledge result:', result);
      
      // Format the response
      let response = typeof result === 'string' ? result : ((result as any)?.result || 'Information retrieved');
      
      // Add officer name to the response for personalization if appropriate
      if (response && !response.includes(officerName) && Math.random() > 0.5) {
        const personalizedPrefixes = [
          `${officerName}, here's what I found: `,
          `${officerName}, `,
          `Here's the information, ${officerName}: `
        ];
        const randomPrefix = personalizedPrefixes[Math.floor(Math.random() * personalizedPrefixes.length)];
        response = randomPrefix + response;
      }
      
      // Track analytics
      this.trackAnalytics('knowledge_query' as AnalyticsEventType, {
        command,
        query,
        success: true,
        timestamp: Date.now()
      });
      
      return {
        command,
        response,
        success: true,
        action: 'knowledge_query',
        module: 'general_knowledge',
        metadata: {
          query,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error('[CommandProcessor] Error processing general knowledge command:', error);
      
      // Track analytics
      this.trackAnalytics('knowledge_query_error' as AnalyticsEventType, {
        command,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
      
      return this.handleError(error, command, 'general_knowledge');
    }
  }
  

  /**
   * Extract a query from a command
   * @param command The command to extract a query from
   */
  private extractQuery(command: string): string {
    const lowerCommand = command.toLowerCase();
    let query = command;
    
    // Common prefixes to remove
    const prefixes = [
      'what is ',
      'who is ',
      'tell me about ',
      'lookup ',
      'look up ',
      'search for ',
      'find information about ',
      'find information on ',
      'tell me ',
      'i want to know about ',
      'i want to know '
    ];
    
    for (const prefix of prefixes) {
      if (lowerCommand.startsWith(prefix)) {
        query = command.substring(prefix.length);
        break;
      } else if (lowerCommand.includes(prefix)) {
        const startIndex = lowerCommand.indexOf(prefix) + prefix.length;
        query = command.substring(startIndex);
        break;
      }
    }
    
    return query.trim();
  }
  

  /**
   * Process multiple commands in a single utterance
   * @param utterance The full voice utterance containing multiple commands
   * @param alternatives Alternative transcriptions for better accuracy
   */
  public async processMultiCommand(utterance: string, alternatives: string[] = []): Promise<MultiCommandResult> {
    console.log(`[CommandProcessor] Processing multi-command: "${utterance}"`);
    
    // Parse commands from the utterance
    const commands = this.parseCommands(utterance);
    
    if (commands.length <= 1) {
      // If only one command, process normally but wrap in multi-command result
      const result = await this.processCommand(utterance, alternatives);
      
      const multiResult: MultiCommandResult = {
        commands: [result],
        success: result.success,
        chainId: uuidv4(),
        context: {
          previousCommand: utterance,
          previousResult: result.response,
          variables: {}
        }
      };
      
      this.multiCommandResults.next(multiResult);
      return multiResult;
    }
    
    const chainId = uuidv4();
    const context: CommandContext = {
      variables: {}
    };
    
    this.debug(`Processing multi-command chain ${chainId} with ${commands.length} commands`);
    
    const results: CommandResult[] = [];
    let success = true;

    for (const command of commands) {
      try {
        const result = await this.processCommand(command, alternatives, true, {
          chainId,
          previousCommand: results.length > 0 ? results[results.length - 1].command : undefined,
          previousResult: results.length > 0 ? results[results.length - 1].response : undefined,
          variables: context.variables
        });
        
        results.push(result);
        success = success && result.success;

        // Update context with any new variables
        if (result.metadata?.contextVariables) {
          context.variables = { ...context.variables, ...result.metadata.contextVariables };
        }

        // Track analytics for chain processing
        await this.trackAnalytics('command_chain_progress', {
          chainId,
          commandIndex: results.length,
          totalCommands: commands.length,
          success: result.success,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error(`[CommandProcessor] Error processing command in chain ${chainId}:`, error);
        success = false;
        break;
      }
    }

    const multiCommandResult: MultiCommandResult = {
      commands: results,
      success,
      chainId,
      context
    };

    this.multiCommandResults.next(multiCommandResult);
    return multiCommandResult;
  }
  
  /**
   * Sync offline commands when back online
   */
  private async syncOfflineCommands(): Promise<void> {
    if (this.offlineMode.value) {
      // Still offline, mark as pending
      this.syncPending = true;
      return;
    }
    
    this.syncPending = false;
    console.log('[CommandProcessor] Syncing offline commands...');
    
    try {
      // Get all unprocessed voice data
      const unprocessedData = await indexedDBService.getUnprocessedVoiceData();
      
      if (unprocessedData.length === 0) {
        console.log('[CommandProcessor] No offline commands to sync');
        return;
      }
      
      console.log(`[CommandProcessor] Found ${unprocessedData.length} offline commands to sync`);
      
      // Process each command
      for (const data of unprocessedData) {
        try {
          // Process the command online
          const result = await this.processOnlineCommand(data.transcript, data.alternatives || []);
          
          // Mark as processed
          await indexedDBService.markVoiceDataAsProcessed(data.id);
          
          console.log(`[CommandProcessor] Synced offline command: ${data.transcript}`);
        } catch (error) {
          console.error(`[CommandProcessor] Error syncing command ${data.id}:`, error);
        }
      }
      
      console.log('[CommandProcessor] Offline command sync completed');
    } catch (error) {
      console.error('[CommandProcessor] Error syncing offline commands:', error);
    }
  }
  
  /**
   * Get command history
   */
  public getCommandHistory() {
    return this.commandHistory;
  }
  
  /**
   * Get error events observable
   */
  public getErrorEvents() {
    return this.errorSubject.asObservable();
  }
  
  /**
   * Get suggested charges observable
   */
  public getSuggestedCharges() {
    return this.suggestedCharges.asObservable();
  }
  
  /**
   * Centralized error handling for command processing
   * @param error The error that occurred
   * @param command The command that was being processed
   * @param module Optional module identifier (online, offline, etc.)
   */
  private handleError(error: unknown, command: string, module: string = 'general'): CommandResult {
    // Increment consecutive errors counter
    this.consecutiveErrors++;
    this.lastErrorTime = Date.now();
    
    // Determine error type
    let errorType: CommandErrorType = 'unknown_error';
    let severity: ErrorSeverity = 'medium';
    let recoverable = true;
    let retryDelay = this.errorBackoffTime * Math.min(this.consecutiveErrors, 5); // Exponential backoff capped at 5x
    
    // Create a more user-friendly error message
    let errorMessage = "I'm sorry, I encountered an error processing your command.";
    
    // Analyze error to determine type and severity
    if (error instanceof Error) {
      const errorText = error.message.toLowerCase();
      
      if (errorText.includes('network') || errorText.includes('fetch') || errorText.includes('connection')) {
        errorType = 'network_error';
        errorMessage += " There seems to be a network issue. Please check your connection.";
        severity = 'high';
      } else if (errorText.includes('timeout') || errorText.includes('timed out')) {
        errorType = 'timeout_error';
        errorMessage += " The request timed out. Please try again.";
        severity = 'medium';
      } else if (errorText.includes('permission') || errorText.includes('microphone')) {
        errorType = 'permission_error';
        errorMessage += " There was a permission error. Please check your microphone settings.";
        severity = 'high';
        recoverable = false;
      } else if (errorText.includes('api') || errorText.includes('key') || errorText.includes('rate limit')) {
        errorType = 'api_error';
        errorMessage += " There was an issue with the AI service. Please try again in a moment.";
        severity = 'high';
        retryDelay = 5000; // Longer delay for API errors
      } else if (errorText.includes('invalid') || errorText.includes('validation')) {
        errorType = 'validation_error';
        errorMessage += " The command couldn't be processed in its current form.";
        severity = 'low';
      } else {
        errorType = 'processing_error';
        errorMessage += " An unexpected error occurred.";
      }
    }
    
    // For offline mode, customize the message
    if (module === 'offline') {
      errorMessage = `I'm sorry, I couldn't process that command offline. ${this.offlineMode.value ? 'You are currently offline.' : ''}`;  
    }
    
    // If we've had too many consecutive errors, suggest switching to offline mode
    if (this.consecutiveErrors >= this.maxConsecutiveErrors && !this.offlineMode.value) {
      errorMessage += " You may want to switch to offline mode if network issues persist.";
      severity = 'high';
    }
    
    // Create error result
    const errorResult: CommandResult = {
      command,
      response: errorMessage,
      success: false,
      module,
      metadata: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType,
        consecutiveErrors: this.consecutiveErrors,
        timestamp: Date.now(),
        recoverable
      }
    };
    
    // Emit detailed error information
    this.errorSubject.next({
      type: errorType,
      message: errorMessage,
      severity,
      recoverable,
      timestamp: Date.now(),
      details: {
        command,
        module,
        error: error instanceof Error ? error.message : String(error),
        consecutiveErrors: this.consecutiveErrors
      }
    });
    
    // Emit result
    this.commandResults.next(errorResult);
    
    // Track analytics for error
    this.trackAnalytics('command_error', {
      command,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType,
      severity,
      consecutiveErrors: this.consecutiveErrors,
      module,
      timestamp: Date.now()
    });
    
    return errorResult;
  }
}

// Create singleton instance
export const commandProcessingService = new CommandProcessingService();
