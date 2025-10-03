/**
 * MapView - Real-time map visualization component with MapLibre GL integration
 * Provides live GPS track rendering, current position marker, and map controls
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useAppContext } from '../context/AppContext';

const MapView = ({ className = "" }) => {
  const mapContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [useCanvasFallback, setUseCanvasFallback] = useState(false);
  const lastUpdateRef = useRef(0);
  const trackSourceRef = useRef(null);
  
  const { 
    state, 
    tripRecorder, 
    geolocation, 
    actions 
  } = useAppContext();
  
  const { currentTrip, stats } = tripRecorder;
  const { position } = geolocation;
  const { followMode } = state;

  // MapLibre GL constants
  const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';
  const DEFAULT_CENTER = [36.8219, -1.2921]; // Nairobi coordinates
  const DEFAULT_ZOOM = 14;
  const UPDATE_THROTTLE = 100; // ms between map updates

  /**
   * Initialize MapLibre GL map
   */
  const initMapLibre = useCallback(async () => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      // Dynamically import MapLibre GL
      const maplibregl = await import('maplibre-gl');
      
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLE,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
        antialias: true
      });

      // Store map reference
      mapRef.current = map;
      actions.setMapInstance(map);

      // Wait for map to load
      map.on('load', () => {
        console.log('MapLibre GL loaded successfully');
        
        // Add GPS track source and layer
        map.addSource('track', {
          type: 'geojson',
          data: {
            type: 'LineString',
            coordinates: []
          }
        });

        map.addLayer({
          id: 'track-line',
          type: 'line',
          source: 'track',
          paint: {
            'line-color': '#00f5d4', // Brand neon color
            'line-width': 4,
            'line-opacity': 0.8
          }
        });

        // Add current position source and layer
        map.addSource('current-position', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: DEFAULT_CENTER
            }
          }
        });

        map.addLayer({
          id: 'current-position-circle',
          type: 'circle',
          source: 'current-position',
          paint: {
            'circle-radius': 8,
            'circle-color': '#ff1b9b', // Accent color
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-opacity': 0.8
          }
        });

        // Add accuracy circle layer
        map.addLayer({
          id: 'accuracy-circle',
          type: 'circle',
          source: 'current-position',
          paint: {
            'circle-radius': {
              type: 'identity',
              property: 'accuracy'
            },
            'circle-color': 'rgba(0, 245, 212, 0.1)',
            'circle-stroke-color': 'rgba(0, 245, 212, 0.3)',
            'circle-stroke-width': 1,
            'circle-opacity': 0.3
          }
        });

        trackSourceRef.current = map.getSource('track');
        setMapLoaded(true);
      });

      map.on('error', (e) => {
        console.warn('MapLibre GL error, falling back to canvas:', e);
        setUseCanvasFallback(true);
        actions.setError('Map tiles failed to load, using offline mode');
      });

      // Handle map style errors
      map.on('styledata', () => {
        if (map.isStyleLoaded()) {
          console.log('Map style loaded successfully');
        }
      });

    } catch (error) {
      console.warn('MapLibre GL failed to initialize, using canvas fallback:', error);
      setUseCanvasFallback(true);
      actions.setError('Map failed to initialize, using offline mode');
    }
  }, [actions]);

  /**
   * Canvas fallback implementation
   */
  const initCanvasFallback = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set actual size in memory (scaled up for high-DPI)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Scale back down using CSS
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Scale the drawing context
    ctx.scale(dpr, dpr);

    console.log('Canvas fallback initialized');
    setMapLoaded(true);
  }, []);

  /**
   * Draw canvas fallback map
   */
  const drawCanvasMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !useCanvasFallback) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Grid pattern for map-like appearance
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Center coordinates display
    ctx.font = '16px var(--nv-font-mono, monospace)';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('Offline Map Mode', width / 2, height / 2 - 40);
    ctx.fillText('GPS tracking active', width / 2, height / 2 - 20);
    
    if (position) {
      ctx.fillText(
        `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
        width / 2,
        height / 2
      );
      ctx.fillText(
        `Accuracy: ${Math.round(position.coords.accuracy)}m`,
        width / 2,
        height / 2 + 20
      );
    }

    // Trip stats
    if (currentTrip && currentTrip.points.length > 0) {
      ctx.fillText(
        `Points: ${currentTrip.points.length}`,
        width / 2,
        height / 2 + 50
      );
    }

    // Current position indicator
    if (position) {
      ctx.fillStyle = '#ff1b9b';
      ctx.beginPath();
      ctx.arc(width / 2, height / 2 + 80, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Pulsing effect
      const pulse = Math.abs(Math.sin(Date.now() * 0.005));
      ctx.fillStyle = `rgba(255, 27, 155, ${0.3 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2 + 80, 15, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [useCanvasFallback, position, currentTrip]);

  /**
   * Update MapLibre track with new GPS points
   */
  const updateMapTrack = useCallback(() => {
    if (!mapRef.current || !mapLoaded || !trackSourceRef.current || useCanvasFallback) return;
    if (!currentTrip || currentTrip.points.length === 0) return;

    // Throttle updates for performance
    const now = Date.now();
    if (now - lastUpdateRef.current < UPDATE_THROTTLE) return;
    lastUpdateRef.current = now;

    const coordinates = currentTrip.points.map(point => [point.lon, point.lat]);
    
    trackSourceRef.current.setData({
      type: 'LineString',
      coordinates
    });

    // Update current position
    if (position) {
      const currentPositionSource = mapRef.current.getSource('current-position');
      if (currentPositionSource) {
        currentPositionSource.setData({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [position.coords.longitude, position.coords.latitude]
          },
          properties: {
            accuracy: position.coords.accuracy || 10
          }
        });
      }

      // Follow mode: center map on current position
      if (followMode) {
        mapRef.current.easeTo({
          center: [position.coords.longitude, position.coords.latitude],
          duration: 1000
        });
      }
    }
  }, [mapLoaded, currentTrip, position, followMode, useCanvasFallback]);

  /**
   * Fit map bounds to show entire trip
   */
  const fitBoundsToTrip = useCallback(() => {
    if (!mapRef.current || !mapLoaded || useCanvasFallback) return;
    if (!currentTrip || currentTrip.points.length === 0) return;

    const coordinates = currentTrip.points.map(point => [point.lon, point.lat]);
    
    if (coordinates.length === 1) {
      // Single point - just center on it
      mapRef.current.easeTo({
        center: coordinates[0],
        zoom: 16,
        duration: 1000
      });
      return;
    }

    // Calculate bounds
    const bounds = coordinates.reduce((bounds, coord) => {
      return [
        [Math.min(coord[0], bounds[0][0]), Math.min(coord[1], bounds[0][1])], // SW
        [Math.max(coord[0], bounds[1][0]), Math.max(coord[1], bounds[1][1])]  // NE
      ];
    }, [[coordinates[0][0], coordinates[0][1]], [coordinates[0][0], coordinates[0][1]]]);

    mapRef.current.fitBounds(bounds, {
      padding: 50,
      duration: 1000
    });
  }, [mapLoaded, currentTrip, useCanvasFallback]);

  // Initialize map on mount
  useEffect(() => {
    if (useCanvasFallback) {
      initCanvasFallback();
    } else {
      initMapLibre();
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapLoaded(false);
      }
    };
  }, [useCanvasFallback, initMapLibre, initCanvasFallback]);

  // Update track when trip data changes
  useEffect(() => {
    if (useCanvasFallback) {
      drawCanvasMap();
    } else {
      updateMapTrack();
    }
  }, [updateMapTrack, drawCanvasMap, useCanvasFallback]);

  // Canvas animation loop for fallback mode
  useEffect(() => {
    if (!useCanvasFallback) return;

    const animate = () => {
      drawCanvasMap();
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [useCanvasFallback, drawCanvasMap]);

  // Expose fit bounds function to parent components
  useEffect(() => {
    window.roadtripMapFitBounds = fitBoundsToTrip;
    return () => {
      delete window.roadtripMapFitBounds;
    };
  }, [fitBoundsToTrip]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* MapLibre GL container */}
      {!useCanvasFallback && (
        <div
          ref={mapContainerRef}
          className="absolute inset-0 w-full h-full"
          style={{
            background: 'var(--color-surface)'
          }}
        />
      )}
      
      {/* Canvas fallback */}
      {useCanvasFallback && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            background: 'var(--color-surface)',
            imageRendering: 'pixelated'
          }}
        />
      )}
      
      {/* Loading overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          <div className="text-white text-center">
            <div className="text-4xl mb-2">???</div>
            <div>Loading Map...</div>
            <div className="text-sm opacity-75 mt-1">
              {useCanvasFallback ? 'Offline Mode' : 'Connecting to map tiles'}
            </div>
          </div>
        </div>
      )}
      
      {/* Map controls overlay */}
      {mapLoaded && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          {/* Follow mode toggle */}
          <button
            onClick={actions.toggleFollowMode}
            className={`btn-secondary text-xs px-3 py-2 ${followMode ? 'bg-brand text-black' : ''}`}
            title={followMode ? 'Disable follow mode' : 'Enable follow mode'}
          >
            {followMode ? '??' : '??'}
          </button>
          
          {/* Fit bounds button */}
          <button
            onClick={fitBoundsToTrip}
            className="btn-secondary text-xs px-3 py-2"
            disabled={!currentTrip || currentTrip.points.length === 0}
            title="Fit map to trip"
          >
            ?
          </button>
        </div>
      )}
      
      {/* Trip info overlay */}
      {currentTrip && currentTrip.points.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-md text-sm">
          <div>Points: {currentTrip.points.length}</div>
          {position && (
            <div className="text-xs opacity-75">
              Last: {new Date(currentTrip.points[currentTrip.points.length - 1].timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {/* Accessibility */}
      <div className="sr-only" role="region" aria-label="Trip map">
        {useCanvasFallback ? (
          <div>
            Map is in offline mode. 
            {position && `Current position: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`}
            {currentTrip && ` Trip has ${currentTrip.points.length} recorded points.`}
          </div>
        ) : (
          <div>
            Interactive map showing trip route and current position.
            {currentTrip && ` Trip has ${currentTrip.points.length} recorded points.`}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;