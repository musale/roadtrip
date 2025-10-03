/**
 * useGeolocation - React hook for wrapping navigator.geolocation API
 * Handles permission requests, error handling, and accuracy filtering
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const useGeolocation = () => {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState('prompt'); // 'granted', 'denied', 'prompt'
  const [accuracy, setAccuracy] = useState(null);
  
  const watchIdRef = useRef(null);
  const isWatchingRef = useRef(false);

  /**
   * Check current geolocation permission status
   */
  const checkPermission = useCallback(async () => {
    if (!navigator.permissions) {
      return 'unavailable';
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setPermission(result.state);
      
      // Listen for permission changes
      result.addEventListener('change', () => {
        setPermission(result.state);
      });
      
      return result.state;
    } catch (err) {
      console.warn('Unable to query geolocation permission:', err);
      return 'unavailable';
    }
  }, []);

  /**
   * Request geolocation permission
   */
  const requestPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported by this browser');
      setError(error);
      throw error;
    }

    setIsLoading(true);
    setError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
    };

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPosition(position);
          setAccuracy(position.coords.accuracy);
          setPermission('granted');
          setIsLoading(false);
          resolve(position);
        },
        (error) => {
          console.error('Geolocation error:', error.message);
          setError(error);
          setIsLoading(false);
          
          // Map error codes to permission states
          if (error.code === error.PERMISSION_DENIED) {
            setPermission('denied');
          }
          
          reject(error);
        },
        options
      );
    });
  }, []);

  /**
   * Get current position once
   */
  const getCurrentPosition = useCallback(async (customOptions = {}) => {
    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported by this browser');
      setError(error);
      throw error;
    }

    setIsLoading(true);
    setError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000,
      ...customOptions
    };

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Filter out inaccurate readings
          if (position.coords.accuracy > 50) {
            console.warn('Position accuracy too low:', position.coords.accuracy);
            // Don't update state for inaccurate readings, but still resolve
            setIsLoading(false);
            resolve(null);
            return;
          }

          setPosition(position);
          setAccuracy(position.coords.accuracy);
          setIsLoading(false);
          resolve(position);
        },
        (error) => {
          console.error('Geolocation error:', error.message);
          setError(error);
          setIsLoading(false);
          reject(error);
        },
        options
      );
    });
  }, []);

  /**
   * Start watching position with callback
   */
  const watchPosition = useCallback((onPositionUpdate, onError, customOptions = {}) => {
    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported by this browser');
      setError(error);
      throw error;
    }

    if (isWatchingRef.current) {
      console.warn('Already watching position');
      return watchIdRef.current;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000,
      ...customOptions
    };

    const handleSuccess = (position) => {
      // Filter out inaccurate readings
      if (position.coords.accuracy > 50) {
        console.warn('Position accuracy too low:', position.coords.accuracy);
        return;
      }

      setPosition(position);
      setAccuracy(position.coords.accuracy);
      setError(null);
      
      if (onPositionUpdate) {
        onPositionUpdate(position);
      }
    };

    const handleError = (error) => {
      console.error('Geolocation watch error:', error.message);
      setError(error);
      
      if (onError) {
        onError(error);
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      options
    );

    isWatchingRef.current = true;
    setIsLoading(false);

    return watchIdRef.current;
  }, []);

  /**
   * Stop watching position
   */
  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      isWatchingRef.current = false;
      console.log('Geolocation watch cleared');
    }
  }, []);

  /**
   * Calculate distance between two positions in meters
   */
  const calculateDistance = useCallback((pos1, pos2) => {
    const R = 6371000; // Earth's radius in meters
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    
    const lat1 = pos1.coords ? pos1.coords.latitude : pos1.latitude;
    const lon1 = pos1.coords ? pos1.coords.longitude : pos1.longitude;
    const lat2 = pos2.coords ? pos2.coords.latitude : pos2.latitude;
    const lon2 = pos2.coords ? pos2.coords.longitude : pos2.longitude;
    
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  /**
   * Format position for display
   */
  const formatPosition = useCallback((pos = position) => {
    if (!pos) return null;
    
    return {
      latitude: pos.coords.latitude.toFixed(6),
      longitude: pos.coords.longitude.toFixed(6),
      accuracy: Math.round(pos.coords.accuracy),
      timestamp: new Date(pos.timestamp).toLocaleTimeString()
    };
  }, [position]);

  /**
   * Check if geolocation is supported
   */
  const isSupported = !!navigator.geolocation;

  /**
   * Check if current position is accurate enough
   */
  const isAccurate = accuracy !== null && accuracy <= 50;

  // Initialize permission check on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearWatch();
    };
  }, [clearWatch]);

  return {
    // State
    position,
    error,
    isLoading,
    permission,
    accuracy,
    isSupported,
    isAccurate,
    isWatching: isWatchingRef.current,
    
    // Actions
    requestPermission,
    getCurrentPosition,
    watchPosition,
    clearWatch,
    checkPermission,
    
    // Utilities
    calculateDistance,
    formatPosition
  };
};

export default useGeolocation;