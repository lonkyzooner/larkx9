/**
 * Hardware integration for DFRobot UniHiker M10
 * 
 * This module provides an interface for interacting with the UniHiker M10 hardware
 * mentioned in the project memory, including the 2.8-inch touchscreen, microphone,
 * and USB speaker.
 */

// Hardware status
interface HardwareStatus {
  batteryLevel: number;
  microphoneConnected: boolean;
  speakerConnected: boolean;
  screenBrightness: number;
  temperature: number;
  isCharging: boolean;
}

// Default status for browser environments
const defaultStatus: HardwareStatus = {
  batteryLevel: 85,
  microphoneConnected: true,
  speakerConnected: true,
  screenBrightness: 80,
  temperature: 25,
  isCharging: false
};

// Current hardware status
let currentStatus: HardwareStatus = { ...defaultStatus };

// Event listeners
const listeners: { [key: string]: Function[] } = {
  batteryChange: [],
  deviceConnect: [],
  deviceDisconnect: [],
  temperatureChange: []
};

/**
 * Initialize hardware integration
 */
export async function initializeHardware(): Promise<boolean> {
  try {
    // In a browser environment, simulate hardware initialization
    if (typeof window !== 'undefined') {
      console.log('Initializing UniHiker M10 hardware in simulation mode');
      
      // Simulate battery level changes
      setInterval(() => {
        if (!currentStatus.isCharging) {
          // Decrease battery level
          const newLevel = Math.max(0, currentStatus.batteryLevel - 1);
          updateBatteryLevel(newLevel);
          
          // Simulate charging when battery gets low
          if (newLevel < 20) {
            updateChargingStatus(true);
          }
        } else {
          // Increase battery level when charging
          const newLevel = Math.min(100, currentStatus.batteryLevel + 2);
          updateBatteryLevel(newLevel);
          
          // Stop charging when full
          if (newLevel >= 100) {
            updateChargingStatus(false);
          }
        }
      }, 60000); // Update every minute
      
      // Simulate temperature changes
      setInterval(() => {
        const tempChange = (Math.random() - 0.5) * 2; // -1 to +1
        updateTemperature(currentStatus.temperature + tempChange);
      }, 120000); // Update every 2 minutes
      
      // Try to access actual battery API if available
      // Define BatteryManager interface
      interface BatteryManager extends EventTarget {
        charging: boolean;
        chargingTime: number;
        dischargingTime: number;
        level: number;
        addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
      }
      
      // Extend Navigator interface
      interface NavigatorWithBattery extends Navigator {
        getBattery?: () => Promise<BatteryManager>;
      }
      
      const nav = navigator as NavigatorWithBattery;
      
      if (nav.getBattery) {
        try {
          const battery = await nav.getBattery();
          updateBatteryLevel(Math.round(battery.level * 100));
          updateChargingStatus(battery.charging);
          
          battery.addEventListener('levelchange', () => {
            updateBatteryLevel(Math.round(battery.level * 100));
          });
          
          battery.addEventListener('chargingchange', () => {
            updateChargingStatus(battery.charging);
          });
        } catch (error) {
          console.warn('Could not access battery API:', error);
        }
      }
      
      return true;
    }
    
    // In a real UniHiker M10 environment, we would initialize hardware here
    // This would involve native code that interacts with the hardware
    console.log('UniHiker M10 hardware not detected, running in simulation mode');
    return false;
  } catch (error) {
    console.error('Error initializing hardware:', error);
    return false;
  }
}

/**
 * Update battery level
 */
function updateBatteryLevel(level: number): void {
  const oldLevel = currentStatus.batteryLevel;
  currentStatus.batteryLevel = level;
  
  // Notify listeners if significant change
  if (Math.abs(oldLevel - level) >= 5) {
    notifyListeners('batteryChange', { level });
  }
}

/**
 * Update charging status
 */
function updateChargingStatus(isCharging: boolean): void {
  currentStatus.isCharging = isCharging;
  notifyListeners('batteryChange', { level: currentStatus.batteryLevel, isCharging });
}

/**
 * Update temperature
 */
function updateTemperature(temperature: number): void {
  currentStatus.temperature = temperature;
  notifyListeners('temperatureChange', { temperature });
}

/**
 * Notify event listeners
 */
function notifyListeners(event: string, data: any): void {
  if (listeners[event]) {
    listeners[event].forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }
}

/**
 * Get current hardware status
 */
export function getHardwareStatus(): HardwareStatus {
  return { ...currentStatus };
}

/**
 * Set screen brightness (0-100)
 */
export function setScreenBrightness(brightness: number): boolean {
  try {
    const validBrightness = Math.max(0, Math.min(100, brightness));
    currentStatus.screenBrightness = validBrightness;
    
    // In a real implementation, we would set the actual screen brightness here
    console.log(`Setting screen brightness to ${validBrightness}%`);
    return true;
  } catch (error) {
    console.error('Error setting screen brightness:', error);
    return false;
  }
}

/**
 * Check if microphone is available
 */
export async function checkMicrophone(): Promise<boolean> {
  try {
    // Try to access the microphone
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop all tracks to release the microphone
      stream.getTracks().forEach(track => track.stop());
      
      currentStatus.microphoneConnected = true;
      return true;
    }
    
    currentStatus.microphoneConnected = false;
    return false;
  } catch (error) {
    console.error('Microphone not available:', error);
    currentStatus.microphoneConnected = false;
    return false;
  }
}

/**
 * Check if speaker is available
 */
export async function checkSpeaker(): Promise<boolean> {
  try {
    // Create a test audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a test oscillator
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Set very low volume
    gainNode.gain.value = 0.01;
    
    // Connect oscillator to gain node and gain node to destination
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Start and immediately stop the oscillator
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.001);
    
    // Close the audio context
    setTimeout(() => {
      audioContext.close();
    }, 100);
    
    currentStatus.speakerConnected = true;
    return true;
  } catch (error) {
    console.error('Speaker test failed:', error);
    currentStatus.speakerConnected = false;
    return false;
  }
}

/**
 * Add event listener
 */
export function addEventListener(event: string, callback: Function): void {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  
  listeners[event].push(callback);
}

/**
 * Remove event listener
 */
export function removeEventListener(event: string, callback: Function): void {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter(listener => listener !== callback);
  }
}

/**
 * Enter low power mode
 */
export function enterLowPowerMode(): boolean {
  try {
    // Reduce screen brightness
    setScreenBrightness(20);
    
    // In a real implementation, we would reduce CPU frequency, disable non-essential services, etc.
    console.log('Entering low power mode');
    return true;
  } catch (error) {
    console.error('Error entering low power mode:', error);
    return false;
  }
}

/**
 * Exit low power mode
 */
export function exitLowPowerMode(): boolean {
  try {
    // Restore screen brightness
    setScreenBrightness(80);
    
    // In a real implementation, we would restore CPU frequency, enable services, etc.
    console.log('Exiting low power mode');
    return true;
  } catch (error) {
    console.error('Error exiting low power mode:', error);
    return false;
  }
}
