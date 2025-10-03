/**
 * useLocalStorage - React hook for trip data persistence and management
 * Handles localStorage operations with error handling and data validation
 */

import { useState, useEffect, useCallback } from 'react';

const useLocalStorage = (key = 'tripRecorder_trips') => {
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load trips from localStorage
   */
  const loadTrips = useCallback(() => {
    setIsLoading(true);
    setError(null);
    
    try {
      const storedData = localStorage.getItem(key);
      const parsedTrips = storedData ? JSON.parse(storedData) : [];
      
      // Validate trip data structure
      const validTrips = parsedTrips.filter(trip => 
        trip && 
        trip.id && 
        trip.startTime && 
        Array.isArray(trip.points)
      );
      
      setTrips(validTrips);
      console.log(`Loaded ${validTrips.length} trips from localStorage`);
    } catch (err) {
      console.error('Failed to load trips from localStorage:', err);
      setError(err);
      setTrips([]);
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  /**
   * Save trips to localStorage
   */
  const saveTrips = useCallback((newTrips) => {
    try {
      localStorage.setItem(key, JSON.stringify(newTrips));
      setTrips(newTrips);
      console.log(`Saved ${newTrips.length} trips to localStorage`);
    } catch (err) {
      console.error('Failed to save trips to localStorage:', err);
      setError(err);
      throw err;
    }
  }, [key]);

  /**
   * Add a new trip
   */
  const addTrip = useCallback((trip) => {
    if (!trip || !trip.id) {
      throw new Error('Invalid trip data');
    }

    const newTrips = [...trips, trip];
    saveTrips(newTrips);
    return trip;
  }, [trips, saveTrips]);

  /**
   * Update an existing trip
   */
  const updateTrip = useCallback((tripId, updatedTrip) => {
    if (!tripId || !updatedTrip) {
      throw new Error('Invalid trip data');
    }

    const newTrips = trips.map(trip => 
      trip.id === tripId ? { ...trip, ...updatedTrip } : trip
    );
    
    saveTrips(newTrips);
    return updatedTrip;
  }, [trips, saveTrips]);

  /**
   * Delete a trip by ID
   */
  const deleteTrip = useCallback((tripId) => {
    if (!tripId) {
      throw new Error('Trip ID is required');
    }

    const newTrips = trips.filter(trip => trip.id !== tripId);
    saveTrips(newTrips);
    return tripId;
  }, [trips, saveTrips]);

  /**
   * Get a trip by ID
   */
  const getTrip = useCallback((tripId) => {
    return trips.find(trip => trip.id === tripId) || null;
  }, [trips]);

  /**
   * Clear all trips
   */
  const clearTrips = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setTrips([]);
      console.log('All trips cleared from localStorage');
    } catch (err) {
      console.error('Failed to clear trips from localStorage:', err);
      setError(err);
      throw err;
    }
  }, [key]);

  /**
   * Export trip as GPX string
   */
  const exportTripGPX = useCallback((tripId) => {
    const trip = getTrip(tripId);
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
  }, [getTrip]);

  /**
   * Export trip as GeoJSON
   */
  const exportTripGeoJSON = useCallback((tripId) => {
    const trip = getTrip(tripId);
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
  }, [getTrip]);

  /**
   * Get storage statistics
   */
  const getStorageStats = useCallback(() => {
    try {
      const data = localStorage.getItem(key);
      const sizeInBytes = data ? new Blob([data]).size : 0;
      const sizeInKB = Math.round(sizeInBytes / 1024 * 100) / 100;
      
      return {
        tripCount: trips.length,
        sizeInBytes,
        sizeInKB,
        totalPoints: trips.reduce((sum, trip) => sum + trip.points.length, 0)
      };
    } catch (err) {
      console.error('Failed to calculate storage stats:', err);
      return {
        tripCount: 0,
        sizeInBytes: 0,
        sizeInKB: 0,
        totalPoints: 0
      };
    }
  }, [key, trips]);

  /**
   * Download file helper
   */
  const downloadFile = useCallback((content, filename, contentType = 'text/plain') => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }, []);

  /**
   * Export trip and download file
   */
  const downloadTripGPX = useCallback((tripId) => {
    const gpx = exportTripGPX(tripId);
    const trip = getTrip(tripId);
    const filename = `trip_${trip.id.substring(0, 8)}_${new Date(trip.startTime).toISOString().split('T')[0]}.gpx`;
    downloadFile(gpx, filename, 'application/gpx+xml');
  }, [exportTripGPX, getTrip, downloadFile]);

  /**
   * Export trip as GeoJSON and download
   */
  const downloadTripGeoJSON = useCallback((tripId) => {
    const geoJSON = exportTripGeoJSON(tripId);
    const trip = getTrip(tripId);
    const filename = `trip_${trip.id.substring(0, 8)}_${new Date(trip.startTime).toISOString().split('T')[0]}.geojson`;
    downloadFile(JSON.stringify(geoJSON, null, 2), filename, 'application/geo+json');
  }, [exportTripGeoJSON, getTrip, downloadFile]);

  /**
   * Sort trips by date (newest first)
   */
  const sortedTrips = [...trips].sort((a, b) => b.startTime - a.startTime);

  // Load trips on mount
  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  return {
    // State
    trips: sortedTrips,
    isLoading,
    error,
    
    // Actions
    addTrip,
    updateTrip,
    deleteTrip,
    getTrip,
    clearTrips,
    loadTrips,
    
    // Export functions
    exportTripGPX,
    exportTripGeoJSON,
    downloadTripGPX,
    downloadTripGeoJSON,
    
    // Utilities
    getStorageStats
  };
};

export default useLocalStorage;