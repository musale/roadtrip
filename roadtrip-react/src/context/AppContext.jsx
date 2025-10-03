/**
 * AppContext - Global state management for RoadTrip app
 * Provides centralized state and actions for all components
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Import our Phase 2 hooks
import useTripRecorder from '../hooks/useTripRecorder';
import useGeolocation from '../hooks/useGeolocation';
import useLocalStorage from '../hooks/useLocalStorage';
import useWakeLock from '../hooks/useWakeLock';

// Define action types
const ActionTypes = {
  SET_MODE: 'SET_MODE',
  SET_GPS_STATUS: 'SET_GPS_STATUS',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_LOADING: 'SET_LOADING',
  TOGGLE_FOLLOW_MODE: 'TOGGLE_FOLLOW_MODE',
  SET_MAP_INSTANCE: 'SET_MAP_INSTANCE',
  SET_CAMERA_STREAM: 'SET_CAMERA_STREAM'
};

// Initial state
const initialState = {
  mode: 'camera', // 'camera' | 'map'
  isLoading: false,
  error: null,
  followMode: true, // Auto-center map on current position
  mapInstance: null,
  cameraStream: null,
  gpsStatus: {
    supported: false,
    permission: 'prompt',
    accuracy: null,
    isAccurate: false,
    error: null
  }
};

// Reducer function
function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_MODE:
      return {
        ...state,
        mode: action.payload,
        error: null // Clear errors when switching modes
      };
    
    case ActionTypes.SET_GPS_STATUS:
      return {
        ...state,
        gpsStatus: {
          ...state.gpsStatus,
          ...action.payload
        }
      };
    
    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
    
    case ActionTypes.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };
    
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };
    
    case ActionTypes.TOGGLE_FOLLOW_MODE:
      return {
        ...state,
        followMode: !state.followMode
      };
    
    case ActionTypes.SET_MAP_INSTANCE:
      return {
        ...state,
        mapInstance: action.payload
      };
    
    case ActionTypes.SET_CAMERA_STREAM:
      return {
        ...state,
        cameraStream: action.payload
      };
    
    default:
      return state;
  }
}

// Create context
const AppContext = createContext();

// Custom hook to use the app context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// App Provider component
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Initialize hooks
  const tripRecorder = useTripRecorder();
  const geolocation = useGeolocation();
  const localStorage = useLocalStorage();
  const wakeLock = useWakeLock();

  // Update GPS status when geolocation hook changes
  React.useEffect(() => {
    dispatch({
      type: ActionTypes.SET_GPS_STATUS,
      payload: {
        supported: geolocation.isSupported,
        permission: geolocation.permission,
        accuracy: geolocation.accuracy,
        isAccurate: geolocation.isAccurate,
        error: geolocation.error
      }
    });
  }, [
    geolocation.isSupported,
    geolocation.permission,
    geolocation.accuracy,
    geolocation.isAccurate,
    geolocation.error
  ]);

  // Action creators
  const actions = {
    // Mode management
    setMode: useCallback((mode) => {
      dispatch({ type: ActionTypes.SET_MODE, payload: mode });
    }, []),

    // Error management
    setError: useCallback((error) => {
      dispatch({ type: ActionTypes.SET_ERROR, payload: error });
    }, []),

    clearError: useCallback(() => {
      dispatch({ type: ActionTypes.CLEAR_ERROR });
    }, []),

    // Loading state
    setLoading: useCallback((loading) => {
      dispatch({ type: ActionTypes.SET_LOADING, payload: loading });
    }, []),

    // Map controls
    toggleFollowMode: useCallback(() => {
      dispatch({ type: ActionTypes.TOGGLE_FOLLOW_MODE });
    }, []),

    setMapInstance: useCallback((mapInstance) => {
      dispatch({ type: ActionTypes.SET_MAP_INSTANCE, payload: mapInstance });
    }, []),

    // Camera controls
    setCameraStream: useCallback((stream) => {
      dispatch({ type: ActionTypes.SET_CAMERA_STREAM, payload: stream });
    }, []),

    // Trip recording actions
    startRecording: useCallback(async () => {
      try {
        dispatch({ type: ActionTypes.SET_LOADING, payload: true });
        dispatch({ type: ActionTypes.CLEAR_ERROR });

        // Request GPS permission if needed
        if (geolocation.permission !== 'granted') {
          await geolocation.requestPermission();
        }
        
        // Start trip recording
        const trip = tripRecorder.startTrip();
        
        // Request wake lock during recording
        if (wakeLock.isSupported) {
          try {
            await wakeLock.requestWakeLock();
          } catch (err) {
            console.warn('Wake lock failed:', err);
          }
        }

        return trip;
      } catch (error) {
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      } finally {
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      }
    }, [geolocation, tripRecorder, wakeLock]),

    stopRecording: useCallback(async () => {
      try {
        dispatch({ type: ActionTypes.SET_LOADING, payload: true });
        
        // Stop trip recording
        const finishedTrip = tripRecorder.stopTrip();
        
        // Release wake lock
        if (wakeLock.isActive) {
          await wakeLock.releaseWakeLock();
        }
        
        // Save trip to storage
        if (finishedTrip) {
          localStorage.addTrip(finishedTrip);
        }

        return finishedTrip;
      } catch (error) {
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      } finally {
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      }
    }, [tripRecorder, wakeLock, localStorage]),

    // Export actions
    exportTrip: useCallback((format = 'gpx', tripId = null) => {
      try {
        switch (format.toLowerCase()) {
          case 'gpx':
            return tripId ? localStorage.exportTripGPX(tripId) : tripRecorder.exportGPX();
          case 'geojson':
            return tripId ? localStorage.exportTripGeoJSON(tripId) : tripRecorder.exportGeoJSON();
          default:
            throw new Error(`Unsupported export format: ${format}`);
        }
      } catch (error) {
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    }, [localStorage, tripRecorder]),

    downloadTrip: useCallback((format = 'gpx', tripId = null) => {
      try {
        switch (format.toLowerCase()) {
          case 'gpx':
            return tripId ? localStorage.downloadTripGPX(tripId) : (() => {
              const gpx = tripRecorder.exportGPX();
              const blob = new Blob([gpx], { type: 'application/gpx+xml' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `trip_${new Date().toISOString().split('T')[0]}.gpx`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            })();
          case 'geojson':
            return tripId ? localStorage.downloadTripGeoJSON(tripId) : (() => {
              const geoJSON = tripRecorder.exportGeoJSON();
              const blob = new Blob([JSON.stringify(geoJSON, null, 2)], { type: 'application/geo+json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `trip_${new Date().toISOString().split('T')[0]}.geojson`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            })();
          default:
            throw new Error(`Unsupported export format: ${format}`);
        }
      } catch (error) {
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    }, [localStorage, tripRecorder])
  };

  // Utility functions
  const utils = {
    formatDuration: useCallback((ms) => {
      const seconds = Math.floor(ms / 1000);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []),

    formatDistance: useCallback((meters) => {
      return (meters / 1000).toFixed(2);
    }, []),

    formatSpeed: useCallback((kph) => {
      return kph.toFixed(1);
    }, []),

    getGPSStatusDisplay: useCallback(() => {
      const { supported, permission, isAccurate, error } = state.gpsStatus;
      
      if (!supported) return { text: 'Not Supported', color: 'text-red-400' };
      if (error) return { text: 'Error', color: 'text-red-400' };
      if (permission === 'denied') return { text: 'Denied', color: 'text-red-400' };
      if (permission === 'granted' && isAccurate) return { text: 'Good', color: 'text-green-400' };
      if (permission === 'granted') return { text: 'Poor', color: 'text-yellow-400' };
      return { text: 'Unknown', color: 'text-gray-400' };
    }, [state.gpsStatus])
  };

  // Context value
  const contextValue = {
    // State
    state,
    
    // Hook data
    tripRecorder: {
      ...tripRecorder,
      isRecording: tripRecorder.isTracking
    },
    geolocation,
    localStorage,
    wakeLock,
    
    // Actions
    actions,
    
    // Utilities
    utils
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;