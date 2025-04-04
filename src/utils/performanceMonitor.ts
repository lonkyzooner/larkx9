/**
 * Performance monitoring system for LARK
 */

// Extend Performance interface to include Chrome's memory info
interface PerformanceMemory {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

// Extend PerformanceEntry interface to include resource timing properties
interface ExtendedPerformanceEntry extends PerformanceEntry {
  initiatorType?: string;
}

// Performance metrics
interface PerformanceMetrics {
  apiCalls: {
    count: number;
    totalTime: number;
    errors: number;
  };
  rendering: {
    fps: number[];
    longFrames: number;
  };
  memory: {
    jsHeapSizeLimit?: number;
    totalJSHeapSize?: number;
    usedJSHeapSize?: number;
    samples: Array<{
      timestamp: number;
      usedJSHeapSize?: number;
    }>;
  };
  timing: {
    [key: string]: {
      count: number;
      totalTime: number;
      min: number;
      max: number;
    };
  };
}

// Initialize metrics
const metrics: PerformanceMetrics = {
  apiCalls: {
    count: 0,
    totalTime: 0,
    errors: 0
  },
  rendering: {
    fps: [],
    longFrames: 0
  },
  memory: {
    samples: []
  },
  timing: {}
};

// Last frame timestamp for FPS calculation
let lastFrameTime = performance.now();
let frameCount = 0;
let lastFpsUpdateTime = performance.now();

// FPS monitoring interval
const FPS_UPDATE_INTERVAL = 1000; // 1 second
const MEMORY_SAMPLE_INTERVAL = 10000; // 10 seconds

/**
 * Start performance monitoring
 */
export function startPerformanceMonitoring(): void {
  // Monitor FPS
  const monitorFps = () => {
    const now = performance.now();
    frameCount++;
    
    // Calculate FPS every second
    if (now - lastFpsUpdateTime >= FPS_UPDATE_INTERVAL) {
      const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
      metrics.rendering.fps.push(fps);
      
      // Keep only the last 60 samples (1 minute)
      if (metrics.rendering.fps.length > 60) {
        metrics.rendering.fps.shift();
      }
      
      frameCount = 0;
      lastFpsUpdateTime = now;
    }
    
    // Check for long frames (potential jank)
    const frameDuration = now - lastFrameTime;
    if (frameDuration > 50) { // Longer than 50ms (less than 20 FPS)
      metrics.rendering.longFrames++;
    }
    
    lastFrameTime = now;
    requestAnimationFrame(monitorFps);
  };
  
  // Start FPS monitoring
  requestAnimationFrame(monitorFps);
  
  // Monitor memory usage if available
  const extendedPerformance = performance as ExtendedPerformance;
  if (extendedPerformance.memory) {
    metrics.memory.jsHeapSizeLimit = extendedPerformance.memory.jsHeapSizeLimit;
    metrics.memory.totalJSHeapSize = extendedPerformance.memory.totalJSHeapSize;
    metrics.memory.usedJSHeapSize = extendedPerformance.memory.usedJSHeapSize;
    
    // Sample memory usage periodically
    setInterval(() => {
      if (extendedPerformance.memory) {
        metrics.memory.samples.push({
          timestamp: Date.now(),
          usedJSHeapSize: extendedPerformance.memory.usedJSHeapSize
        });
        
        // Keep only the last 60 samples (10 minutes)
        if (metrics.memory.samples.length > 60) {
          metrics.memory.samples.shift();
        }
      }
    }, MEMORY_SAMPLE_INTERVAL);
  }
}

/**
 * Track API call performance
 * @param name API call name
 * @param startTime Start time
 * @param error Whether the call resulted in an error
 */
export function trackApiCall(name: string, startTime: number, error: boolean = false): void {
  const duration = performance.now() - startTime;
  
  metrics.apiCalls.count++;
  metrics.apiCalls.totalTime += duration;
  
  if (error) {
    metrics.apiCalls.errors++;
  }
  
  // Track specific API call timing
  if (!metrics.timing[name]) {
    metrics.timing[name] = {
      count: 0,
      totalTime: 0,
      min: duration,
      max: duration
    };
  }
  
  const timing = metrics.timing[name];
  timing.count++;
  timing.totalTime += duration;
  timing.min = Math.min(timing.min, duration);
  timing.max = Math.max(timing.max, duration);
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  return { ...metrics };
}

/**
 * Get average FPS
 */
export function getAverageFps(): number {
  if (metrics.rendering.fps.length === 0) {
    return 0;
  }
  
  const sum = metrics.rendering.fps.reduce((acc, fps) => acc + fps, 0);
  return Math.round(sum / metrics.rendering.fps.length);
}

/**
 * Get memory usage percentage
 */
export function getMemoryUsagePercentage(): number | null {
  if (metrics.memory.jsHeapSizeLimit && metrics.memory.usedJSHeapSize) {
    return Math.round((metrics.memory.usedJSHeapSize / metrics.memory.jsHeapSizeLimit) * 100);
  }
  
  return null;
}

/**
 * Get average API call time
 */
export function getAverageApiCallTime(): number {
  if (metrics.apiCalls.count === 0) {
    return 0;
  }
  
  return Math.round(metrics.apiCalls.totalTime / metrics.apiCalls.count);
}

/**
 * Reset performance metrics
 */
export function resetPerformanceMetrics(): void {
  metrics.apiCalls = {
    count: 0,
    totalTime: 0,
    errors: 0
  };
  
  metrics.rendering = {
    fps: [],
    longFrames: 0
  };
  
  metrics.memory.samples = [];
  
  metrics.timing = {};
}

// Add performance observer for resource timing
if (typeof PerformanceObserver !== 'undefined') {
  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const extendedEntry = entry as ExtendedPerformanceEntry;
        if (extendedEntry.initiatorType === 'fetch' || extendedEntry.initiatorType === 'xmlhttprequest') {
          const name = entry.name.split('/').pop() || entry.name;
          trackApiCall(name, entry.startTime, false);
        }
      });
    });
    
    observer.observe({ entryTypes: ['resource'] });
  } catch (e) {
    console.error('Performance observer not supported', e);
  }
}
