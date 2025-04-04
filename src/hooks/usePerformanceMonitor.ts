import { useState, useEffect, useCallback, useRef } from 'react';

export interface PerformanceMetrics {
  apiLatency: Record<string, number[]>;
  renderTime: number[];
  memoryUsage: number[];
  lastUpdated: number;
}

export interface PerformanceEvent {
  type: 'api_call' | 'render' | 'memory';
  name?: string;
  duration?: number;
  timestamp: number;
}

/**
 * Custom hook for monitoring application performance
 * 
 * @returns Performance monitoring utilities
 */
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    apiLatency: {},
    renderTime: [],
    memoryUsage: [],
    lastUpdated: Date.now()
  });
  
  const renderStartTime = useRef<number | null>(null);
  const apiCallStartTimes = useRef<Record<string, number>>({});
  
  // Track render performance
  useEffect(() => {
    // Mark render start time
    renderStartTime.current = performance.now();
    
    return () => {
      // Measure render time on unmount
      if (renderStartTime.current) {
        const renderDuration = performance.now() - renderStartTime.current;
        trackEvent({
          type: 'render',
          duration: renderDuration,
          timestamp: Date.now()
        });
        renderStartTime.current = null;
      }
    };
  }, []);
  
  // Track memory usage periodically
  useEffect(() => {
    // Only run in environments that support performance memory
    if (performance && (performance as any).memory) {
      const trackMemory = () => {
        const memory = (performance as any).memory;
        if (memory) {
          trackEvent({
            type: 'memory',
            duration: memory.usedJSHeapSize / (1024 * 1024), // Convert to MB
            timestamp: Date.now()
          });
        }
      };
      
      // Track initial memory usage
      trackMemory();
      
      // Track memory usage every 30 seconds
      const interval = setInterval(trackMemory, 30000);
      
      return () => clearInterval(interval);
    }
  }, []);
  
  /**
   * Track a performance event
   */
  const trackEvent = useCallback((event: PerformanceEvent) => {
    setMetrics(prev => {
      const updated = { ...prev, lastUpdated: Date.now() };
      
      switch (event.type) {
        case 'api_call':
          if (event.name && event.duration) {
            const apiName = event.name;
            updated.apiLatency = {
              ...updated.apiLatency,
              [apiName]: [
                ...(updated.apiLatency[apiName] || []).slice(-9),
                event.duration
              ]
            };
          }
          break;
          
        case 'render':
          if (event.duration) {
            updated.renderTime = [
              ...updated.renderTime.slice(-19),
              event.duration
            ];
          }
          break;
          
        case 'memory':
          if (event.duration) {
            updated.memoryUsage = [
              ...updated.memoryUsage.slice(-19),
              event.duration
            ];
          }
          break;
      }
      
      return updated;
    });
  }, []);
  
  /**
   * Start tracking an API call
   */
  const startApiCall = useCallback((apiName: string) => {
    apiCallStartTimes.current[apiName] = performance.now();
    return apiName;
  }, []);
  
  /**
   * End tracking an API call
   */
  const endApiCall = useCallback((apiName: string) => {
    const startTime = apiCallStartTimes.current[apiName];
    if (startTime) {
      const duration = performance.now() - startTime;
      trackEvent({
        type: 'api_call',
        name: apiName,
        duration,
        timestamp: Date.now()
      });
      delete apiCallStartTimes.current[apiName];
      return duration;
    }
    return 0;
  }, [trackEvent]);
  
  /**
   * Get average API latency for a specific API
   */
  const getAverageApiLatency = useCallback((apiName: string) => {
    const latencies = metrics.apiLatency[apiName] || [];
    if (latencies.length === 0) return 0;
    
    const sum = latencies.reduce((acc, val) => acc + val, 0);
    return sum / latencies.length;
  }, [metrics.apiLatency]);
  
  /**
   * Get average render time
   */
  const getAverageRenderTime = useCallback(() => {
    if (metrics.renderTime.length === 0) return 0;
    
    const sum = metrics.renderTime.reduce((acc, val) => acc + val, 0);
    return sum / metrics.renderTime.length;
  }, [metrics.renderTime]);
  
  /**
   * Get current memory usage
   */
  const getCurrentMemoryUsage = useCallback(() => {
    return metrics.memoryUsage[metrics.memoryUsage.length - 1] || 0;
  }, [metrics.memoryUsage]);
  
  return {
    metrics,
    startApiCall,
    endApiCall,
    trackEvent,
    getAverageApiLatency,
    getAverageRenderTime,
    getCurrentMemoryUsage
  };
}
