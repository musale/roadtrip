# Copilot Instructions - RoadTrip App

## Project Overview

RoadTrip is a mobile-first Progressive Web App (PWA) for GPS trip recording with live HUD overlay. The app provides real-time trip tracking, statistics visualization, and data export capabilities.

### Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), CSS3, HTML5
- **APIs**: Geolocation API, Canvas API, Web Storage API
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

### 3. Main App (`src/js/main.js`)

**Purpose**: Application orchestration and UI integration

**Key Features**:

- Component initialization and coordination
- Event handling for UI controls
- Camera/map mode switching
- Recording state management
- Integration between TripRecorder and LiveHUD

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
│       └── LiveHUD.js          # Real-time display
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

### Integration Testing ✅

- Event-driven communication between components
- Real-time data flow from GPS to HUD display
- UI control integration
- Export functionality validation

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

## Debugging Tips

### Common Issues

1. **Module Loading**: Ensure proper CORS setup when testing locally
2. **Geolocation**: Check browser permissions and HTTPS requirements
3. **Canvas Rendering**: Verify device pixel ratio scaling
4. **Performance**: Monitor requestAnimationFrame usage

### Development Server

Use Python's built-in server for local testing:

```bash
cd src && python3 -m http.server 8080
```

## Future Development

### Potential Enhancements

- Offline capability with Service Workers
- Map integration (OpenStreetMap/Mapbox)
- Trip comparison and analytics
- Social sharing features
- Advanced export formats (KML, TCX)
- Real-time dashcam video recording

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
4. Test export functionality
5. Check accessibility with screen reader

### Automated Testing

Use Playwright for comprehensive browser automation testing of all features. The app has been fully tested with real GPS data capture and export validation.

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
