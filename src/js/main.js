/**
 * RoadTrip - Mobile Recording App Main Script
 * 
 * Integrates TripRecorder, LiveHUD, and MapView components for a mobile-first PWA
 * experience with real-time GPS tracking and map visualization.
 */

import TripRecorder from './TripRecorder.js';
import LiveHUD from './LiveHUD.js';
import MapView from './MapView.js';

// App state
let currentMode = 'camera'; // 'camera' or 'map'
let tripRecorder = null;
let hud = null;
let mapView = null;
let wakeLock = null;
let updateInterval = null;

// DOM elements
let elements = {};

/**
 * Initialize the recording application
 */
async function initializeApp() {
    console.log('RoadTrip Recording App - Initializing...');
    
    // Get DOM references
    cacheElements();
    
    // Initialize components
    initializeTripRecorder();
    initializeHUD();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize camera/map modes
    await initializeModes();
    
    // Update initial UI state
    updateUI();
    
    console.log('RoadTrip Recording App - Ready');
}

/**
 * Cache DOM element references for performance
 */
function cacheElements() {
    elements = {
        root: document.getElementById('root'),
        hudCanvas: document.getElementById('hudCanvas'),
        cameraFeed: document.getElementById('cameraFeed'),
        mapContainer: document.getElementById('mapContainer'),
        recordBtn: document.getElementById('recordBtn'),
        modeToggle: document.getElementById('modeToggle'),
        fitBtn: document.getElementById('fitBtn'),
        settingsBtn: document.getElementById('settingsBtn'),
        recordingStatus: document.getElementById('recordingStatus'),
        statusText: document.getElementById('statusText'),
        modeIndicator: document.getElementById('modeIndicator'),
        gpsStatus: document.getElementById('gpsStatus'),
        gpsText: document.getElementById('gpsText'),
        storageIndicator: document.getElementById('storageIndicator'),
        storageText: document.getElementById('storageText'),
        recordIcon: document.getElementById('recordIcon'),
        recordLabel: document.getElementById('recordLabel'),
        ariaLive: document.getElementById('ariaLive')
    };
}

/**
 * Initialize TripRecorder
 */
function initializeTripRecorder() {
    tripRecorder = new TripRecorder();
    console.log('TripRecorder initialized');
}

/**
 * Initialize LiveHUD component
 */
function initializeHUD() {
    hud = new LiveHUD({
        showHeading: true,
        showVU: false,
        theme: {
            fg: '#ffffff',
            shadow: '#000000',
            accent: '#00ff88',
            danger: '#ff4444',
            warning: '#ffaa00'
        }
    });
    
    hud.attach(elements.hudCanvas);
    console.log('LiveHUD initialized');
}

/**
 * Initialize MapView
 */
async function initializeMapView() {
    if (mapView) return mapView;
    
    try {
        mapView = new MapView({
            container: elements.mapContainer,
            useMapLibre: true,
            initialCenter: [-122.4194, 37.7749], // Default to SF
            initialZoom: 14
        });
        
        await mapView.init();
        console.log('MapView initialized');
        return mapView;
    } catch (error) {
        console.error('Failed to initialize MapView:', error);
        throw error;
    }
}

/**
 * Setup event listeners for controls
 */
function setupEventListeners() {
    // Record button
    elements.recordBtn.addEventListener('click', toggleRecording);
    
    // Mode toggle button
    elements.modeToggle.addEventListener('click', toggleMode);
    
    // Fit button (map mode only)
    elements.fitBtn.addEventListener('click', fitMapToTrip);
    
    // Settings button (placeholder)
    elements.settingsBtn.addEventListener('click', showSettings);
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle device orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    
    console.log('Event listeners setup complete');
}

/**
 * Initialize camera and map modes
 */
async function initializeModes() {
    // Set initial mode
    setMode(currentMode);
    
    // Try to initialize camera
    if (currentMode === 'camera') {
        await initializeCamera();
    }
}

/**
 * Initialize camera feed
 */
async function initializeCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // Rear camera for dashcam
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        
        elements.cameraFeed.srcObject = stream;
        console.log('Camera initialized successfully');
        
    } catch (error) {
        console.warn('Camera access failed:', error);
        updateGPSStatus('Camera unavailable', 'error');
    }
}

/**
 * Toggle between camera and map modes
 */
async function toggleMode() {
    const newMode = currentMode === 'camera' ? 'map' : 'camera';
    await setMode(newMode);
    
    // Update aria-live for accessibility
    elements.ariaLive.textContent = `Switched to ${newMode} mode`;
}

/**
 * Set the current mode (camera or map)
 */
async function setMode(mode) {
    currentMode = mode;
    
    // Update CSS class for mode
    elements.root.className = `mode-${mode}`;
    
    // Update mode indicator
    elements.modeIndicator.textContent = mode === 'camera' ? 'Camera' : 'Map';
    
    // Initialize map view if switching to map mode
    if (mode === 'map' && !mapView) {
        try {
            await initializeMapView();
            
            // If we have an active trip, update the map
            const currentTrip = tripRecorder.getCurrentTrip();
            if (currentTrip && currentTrip.points.length > 0) {
                mapView.updateLiveTrack(currentTrip.points);
                if (currentTrip.points.length > 0) {
                    const lastPoint = currentTrip.points[currentTrip.points.length - 1];
                    mapView.setCurrentPoint(lastPoint);
                }
            }
        } catch (error) {
            console.error('Failed to initialize map view:', error);
            // Fall back to camera mode
            currentMode = 'camera';
            elements.root.className = 'mode-camera';
            elements.modeIndicator.textContent = 'Camera';
        }
    }
    
    console.log(`Mode set to: ${mode}`);
}

/**
 * Toggle recording state
 */
async function toggleRecording() {
    const isRecording = tripRecorder.isTracking;
    
    if (isRecording) {
        await stopRecording();
    } else {
        await startRecording();
    }
}

/**
 * Start recording trip
 */
async function startRecording() {
    try {
        // Start trip recording
        tripRecorder.startTrip();
        
        // Start HUD
        hud.start();
        
        // Start real-time updates
        startRealtimeUpdates();
        
        // Acquire wake lock to prevent screen sleep
        await acquireWakeLock();
        
        updateUI();
        updateStatus('Recording', 'recording');
        
        console.log('Recording started');
        
    } catch (error) {
        console.error('Failed to start recording:', error);
        updateStatus('Error starting recording', 'error');
    }
}

/**
 * Stop recording trip
 */
async function stopRecording() {
    try {
        // Stop trip recording
        const trip = tripRecorder.stopTrip();
        
        // Stop HUD
        hud.stop();
        
        // Stop real-time updates
        stopRealtimeUpdates();
        
        // Release wake lock
        await releaseWakeLock();
        
        updateUI();
        updateStatus('Stopped', 'stopped');
        
        console.log('Recording stopped');
        
        // Show trip summary
        if (trip) {
            showTripSummary(trip);
        }
        
    } catch (error) {
        console.error('Failed to stop recording:', error);
        updateStatus('Error stopping recording', 'error');
    }
}

/**
 * Start real-time updates for HUD and map
 */
function startRealtimeUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(() => {
        const currentTrip = tripRecorder.getCurrentTrip();
        if (!currentTrip) return;
        
        // Update HUD
        updateHUD(currentTrip);
        
        // Update map view if in map mode
        if (currentMode === 'map' && mapView && currentTrip.points.length > 0) {
            mapView.updateLiveTrack(currentTrip.points);
            
            const lastPoint = currentTrip.points[currentTrip.points.length - 1];
            if (lastPoint) {
                mapView.setCurrentPoint(lastPoint);
            }
        }
        
        // Update GPS status
        if (currentTrip.points.length > 0) {
            const lastPoint = currentTrip.points[currentTrip.points.length - 1];
            updateGPSStatus(`GPS: ${lastPoint.accuracy.toFixed(2)}m`, 'active');
        }
        
    }, 500); // Update every 500ms
}

/**
 * Stop real-time updates
 */
function stopRealtimeUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

/**
 * Update HUD with current trip data
 */
function updateHUD(trip) {
    if (!hud || !trip) return;
    
    const stats = trip.stats || { distanceMeters: 0, durationMs: 0, avgSpeedKph: 0 };
    const points = trip.points || [];
    
    // Calculate current speed from latest points
    let currentSpeedKph = 0;
    if (points.length >= 2) {
        const latest = points[points.length - 1];
        const previous = points[points.length - 2];
        const timeDelta = (latest.timestamp - previous.timestamp) / 1000; // seconds
        
        if (timeDelta > 0) {
            const distance = calculateDistance(
                previous.lat, previous.lon,
                latest.lat, latest.lon
            );
            currentSpeedKph = (distance / 1000) / (timeDelta / 3600); // km/h
        }
    }
    
    // Get heading from latest point
    let heading = 0;
    if (points.length > 0) {
        const latest = points[points.length - 1];
        if (latest.heading !== undefined && latest.heading !== null) {
            heading = latest.heading;
        }
    }
    
    // Update HUD
    const hudStats = {
        speed: Math.max(0, currentSpeedKph),
        heading: heading,
        duration: stats.durationMs,
        distance: stats.distanceMeters
    };
    
    hud.update(hudStats);
}

/**
 * Fit map to current trip
 */
function fitMapToTrip() {
    if (!mapView) return;
    
    const currentTrip = tripRecorder.getCurrentTrip();
    if (currentTrip && currentTrip.points.length > 0) {
        mapView.fitBoundsToPoints(currentTrip.points);
        elements.ariaLive.textContent = 'Map fitted to trip route';
    }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Update UI state based on recording status
 */
function updateUI() {
    const isRecording = tripRecorder ? tripRecorder.isTracking : false;
    
    // Update record button
    elements.recordBtn.className = isRecording ? 'control-btn primary recording' : 'control-btn primary';
    elements.recordIcon.textContent = isRecording ? '⏸️' : '▶️';
    elements.recordLabel.textContent = isRecording ? 'Stop' : 'Start';
    
    // Update recording status indicator
    if (isRecording) {
        elements.recordingStatus.classList.add('recording');
    } else {
        elements.recordingStatus.classList.remove('recording');
    }
}

/**
 * Update status text and indicator
 */
function updateStatus(text, type = 'ready') {
    elements.statusText.textContent = text;
    
    // Update status dot color based on type
    const statusDot = elements.recordingStatus.querySelector('.status-dot');
    statusDot.className = 'status-dot';
    
    switch (type) {
        case 'recording':
            elements.recordingStatus.classList.add('recording');
            break;
        case 'error':
            statusDot.style.background = '#ef4444';
            break;
        case 'stopped':
            statusDot.style.background = '#f59e0b';
            break;
        default:
            statusDot.style.background = '#10b981';
    }
    
    // Update aria-live for accessibility
    elements.ariaLive.textContent = text;
}

/**
 * Update GPS status
 */
function updateGPSStatus(text, type = 'active') {
    elements.gpsText.textContent = text;
    
    // Update GPS icon based on type
    const gpsIcon = elements.gpsStatus.querySelector('.gps-icon');
    switch (type) {
        case 'active':
            gpsIcon.textContent = '📍';
            break;
        case 'acquiring':
            gpsIcon.textContent = '🔍';
            break;
        case 'error':
            gpsIcon.textContent = '❌';
            break;
        default:
            gpsIcon.textContent = '📍';
    }
}

/**
 * Show settings dialog (placeholder)
 */
function showSettings() {
    alert('Settings dialog would appear here');
}

/**
 * Show trip summary
 */
function showTripSummary(trip) {
    if (!trip || !trip.stats) return;
    
    const stats = trip.stats;
    const distanceKm = (stats.distanceMeters / 1000).toFixed(2);
    const durationMin = Math.round(stats.durationMs / 60000);
    const avgSpeedKph = stats.avgSpeedKph.toFixed(1);
    
    const summary = `Trip Summary:\nDistance: ${distanceKm} km\nDuration: ${durationMin} minutes\nAverage Speed: ${avgSpeedKph} km/h\nPoints Recorded: ${trip.points.length}`;
    
    // For now, just show an alert. In a real app, this would be a proper modal
    alert(summary);
}

/**
 * Acquire wake lock to prevent screen sleep during recording
 */
async function acquireWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake lock acquired');
        }
    } catch (error) {
        console.warn('Wake lock failed:', error);
    }
}

/**
 * Release wake lock
 */
async function releaseWakeLock() {
    try {
        if (wakeLock) {
            await wakeLock.release();
            wakeLock = null;
            console.log('Wake lock released');
        }
    } catch (error) {
        console.warn('Wake lock release failed:', error);
    }
}

/**
 * Handle page visibility changes
 */
function handleVisibilityChange() {
    if (document.hidden) {
        console.log('App went to background');
    } else {
        console.log('App came to foreground');
        // Re-acquire wake lock if recording
        if (tripRecorder && tripRecorder.isTracking && !wakeLock) {
            acquireWakeLock();
        }
    }
}

/**
 * Handle device orientation changes
 */
function handleOrientationChange() {
    // Re-setup canvas after orientation change
    setTimeout(() => {
        if (hud) {
            hud.attach(elements.hudCanvas);
        }
        if (mapView && mapView.canvas) {
            mapView.setupCanvas();
            mapView.drawCanvas();
        }
    }, 100);
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}