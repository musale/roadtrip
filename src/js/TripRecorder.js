/**
 * TripRecorder - A minimal JavaScript module for recording GPS trips
 * Supports trip recording, geolocation tracking, and data export in GPX/GeoJSON formats
 */

class TripRecorder {
    constructor() {
        this.currentTrip = null;
        this.watchId = null;
        this.isTracking = false;
    }

    /**
     * Generate a simple UUID v4
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Calculate Haversine distance between two points in meters
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Calculate speed using moving average of last 3 points
     */
    calculateSmoothedSpeed(points) {
        if (points.length < 2) return 0;
        
        const recentPoints = points.slice(-3); // Get last 3 points
        let totalSpeed = 0;
        let validSpeeds = 0;

        for (let i = 1; i < recentPoints.length; i++) {
            const prev = recentPoints[i - 1];
            const curr = recentPoints[i];
            const distance = this.calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
            const timeDelta = (curr.timestamp - prev.timestamp) / 1000; // Convert to seconds
            
            if (timeDelta > 0) {
                totalSpeed += distance / timeDelta; // m/s
                validSpeeds++;
            }
        }

        return validSpeeds > 0 ? totalSpeed / validSpeeds : 0;
    }

    /**
     * Create a new trip data structure
     */
    createTrip() {
        return {
            id: this.generateUUID(),
            startTime: Date.now(),
            endTime: null,
            points: [],
            stats: {
                distanceMeters: 0,
                durationMs: 0,
                avgSpeedKph: 0
            }
        };
    }

    /**
     * Create a new point data structure
     */
    createPoint(position, speed = 0) {
        return {
            timestamp: Date.now(),
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: speed // m/s
        };
    }

    /**
     * Handle geolocation position updates
     */
    handlePositionUpdate(position) {
        if (!this.currentTrip || !this.isTracking) return;

        // Ignore inaccurate readings
        if (position.coords.accuracy > 50) {
            console.log('Ignoring inaccurate position:', position.coords.accuracy);
            return;
        }

        const speed = this.calculateSmoothedSpeed(this.currentTrip.points);
        const point = this.createPoint(position, speed);
        
        this.currentTrip.points.push(point);
        this.updateTripStats();
        
        console.log('Point recorded:', {
            lat: point.lat,
            lon: point.lon,
            accuracy: point.accuracy,
            speed: point.speed.toFixed(2) + ' m/s'
        });
    }

    /**
     * Handle geolocation errors
     */
    handlePositionError(error) {
        console.error('Geolocation error:', error.message);
    }

    /**
     * Update trip statistics
     */
    updateTripStats() {
        if (!this.currentTrip || this.currentTrip.points.length < 2) return;

        const points = this.currentTrip.points;
        let totalDistance = 0;

        // Calculate total distance
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            totalDistance += this.calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
        }

        // Calculate duration
        const duration = Date.now() - this.currentTrip.startTime;

        // Calculate average speed in km/h
        const avgSpeedKph = duration > 0 ? (totalDistance / 1000) / (duration / 3600000) : 0;

        this.currentTrip.stats = {
            distanceMeters: totalDistance,
            durationMs: duration,
            avgSpeedKph: avgSpeedKph
        };
    }

    /**
     * Start recording a new trip
     */
    startTrip() {
        if (this.isTracking) {
            console.warn('Trip already in progress');
            return this.currentTrip;
        }

        if (!navigator.geolocation) {
            throw new Error('Geolocation is not supported by this browser');
        }

        this.currentTrip = this.createTrip();
        this.isTracking = true;

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handlePositionError(error),
            options
        );

        console.log('Trip started:', this.currentTrip.id);
        return this.currentTrip;
    }

    /**
     * Stop recording the current trip
     */
    stopTrip() {
        if (!this.isTracking || !this.currentTrip) {
            console.warn('No trip in progress');
            return null;
        }

        this.isTracking = false;
        
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        this.currentTrip.endTime = Date.now();
        this.updateTripStats();

        // Optional: Save to localStorage
        this.saveToLocalStorage();

        console.log('Trip stopped:', this.currentTrip.id);
        console.log('Final stats:', this.currentTrip.stats);

        return this.currentTrip;
    }

    /**
     * Get the current active trip
     */
    getCurrentTrip() {
        return this.currentTrip;
    }

    /**
     * Export trip data as GPX XML string
     */
    exportGPX() {
        if (!this.currentTrip || this.currentTrip.points.length === 0) {
            throw new Error('No trip data to export');
        }

        const trip = this.currentTrip;
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
    }

    /**
     * Export trip data as GeoJSON FeatureCollection
     */
    exportGeoJSON() {
        if (!this.currentTrip || this.currentTrip.points.length === 0) {
            throw new Error('No trip data to export');
        }

        const trip = this.currentTrip;
        
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
    }

    /**
     * Save trip data to localStorage
     */
    saveToLocalStorage() {
        if (!this.currentTrip) return;

        try {
            const trips = this.getTripsFromLocalStorage();
            trips.push(this.currentTrip);
            localStorage.setItem('tripRecorder_trips', JSON.stringify(trips));
            console.log('Trip saved to localStorage');
        } catch (error) {
            console.error('Failed to save trip to localStorage:', error);
        }
    }

    /**
     * Get all trips from localStorage
     */
    getTripsFromLocalStorage() {
        try {
            const tripsData = localStorage.getItem('tripRecorder_trips');
            return tripsData ? JSON.parse(tripsData) : [];
        } catch (error) {
            console.error('Failed to load trips from localStorage:', error);
            return [];
        }
    }

    /**
     * Clear all trips from localStorage
     */
    clearLocalStorage() {
        try {
            localStorage.removeItem('tripRecorder_trips');
            console.log('Trip data cleared from localStorage');
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
        }
    }
}

// Export the TripRecorder class
export default TripRecorder;