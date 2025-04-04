import { commandAnalytics } from './command-analytics';
import { commandContext } from './command-context';

interface CommandPrediction {
  command: string;
  confidence: number;
  context: string;
}

class CommandPredictor {
  private static instance: CommandPredictor;
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly CONTEXT_WEIGHT = 0.3;
  private readonly HISTORY_WEIGHT = 0.7;
  
  private constructor() {}
  
  public static getInstance(): CommandPredictor {
    if (!CommandPredictor.instance) {
      CommandPredictor.instance = new CommandPredictor();
    }
    return CommandPredictor.instance;
  }
  
  public predictNextCommand(): CommandPrediction[] {
    const predictions: CommandPrediction[] = [];
    
    // Get context-based predictions
    const contextPredictions = this.getContextBasedPredictions();
    predictions.push(...contextPredictions);
    
    // Get history-based predictions
    const stats = commandAnalytics.getStats();
    if (stats.totalCommands > 0) {
      const historicalPredictions = this.getHistoricalPredictions();
      predictions.push(...historicalPredictions);
    }
    
    // Combine and sort predictions by confidence
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .filter(p => p.confidence >= this.CONFIDENCE_THRESHOLD)
      .slice(0, 3);
  }
  
  private getContextBasedPredictions(): CommandPrediction[] {
    const predictions: CommandPrediction[] = [];
    const context = commandContext.getFullContext();
    
    // If we recently did a threat assessment, suggest follow-up
    if (commandContext.isRecentThreatAssessment()) {
      const lastAssessment = commandContext.getLastThreatAssessment();
      if (lastAssessment?.location) {
        predictions.push({
          command: `Update threat assessment for ${lastAssessment.location}`,
          confidence: 0.85,
          context: 'Recent threat assessment'
        });
      }
    }
    
    // If we have a language preference set, use it for suggestions
    const language = commandContext.getLanguagePreference();
    if (language && language !== 'english') {
      predictions.push({
        command: `Read Miranda rights in ${language}`,
        confidence: 0.75,
        context: 'Language preference'
      });
    }
    
    // If we have a recent statute lookup, suggest related statutes
    const lastStatute = commandContext.getLastStatute();
    if (lastStatute) {
      // For example, if looking up assault statute, suggest battery
      const relatedStatutes = this.getRelatedStatutes(lastStatute);
      if (relatedStatutes.length > 0) {
        predictions.push({
          command: `Look up statute ${relatedStatutes[0]}`,
          confidence: 0.7,
          context: 'Related statute'
        });
      }
    }
    
    return predictions;
  }
  
  private getHistoricalPredictions(): CommandPrediction[] {
    const predictions: CommandPrediction[] = [];
    const stats = commandAnalytics.getStats(24 * 60 * 60 * 1000); // Last 24 hours
    
    // If certain commands are frequently used together, suggest the next one
    if (stats.totalCommands > 0) {
      const commonPatterns = this.analyzeCommandPatterns();
      if (commonPatterns.length > 0) {
        predictions.push({
          command: commonPatterns[0],
          confidence: 0.8,
          context: 'Common pattern'
        });
      }
    }
    
    return predictions;
  }
  
  private getRelatedStatutes(statute: string): string[] {
    // Map of related statutes
    const relatedStatutesMap: Record<string, string[]> = {
      '14:30': ['14:31', '14:34'], // Murder -> Manslaughter, Battery
      '14:34': ['14:34.1', '14:35'], // Battery -> Aggravated Battery, Simple Battery
      '14:35': ['14:34', '14:36'], // Simple Battery -> Battery, Assault
      '14:37': ['14:37.1', '14:37.2'], // Aggravated Assault -> Assault by Drive-by Shooting
      '14:95': ['14:95.1', '14:95.2'], // Illegal Carrying of Weapons
      '14:402': ['14:402.1'] // Contraband
    };
    
    return relatedStatutesMap[statute] || [];
  }
  
  private analyzeCommandPatterns(): string[] {
    // This would analyze command history to find common sequences
    // For now, return an empty array as placeholder
    return [];
  }
}

export const commandPredictor = CommandPredictor.getInstance();
