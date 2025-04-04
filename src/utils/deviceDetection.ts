/**
 * Device detection utilities for LARK application
 */

export interface DeviceInfo {
  screenWidth: number;
  screenHeight: number;
  isSmallScreen: boolean;
  isTouch: boolean;
  isMobile: boolean;
  userAgent: string;
}

/**
 * Gets detailed device information
 */
export function getDeviceInfo(): DeviceInfo {
  const screenWidth = window.innerWidth || document.documentElement.clientWidth;
  const screenHeight = window.innerHeight || document.documentElement.clientHeight;
  
  return {
    screenWidth,
    screenHeight,
    isSmallScreen: screenWidth < 768,
    isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    isMobile: /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()),
    userAgent: navigator.userAgent
  };
}

/**
 * Apply mobile-specific adaptations to the app
 */
export function applyMobileAdaptations(): void {
  const { isMobile } = getDeviceInfo();
  
  if (isMobile) {
    // Add device-specific class to body for CSS targeting
    document.body.classList.add('mobile-device');
    
    // Apply other device-specific adaptations
    console.log('[Device] Mobile device detected, applying adaptations');
    
    // Set viewport meta tag for optimal display
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
  }
}

// Environment check for mobile devices
export function isMobileDevice(): boolean {
  const { isMobile } = getDeviceInfo();
  return isMobile;
}
