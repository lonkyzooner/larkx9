/**
 * Network optimization utilities for LARK
 * 
 * This module provides functions for optimizing network requests
 * to improve application performance and reduce bandwidth usage.
 */

import { trackApiCall } from './performanceMonitor';

// Network status
interface NetworkStatus {
  online: boolean;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

// Default network status
const defaultNetworkStatus: NetworkStatus = {
  online: true,
  effectiveType: '4g',
  downlink: 10,
  rtt: 50,
  saveData: false
};

// Current network status
let currentNetworkStatus: NetworkStatus = { ...defaultNetworkStatus };

// Network status listeners
const networkListeners: Function[] = [];

/**
 * Initialize network monitoring
 */
export function initNetworkMonitoring(): void {
  // Update online status
  const updateOnlineStatus = () => {
    const wasOnline = currentNetworkStatus.online;
    currentNetworkStatus.online = navigator.onLine;
    
    if (wasOnline !== currentNetworkStatus.online) {
      notifyNetworkListeners();
    }
  };
  
  // Update connection information if available
  const updateConnectionInfo = () => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      if (connection) {
        currentNetworkStatus.effectiveType = connection.effectiveType || '4g';
        currentNetworkStatus.downlink = connection.downlink || 10;
        currentNetworkStatus.rtt = connection.rtt || 50;
        currentNetworkStatus.saveData = connection.saveData || false;
        
        notifyNetworkListeners();
      }
    }
  };
  
  // Set up event listeners
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateConnectionInfo);
      updateConnectionInfo();
    }
  }
  
  // Initial status update
  updateOnlineStatus();
}

/**
 * Notify network status listeners
 */
function notifyNetworkListeners(): void {
  networkListeners.forEach(listener => {
    try {
      listener(currentNetworkStatus);
    } catch (error) {
      console.error('Error in network listener:', error);
    }
  });
}

/**
 * Add network status listener
 * @param listener Function to call when network status changes
 */
export function addNetworkListener(listener: Function): void {
  networkListeners.push(listener);
}

/**
 * Remove network status listener
 * @param listener Function to remove from listeners
 */
export function removeNetworkListener(listener: Function): void {
  const index = networkListeners.indexOf(listener);
  if (index !== -1) {
    networkListeners.splice(index, 1);
  }
}

/**
 * Get current network status
 * @returns Current network status
 */
export function getNetworkStatus(): NetworkStatus {
  return { ...currentNetworkStatus };
}

/**
 * Check if the current connection is slow
 * @returns True if the connection is slow
 */
export function isSlowConnection(): boolean {
  return (
    !currentNetworkStatus.online ||
    currentNetworkStatus.effectiveType === '2g' ||
    currentNetworkStatus.effectiveType === 'slow-2g' ||
    currentNetworkStatus.downlink < 0.5 ||
    currentNetworkStatus.rtt > 500 ||
    currentNetworkStatus.saveData
  );
}

/**
 * Optimize fetch options based on network conditions
 * @param url URL to fetch
 * @param options Fetch options
 * @returns Optimized fetch options
 */
export function optimizeFetchOptions(url: string, options: RequestInit = {}): RequestInit {
  const optimizedOptions: RequestInit = { ...options };
  
  // Add cache control for slow connections
  if (isSlowConnection()) {
    optimizedOptions.headers = {
      ...optimizedOptions.headers,
      'Cache-Control': 'max-age=86400' // Cache for 24 hours
    };
  }
  
  return optimizedOptions;
}

/**
 * Fetch with network optimization and performance tracking
 * @param url URL to fetch
 * @param options Fetch options
 * @returns Promise resolving to fetch response
 */
export async function optimizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const startTime = performance.now();
  const optimizedOptions = optimizeFetchOptions(url, options);
  
  try {
    // If offline and we have a cached response, return it
    if (!navigator.onLine) {
      const cache = await caches.open('lark-network-cache');
      const cachedResponse = await cache.match(url);
      
      if (cachedResponse) {
        trackApiCall(`fetch_cached_${url}`, startTime, false);
        return cachedResponse;
      }
    }
    
    // Perform the fetch
    const response = await fetch(url, optimizedOptions);
    
    // Track performance
    trackApiCall(`fetch_${url}`, startTime, !response.ok);
    
    // Cache successful GET requests
    if (response.ok && (options.method === 'GET' || !options.method)) {
      const cache = await caches.open('lark-network-cache');
      cache.put(url, response.clone());
    }
    
    return response;
  } catch (error) {
    // Track error
    trackApiCall(`fetch_error_${url}`, startTime, true);
    
    // If offline, try to return cached response
    if (!navigator.onLine) {
      const cache = await caches.open('lark-network-cache');
      const cachedResponse = await cache.match(url);
      
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    throw error;
  }
}

/**
 * Preload resources that will likely be needed soon
 * @param urls URLs to preload
 */
export async function preloadResources(urls: string[]): Promise<void> {
  // Don't preload on slow connections
  if (isSlowConnection()) {
    return;
  }
  
  // Preload resources in the background
  setTimeout(async () => {
    try {
      const cache = await caches.open('lark-network-cache');
      
      for (const url of urls) {
        // Check if already cached
        const cachedResponse = await cache.match(url);
        if (!cachedResponse) {
          // Fetch and cache
          fetch(url, { priority: 'low' as any })
            .then(response => {
              if (response.ok) {
                cache.put(url, response);
              }
            })
            .catch(error => {
              console.warn(`Failed to preload ${url}:`, error);
            });
        }
      }
    } catch (error) {
      console.warn('Failed to preload resources:', error);
    }
  }, 1000);
}

/**
 * Clear network cache
 * @returns Promise resolving when cache is cleared
 */
export async function clearNetworkCache(): Promise<boolean> {
  try {
    const cache = await caches.open('lark-network-cache');
    const keys = await cache.keys();
    
    for (const request of keys) {
      await cache.delete(request);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to clear network cache:', error);
    return false;
  }
}
