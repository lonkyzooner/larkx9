export interface CommandMetrics {
  timestamp: number;
  command: string;
  success: boolean;
  responseTime: number;
  confidence: number;
  offline: boolean;
  commandType: 'miranda' | 'statute' | 'threat' | 'tactical' | 'unknown' | 'general_query';
  voiceAccuracy?: number;
  suggestionAccepted?: boolean;
}

export interface CommandStats {
  totalCommands: number;
  successRate: number;
  averageResponseTime: number;
  commonFailures: Array<{command: string; count: number}>;
  offlineUsage: number;
  voiceRecognitionAccuracy: number;
  commandTypeBreakdown: {
    miranda: number;
    statute: number;
    threat: number;
    tactical: number;
    general_query: number;
    unknown: number;
  };
  predictiveMetrics: {
    suggestionAcceptanceRate: number;
    averageConfidenceScore: number;
    topSuggestions: Array<{ command: string; useCount: number }>;
  };
  performanceOverTime: Array<{
    timestamp: number;
    successRate: number;
    responseTime: number;
    accuracy: number;
  }>;
}

class CommandAnalytics {
  private static instance: CommandAnalytics;
  private metrics: CommandMetrics[] = [];
  private readonly MAX_HISTORY = 1000;
  
  private constructor() {}
  
  public static getInstance(): CommandAnalytics {
    if (!CommandAnalytics.instance) {
      CommandAnalytics.instance = new CommandAnalytics();
    }
    return CommandAnalytics.instance;
  }
  
  public recordCommand(metrics: Omit<CommandMetrics, 'timestamp'>): void {
    this.metrics.push({
      ...metrics,
      timestamp: Date.now()
    });
    
    // Keep only recent history
    if (this.metrics.length > this.MAX_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_HISTORY);
    }
    
    // Save to localStorage for persistence
    this.persistMetrics();
  }
  
  public getStats(timeframe: number = 7 * 24 * 60 * 60 * 1000): CommandStats {
    const recentMetrics = this.metrics.filter(
      m => Date.now() - m.timestamp < timeframe
    );
    
    const totalCommands = recentMetrics.length;
    if (totalCommands === 0) {
      return {
        totalCommands: 0,
        successRate: 0,
        averageResponseTime: 0,
        commonFailures: [],
        offlineUsage: 0,
        voiceRecognitionAccuracy: 0,
        commandTypeBreakdown: {
          miranda: 0,
          statute: 0,
          threat: 0,
          tactical: 0,
          general_query: 0,
          unknown: 0
        },
        predictiveMetrics: {
          suggestionAcceptanceRate: 0,
          averageConfidenceScore: 0,
          topSuggestions: []
        },
        performanceOverTime: []
      };
    }
    
    const successfulCommands = recentMetrics.filter(m => m.success);
    const failedCommands = recentMetrics.filter(m => !m.success);
    
    // Calculate common failures
    const failureMap = new Map<string, number>();
    failedCommands.forEach(m => {
      const count = failureMap.get(m.command) || 0;
      failureMap.set(m.command, count + 1);
    });

    // Calculate command type breakdown
    const typeBreakdown = recentMetrics.reduce((acc, m) => {
      acc[m.commandType] = (acc[m.commandType] || 0) + 1;
      return acc;
    }, {} as CommandStats['commandTypeBreakdown']);

    // Calculate voice recognition accuracy
    const voiceMetrics = recentMetrics.filter(m => m.voiceAccuracy !== undefined);
    const voiceAccuracy = voiceMetrics.length > 0
      ? voiceMetrics.reduce((sum, m) => sum + (m.voiceAccuracy || 0), 0) / voiceMetrics.length
      : 0;

    // Calculate predictive metrics
    const suggestedCommands = recentMetrics.filter(m => m.suggestionAccepted !== undefined);
    const suggestionAcceptanceRate = suggestedCommands.length > 0
      ? suggestedCommands.filter(m => m.suggestionAccepted).length / suggestedCommands.length
      : 0;

    // Calculate performance over time
    const timeSlots = 10; // Split timeframe into 10 slots
    const slotSize = timeframe / timeSlots;
    const performanceOverTime = Array.from({ length: timeSlots }, (_, i) => {
      const slotStart = Date.now() - timeframe + (i * slotSize);
      const slotEnd = slotStart + slotSize;
      const slotMetrics = recentMetrics.filter(m => m.timestamp >= slotStart && m.timestamp < slotEnd);
      
      return {
        timestamp: slotStart,
        successRate: slotMetrics.length > 0 
          ? (slotMetrics.filter(m => m.success).length / slotMetrics.length) * 100
          : 0,
        responseTime: slotMetrics.length > 0
          ? slotMetrics.reduce((sum, m) => sum + m.responseTime, 0) / slotMetrics.length
          : 0,
        accuracy: slotMetrics.filter(m => m.voiceAccuracy !== undefined).length > 0
          ? slotMetrics.reduce((sum, m) => sum + (m.voiceAccuracy || 0), 0) / slotMetrics.length
          : 0
      };
    });
    
    const commonFailures = Array.from(failureMap.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Calculate top suggestions
    const suggestionMap = new Map<string, number>();
    recentMetrics.forEach(m => {
      if (m.suggestionAccepted) {
        const count = suggestionMap.get(m.command) || 0;
        suggestionMap.set(m.command, count + 1);
      }
    });

    const topSuggestions = Array.from(suggestionMap.entries())
      .map(([command, useCount]) => ({ command, useCount }))
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 5);

    const averageConfidenceScore = recentMetrics.reduce((sum, m) => sum + m.confidence, 0) / totalCommands;

    return {
      totalCommands,
      successRate: (successfulCommands.length / totalCommands) * 100,
      averageResponseTime: recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalCommands,
      commonFailures,
      offlineUsage: recentMetrics.filter(m => m.offline).length,
      voiceRecognitionAccuracy: voiceAccuracy,
      commandTypeBreakdown: typeBreakdown,
      predictiveMetrics: {
        suggestionAcceptanceRate,
        averageConfidenceScore,
        topSuggestions
      },
      performanceOverTime
    };
  }
  
  public getCommandSuggestions(partialCommand: string): string[] {
    // Find similar successful commands from history
    return this.metrics
      .filter(m => m.success && m.command.toLowerCase().includes(partialCommand.toLowerCase()))
      .sort((a, b) => b.confidence - a.confidence)
      .map(m => m.command)
      .slice(0, 5);
  }
  
  private persistMetrics(): void {
    try {
      localStorage.setItem('lark_command_metrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.error('Failed to persist command metrics:', error);
    }
  }
  
  public loadPersistedMetrics(): void {
    try {
      const stored = localStorage.getItem('lark_command_metrics');
      if (stored) {
        this.metrics = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load persisted command metrics:', error);
    }
  }
}

export const commandAnalytics = CommandAnalytics.getInstance();
