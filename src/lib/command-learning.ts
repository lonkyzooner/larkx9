interface CommandCorrection {
  originalCommand: string;
  correctedCommand: string;
  timestamp: number;
}

interface CommandPattern {
  pattern: string;
  replacements: string[];
  confidence: number;
}

class CommandLearningSystem {
  private static instance: CommandLearningSystem;
  private corrections: CommandCorrection[] = [];
  private patterns: CommandPattern[] = [];
  private readonly MAX_CORRECTIONS = 500;
  
  private constructor() {
    this.loadPersistedData();
  }
  
  public static getInstance(): CommandLearningSystem {
    if (!CommandLearningSystem.instance) {
      CommandLearningSystem.instance = new CommandLearningSystem();
    }
    return CommandLearningSystem.instance;
  }
  
  public addCorrection(originalCommand: string, correctedCommand: string): void {
    this.corrections.push({
      originalCommand,
      correctedCommand,
      timestamp: Date.now()
    });
    
    // Keep only recent corrections
    if (this.corrections.length > this.MAX_CORRECTIONS) {
      this.corrections = this.corrections.slice(-this.MAX_CORRECTIONS);
    }
    
    // Learn from this correction
    this.learnPattern(originalCommand, correctedCommand);
    this.persistData();
  }
  
  private learnPattern(original: string, corrected: string): void {
    // Find common words between original and corrected
    const originalWords = original.toLowerCase().split(' ');
    const correctedWords = corrected.toLowerCase().split(' ');
    
    // Create pattern by replacing different words with wildcards
    let pattern = original.toLowerCase();
    let replacements: string[] = [];
    
    originalWords.forEach((word, index) => {
      if (index < correctedWords.length && word !== correctedWords[index]) {
        pattern = pattern.replace(word, '*');
        replacements.push(`${word}:${correctedWords[index]}`);
      }
    });
    
    // Update or add pattern
    const existingPattern = this.patterns.find(p => p.pattern === pattern);
    if (existingPattern) {
      existingPattern.confidence += 0.1;
      existingPattern.replacements = [...new Set([...existingPattern.replacements, ...replacements])];
    } else {
      this.patterns.push({
        pattern,
        replacements,
        confidence: 0.5
      });
    }
  }
  
  public suggestCorrection(command: string): string | null {
    const commandLower = command.toLowerCase();
    
    // Find matching patterns
    const matchingPatterns = this.patterns
      .filter(p => this.matchesPattern(commandLower, p.pattern))
      .sort((a, b) => b.confidence - a.confidence);
    
    if (matchingPatterns.length > 0) {
      const bestPattern = matchingPatterns[0];
      let corrected = commandLower;
      
      // Apply replacements
      bestPattern.replacements.forEach(replacement => {
        const [from, to] = replacement.split(':');
        corrected = corrected.replace(from, to);
      });
      
      return corrected;
    }
    
    return null;
  }
  
  private matchesPattern(command: string, pattern: string): boolean {
    const commandParts = command.split(' ');
    const patternParts = pattern.split(' ');
    
    if (commandParts.length !== patternParts.length) return false;
    
    return patternParts.every((part, index) => 
      part === '*' || part === commandParts[index]
    );
  }
  
  private persistData(): void {
    try {
      localStorage.setItem('lark_command_corrections', JSON.stringify({
        corrections: this.corrections,
        patterns: this.patterns
      }));
    } catch (error) {
      console.error('Failed to persist command learning data:', error);
    }
  }
  
  private loadPersistedData(): void {
    try {
      const stored = localStorage.getItem('lark_command_corrections');
      if (stored) {
        const data = JSON.parse(stored);
        this.corrections = data.corrections || [];
        this.patterns = data.patterns || [];
      }
    } catch (error) {
      console.error('Failed to load persisted command learning data:', error);
    }
  }
  
  public getStats(): {
    totalCorrections: number;
    commonPatterns: CommandPattern[];
    learningProgress: number;
  } {
    return {
      totalCorrections: this.corrections.length,
      commonPatterns: this.patterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5),
      learningProgress: Math.min(
        (this.patterns.length / 100) * 100,
        100
      )
    };
  }
}

export const commandLearning = CommandLearningSystem.getInstance();
