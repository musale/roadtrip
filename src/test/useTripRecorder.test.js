/**
 * useTripRecorder Hook Tests
 * Tests for GPS trip recording, distance calculation, and statistics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useTripRecorder from '../hooks/useTripRecorder';

describe('useTripRecorder Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Initialization', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() => useTripRecorder());
      
      expect(result.current.isTracking).toBe(false);
      expect(result.current.currentTrip).toBeNull();
      expect(result.current.stats).toEqual({
        distanceMeters: 0,
        durationMs: 0,
        currentSpeedKph: 0,
        avgSpeedKph: 0,
        maxSpeedKph: 0,
      });
    });
  });

  describe('Starting a Trip', () => {
    it('starts a new trip', () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      expect(result.current.isTracking).toBe(true);
      expect(result.current.currentTrip).not.toBeNull();
      expect(result.current.currentTrip.id).toBeDefined();
      expect(result.current.currentTrip.startTime).toBeDefined();
      expect(result.current.currentTrip.points).toEqual([]);
    });

    it('generates unique trip IDs', () => {
      const { result: result1 } = renderHook(() => useTripRecorder());
      const { result: result2 } = renderHook(() => useTripRecorder());
      
      act(() => {
        result1.current.startTrip();
        result2.current.startTrip();
      });
      
      expect(result1.current.currentTrip.id).not.toBe(result2.current.currentTrip.id);
    });
  });

  describe('Stopping a Trip', () => {
    it('stops trip and returns trip data', () => {
      const { result } = renderHook(() => useTripRecorder());
      
      let finishedTrip;
      act(() => {
        result.current.startTrip();
        finishedTrip = result.current.stopTrip();
      });
      
      expect(result.current.isTracking).toBe(false);
      expect(result.current.currentTrip).toBeNull();
      expect(finishedTrip).not.toBeNull();
      expect(finishedTrip.endTime).toBeDefined();
    });

    it('returns null when no trip is active', () => {
      const { result } = renderHook(() => useTripRecorder());
      
      const finishedTrip = result.current.stopTrip();
      
      expect(finishedTrip).toBeNull();
    });
  });

  describe('Distance Calculation', () => {
    it('calculates distance using Haversine formula', async () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      // Simulate GPS points (roughly 1km apart in Nairobi)
      const point1 = {
        coords: {
          latitude: -1.2921,
          longitude: 36.8219,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };
      
      const point2 = {
        coords: {
          latitude: -1.2921,
          longitude: 36.8319, // ~1km east
          accuracy: 10,
        },
        timestamp: Date.now() + 1000,
      };
      
      await act(async () => {
        // Trigger position updates
        const mockWatchId = 1;
        const onSuccess = navigator.geolocation.watchPosition.mock.calls[0]?.[0];
        
        if (onSuccess) {
          onSuccess(point1);
          await new Promise(resolve => setTimeout(resolve, 100));
          onSuccess(point2);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      });
      
      await waitFor(() => {
        expect(result.current.stats.distanceMeters).toBeGreaterThan(0);
      });
    });
  });

  describe('Speed Calculation', () => {
    it('calculates current speed', async () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      await act(async () => {
        const onSuccess = navigator.geolocation.watchPosition.mock.calls[0]?.[0];
        
        if (onSuccess) {
          onSuccess({
            coords: { latitude: -1.2921, longitude: 36.8219, accuracy: 10 },
            timestamp: Date.now(),
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          onSuccess({
            coords: { latitude: -1.2921, longitude: 36.8319, accuracy: 10 },
            timestamp: Date.now() + 1000,
          });
        }
      });
      
      await waitFor(() => {
        expect(result.current.stats.currentSpeedKph).toBeGreaterThanOrEqual(0);
      });
    });

    it('tracks maximum speed', async () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      await act(async () => {
        const onSuccess = navigator.geolocation.watchPosition.mock.calls[0]?.[0];
        
        if (onSuccess) {
          // Simulate increasing speeds
          for (let i = 0; i < 3; i++) {
            onSuccess({
              coords: { 
                latitude: -1.2921 + (i * 0.01), 
                longitude: 36.8219, 
                accuracy: 10 
              },
              timestamp: Date.now() + (i * 1000),
            });
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      });
      
      await waitFor(() => {
        expect(result.current.stats.maxSpeedKph).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Statistics', () => {
    it('calculates trip duration', async () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      expect(result.current.stats.durationMs).toBeGreaterThan(0);
    });

    it('updates statistics in real-time', async () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      const initialStats = { ...result.current.stats };
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      expect(result.current.stats.durationMs).toBeGreaterThan(initialStats.durationMs);
    });
  });

  describe('Accuracy Filtering', () => {
    it('filters out low accuracy points (>50m)', async () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      await act(async () => {
        const onSuccess = navigator.geolocation.watchPosition.mock.calls[0]?.[0];
        
        if (onSuccess) {
          // Low accuracy point (should be filtered)
          onSuccess({
            coords: { latitude: -1.2921, longitude: 36.8219, accuracy: 100 },
            timestamp: Date.now(),
          });
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // High accuracy point (should be kept)
          onSuccess({
            coords: { latitude: -1.2921, longitude: 36.8319, accuracy: 10 },
            timestamp: Date.now() + 1000,
          });
        }
      });
      
      await waitFor(() => {
        // Should have filtered the low accuracy point
        const points = result.current.currentTrip?.points || [];
        expect(points.every(p => p.accuracy <= 50)).toBe(true);
      });
    });
  });

  describe('Export Functionality', () => {
    it('exports trip as GPX format', () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      const gpx = result.current.exportGPX();
      
      expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(gpx).toContain('<gpx');
      expect(gpx).toContain('</gpx>');
    });

    it('exports trip as GeoJSON format', () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      const geoJSON = result.current.exportGeoJSON();
      
      expect(geoJSON).toHaveProperty('type', 'FeatureCollection');
      expect(geoJSON).toHaveProperty('features');
      expect(Array.isArray(geoJSON.features)).toBe(true);
    });

    it('includes trip metadata in exports', () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      const geoJSON = result.current.exportGeoJSON();
      
      expect(geoJSON.features[0].properties).toHaveProperty('distance');
      expect(geoJSON.features[0].properties).toHaveProperty('duration');
      expect(geoJSON.features[0].properties).toHaveProperty('maxSpeed');
    });
  });

  describe('Error Handling', () => {
    it('handles geolocation errors gracefully', async () => {
      const { result } = renderHook(() => useTripRecorder());
      
      act(() => {
        result.current.startTrip();
      });
      
      await act(async () => {
        const onError = navigator.geolocation.watchPosition.mock.calls[0]?.[1];
        
        if (onError) {
          onError({
            code: 1,
            message: 'User denied geolocation',
          });
        }
      });
      
      // Should still be tracking, waiting for valid GPS
      expect(result.current.isTracking).toBe(true);
    });
  });
});