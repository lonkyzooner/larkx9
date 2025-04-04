import React, { useEffect, useState } from 'react';
import { 
  startPerformanceMonitoring, 
  getPerformanceMetrics, 
  getAverageFps, 
  getMemoryUsagePercentage,
  getAverageApiCallTime
} from '../utils/performanceMonitor';

interface PerformanceMonitorProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Performance monitoring component that displays real-time metrics
 * about the application's performance.
 */
const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ visible, onClose }) => {
  const [metrics, setMetrics] = useState({
    fps: 0,
    memory: 0,
    apiCallTime: 0,
    apiCalls: 0,
    apiErrors: 0,
    longFrames: 0
  });

  useEffect(() => {
    // Start performance monitoring when component mounts
    startPerformanceMonitoring();
    
    // Update metrics every second
    const intervalId = setInterval(() => {
      const performanceMetrics = getPerformanceMetrics();
      setMetrics({
        fps: getAverageFps(),
        memory: getMemoryUsagePercentage() || 0,
        apiCallTime: getAverageApiCallTime(),
        apiCalls: performanceMetrics.apiCalls.count,
        apiErrors: performanceMetrics.apiCalls.errors,
        longFrames: performanceMetrics.rendering.longFrames
      });
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  if (!visible) return null;
  
  // Determine status colors based on metrics
  const getFpsColor = (fps: number) => fps < 30 ? 'red' : fps < 50 ? 'orange' : 'green';
  const getMemoryColor = (memory: number) => memory > 80 ? 'red' : memory > 60 ? 'orange' : 'green';
  const getApiTimeColor = (time: number) => time > 1000 ? 'red' : time > 500 ? 'orange' : 'green';
  
  return (
    <div className="performance-monitor">
      <div className="performance-monitor-header">
        <h3>Performance Monitor</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="performance-metrics">
        <div className="metric-item">
          <span className="metric-label">FPS:</span>
          <span className="metric-value" style={{ color: getFpsColor(metrics.fps) }}>
            {metrics.fps}
          </span>
        </div>
        
        <div className="metric-item">
          <span className="metric-label">Memory:</span>
          <span className="metric-value" style={{ color: getMemoryColor(metrics.memory) }}>
            {metrics.memory}%
          </span>
        </div>
        
        <div className="metric-item">
          <span className="metric-label">API Calls:</span>
          <span className="metric-value">
            {metrics.apiCalls} <small>({metrics.apiErrors} errors)</small>
          </span>
        </div>
        
        <div className="metric-item">
          <span className="metric-label">Avg API Time:</span>
          <span className="metric-value" style={{ color: getApiTimeColor(metrics.apiCallTime) }}>
            {metrics.apiCallTime}ms
          </span>
        </div>
        
        <div className="metric-item">
          <span className="metric-label">Long Frames:</span>
          <span className="metric-value" style={{ color: metrics.longFrames > 10 ? 'red' : 'green' }}>
            {metrics.longFrames}
          </span>
        </div>
      </div>
      
      <style>{`
        .performance-monitor {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background-color: rgba(0, 0, 0, 0.8);
          border: 1px solid var(--law-enforcement-blue, #003087);
          border-radius: 8px;
          padding: 12px;
          width: 280px;
          z-index: 9999;
          font-family: monospace;
          color: white;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .performance-monitor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          padding-bottom: 8px;
        }
        
        .performance-monitor-header h3 {
          margin: 0;
          font-size: 14px;
          color: var(--law-enforcement-blue, #003087);
        }
        
        .close-button {
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        
        .performance-metrics {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .metric-item {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }
        
        .metric-label {
          color: #aaa;
        }
        
        .metric-value {
          font-weight: bold;
        }
        
        .metric-value small {
          color: #aaa;
          font-weight: normal;
        }
      `}</style>
    </div>
  );
};

export default React.memo(PerformanceMonitor);
