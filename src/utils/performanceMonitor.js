/**
 * Performance Monitoring Utility
 * Tracks render times, GPS updates, and battery usage
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renders: 0,
      gpsUpdates: 0,
      errors: 0,
      renderTimes: [],
      gpsLatency: [],
      memoryUsage: [],
    };
    
    this.startTime = Date.now();
    this.isMonitoring = process.env.NODE_ENV === 'development';
  }

  /**
   * Track component render
   */
  trackRender(componentName, duration) {
    if (!this.isMonitoring) return;
    
    this.metrics.renders++;
    this.metrics.renderTimes.push({
      component: componentName,
      duration,
      timestamp: Date.now(),
    });
    
    // Keep only last 100 renders
    if (this.metrics.renderTimes.length > 100) {
      this.metrics.renderTimes.shift();
    }
    
    // Warn on slow renders (>16ms = drops below 60fps)
    if (duration > 16) {
      console.warn(`[Performance] Slow render: ${componentName} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Track GPS update
   */
  trackGPSUpdate(latency, accuracy) {
    if (!this.isMonitoring) return;
    
    this.metrics.gpsUpdates++;
    this.metrics.gpsLatency.push({
      latency,
      accuracy,
      timestamp: Date.now(),
    });
    
    // Keep only last 100 updates
    if (this.metrics.gpsLatency.length > 100) {
      this.metrics.gpsLatency.shift();
    }
  }

  /**
   * Track error
   */
  trackError(error, context) {
    if (!this.isMonitoring) return;
    
    this.metrics.errors++;
    console.error(`[Performance] Error in ${context}:`, error);
  }

  /**
   * Track memory usage
   */
  trackMemory() {
    if (!this.isMonitoring || !performance.memory) return;
    
    const memory = {
      used: performance.memory.usedJSHeapSize / 1048576, // MB
      total: performance.memory.totalJSHeapSize / 1048576, // MB
      limit: performance.memory.jsHeapSizeLimit / 1048576, // MB
      timestamp: Date.now(),
    };
    
    this.metrics.memoryUsage.push(memory);
    
    // Keep only last 100 samples
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage.shift();
    }
    
    // Warn on high memory usage (>80% of limit)
    const usagePercent = (memory.used / memory.limit) * 100;
    if (usagePercent > 80) {
      console.warn(`[Performance] High memory usage: ${usagePercent.toFixed(1)}%`);
    }
  }

  /**
   * Get average render time
   */
  getAverageRenderTime() {
    if (this.metrics.renderTimes.length === 0) return 0;
    
    const sum = this.metrics.renderTimes.reduce((acc, item) => acc + item.duration, 0);
    return sum / this.metrics.renderTimes.length;
  }

  /**
   * Get average GPS latency
   */
  getAverageGPSLatency() {
    if (this.metrics.gpsLatency.length === 0) return 0;
    
    const sum = this.metrics.gpsLatency.reduce((acc, item) => acc + item.latency, 0);
    return sum / this.metrics.gpsLatency.length;
  }

  /**
   * Get current memory usage
   */
  getCurrentMemory() {
    if (!performance.memory) return null;
    
    return {
      used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
      total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2),
      limit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2),
    };
  }

  /**
   * Get performance report
   */
  getReport() {
    const uptime = Date.now() - this.startTime;
    const memory = this.getCurrentMemory();
    
    return {
      uptime: Math.floor(uptime / 1000), // seconds
      renders: this.metrics.renders,
      gpsUpdates: this.metrics.gpsUpdates,
      errors: this.metrics.errors,
      avgRenderTime: this.getAverageRenderTime().toFixed(2),
      avgGPSLatency: this.getAverageGPSLatency().toFixed(2),
      memory,
      fps: this.calculateFPS(),
    };
  }

  /**
   * Calculate approximate FPS
   */
  calculateFPS() {
    if (this.metrics.renderTimes.length < 2) return 60;
    
    const recent = this.metrics.renderTimes.slice(-10);
    const avgDuration = recent.reduce((acc, item) => acc + item.duration, 0) / recent.length;
    
    return Math.min(60, Math.floor(1000 / avgDuration));
  }

  /**
   * Log performance summary
   */
  logSummary() {
    if (!this.isMonitoring) return;
    
    const report = this.getReport();
    
    console.group('[Performance] Summary');
    console.log('Uptime:', report.uptime, 'seconds');
    console.log('Renders:', report.renders);
    console.log('GPS Updates:', report.gpsUpdates);
    console.log('Errors:', report.errors);
    console.log('Avg Render Time:', report.avgRenderTime, 'ms');
    console.log('Avg GPS Latency:', report.avgGPSLatency, 'ms');
    console.log('Estimated FPS:', report.fps);
    if (report.memory) {
      console.log('Memory:', `${report.memory.used}MB / ${report.memory.limit}MB`);
    }
    console.groupEnd();
  }

  /**
   * Start periodic monitoring
   */
  startMonitoring(interval = 30000) {
    if (!this.isMonitoring) return;
    
    this.monitoringInterval = setInterval(() => {
      this.trackMemory();
      this.logSummary();
    }, interval);
  }

  /**
   * Stop periodic monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      renders: 0,
      gpsUpdates: 0,
      errors: 0,
      renderTimes: [],
      gpsLatency: [],
      memoryUsage: [],
    };
    this.startTime = Date.now();
  }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitor();

// Expose to window for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.performanceMonitor = performanceMonitor;
}

export default performanceMonitor;