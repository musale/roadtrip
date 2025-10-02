# Copilot Instructions - RoadTrip App

## Project Overview

RoadTrip is a mobile-first Progressive Web App (PWA) for GPS trip recording with live HUD overlay and real-time map visualization. The app provides seamless camera/map mode switching, real-time trip tracking, statistics visualization, and data export capabilities.

### Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), CSS3, HTML5
- **Maps**: MapLibre GL JS (via CDN) with canvas fallback
- **APIs**: Geolocation API, Canvas API, Web Storage API, Wake Lock API
- **Architecture**: Component-based modular design
- **No external frameworks** - Pure web standards implementation

## Core Components

### 1. TripRecorder (`src/js/TripRecorder.js`)

**Purpose**: Core data layer for GPS trip recording and statistics calculation

**Key Features**:

- Start/stop trip recording with unique UUID generation
- High-accuracy geolocation tracking with `navigator.geolocation.watchPosition`
- Haversine formula for distance calculations between GPS points
- Speed smoothing using moving average (last 3 points)
- Quality filtering (excludes points with accuracy > 50m)
- Trip statistics: distance, duration, average/max speed
- Local storage persistence
- GPX and GeoJSON export capabilities

**Key Methods**:

- `startTrip()` - Begins GPS tracking
- `stopTrip()` - Finalizes trip and saves to localStorage
- `getCurrentStats()` - Returns real-time trip statistics
- `exportGPX()` - Exports trip as GPX XML format
- `exportGeoJSON()` - Exports trip as GeoJSON format

### 2. LiveHUD (`src/js/LiveHUD.js`)

**Purpose**: Real-time visual overlay for trip statistics display

**Key Features**:

- Canvas-based rendering with 60fps animation loop
- High-DPI display support with device pixel ratio scaling
- Large, high-contrast fonts for mobile readability
- Real-time updates from TripRecorder events
- Accessibility support with aria-live announcements
- Customizable themes and display options
- Animation control (start/stop)

**Key Methods**:

- `attach(canvas)` - Attach to HTML canvas element
- `start()` - Begin animation loop
- `stop()` - Stop animation loop
- `update(stats)` - Update displayed statistics

### 3. MapView (`src/js/MapView.js`)

**Purpose**: Real-time map visualization with live GPS track rendering

**Key Features**:

- MapLibre GL JS integration for vector maps
- Canvas fallback for offline/low-bandwidth scenarios
- Real-time GPS track visualization with polyline rendering
- Live position marker with accuracy circles
- Follow mode for auto-centering on current location
- Fit-to-bounds functionality for entire trip visualization
- High-DPI canvas support for sharp rendering
- Touch-friendly map controls
- Nairobi-centered default location (36.8219°E, -1.2921°S)

**Key Methods**:

- `init()` - Initialize MapLibre or canvas fallback
- `updateLiveTrack(points)` - Update track with new GPS points
- `setCurrentPoint(point)` - Update current position marker
- `setFollow(enabled)` - Toggle automatic map centering
- `fitBoundsToPoints(points)` - Fit map view to show entire trip
- `destroy()` - Clean up map resources

**MapLibre Integration**:

- Vector map tiles from demotiles.maplibre.org
- GeoJSON data sources for tracks and markers
- Smooth animations with easeTo() transitions
- Layered rendering: track line, current position, accuracy circle
- Real-time coordinate updates at 10Hz max frequency

**Canvas Fallback**:

- Simple Web Mercator projection
- Polyline track rendering with anti-aliasing
- Current position marker with accuracy visualization
- Coordinate display and zoom level indicators
- Touch-friendly zoom and pan controls

### 4. Main App (`src/js/main.js`)

**Purpose**: Application orchestration and UI integration

**Key Features**:

- Component initialization and coordination
- Event handling for UI controls
- Camera/map mode switching without page reload
- Recording state management
- Integration between TripRecorder, LiveHUD, and MapView
- Real-time data synchronization across components
- Wake lock management for screen-on during recording
- Accessibility support with ARIA live regions

## File Structure

```
roadtrip/
├── src/
│   ├── index.html              # Main HTML page
│   ├── css/
│   │   └── styles.css          # Application styles
│   └── js/
│       ├── main.js             # App orchestration
│       ├── TripRecorder.js     # GPS tracking & data
│       ├── LiveHUD.js          # Real-time display
│       └── MapView.js          # Map visualization
├── playwright.config.js        # Testing configuration
└── README.md                   # Project documentation
```

## Development Guidelines

### Code Style

- Use ES6 modules with import/export
- Prefer `const` and `let` over `var`
- Use descriptive variable and function names
- Include JSDoc comments for public methods
- Follow mobile-first responsive design principles

### GPS and Location Handling

- Always use `enableHighAccuracy: true` for geolocation
- Implement proper error handling for location services
- Filter low-accuracy points (> 50m accuracy)
- Use Haversine formula for distance calculations
- Implement speed smoothing to reduce GPS noise

### Performance Considerations

- Use `requestAnimationFrame` for smooth animations
- Implement device pixel ratio scaling for sharp displays
- Minimize canvas redraws where possible
- Use event-driven architecture for component communication
- Store data efficiently in localStorage

### Testing Approach

- Use Playwright for browser automation testing
- Test geolocation functionality with real GPS data
- Verify export formats (GPX/GeoJSON) for compliance
- Test accessibility features with screen readers
- Validate real-time data flow between components

## Key Features Tested

### Trip Recording Functionality ✅

- Start/stop recording with proper state management
- Real GPS coordinate collection and filtering
- Distance calculation using Haversine formula
- Speed computation with moving average smoothing
- Trip statistics: elapsed time, distance, speeds
- Data persistence to localStorage
- Export to GPX and GeoJSON formats

### Live HUD Functionality ✅

- Canvas rendering with high-DPI support
- Real-time stat display (speed, time, distance)
- 60fps animation loop
- Accessibility with aria-live updates
- Theme customization
- Start/stop animation control

### Map View Functionality ✅

- MapLibre GL JS vector map integration
- Real-time GPS track visualization with polyline rendering
- Live position marker with accuracy circles
- Camera/Map mode switching without page reload
- Follow mode for auto-centering on current location
- Fit-to-bounds functionality for entire trip visualization
- Canvas fallback for offline scenarios
- Touch-friendly map controls
- Nairobi-centered default location

### Integration Testing ✅

- Event-driven communication between components
- Real-time data flow from GPS to HUD and Map display
- Mode switching between Camera and Map views
- UI control integration (Mode toggle, Fit button)
- Export functionality validation
- Wake lock management during recording

## Common Patterns

### Event-Driven Updates

```javascript
// TripRecorder dispatches events
window.dispatchEvent(new CustomEvent("tripUpdate", { detail: stats }));

// LiveHUD listens for updates
window.addEventListener("tripUpdate", (event) => {
  this.update(event.detail);
});
```

### Canvas High-DPI Setup

```javascript
const dpr = window.devicePixelRatio || 1;
canvas.width = rect.width * dpr;
canvas.height = rect.height * dpr;
canvas.style.width = rect.width + "px";
canvas.style.height = rect.height + "px";
ctx.scale(dpr, dpr);
```

### Geolocation Configuration

```javascript
const options = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 1000,
};
navigator.geolocation.watchPosition(onSuccess, onError, options);
```

### MapLibre GL Integration

```javascript
// Initialize MapLibre with Nairobi center
this.map = new maplibregl.Map({
  container: mapDiv,
  style: "https://demotiles.maplibre.org/style.json",
  center: [36.8219, -1.2921], // Nairobi coordinates
  zoom: 14,
  attributionControl: false,
});

// Add real-time track layer
this.map.addSource("track", {
  type: "geojson",
  data: { type: "LineString", coordinates: [] },
});

this.map.addLayer({
  id: "track-line",
  type: "line",
  source: "track",
  paint: {
    "line-color": "#00ff88",
    "line-width": 4,
    "line-opacity": 0.8,
  },
});
```

### Mode Switching Pattern

```javascript
// CSS-based mode switching without page reload
async function setMode(mode) {
  currentMode = mode;
  elements.root.className = `mode-${mode}`;
  elements.modeIndicator.textContent = mode === "camera" ? "Camera" : "Map";

  if (mode === "map" && !mapView) {
    await initializeMapView();
    // Update map with current trip data
    const currentTrip = tripRecorder.getCurrentTrip();
    if (currentTrip && currentTrip.points.length > 0) {
      mapView.updateLiveTrack(currentTrip.points);
    }
  }
}
```

## Debugging Tips

### Common Issues

1. **Module Loading**: Ensure proper CORS setup when testing locally
2. **Geolocation**: Check browser permissions and HTTPS requirements
3. **Canvas Rendering**: Verify device pixel ratio scaling
4. **Performance**: Monitor requestAnimationFrame usage
5. **MapLibre Loading**: Verify CDN connectivity and fallback to canvas
6. **Mode Switching**: Ensure CSS classes are applied correctly for .mode-map/.mode-camera

### Development Server

Use Python's built-in server for local testing:

```bash
cd src && python3 -m http.server 8080
```

## Future Development

### Potential Enhancements

- Offline capability with Service Workers
- Advanced map layers and overlays
- Trip comparison and analytics
- Social sharing features
- Advanced export formats (KML, TCX)
- Real-time dashcam video recording
- Custom map styles and themes
- GPS track smoothing algorithms

### Architecture Considerations

- Maintain vanilla JS approach for performance
- Consider Web Workers for heavy GPS calculations
- Implement proper error boundaries
- Add comprehensive logging system
- Consider IndexedDB for large trip datasets

## Testing Instructions

### Manual Testing

1. Grant location permissions in browser
2. Start trip recording and move around
3. Verify real-time HUD updates
4. Test Camera/Map mode switching
5. Verify map rendering and real-time tracking
6. Test Fit button functionality in map mode
7. Test export functionality
8. Check accessibility with screen reader

### Automated Testing

Use Playwright for comprehensive browser automation testing of all features. The app has been fully tested with real GPS data capture, map rendering, mode switching, and export validation.

## Browser Compatibility

### Supported Features

- Geolocation API (all modern browsers)
- Canvas API with high-DPI support
- ES6 modules (Chrome 61+, Firefox 60+, Safari 11+)
- Local Storage API
- Custom Events API

### Mobile Optimization

- Touch-friendly controls
- High-contrast display
- Responsive layout
- Battery-efficient GPS usage
- Proper viewport configuration
