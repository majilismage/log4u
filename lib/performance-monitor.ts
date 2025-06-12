/**
 * Performance monitoring utility for tracking API response times
 * Helps measure the effectiveness of optimization efforts
 */

interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();

  /**
   * Start timing an operation
   */
  start(operation: string, metadata?: Record<string, any>): string {
    const id = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.metrics.set(id, {
      operation,
      startTime: performance.now(),
      metadata
    });
    
    return id;
  }

  /**
   * End timing an operation and return duration
   */
  end(id: string): number | null {
    const metric = this.metrics.get(id);
    if (!metric) {
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;
    
    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${metric.operation}: ${duration.toFixed(2)}ms`, {
        duration,
        metadata: metric.metadata
      });
    }
    
    return duration;
  }

  /**
   * Time a function execution
   */
  async time<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<{ result: T; duration: number }> {
    const id = this.start(operation, metadata);
    try {
      const result = await fn();
      const duration = this.end(id) || 0;
      return { result, duration };
    } catch (error) {
      this.end(id);
      throw error;
    }
  }

  /**
   * Get metrics for a specific operation type
   */
  getMetrics(operation?: string): PerformanceMetric[] {
    const allMetrics = Array.from(this.metrics.values()).filter(m => m.duration !== undefined);
    
    if (operation) {
      return allMetrics.filter(m => m.operation === operation);
    }
    
    return allMetrics;
  }

  /**
   * Get average duration for an operation
   */
  getAverageDuration(operation: string): number | null {
    const metrics = this.getMetrics(operation);
    
    if (metrics.length === 0) {
      return null;
    }
    
    const totalDuration = metrics.reduce((sum, metric) => sum + (metric.duration || 0), 0);
    return totalDuration / metrics.length;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Get summary statistics
   */
  getSummary(): Record<string, { count: number; averageDuration: number; minDuration: number; maxDuration: number }> {
    const allMetrics = this.getMetrics();
    const summary: Record<string, { count: number; averageDuration: number; minDuration: number; maxDuration: number }> = {};
    
    // Group metrics by operation
    const grouped = allMetrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = [];
      }
      acc[metric.operation].push(metric.duration || 0);
      return acc;
    }, {} as Record<string, number[]>);
    
    // Calculate summary statistics
    for (const [operation, durations] of Object.entries(grouped)) {
      const count = durations.length;
      const averageDuration = durations.reduce((sum, duration) => sum + duration, 0) / count;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      
      summary[operation] = {
        count,
        averageDuration,
        minDuration,
        maxDuration
      };
    }
    
    return summary;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Helper function for timing API calls
export const timeApiCall = async <T>(
  operation: string,
  apiCall: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  const { result } = await performanceMonitor.time(operation, apiCall, metadata);
  return result;
}; 