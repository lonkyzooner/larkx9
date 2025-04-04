import { useState, useEffect, useCallback } from 'react';

export interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  screenReader: boolean;
  textToSpeech: boolean;
  voiceControl: boolean;
  autoTranslate: boolean;
  simplifiedUI: boolean;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  largeText: false,
  reduceMotion: false,
  screenReader: false,
  textToSpeech: true, // Enable by default for LARK
  voiceControl: true, // Enable by default for LARK
  autoTranslate: false,
  simplifiedUI: false
};

/**
 * Custom hook for managing accessibility settings
 * 
 * @returns Accessibility utilities and settings
 */
export function useAccessibility() {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load settings from localStorage or use defaults
    try {
      const savedSettings = localStorage.getItem('lark_accessibility_settings');
      return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
    } catch (error) {
      console.error('[Accessibility] Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  });

  // Apply accessibility settings to the document
  useEffect(() => {
    // Apply high contrast
    if (settings.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    // Apply large text
    if (settings.largeText) {
      document.documentElement.classList.add('large-text');
    } else {
      document.documentElement.classList.remove('large-text');
    }

    // Apply reduced motion
    if (settings.reduceMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }

    // Apply simplified UI
    if (settings.simplifiedUI) {
      document.documentElement.classList.add('simplified-ui');
    } else {
      document.documentElement.classList.remove('simplified-ui');
    }

    // Save settings to localStorage
    try {
      localStorage.setItem('lark_accessibility_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('[Accessibility] Error saving settings:', error);
    }
  }, [settings]);

  // Check for system preferences on mount
  useEffect(() => {
    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) {
      updateSetting('reduceMotion', true);
    }

    // Check for prefers-contrast
    const prefersContrast = window.matchMedia('(prefers-contrast: more)');
    if (prefersContrast.matches) {
      updateSetting('highContrast', true);
    }

    // Listen for changes to system preferences
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      updateSetting('reduceMotion', e.matches);
    };

    const handleContrastChange = (e: MediaQueryListEvent) => {
      updateSetting('highContrast', e.matches);
    };

    prefersReducedMotion.addEventListener('change', handleReducedMotionChange);
    prefersContrast.addEventListener('change', handleContrastChange);

    return () => {
      prefersReducedMotion.removeEventListener('change', handleReducedMotionChange);
      prefersContrast.removeEventListener('change', handleContrastChange);
    };
  }, []);

  /**
   * Update a single accessibility setting
   */
  const updateSetting = useCallback((key: keyof AccessibilitySettings, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  /**
   * Reset all settings to defaults
   */
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  /**
   * Check if the device has a screen reader active
   */
  const detectScreenReader = useCallback(() => {
    // This is a basic detection that may not work for all screen readers
    const hasScreenReader = 
      window.navigator.userAgent.includes('JAWS') || 
      window.navigator.userAgent.includes('NVDA') ||
      window.navigator.userAgent.includes('VoiceOver');
    
    if (hasScreenReader) {
      updateSetting('screenReader', true);
    }
  }, [updateSetting]);

  // Run screen reader detection once on mount
  useEffect(() => {
    detectScreenReader();
  }, [detectScreenReader]);

  /**
   * Announce a message to screen readers
   */
  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Create or get the announcement element
    let announcer = document.getElementById('screen-reader-announcer');
    
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'screen-reader-announcer';
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      announcer.className = 'sr-only';
      document.body.appendChild(announcer);
    }
    
    // Set the message
    announcer.textContent = '';
    
    // Use setTimeout to ensure the DOM update is recognized by screen readers
    setTimeout(() => {
      if (announcer) {
        announcer.textContent = message;
      }
    }, 50);
  }, []);

  return {
    settings,
    updateSetting,
    resetSettings,
    announceToScreenReader
  };
}
