// src/MapView.js

// MapLibre GL is loaded via CDN in index.html, so we assume it's globally available as `maplibregl`

class MapView {
  constructor({ container, useMapLibre = true, initialCenter = [0, 0], initialZoom = 2 }) {
    this.container = container;
    this.useMapLibre = useMapLibre;
    this.initialCenter = initialCenter;
    this.initialZoom = initialZoom;
    this.map = null;
    this.canvasFallback = null;
    this.ctx = null;
    this.liveTrackSourceId = 'liveTrack';
    this.currentPointSourceId = 'currentPoint';
    this.follow = false;
    this.currentPoints = [];
    this.currentMapCenter = initialCenter;
  }

  init() {
    if (this.useMapLibre && typeof maplibregl !== 'undefined') {
      this._initMapLibre();
    } else {
      console.warn("MapLibre GL not available or disabled, falling back to canvas.");
      this._initCanvasFallback();
    }
  }

  _initMapLibre() {
    this.map = new maplibregl.Map({
      container: this.container,
      style: 'https://demotiles.maplibre.org/style.json', // Open demo style
      center: this.initialCenter,
      zoom: this.initialZoom,
    });

    this.map.on('load', () => {
      this.map.addSource(this.liveTrackSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      this.map.addLayer({
        id: 'trackLine',
        type: 'line',
        source: this.liveTrackSourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#00F5D4',
          'line-width': 5,
        },
      });

      this.map.addSource(this.currentPointSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      this.map.addLayer({
        id: 'currentPoint',
        type: 'circle',
        source: this.currentPointSourceId,
        paint: {
          'circle-radius': 8,
          'circle-color': '#FF1B9B',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });

      // Handle tile loading errors to potentially switch to canvas fallback
      this.map.on('error', (e) => {
        if (e.error && e.error.message.includes('Failed to load style')) {
          console.error("MapLibre GL style/tile loading error, switching to canvas fallback:", e.error);
          this.destroy();
          this._initCanvasFallback();
        }
      });
    });

    this.map.on('move', () => {
      if (!this.follow) {
        this.currentMapCenter = this.map.getCenter().toArray();
      }
    });
  }

  _initCanvasFallback() {
    this.canvasFallback = document.createElement('canvas');
    this.canvasFallback.id = 'mapCanvasFallback';
    this.canvasFallback.style.width = '100%';
    this.canvasFallback.style.height = '100%';
    this.container.appendChild(this.canvasFallback);
    this.ctx = this.canvasFallback.getContext('2d');
    this._resizeCanvasFallback();
    window.addEventListener('resize', this._resizeCanvasFallback.bind(this));

    // Initial draw
    this._drawCanvasTrack();
  }

  _resizeCanvasFallback() {
    if (!this.canvasFallback) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvasFallback.width = this.container.clientWidth * dpr;
    this.canvasFallback.height = this.container.clientHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this._drawCanvasTrack();
  }

  _drawCanvasTrack() {
    if (!this.ctx || this.currentPoints.length < 2) return;

    this.ctx.clearRect(0, 0, this.canvasFallback.width, this.canvasFallback.height);

    // Simple projection for canvas fallback (very basic, not geographically accurate)
    // This would need a proper projection library for real-world use
    const minLon = Math.min(...this.currentPoints.map(p => p.lon));
    const maxLon = Math.max(...this.currentPoints.map(p => p.lon));
    const minLat = Math.min(...this.currentPoints.map(p => p.lat));
    const maxLat = Math.max(...this.currentPoints.map(p => p.lat));

    const lonRange = maxLon - minLon;
    const latRange = maxLat - minLat;

    const padding = 0.1; // 10% padding
    const effectiveWidth = this.canvasFallback.width / (window.devicePixelRatio || 1) * (1 - 2 * padding);
    const effectiveHeight = this.canvasFallback.height / (window.devicePixelRatio || 1) * (1 - 2 * padding);

    const scaleX = effectiveWidth / (lonRange || 1);
    const scaleY = effectiveHeight / (latRange || 1);

    const offsetX = (this.canvasFallback.width / (window.devicePixelRatio || 1)) * padding - minLon * scaleX;
    const offsetY = (this.canvasFallback.height / (window.devicePixelRatio || 1)) * padding + maxLat * scaleY; // Y-axis inverted

    const project = (lon, lat) => ({
      x: lon * scaleX + offsetX,
      y: -lat * scaleY + offsetY,
    });

    this.ctx.beginPath();
    this.ctx.strokeStyle = '#00F5D4';
    this.ctx.lineWidth = 3;

    const startPoint = project(this.currentPoints[0].lon, this.currentPoints[0].lat);
    this.ctx.moveTo(startPoint.x, startPoint.y);

    for (let i = 1; i < this.currentPoints.length; i++) {
      const p = this.currentPoints[i];
      const projected = project(p.lon, p.lat);
      this.ctx.lineTo(projected.x, projected.y);
    }
    this.ctx.stroke();

    // Draw current point
    const currentP = this.currentPoints[this.currentPoints.length - 1];
    const projectedCurrent = project(currentP.lon, currentP.lat);
    this.ctx.beginPath();
    this.ctx.arc(projectedCurrent.x, projectedCurrent.y, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = '#FF1B9B';
    this.ctx.fill();
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  setFollow(on) {
    this.follow = on;
  }

  updateLiveTrack(points) {
    this.currentPoints = points;

    if (this.map) {
      const geojsonLine = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: points.map(p => [p.lon, p.lat]),
        },
      };
      this.map.getSource(this.liveTrackSourceId).setData(geojsonLine);

      if (this.follow && points.length > 0) {
        const lastPoint = points[points.length - 1];
        this.map.setCenter([lastPoint.lon, lastPoint.lat]);
      }
    } else if (this.canvasFallback) {
      this._drawCanvasTrack();
    }
  }

  setCurrentPoint(p) {
    if (this.map) {
      const geojsonPoint = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.lon, p.lat],
        },
      };
      this.map.getSource(this.currentPointSourceId).setData(geojsonPoint);
    } else if (this.canvasFallback) {
      // Current point is drawn as part of _drawCanvasTrack
    }
  }

  fitBoundsToPoints(points) {
    if (!points || points.length < 2) return;

    if (this.map) {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach(p => bounds.extend([p.lon, p.lat]));
      this.map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    } else if (this.canvasFallback) {
      // For canvas, fitting bounds means re-calculating projection, which is done on each draw
      this._drawCanvasTrack();
    }
  }

  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this.canvasFallback) {
      this.canvasFallback.remove();
      this.canvasFallback = null;
      window.removeEventListener('resize', this._resizeCanvasFallback.bind(this));
    }
  }
}

export default MapView;
