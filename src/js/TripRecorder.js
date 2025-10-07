// src/TripRecorder.js

import { addTrip } from './storage/db.js';

const HAVERSINE_RADIUS_KM = 6371;

class TripRecorder {
  constructor() {
    this.currentTrip = null;
    this.watchId = null;
    this.points = [];
    this.startTime = null;
    this.lastPointTime = null;
    this.distanceM = 0;
    this.speedKph = 0;
    this.headingDeg = 0;
    this.movingTime = 0;
    this.lastPosition = null;
    this.speedReadings = [];
    this.maxSpeedKph = 0;
  }

  startTrip() {
    if (this.watchId) {
      console.warn("Trip already in progress.");
      return;
    }

    this.currentTrip = {
      id: Date.now(),
      startedAt: Date.now(),
      endedAt: null,
      points: [],
      stats: {
        distanceM: 0,
        durationMs: 0,
        avgKph: 0,
        maxKph: 0,
        movingTime: 0,
      },
    };
    this.points = [];
    this.startTime = Date.now();
    this.lastPointTime = Date.now();
    this.distanceM = 0;
    this.speedKph = 0;
    this.headingDeg = 0;
    this.movingTime = 0;
    this.lastPosition = null;
    this.speedReadings = [];
    this.maxSpeedKph = 0;

    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    };

    this.watchId = navigator.geolocation.watchPosition(
      this._handlePosition.bind(this),
      this._handlePositionError.bind(this),
      options
    );
    console.log("Trip started.");
  }

  async stopTrip() {
    if (!this.watchId) {
      console.warn("No trip in progress.");
      return;
    }

    navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.currentTrip.endedAt = Date.now();
    this.currentTrip.points = this.points;
    this.currentTrip.stats.distanceM = this.distanceM;
    this.currentTrip.stats.durationMs = this.currentTrip.endedAt - this.startTime;
    this.currentTrip.stats.maxKph = this.maxSpeedKph;
    this.currentTrip.stats.movingTime = this.movingTime;
    this.currentTrip.stats.avgKph = this.distanceM > 0 ? (this.distanceM / 1000) / (this.movingTime / (1000 * 60 * 60)) : 0;

    await addTrip(this.currentTrip);
    console.log("Trip stopped and saved:", this.currentTrip);

    const tripToReturn = { ...this.currentTrip };
    this.currentTrip = null; // Clear current trip after saving
    return tripToReturn;
  }

  _handlePosition(position) {
    const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;
    const t = Date.now();

    const point = {
      t,
      lat: latitude,
      lon: longitude,
      acc: accuracy,
      alt: altitude,
    };

    if (this.lastPosition) {
      const { distance, bearing } = this._haversineDistance(
        this.lastPosition.lat,
        this.lastPosition.lon,
        latitude,
        longitude
      );
      this.distanceM += distance;

      const timeDiffSeconds = (t - this.lastPointTime) / 1000;
      if (timeDiffSeconds > 0) {
        const currentSpeedMps = distance / timeDiffSeconds;
        this.speedKph = currentSpeedMps * 3.6; // m/s to km/h
        this.speedReadings.push(this.speedKph);
        if (this.speedReadings.length > 10) {
          this.speedReadings.shift(); // Keep last 10 readings for moving average
        }
        point.v = this.speedKph; // Store instantaneous speed
        this.maxSpeedKph = Math.max(this.maxSpeedKph, this.speedKph);

        // Update moving time if speed is above a threshold (e.g., 1 km/h)
        if (this.speedKph > 1) {
          this.movingTime += (t - this.lastPointTime);
        }
      }
      this.headingDeg = heading !== null ? heading : bearing; // Use device heading if available, else bearing
      point.hdg = this.headingDeg;
    } else {
      point.v = 0;
      point.hdg = 0;
    }

    this.points.push(point);
    this.lastPosition = { lat: latitude, lon: longitude };
    this.lastPointTime = t;

    // console.log("New point:", point);
  }

  _handlePositionError(error) {
    console.error("Geolocation error:", error);
    // TODO: Display user-friendly error message
  }

  _haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = HAVERSINE_RADIUS_KM * 1000; // in meters

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const l1 = toRad(lat1);
    const l2 = toRad(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(l1) * Math.cos(l2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in meters

    // Calculate bearing (heading)
    const y = Math.sin(dLon) * Math.cos(l2);
    const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLon);
    const bearing = (toRad(360) + Math.atan2(y, x)) % toRad(360);
    const bearingDeg = (bearing * 180) / Math.PI;

    return { distance, bearing: bearingDeg };
  }

  getCurrentTrip() {
    if (!this.currentTrip) return null;

    const durationMs = Date.now() - this.startTime;
    const currentAvgKph = this.distanceM > 0 ? (this.distanceM / 1000) / (this.movingTime / (1000 * 60 * 60)) : 0;

    // Simple moving average for speed smoothing
    const smoothedSpeedKph = this.speedReadings.length > 0
      ? this.speedReadings.reduce((sum, s) => sum + s, 0) / this.speedReadings.length
      : 0;

    return {
      ...this.currentTrip,
      points: this.points,
      stats: {
        distanceM: this.distanceM,
        durationMs: durationMs,
        avgKph: currentAvgKph,
        maxKph: this.maxSpeedKph,
        movingTime: this.movingTime,
      },
      live: {
        speedKph: smoothedSpeedKph,
        headingDeg: this.headingDeg,
        elapsedMs: durationMs,
      }
    };
  }

  exportGPX(trip) {
    if (!trip || !trip.points || trip.points.length === 0) {
      return null;
    }

    let gpx = '<gpx version="1.1" creator="RoadTrip" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">';
    gpx += `<trk><name>RoadTrip - ${new Date(trip.startedAt).toLocaleString()}</name><trkseg>`;

    trip.points.forEach(p => {
      gpx += `<trkpt lat="${p.lat}" lon="${p.lon}">`;
      gpx += `<time>${new Date(p.t).toISOString()}</time>`;
      if (p.alt !== undefined) gpx += `<ele>${p.alt}</ele>`;
      if (p.v !== undefined) gpx += `<speed>${p.v / 3.6}</speed>`; // km/h to m/s
      if (p.hdg !== undefined) gpx += `<course>${p.hdg}</course>`;
      gpx += `</trkpt>`;
    });

    gpx += `</trkseg></trk></gpx>`;
    return new Blob([gpx], { type: 'application/gpx+xml' });
  }

  exportGeoJSON(trip) {
    if (!trip || !trip.points || trip.points.length === 0) {
      return null;
    }

    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: `RoadTrip - ${new Date(trip.startedAt).toLocaleString()}`,
            startedAt: new Date(trip.startedAt).toISOString(),
            endedAt: new Date(trip.endedAt).toISOString(),
            distanceM: trip.stats.distanceM,
            durationMs: trip.stats.durationMs,
            avgKph: trip.stats.avgKph,
            maxKph: trip.stats.maxKph,
            movingTime: trip.stats.movingTime,
          },
          geometry: {
            type: 'LineString',
            coordinates: trip.points.map(p => [p.lon, p.lat, p.alt || 0]),
          },
        },
        // Optionally add points as individual features
        ...trip.points.map(p => ({
          type: 'Feature',
          properties: {
            time: new Date(p.t).toISOString(),
            speedKph: p.v,
            headingDeg: p.hdg,
            accuracy: p.acc,
            altitude: p.alt,
          },
          geometry: {
            type: 'Point',
            coordinates: [p.lon, p.lat, p.alt || 0],
          },
        }))
      ],
    };
    return new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  }
}

export default TripRecorder;
