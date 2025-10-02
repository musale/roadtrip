/**
 * MapView - MapLibre GL JS integration with canvas fallback
 * 
 * Provides real-time trip tracking visualization with live track updates,
 * follow mode, and fit-to-bounds functionality. Falls back to simple
 * canvas drawing when MapLibre is unavailable.
 */

class MapView {
    constructor(opts = {}) {
        this.container = opts.container;
        this.useMapLibre = opts.useMapLibre !== false;
        this.initialCenter = opts.initialCenter || [36.8219, -1.2921]; // Default to Nairobi
        this.initialZoom = opts.initialZoom || 14;
        
        this.map = null;
        this.canvas = null;
        this.ctx = null;
        this.isFollowing = true;
        this.points = [];
        this.currentPoint = null;
        this.lastUpdateTime = 0;
        this.updateThrottle = 100; // Max 10 Hz updates
        
        // Bind methods
        this.updateLiveTrack = this.updateLiveTrack.bind(this);
        this.setCurrentPoint = this.setCurrentPoint.bind(this);
        this.setFollow = this.setFollow.bind(this);
        this.fitBoundsToPoints = this.fitBoundsToPoints.bind(this);
        
        // Debug hooks
        if (typeof window !== 'undefined') {
            window.__debugMap = {
                fit: () => this.fitBoundsToPoints(this.points),
                follow: (on) => this.setFollow(on),
                points: () => this.points,
                mapInstance: () => this.map
            };
        }
    }

    /**
     * Initialize MapLibre or canvas fallback
     */
    async init() {
        try {
            if (this.useMapLibre && typeof maplibregl !== 'undefined') {
                await this.initMapLibre();
                console.log('MapView initialized with MapLibre GL');
            } else {
                await this.initCanvasFallback();
                console.log('MapView initialized with canvas fallback');
            }
        } catch (error) {
            console.warn('MapLibre failed, falling back to canvas:', error);
            await this.initCanvasFallback();
        }
    }

    /**
     * Initialize MapLibre GL map
     */
    async initMapLibre() {
        // Create map container
        const mapDiv = this.container.querySelector('#map');
        if (!mapDiv) {
            throw new Error('Map container #map not found');
        }

        this.map = new maplibregl.Map({
            container: mapDiv,
            style: 'https://demotiles.maplibre.org/style.json',
            center: this.initialCenter,
            zoom: this.initialZoom,
            attributionControl: false
        });

        // Wait for map to load
        await new Promise((resolve, reject) => {
            this.map.on('load', resolve);
            this.map.on('error', reject);
        });

        // Add track source and layer
        this.map.addSource('track', {
            type: 'geojson',
            data: {
                type: 'LineString',
                coordinates: []
            }
        });

        this.map.addLayer({
            id: 'track-line',
            type: 'line',
            source: 'track',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#00ff88',
                'line-width': 4,
                'line-opacity': 0.8
            }
        });

        // Add current position source and layer
        this.map.addSource('cursor', {
            type: 'geojson',
            data: {
                type: 'Point',
                coordinates: this.initialCenter
            }
        });

        this.map.addLayer({
            id: 'cursor-point',
            type: 'circle',
            source: 'cursor',
            paint: {
                'circle-radius': 8,
                'circle-color': '#ff4444',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-opacity': 0.9
            }
        });

        // Add accuracy circle layer
        this.map.addSource('accuracy', {
            type: 'geojson',
            data: {
                type: 'Point',
                coordinates: this.initialCenter
            }
        });

        this.map.addLayer({
            id: 'accuracy-circle',
            type: 'circle',
            source: 'accuracy',
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, ['*', ['get', 'accuracy', ['get', 'properties']], 0.1],
                    20, ['*', ['get', 'accuracy', ['get', 'properties']], 2]
                ],
                'circle-color': '#00ff88',
                'circle-opacity': 0.1,
                'circle-stroke-color': '#00ff88',
                'circle-stroke-width': 1,
                'circle-stroke-opacity': 0.3
            }
        });

        // Try to get user location for initial center
        this.getUserLocation().then(center => {
            if (center && this.points.length === 0) {
                this.map.setCenter(center);
            }
        }).catch(() => {
            // Ignore geolocation errors
        });
    }

    /**
     * Initialize canvas fallback
     */
    async initCanvasFallback() {
        const mapFallback = this.container.querySelector('#mapFallback');
        if (!mapFallback) {
            throw new Error('Canvas fallback #mapFallback not found');
        }

        this.canvas = mapFallback;
        this.ctx = this.canvas.getContext('2d');
        
        // Setup high-DPI canvas
        this.setupCanvas();
        
        // Hide map div and show canvas
        const mapDiv = this.container.querySelector('#map');
        if (mapDiv) mapDiv.style.display = 'none';
        this.canvas.style.display = 'block';

        // Initial draw
        this.drawCanvas();

        // Try to get user location for initial center
        this.getUserLocation().then(center => {
            if (center && this.points.length === 0) {
                this.canvasCenter = center;
                this.drawCanvas();
            }
        }).catch(() => {
            // Use default center
            this.canvasCenter = this.initialCenter;
        });
    }

    /**
     * Setup high-DPI canvas
     */
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(dpr, dpr);
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
        this.canvasCenter = this.initialCenter;
        this.canvasZoom = this.initialZoom;
    }

    /**
     * Get user's current location
     */
    getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => {
                    resolve([position.coords.longitude, position.coords.latitude]);
                },
                error => reject(error),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 30000
                }
            );
        });
    }

    /**
     * Update live track with new points
     */
    updateLiveTrack(points) {
        // Throttle updates
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateThrottle) {
            return;
        }
        this.lastUpdateTime = now;

        this.points = points || [];
        
        if (this.map) {
            this.updateMapLibreTrack();
        } else if (this.canvas) {
            this.drawCanvas();
        }
    }

    /**
     * Update MapLibre track
     */
    updateMapLibreTrack() {
        if (!this.map || this.points.length === 0) return;

        const coordinates = this.points.map(p => [p.lon, p.lat]);
        
        this.map.getSource('track').setData({
            type: 'LineString',
            coordinates: coordinates
        });

        // Follow the latest point if following is enabled
        if (this.isFollowing && coordinates.length > 0) {
            const latest = coordinates[coordinates.length - 1];
            this.map.easeTo({
                center: latest,
                duration: 400
            });
        }
    }

    /**
     * Set current point (user location)
     */
    setCurrentPoint(point) {
        this.currentPoint = point;
        
        if (this.map && point) {
            // Update cursor position
            this.map.getSource('cursor').setData({
                type: 'Point',
                coordinates: [point.lon, point.lat]
            });

            // Update accuracy circle if accuracy is available and reasonable
            if (point.accuracy && point.accuracy <= 50) {
                this.map.getSource('accuracy').setData({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [point.lon, point.lat]
                    },
                    properties: {
                        accuracy: point.accuracy
                    }
                });
            }
        } else if (this.canvas) {
            this.drawCanvas();
        }
    }

    /**
     * Set follow mode
     */
    setFollow(on) {
        this.isFollowing = on;
        
        if (on && this.currentPoint) {
            if (this.map) {
                this.map.easeTo({
                    center: [this.currentPoint.lon, this.currentPoint.lat],
                    duration: 400
                });
            } else if (this.canvas) {
                this.canvasCenter = [this.currentPoint.lon, this.currentPoint.lat];
                this.drawCanvas();
            }
        }
    }

    /**
     * Fit bounds to all points
     */
    fitBoundsToPoints(points) {
        if (!points || points.length === 0) return;

        if (this.map) {
            const coordinates = points.map(p => [p.lon, p.lat]);
            
            if (coordinates.length === 1) {
                // Single point - center on it
                this.map.easeTo({
                    center: coordinates[0],
                    zoom: this.initialZoom,
                    duration: 1000
                });
            } else {
                // Multiple points - fit bounds
                const bounds = coordinates.reduce((bounds, coord) => {
                    return bounds.extend(coord);
                }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

                this.map.fitBounds(bounds, {
                    padding: 48,
                    duration: 1000
                });
            }
        } else if (this.canvas) {
            this.fitCanvasBounds(points);
        }
    }

    /**
     * Fit canvas bounds to points
     */
    fitCanvasBounds(points) {
        if (points.length === 0) return;

        if (points.length === 1) {
            this.canvasCenter = [points[0].lon, points[0].lat];
        } else {
            // Calculate bounds
            let minLon = points[0].lon, maxLon = points[0].lon;
            let minLat = points[0].lat, maxLat = points[0].lat;

            points.forEach(p => {
                minLon = Math.min(minLon, p.lon);
                maxLon = Math.max(maxLon, p.lon);
                minLat = Math.min(minLat, p.lat);
                maxLat = Math.max(maxLat, p.lat);
            });

            // Center on bounds
            this.canvasCenter = [
                (minLon + maxLon) / 2,
                (minLat + maxLat) / 2
            ];

            // Adjust zoom to fit bounds with padding
            const lonSpan = maxLon - minLon;
            const latSpan = maxLat - minLat;
            const maxSpan = Math.max(lonSpan, latSpan);
            
            if (maxSpan > 0) {
                // Simple zoom calculation (adjust as needed)
                this.canvasZoom = Math.max(10, 18 - Math.log2(maxSpan * 100));
            }
        }

        this.drawCanvas();
    }

    /**
     * Draw canvas fallback
     */
    drawCanvas() {
        if (!this.ctx) return;

        // Clear canvas
        this.ctx.fillStyle = '#2d3748';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Draw coordinate system info
        this.ctx.fillStyle = '#4a5568';
        this.ctx.font = '12px monospace';
        this.ctx.fillText(`Center: ${this.canvasCenter[1].toFixed(4)}, ${this.canvasCenter[0].toFixed(4)}`, 10, 20);
        this.ctx.fillText(`Zoom: ${this.canvasZoom.toFixed(1)}`, 10, 35);

        if (this.points.length > 0) {
            this.drawTrackOnCanvas();
        }

        if (this.currentPoint) {
            this.drawCurrentPointOnCanvas();
        }

        // Draw center crosshair
        this.ctx.strokeStyle = '#4a5568';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvasWidth / 2 - 10, this.canvasHeight / 2);
        this.ctx.lineTo(this.canvasWidth / 2 + 10, this.canvasHeight / 2);
        this.ctx.moveTo(this.canvasWidth / 2, this.canvasHeight / 2 - 10);
        this.ctx.lineTo(this.canvasWidth / 2, this.canvasHeight / 2 + 10);
        this.ctx.stroke();
    }

    /**
     * Draw track on canvas
     */
    drawTrackOnCanvas() {
        if (this.points.length < 2) return;

        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalAlpha = 0.8;

        this.ctx.beginPath();
        let first = true;

        this.points.forEach(point => {
            const screenPos = this.lonLatToScreen(point.lon, point.lat);
            
            if (first) {
                this.ctx.moveTo(screenPos.x, screenPos.y);
                first = false;
            } else {
                this.ctx.lineTo(screenPos.x, screenPos.y);
            }
        });

        this.ctx.stroke();
        this.ctx.globalAlpha = 1;
    }

    /**
     * Draw current point on canvas
     */
    drawCurrentPointOnCanvas() {
        const screenPos = this.lonLatToScreen(this.currentPoint.lon, this.currentPoint.lat);
        
        // Draw accuracy circle if available
        if (this.currentPoint.accuracy && this.currentPoint.accuracy <= 50) {
            const radiusMeters = this.currentPoint.accuracy;
            const radiusPixels = this.metersToPixels(radiusMeters);
            
            this.ctx.strokeStyle = '#00ff88';
            this.ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
            this.ctx.lineWidth = 1;
            this.ctx.globalAlpha = 0.5;
            
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, radiusPixels, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.globalAlpha = 1;
        }

        // Draw current position marker
        this.ctx.fillStyle = '#ff4444';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, 8, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
    }

    /**
     * Convert lon/lat to screen coordinates
     */
    lonLatToScreen(lon, lat) {
        // Simple Web Mercator projection for canvas fallback
        const centerLon = this.canvasCenter[0];
        const centerLat = this.canvasCenter[1];
        
        // Scale factor based on zoom level
        const scale = Math.pow(2, this.canvasZoom - 10) * 100000;
        
        const x = this.canvasWidth / 2 + (lon - centerLon) * scale;
        const y = this.canvasHeight / 2 - (lat - centerLat) * scale;
        
        return { x, y };
    }

    /**
     * Convert meters to pixels at current zoom
     */
    metersToPixels(meters) {
        // Rough approximation for canvas fallback
        const scale = Math.pow(2, this.canvasZoom - 10) * 100000;
        const metersPerDegree = 111000; // Rough approximation
        return (meters / metersPerDegree) * scale;
    }

    /**
     * Destroy the map view
     */
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        
        this.canvas = null;
        this.ctx = null;
        this.points = [];
        this.currentPoint = null;
        
        // Clear debug hooks
        if (typeof window !== 'undefined' && window.__debugMap) {
            delete window.__debugMap;
        }
    }
}

export default MapView;