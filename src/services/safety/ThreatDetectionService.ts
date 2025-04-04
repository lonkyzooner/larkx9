/**
 * Threat Detection Service
 * 
 * This service provides audio-based threat detection capabilities
 * for the LARK (Law Enforcement Assistance and Response Kit) application.
 */

import { batteryOptimizationService } from '../system/BatteryOptimizationService';

export interface ThreatDetectionResult {
  threatDetected: boolean;
  confidenceScore: number;
  threatType?: string;
  audioSignature?: string;
  timestamp: number;
  location?: GeolocationCoordinates;
}

export interface ThreatDetectionOptions {
  sensitivity: 'low' | 'medium' | 'high';
  continuousMonitoring: boolean;
  notificationThreshold: number; // 0-1
  includeAudioSignature: boolean;
  includeLocation: boolean;
}

class ThreatDetectionService {
  private isInitialized = false;
  private isMonitoring = false;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private detectionHistory: ThreatDetectionResult[] = [];
  private listeners: Array<(result: ThreatDetectionResult) => void> = [];
  
  private options: ThreatDetectionOptions = {
    sensitivity: 'medium',
    continuousMonitoring: false,
    notificationThreshold: 0.7,
    includeAudioSignature: false,
    includeLocation: true
  };

  // Sound signatures for different threat types
  private threatSignatures = [
    { type: 'gunshot', patterns: [/* frequency patterns for gunshots */] },
    { type: 'breaking_glass', patterns: [/* frequency patterns for breaking glass */] },
    { type: 'scream', patterns: [/* frequency patterns for screams */] },
    { type: 'aggressive_voice', patterns: [/* frequency patterns for aggressive voices */] }
  ];

  /**
   * Initialize the threat detection service
   */
  public async initialize(options?: Partial<ThreatDetectionOptions>): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Update options if provided
      if (options) {
        this.options = { ...this.options, ...options };
      }

      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      console.log('[ThreatDetection] Service initialized');
      this.isInitialized = true;
      
      // Start continuous monitoring if enabled
      if (this.options.continuousMonitoring) {
        await this.startMonitoring();
      }
      
      return true;
    } catch (error) {
      console.error('[ThreatDetection] Initialization error:', error);
      return false;
    }
  }

  /**
   * Start audio monitoring for threats
   */
  public async startMonitoring(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isMonitoring) {
      return true;
    }

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Set up audio analysis
      if (this.audioContext && this.mediaStream) {
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.audioAnalyser = this.audioContext.createAnalyser();
        this.audioAnalyser.fftSize = 2048;
        source.connect(this.audioAnalyser);
        
        // Start monitoring interval
        const bufferLength = this.audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // Determine monitoring interval based on battery optimization
        const powerMode = batteryOptimizationService.getCurrentPowerMode();
        const intervalTime = powerMode.reducedPollingInterval ? 1000 : 500; // ms
        
        this.monitoringInterval = setInterval(() => {
          if (this.audioAnalyser) {
            this.audioAnalyser.getByteFrequencyData(dataArray);
            this.analyzeAudioData(dataArray);
          }
        }, intervalTime);
        
        this.isMonitoring = true;
        console.log('[ThreatDetection] Monitoring started');
        return true;
      }
      
      throw new Error('AudioContext or MediaStream not available');
    } catch (error) {
      console.error('[ThreatDetection] Error starting monitoring:', error);
      return false;
    }
  }

  /**
   * Stop audio monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.isMonitoring = false;
    console.log('[ThreatDetection] Monitoring stopped');
  }

  /**
   * Analyze audio data for potential threats
   */
  private analyzeAudioData(dataArray: Uint8Array): void {
    // Skip analysis if battery optimization restricts it
    if (!batteryOptimizationService.canMakeApiCall('medium')) {
      return;
    }
    
    // Calculate average volume level
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    
    // Detect sudden loud noises (simplified detection)
    const loudnessThreshold = this.getSensitivityThreshold();
    const isSuddenLoudNoise = average > loudnessThreshold;
    
    if (isSuddenLoudNoise) {
      // Perform more detailed analysis to determine threat type
      const threatType = this.identifyThreatType(dataArray);
      
      if (threatType) {
        // Create threat detection result
        this.createThreatDetection(threatType, average / 255, dataArray);
      }
    }
  }

  /**
   * Get sensitivity threshold based on current settings
   */
  private getSensitivityThreshold(): number {
    switch (this.options.sensitivity) {
      case 'low': return 200; // Higher threshold, less sensitive
      case 'high': return 150; // Lower threshold, more sensitive
      case 'medium':
      default: return 175;
    }
  }

  /**
   * Identify the type of threat based on audio signature
   */
  private identifyThreatType(dataArray: Uint8Array): string | null {
    // This is a simplified implementation
    // In a real implementation, you would use more sophisticated
    // audio analysis and machine learning techniques
    
    // Example: Check for gunshot signature (simplified)
    const hasHighFrequencySpike = this.checkForHighFrequencySpike(dataArray);
    if (hasHighFrequencySpike) {
      return 'gunshot';
    }
    
    // Example: Check for scream signature (simplified)
    const hasMidFrequencySustained = this.checkForMidFrequencySustained(dataArray);
    if (hasMidFrequencySustained) {
      return 'scream';
    }
    
    // Example: Check for breaking glass signature (simplified)
    const hasHighMidFrequencyPattern = this.checkForHighMidFrequencyPattern(dataArray);
    if (hasHighMidFrequencyPattern) {
      return 'breaking_glass';
    }
    
    // No recognized threat pattern
    return null;
  }

  /**
   * Check for high frequency spike (potential gunshot)
   */
  private checkForHighFrequencySpike(dataArray: Uint8Array): boolean {
    // Simplified check for high frequency components
    const highFreqStart = Math.floor(dataArray.length * 0.7);
    const highFreqEnd = dataArray.length;
    
    let highFreqAvg = 0;
    for (let i = highFreqStart; i < highFreqEnd; i++) {
      highFreqAvg += dataArray[i];
    }
    highFreqAvg /= (highFreqEnd - highFreqStart);
    
    return highFreqAvg > 200;
  }

  /**
   * Check for sustained mid-frequency (potential scream)
   */
  private checkForMidFrequencySustained(dataArray: Uint8Array): boolean {
    // Simplified check for mid frequency components
    const midFreqStart = Math.floor(dataArray.length * 0.3);
    const midFreqEnd = Math.floor(dataArray.length * 0.7);
    
    let midFreqAvg = 0;
    for (let i = midFreqStart; i < midFreqEnd; i++) {
      midFreqAvg += dataArray[i];
    }
    midFreqAvg /= (midFreqEnd - midFreqStart);
    
    return midFreqAvg > 180;
  }

  /**
   * Check for high-mid frequency pattern (potential breaking glass)
   */
  private checkForHighMidFrequencyPattern(dataArray: Uint8Array): boolean {
    // Simplified check for high-mid frequency components
    const highMidFreqStart = Math.floor(dataArray.length * 0.5);
    const highMidFreqEnd = Math.floor(dataArray.length * 0.9);
    
    let highMidFreqAvg = 0;
    for (let i = highMidFreqStart; i < highMidFreqEnd; i++) {
      highMidFreqAvg += dataArray[i];
    }
    highMidFreqAvg /= (highMidFreqEnd - highMidFreqStart);
    
    return highMidFreqAvg > 190;
  }

  /**
   * Create a threat detection result and notify listeners
   */
  private async createThreatDetection(
    threatType: string, 
    confidenceScore: number, 
    dataArray: Uint8Array
  ): Promise<void> {
    // Only proceed if confidence is above threshold
    if (confidenceScore < this.options.notificationThreshold) {
      return;
    }
    
    // Create result object
    const result: ThreatDetectionResult = {
      threatDetected: true,
      confidenceScore,
      threatType,
      timestamp: Date.now()
    };
    
    // Include audio signature if enabled
    if (this.options.includeAudioSignature) {
      result.audioSignature = this.createAudioSignature(dataArray);
    }
    
    // Include location if enabled
    if (this.options.includeLocation) {
      try {
        const position = await this.getCurrentPosition();
        result.location = position.coords;
      } catch (error) {
        console.warn('[ThreatDetection] Could not get location:', error);
      }
    }
    
    // Add to history
    this.detectionHistory.push(result);
    
    // Limit history size
    if (this.detectionHistory.length > 20) {
      this.detectionHistory.shift();
    }
    
    // Notify listeners
    this.notifyListeners(result);
    
    console.warn(`[ThreatDetection] Threat detected: ${threatType} (${Math.round(confidenceScore * 100)}% confidence)`);
  }

  /**
   * Create an audio signature from frequency data
   */
  private createAudioSignature(dataArray: Uint8Array): string {
    // Simplified implementation - create a compressed representation
    // of the frequency data as a base64 string
    const compressed = new Uint8Array(32);
    const step = Math.floor(dataArray.length / 32);
    
    for (let i = 0; i < 32; i++) {
      compressed[i] = dataArray[i * step];
    }
    
    return btoa(String.fromCharCode.apply(null, Array.from(compressed)));
  }

  /**
   * Get current position
   */
  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
    });
  }

  /**
   * Get detection history
   */
  public getDetectionHistory(): ThreatDetectionResult[] {
    return [...this.detectionHistory];
  }

  /**
   * Clear detection history
   */
  public clearDetectionHistory(): void {
    this.detectionHistory = [];
  }

  /**
   * Add a listener for threat detections
   */
  public addListener(callback: (result: ThreatDetectionResult) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove a listener
   */
  public removeListener(callback: (result: ThreatDetectionResult) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all listeners of a threat detection
   */
  private notifyListeners(result: ThreatDetectionResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('[ThreatDetection] Error in listener:', error);
      }
    });
  }

  /**
   * Update detection options
   */
  public updateOptions(options: Partial<ThreatDetectionOptions>): void {
    this.options = { ...this.options, ...options };
    console.log('[ThreatDetection] Options updated:', this.options);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stopMonitoring();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.listeners = [];
    this.isInitialized = false;
  }
}

// Export a singleton instance
export const threatDetectionService = new ThreatDetectionService();
