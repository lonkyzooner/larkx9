/**
 * Battery Optimization Service
 * 
 * This service helps optimize battery usage for the LARK application,
 * particularly important for the UniHiker M10 hardware deployment.
 */

export interface BatteryStatus {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  lowPowerMode: boolean;
}

export interface PowerMode {
  name: 'ultra-low' | 'low' | 'balanced' | 'performance';
  maxApiCallsPerMinute: number;
  disableBackgroundTasks: boolean;
  disableAnimation: boolean;
  reducedPollingInterval: boolean;
  screenBrightness: number; // 0-1
  audioVolume: number; // 0-1
}

class BatteryOptimizationService {
  private batteryStatus: BatteryStatus = {
    level: 1,
    charging: false,
    chargingTime: 0,
    dischargingTime: 0,
    lowPowerMode: false
  };

  private currentPowerMode: PowerMode = {
    name: 'balanced',
    maxApiCallsPerMinute: 20,
    disableBackgroundTasks: false,
    disableAnimation: false,
    reducedPollingInterval: false,
    screenBrightness: 0.8,
    audioVolume: 0.8
  };

  private apiCallCounter = 0;
  private apiCallResetInterval: NodeJS.Timeout | null = null;
  private batteryUpdateInterval: NodeJS.Timeout | null = null;
  private listeners: Array<(status: BatteryStatus, mode: PowerMode) => void> = [];

  /**
   * Initialize the battery optimization service
   */
  public async initialize(): Promise<boolean> {
    try {
      // Set up battery monitoring if available
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        this.updateBatteryStatus(battery);

        // Listen for battery status changes
        battery.addEventListener('levelchange', () => this.updateBatteryStatus(battery));
        battery.addEventListener('chargingchange', () => this.updateBatteryStatus(battery));
        battery.addEventListener('chargingtimechange', () => this.updateBatteryStatus(battery));
        battery.addEventListener('dischargingtimechange', () => this.updateBatteryStatus(battery));
      } else {
        console.warn('[BatteryOptimization] Battery API not supported');
      }

      // Set up API call rate limiting
      this.apiCallResetInterval = setInterval(() => {
        this.apiCallCounter = 0;
      }, 60000); // Reset counter every minute

      // Set up periodic battery status checks
      this.batteryUpdateInterval = setInterval(() => {
        this.checkBatteryStatus();
      }, 30000); // Check every 30 seconds

      return true;
    } catch (error) {
      console.error('[BatteryOptimization] Error initializing:', error);
      return false;
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.apiCallResetInterval) {
      clearInterval(this.apiCallResetInterval);
      this.apiCallResetInterval = null;
    }

    if (this.batteryUpdateInterval) {
      clearInterval(this.batteryUpdateInterval);
      this.batteryUpdateInterval = null;
    }

    this.listeners = [];
  }

  /**
   * Update battery status from Battery API
   */
  private updateBatteryStatus(battery: any): void {
    this.batteryStatus = {
      level: battery.level,
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
      lowPowerMode: this.batteryStatus.lowPowerMode // Preserve existing value
    };

    // Update power mode based on new battery status
    this.updatePowerMode();

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Check battery status and update power mode if needed
   */
  private checkBatteryStatus(): void {
    // Check for low power mode
    // This is a simplified check - in a real implementation,
    // you would use platform-specific APIs to detect low power mode
    if (this.batteryStatus.level <= 0.2 && !this.batteryStatus.charging) {
      this.batteryStatus.lowPowerMode = true;
    } else if (this.batteryStatus.level >= 0.3 || this.batteryStatus.charging) {
      this.batteryStatus.lowPowerMode = false;
    }

    // Update power mode
    this.updatePowerMode();
  }

  /**
   * Update power mode based on battery status
   */
  private updatePowerMode(): void {
    let newMode: PowerMode['name'];

    // Determine power mode based on battery status
    if (this.batteryStatus.lowPowerMode || this.batteryStatus.level <= 0.1) {
      newMode = 'ultra-low';
    } else if (this.batteryStatus.level <= 0.2) {
      newMode = 'low';
    } else if (this.batteryStatus.level <= 0.5 && !this.batteryStatus.charging) {
      newMode = 'balanced';
    } else {
      newMode = 'performance';
    }

    // Only update if the mode has changed
    if (newMode !== this.currentPowerMode.name) {
      this.setActivePowerMode(newMode);
    }
  }

  /**
   * Set the active power mode
   */
  public setActivePowerMode(mode: PowerMode['name']): void {
    switch (mode) {
      case 'ultra-low':
        this.currentPowerMode = {
          name: 'ultra-low',
          maxApiCallsPerMinute: 5,
          disableBackgroundTasks: true,
          disableAnimation: true,
          reducedPollingInterval: true,
          screenBrightness: 0.4,
          audioVolume: 0.6
        };
        break;

      case 'low':
        this.currentPowerMode = {
          name: 'low',
          maxApiCallsPerMinute: 10,
          disableBackgroundTasks: true,
          disableAnimation: true,
          reducedPollingInterval: false,
          screenBrightness: 0.6,
          audioVolume: 0.7
        };
        break;

      case 'balanced':
        this.currentPowerMode = {
          name: 'balanced',
          maxApiCallsPerMinute: 20,
          disableBackgroundTasks: false,
          disableAnimation: false,
          reducedPollingInterval: false,
          screenBrightness: 0.8,
          audioVolume: 0.8
        };
        break;

      case 'performance':
        this.currentPowerMode = {
          name: 'performance',
          maxApiCallsPerMinute: 30,
          disableBackgroundTasks: false,
          disableAnimation: false,
          reducedPollingInterval: false,
          screenBrightness: 1.0,
          audioVolume: 1.0
        };
        break;
    }

    console.log(`[BatteryOptimization] Power mode set to: ${mode}`);
    
    // Apply power mode settings
    this.applyPowerModeSettings();
    
    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Apply current power mode settings
   */
  private applyPowerModeSettings(): void {
    // Apply screen brightness (if supported)
    this.setScreenBrightness(this.currentPowerMode.screenBrightness);
    
    // Apply audio volume
    this.setAudioVolume(this.currentPowerMode.audioVolume);
    
    // Apply CSS classes for animations
    if (this.currentPowerMode.disableAnimation) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }

  /**
   * Set screen brightness (if supported)
   */
  private setScreenBrightness(brightness: number): void {
    // This is a simplified implementation
    // In a real implementation, you would use platform-specific APIs
    try {
      // For UniHiker M10, you might use a custom API or WebUSB
      console.log(`[BatteryOptimization] Setting screen brightness to: ${brightness}`);
    } catch (error) {
      console.warn('[BatteryOptimization] Failed to set screen brightness:', error);
    }
  }

  /**
   * Set audio volume
   */
  private setAudioVolume(volume: number): void {
    try {
      // Set volume for all audio elements
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        audio.volume = volume;
      });
      
      console.log(`[BatteryOptimization] Setting audio volume to: ${volume}`);
    } catch (error) {
      console.warn('[BatteryOptimization] Failed to set audio volume:', error);
    }
  }

  /**
   * Check if an API call is allowed based on current rate limits
   */
  public canMakeApiCall(priority: 'high' | 'medium' | 'low' = 'medium'): boolean {
    // Always allow high priority calls
    if (priority === 'high') {
      this.apiCallCounter++;
      return true;
    }

    // Check if we've reached the limit
    if (this.apiCallCounter >= this.currentPowerMode.maxApiCallsPerMinute) {
      return false;
    }

    // For low priority calls in ultra-low power mode, be more restrictive
    if (priority === 'low' && this.currentPowerMode.name === 'ultra-low') {
      return false;
    }

    // Increment counter and allow the call
    this.apiCallCounter++;
    return true;
  }

  /**
   * Get current battery status
   */
  public getBatteryStatus(): BatteryStatus {
    return { ...this.batteryStatus };
  }

  /**
   * Get current power mode
   */
  public getCurrentPowerMode(): PowerMode {
    return { ...this.currentPowerMode };
  }

  /**
   * Add a listener for battery status and power mode changes
   */
  public addListener(callback: (status: BatteryStatus, mode: PowerMode) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove a listener
   */
  public removeListener(callback: (status: BatteryStatus, mode: PowerMode) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getBatteryStatus(), this.getCurrentPowerMode());
      } catch (error) {
        console.error('[BatteryOptimization] Error in listener:', error);
      }
    });
  }
}

// Export a singleton instance
export const batteryOptimizationService = new BatteryOptimizationService();
