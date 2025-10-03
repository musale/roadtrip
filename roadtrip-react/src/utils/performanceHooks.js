/**
 * withPerformanceTracking - HOC for tracking component render performance
 * Wraps components to measure render times and identify bottlenecks
 */

import { useEffect, useRef } from 'react';
import performanceMonitor from '../utils/performanceMonitor';

export function withPerformanceTracking(Component, componentName) {
  const displayName = componentName || Component.displayName || Component.name || 'Component';
  
  function PerformanceTrackedComponent(props) {
    const renderStartTime = useRef(performance.now());
    const renderCount = useRef(0);

    useEffect(() => {
      const renderEndTime = performance.now();
      const renderDuration = renderEndTime - renderStartTime.current;
      
      renderCount.current++;
      performanceMonitor.trackRender(displayName, renderDuration);
      
      // Log excessive re-renders
      if (renderCount.current > 10) {
        console.warn(`[Performance] ${displayName} has rendered ${renderCount.current} times`);
      }
      
      renderStartTime.current = performance.now();
    });

    return <Component {...props} />;
  }

  PerformanceTrackedComponent.displayName = `withPerformanceTracking(${displayName})`;
  
  return PerformanceTrackedComponent;
}

/**
 * useRenderCount - Hook to track component render count
 */
export function useRenderCount(componentName) {
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current++;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Render] ${componentName} rendered ${renderCount.current} times`);
    }
  });
  
  return renderCount.current;
}

/**
 * useWhyDidYouUpdate - Hook to debug why a component re-rendered
 */
export function useWhyDidYouUpdate(name, props) {
  const previousProps = useRef();

  useEffect(() => {
    if (previousProps.current && process.env.NODE_ENV === 'development') {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps = {};

      allKeys.forEach(key => {
        if (previousProps.current[key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current[key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length > 0) {
        console.log('[WhyDidYouUpdate]', name, changedProps);
      }
    }

    previousProps.current = props;
  });
}