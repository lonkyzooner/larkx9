interface CommandContext {
  languagePreference?: string;
  lastStatute?: string;
  lastThreatAssessment?: {
    timestamp: number;
    location?: string;
  };
  voicePreferences: {
    voiceId: string;  // Using OpenAI voice as default
    speed: number;
    volume: number;
  };
}

class CommandContextManager {
  private static instance: CommandContextManager;
  private context: CommandContext;
  
  private constructor() {
    this.context = {
      voicePreferences: {
        voiceId: 'alloy', // OpenAI default voice
        speed: 1.0,
        volume: 1.0
      }
    };
  }
  
  public static getInstance(): CommandContextManager {
    if (!CommandContextManager.instance) {
      CommandContextManager.instance = new CommandContextManager();
    }
    return CommandContextManager.instance;
  }
  
  // Update language preference
  public setLanguagePreference(language: string): void {
    this.context.languagePreference = language;
  }
  
  // Get language preference with fallback
  public getLanguagePreference(): string {
    return this.context.languagePreference || 'english';
  }
  
  // Update last accessed statute
  public setLastStatute(statute: string): void {
    this.context.lastStatute = statute;
  }
  
  // Get last accessed statute
  public getLastStatute(): string | undefined {
    return this.context.lastStatute;
  }
  
  // Update threat assessment context
  public updateThreatContext(location?: string): void {
    this.context.lastThreatAssessment = {
      timestamp: Date.now(),
      location
    };
  }
  
  // Get last threat assessment info
  public getLastThreatAssessment(): { timestamp: number; location?: string } | undefined {
    return this.context.lastThreatAssessment;
  }
  
  // Check if threat assessment is recent (within last 5 minutes)
  public isRecentThreatAssessment(): boolean {
    if (!this.context.lastThreatAssessment) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - this.context.lastThreatAssessment.timestamp < fiveMinutes;
  }
  
  // Get voice preferences
  public getVoicePreferences(): CommandContext['voicePreferences'] {
    return this.context.voicePreferences;
  }
  
  // Update voice preferences
  public updateVoicePreferences(preferences: Partial<CommandContext['voicePreferences']>): void {
    this.context.voicePreferences = {
      ...this.context.voicePreferences,
      ...preferences
    };
  }
  
  // Clear all context
  public clearContext(): void {
    this.context = {
      voicePreferences: this.context.voicePreferences // Preserve voice preferences
    };
  }
  
  // Get full context (for debugging)
  public getFullContext(): CommandContext {
    return { ...this.context };
  }
}

export const commandContext = CommandContextManager.getInstance();
