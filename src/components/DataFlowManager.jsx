/**
 * DataFlowManager - Manages real-time data synchronization between components
 * Coordinates GPS data ? TripRecorder ? UI updates with error handling
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';

const DataFlowManager = () => {
  const {
    state,
    tripRecorder,
    geolocation,
    actions
  } = useAppContext();

  const { isRecording } = tripRecorder;
  const { position, error: gpsError } = geolocation;
  
  // Refs for tracking
  const lastPositionRef = useRef(null);
  const updateCountRef = useRef(0);
  const errorCountRef = useRef(0);

  /**
   * Handle GPS position updates
   * Feeds new position data to TripRecorder when recording
   */
  const handlePositionUpdate = useCallback(() => {
    if (!isRecording || !position) return;

    // Check if position actually changed
    const positionChanged = 
      !lastPositionRef.current ||
      lastPositionRef.current.coords.latitude !== position.coords.latitude ||
      lastPositionRef.current.coords.longitude !== position.coords.longitude;

    if (!positionChanged) return;

    try {
      // Position data is automatically handled by useTripRecorder
      // through useGeolocation integration in AppContext
      lastPositionRef.current = position;
      updateCountRef.current += 1;

      // Log periodic updates in development
      if (process.env.NODE_ENV === 'development' && updateCountRef.current % 10 === 0) {
        console.log('[DataFlow] GPS updates processed:', updateCountRef.current);
      }
    } catch (error) {
      console.error('[DataFlow] Error processing position:', error);
      errorCountRef.current += 1;

      if (errorCountRef.current > 5) {
        actions.setError('GPS data processing issues detected');
      }
    }
  }, [isRecording, position, actions]);

  /**
   * Handle GPS errors
   * Manages error state and provides user feedback
   */
  const handleGPSError = useCallback(() => {
    if (!gpsError) return;

    let userMessage = 'GPS error occurred';
    
    switch (gpsError.code) {
      case 1: // PERMISSION_DENIED
        userMessage = 'GPS permission denied. Please enable location access.';
        break;
      case 2: // POSITION_UNAVAILABLE
        userMessage = 'GPS position unavailable. Check your device settings.';
        break;
      case 3: // TIMEOUT
        userMessage = 'GPS timeout. Signal may be weak.';
        break;
      default:
        userMessage = gpsError.message || 'Unknown GPS error';
    }

    // Only show error if recording (avoid spam when not in use)
    if (isRecording) {
      actions.setError(userMessage);
      
      // Auto-clear error after 10 seconds
      setTimeout(() => {
        if (state.error === userMessage) {
          actions.clearError();
        }
      }, 10000);
    }

    console.error('[DataFlow] GPS Error:', gpsError);
  }, [gpsError, isRecording, actions, state.error]);

  /**
   * Monitor recording state changes
   * Ensures proper initialization and cleanup
   */
  useEffect(() => {
    if (isRecording) {
      console.log('[DataFlow] Recording started - GPS updates active');
      updateCountRef.current = 0;
      errorCountRef.current = 0;
    } else {
      if (updateCountRef.current > 0) {
        console.log('[DataFlow] Recording stopped - Total updates:', updateCountRef.current);
      }
      lastPositionRef.current = null;
    }
  }, [isRecording]);

  /**
   * Process position updates
   */
  useEffect(() => {
    handlePositionUpdate();
  }, [handlePositionUpdate]);

  /**
   * Handle GPS errors
   */
  useEffect(() => {
    handleGPSError();
  }, [handleGPSError]);

  /**
   * Monitor component health
   * Logs warnings if data flow seems stuck
   */
  useEffect(() => {
    if (!isRecording) return;

    const healthCheckInterval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - (lastPositionRef.current?.timestamp || 0);
      
      if (timeSinceLastUpdate > 5000 && updateCountRef.current > 0) {
        console.warn('[DataFlow] No GPS updates for 5 seconds');
        
        if (timeSinceLastUpdate > 10000) {
          actions.setError('GPS signal lost. Check your location settings.');
        }
      }
    }, 5000);

    return () => clearInterval(healthCheckInterval);
  }, [isRecording, actions]);

  /**
   * Development logging
   */
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const logInterval = setInterval(() => {
      if (isRecording) {
        console.log('[DataFlow] Status:', {
          recording: isRecording,
          updates: updateCountRef.current,
          errors: errorCountRef.current,
          hasPosition: !!position,
          accuracy: position?.coords.accuracy
        });
      }
    }, 30000); // Log every 30 seconds

    return () => clearInterval(logInterval);
  }, [isRecording, position]);

  // This component doesn't render anything
  return null;
};

export default DataFlowManager;