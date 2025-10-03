/**
 * useWakeLock - React hook for managing screen wake lock during recording
 * Prevents screen from turning off during trip recording
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const useWakeLock = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  
  const wakeLockRef = useRef(null);

  /**
   * Check if Wake Lock API is supported
   */
  const checkSupport = useCallback(() => {
    const supported = 'wakeLock' in navigator;
    setIsSupported(supported);
    return supported;
  }, []);

  /**
   * Request wake lock
   */
  const requestWakeLock = useCallback(async () => {
    if (!isSupported) {
      const error = new Error('Wake Lock API is not supported');
      setError(error);
      throw error;
    }

    if (isActive) {
      console.warn('Wake lock is already active');
      return wakeLockRef.current;
    }

    try {
      setError(null);
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      
      console.log('Wake lock activated');
      
      // Listen for wake lock release
      wakeLockRef.current.addEventListener('release', () => {
        console.log('Wake lock released');
        setIsActive(false);
        wakeLockRef.current = null;
      });

      return wakeLockRef.current;
    } catch (err) {
      console.error('Failed to request wake lock:', err);
      setError(err);
      setIsActive(false);
      wakeLockRef.current = null;
      throw err;
    }
  }, [isSupported, isActive]);

  /**
   * Release wake lock
   */
  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) {
      console.warn('No active wake lock to release');
      return;
    }

    try {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsActive(false);
      console.log('Wake lock released manually');
    } catch (err) {
      console.error('Failed to release wake lock:', err);
      setError(err);
      throw err;
    }
  }, []);

  /**
   * Toggle wake lock on/off
   */
  const toggleWakeLock = useCallback(async () => {
    if (isActive) {
      await releaseWakeLock();
    } else {
      await requestWakeLock();
    }
  }, [isActive, releaseWakeLock, requestWakeLock]);

  /**
   * Handle visibility change - re-request wake lock when page becomes visible
   */
  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState === 'visible' && !isActive && wakeLockRef.current === null) {
      // Re-request wake lock if it was previously active
      try {
        await requestWakeLock();
      } catch (err) {
        console.warn('Failed to re-request wake lock on visibility change:', err);
      }
    }
  }, [isActive, requestWakeLock]);

  // Check support on mount
  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  // Add visibility change listener
  useEffect(() => {
    if (isSupported) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isSupported, handleVisibilityChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.error);
      }
    };
  }, []);

  return {
    // State
    isSupported,
    isActive,
    error,
    
    // Actions
    requestWakeLock,
    releaseWakeLock,
    toggleWakeLock
  };
};

export default useWakeLock;