/**
 * useTripRecorder - React hook for GPS trip recording and statistics calculation
 * Converts the vanilla JS TripRecorder class to a React hook
 */

import { useState, useRef, useCallback } from 'react';

const useTripRecorder = () => {
  const [currentTrip, setCurrentTrip] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [stats, setStats] = useState({
    distanceMeters: 0,
    durationMs: 0,
    avgSpeedKph: 0,
    currentSpeedKph: 0,
    maxSpeedKph: 0
  });
  
  const watchIdRef = useRef(null);

  /**
   * Generate a simple UUID v4
   */
  const generateUUID = useCallback(() => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }, []);

  /**
   * Calculate Haversine distance between two points in meters
   */
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const toRadians = (degrees) => degrees * (Math.PI / 180);
    
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  /**
   * Calculate speed using moving average of last 3 points
   */
  const calculateSmoothedSpeed = useCallback((points) => {
    if (points.length < 2) return 0;
    
    const recentPoints = points.slice(-3); // Get last 3 points
    let totalSpeed = 0;
    let validSpeeds = 0;

    for (let i = 1; i < recentPoints.length; i++) {
      const prev = recentPoints[i - 1];
      const curr = recentPoints[i];
      const distance = calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
      const timeDelta = (curr.timestamp - prev.timestamp) / 1000; // Convert to seconds
      
      if (timeDelta > 0) {
        totalSpeed += distance / timeDelta; // m/s
        validSpeeds++;
      }
    }

    return validSpeeds > 0 ? totalSpeed / validSpeeds : 0;
  }, [calculateDistance]);

  /**
   * Create a new trip data structure
   */
  const createTrip = useCallback(() => {
    return {
      id: generateUUID(),
      startTime: Date.now(),
      endTime: null,
      points: [],
      stats: {
        distanceMeters: 0,
        durationMs: 0,
        avgSpeedKph: 0,
        maxSpeedKph: 0
      }
    };
  }, [generateUUID]);

  /**
   * Create a new point data structure
   */
  const createPoint = useCallback((position, speed = 0) => {
    return {
      timestamp: Date.now(),
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: speed // m/s
    };
  }, []);

  /**
   * Update trip statistics
   */
  const updateTripStats = useCallback((trip) => {
    if (!trip || trip.points.length < 2) return trip;

    const points = trip.points;
    let totalDistance = 0;
    let maxSpeed = 0;

    // Calculate total distance and max speed
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      totalDistance += calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
      
      const speedKph = curr.speed * 3.6; // Convert m/s to km/h
      if (speedKph > maxSpeed) {
        maxSpeed = speedKph;
      }
    }

    // Calculate duration
    const duration = Date.now() - trip.startTime;

    // Calculate average speed in km/h
    const avgSpeedKph = duration > 0 ? (totalDistance / 1000) / (duration / 3600000) : 0;

    const updatedTrip = {
      ...trip,
      stats: {
        distanceMeters: totalDistance,
        durationMs: duration,
        avgSpeedKph: avgSpeedKph,
        maxSpeedKph: maxSpeed
      }
    };

    // Update stats state
    const currentSpeedKph = points.length > 0 ? points[points.length - 1].speed * 3.6 : 0;
    setStats({
      distanceMeters: totalDistance,
      durationMs: duration,
      avgSpeedKph: avgSpeedKph,
      currentSpeedKph: currentSpeedKph,
      maxSpeedKph: maxSpeed
    });

    return updatedTrip;
  }, [calculateDistance]);

  /**
   * Handle geolocation position updates
   */
  const handlePositionUpdate = useCallback((position) => {
    setCurrentTrip(prevTrip => {
      if (!prevTrip || !isTracking) return prevTrip;

      // Ignore inaccurate readings
      if (position.coords.accuracy > 50) {
        console.log('Ignoring inaccurate position:', position.coords.accuracy);
        return prevTrip;
      }

      const speed = calculateSmoothedSpeed(prevTrip.points);
      const point = createPoint(position, speed);
      
      const updatedTrip = {
        ...prevTrip,
        points: [...prevTrip.points, point]
      };

      // Update statistics
      const tripWithStats = updateTripStats(updatedTrip);
      
      console.log('Point recorded:', {
        lat: point.lat,
        lon: point.lon,
        accuracy: point.accuracy,
        speed: point.speed.toFixed(2) + ' m/s'
      });

      // Dispatch custom event for other components
      window.dispatchEvent(new CustomEvent('tripUpdate', { 
        detail: { 
          trip: tripWithStats,
          stats: tripWithStats.stats,
          currentPoint: point
        }
      }));

      return tripWithStats;
    });
  }, [isTracking, calculateSmoothedSpeed, createPoint, updateTripStats]);

  /**
   * Handle geolocation errors
   */
  const handlePositionError = useCallback((error) => {
    console.error('Geolocation error:', error.message);
  }, []);

  /**
   * Start recording a new trip
   */
  const startTrip = useCallback(() => {
    if (isTracking) {
      console.warn('Trip already in progress');
      return currentTrip;
    }

    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    const newTrip = createTrip();
    setCurrentTrip(newTrip);
    setIsTracking(true);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      options
    );

    console.log('Trip started:', newTrip.id);
    
    // Dispatch trip start event
    window.dispatchEvent(new CustomEvent('tripStarted', { detail: newTrip }));
    
    return newTrip;
  }, [isTracking, currentTrip, createTrip, handlePositionUpdate, handlePositionError]);

  /**
   * Stop recording the current trip
   */
  const stopTrip = useCallback(() => {
    if (!isTracking || !currentTrip) {
      console.warn('No trip in progress');
      return null;
    }

    setIsTracking(false);
    
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const finishedTrip = {
      ...currentTrip,
      endTime: Date.now()
    };

    const finalTrip = updateTripStats(finishedTrip);
    setCurrentTrip(finalTrip);

    // Save to localStorage
    saveToLocalStorage(finalTrip);

    console.log('Trip stopped:', finalTrip.id);
    console.log('Final stats:', finalTrip.stats);

    // Dispatch trip stop event
    window.dispatchEvent(new CustomEvent('tripStopped', { detail: finalTrip }));

    return finalTrip;
  }, [isTracking, currentTrip, updateTripStats]);

  /**
   * Export trip data as GPX XML string
   */
  const exportGPX = useCallback((trip = currentTrip) => {
    if (!trip || trip.points.length === 0) {
      throw new Error('No trip data to export');
    }

    const startDate = new Date(trip.startTime).toISOString();
    
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TripRecorder" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Trip ${trip.id}</name>
    <time>${startDate}</time>
  </metadata>
  <trk>
    <name>Trip ${trip.id}</name>
    <trkseg>`;

    trip.points.forEach(point => {
      const timestamp = new Date(point.timestamp).toISOString();
      gpx += `
      <trkpt lat="${point.lat}" lon="${point.lon}">
        <time>${timestamp}</time>
        <extensions>
          <speed>${point.speed}</speed>
          <accuracy>${point.accuracy}</accuracy>
        </extensions>
      </trkpt>`;
    });

    gpx += `
    </trkseg>
  </trk>
</gpx>`;

    return gpx;
  }, [currentTrip]);

  /**
   * Export trip data as GeoJSON FeatureCollection
   */
  const exportGeoJSON = useCallback((trip = currentTrip) => {
    if (!trip || trip.points.length === 0) {
      throw new Error('No trip data to export');
    }
    
    const lineString = {
      type: "Feature",
      properties: {
        name: `Trip ${trip.id}`,
        startTime: trip.startTime,
        endTime: trip.endTime,
        stats: trip.stats
      },
      geometry: {
        type: "LineString",
        coordinates: trip.points.map(point => [point.lon, point.lat])
      }
    };

    const points = trip.points.map((point, index) => ({
      type: "Feature",
      properties: {
        timestamp: point.timestamp,
        speed: point.speed,
        accuracy: point.accuracy,
        pointIndex: index
      },
      geometry: {
        type: "Point",
        coordinates: [point.lon, point.lat]
      }
    }));

    return {
      type: "FeatureCollection",
      features: [lineString, ...points]
    };
  }, [currentTrip]);

  /**
   * Save trip data to localStorage
   */
  const saveToLocalStorage = useCallback((trip) => {
    if (!trip) return;

    try {
      const trips = getTripsFromLocalStorage();
      trips.push(trip);
      localStorage.setItem('tripRecorder_trips', JSON.stringify(trips));
      console.log('Trip saved to localStorage');
    } catch (error) {
      console.error('Failed to save trip to localStorage:', error);
    }
  }, []);

  /**
   * Get all trips from localStorage
   */
  const getTripsFromLocalStorage = useCallback(() => {
    try {
      const tripsData = localStorage.getItem('tripRecorder_trips');
      return tripsData ? JSON.parse(tripsData) : [];
    } catch (error) {
      console.error('Failed to load trips from localStorage:', error);
      return [];
    }
  }, []);

  /**
   * Clear all trips from localStorage
   */
  const clearLocalStorage = useCallback(() => {
    try {
      localStorage.removeItem('tripRecorder_trips');
      console.log('Trip data cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }, []);

  return {
    // State
    currentTrip,
    isTracking,
    stats,
    
    // Actions
    startTrip,
    stopTrip,
    
    // Export functions
    exportGPX,
    exportGeoJSON,
    
    // Storage functions
    getTripsFromLocalStorage,
    clearLocalStorage
  };
};

export default useTripRecorder;