/**
 * RoadTrip - Mobile Recording App Main Script
 * 
 * Integrates LiveHUD component with geolocation, camera/map modes,
 * and recording controls for a mobile-first PWA experience.
 */

import LiveHUD from './LiveHUD.js';

// App state
let currentMode = 'camera'; // 'camera' or 'map'
let isRecording = false;
let tripStartTime = null;
let lastPosition = null;
let totalDistance = 0;
let positionHistory = [];
let watchId = null;
let wakeLock = null;

// HUD instance
let hud = null;

// MediaRecorder for demo (not fully implemented)
let mediaRecorder = null;
let recordedChunks = [];

// DOM elements
let elements = {};

/**
 * Initialize the recording application
 */
function initializeApp() {
    console.log('RoadTrip Recording App - Initializing...');
    
    // Get DOM references
    cacheElements();
    
    // Initialize LiveHUD component
    initializeHUD();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize camera/map modes
    initializeModes();
    
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
 * Initialize LiveHUD component
 */
function initializeHUD() {
    hud = new LiveHUD({
        showHeading: true,
        showVU: false, // Disable VU meter for now
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
 * Setup event listeners for controls
 */
function setupEventListeners() {
    // Record button
    elements.recordBtn.addEventListener('click', toggleRecording);
    
    // Mode toggle button
    elements.modeToggle.addEventListener('click', toggleMode);
    
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
    
    // Initialize map placeholder (real map integration would go here)
    initializeMap();
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
        
        // Setup for HUD compositing
        elements.cameraFeed.addEventListener('loadeddata', () => {
            console.log('Camera feed ready for compositing');
        });
        
        console.log('Camera initialized successfully');
        
    } catch (error) {
        console.warn('Camera access failed:', error);
        updateGPSStatus('Camera unavailable', 'error');
    }
}

/**
 * Initialize map (placeholder for real map integration)
 */
function initializeMap() {
    // TODO: Initialize real map here (Leaflet, MapBox, etc.)
    console.log('Map placeholder initialized');
}

/**
 * Toggle between camera and map modes
 */
function toggleMode() {
    currentMode = currentMode === 'camera' ? 'map' : 'camera';
    setMode(currentMode);
    
    // Update aria-live for accessibility
    elements.ariaLive.textContent = `Switched to ${currentMode} mode`;
}

/**
 * Set the current mode (camera or map)
 */
function setMode(mode) {
    currentMode = mode;
    
    // Update CSS class for mode
    elements.root.className = `mode-${mode}`;
    
    // Update mode indicator
    elements.modeIndicator.textContent = mode === 'camera' ? 'Camera' : 'Map';
    
    console.log(`Mode set to: ${mode}`);
}

/**
 * Toggle recording state
 */
async function toggleRecording() {
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
        isRecording = true;
        tripStartTime = Date.now();
        totalDistance = 0;
        positionHistory = [];
        lastPosition = null;
        
        // Start HUD
        hud.start();
        
        // Start geolocation tracking
        startGeolocationTracking();
        
        // Acquire wake lock to prevent screen sleep
        await acquireWakeLock();
        
        // Setup MediaRecorder demo (canvas.captureStream)
        setupMediaRecorderDemo();
        
        updateUI();
        updateStatus('Recording', 'recording');
        
        console.log('Recording started');
        
    } catch (error) {
        console.error('Failed to start recording:', error);
        isRecording = false;
        updateStatus('Error starting recording', 'error');
    }
}

/**
 * Stop recording trip
 */
async function stopRecording() {
    try {
        isRecording = false;
        
        // Stop HUD
        hud.stop();
        
        // Stop geolocation tracking
        stopGeolocationTracking();
        
        // Release wake lock
        await releaseWakeLock();
        
        // Stop MediaRecorder demo
        stopMediaRecorderDemo();
        
        updateUI();
        updateStatus('Stopped', 'stopped');
        
        console.log('Recording stopped');
        
        // Show trip summary
        showTripSummary();
        
    } catch (error) {
        console.error('Failed to stop recording:', error);
        updateStatus('Error stopping recording', 'error');
    }
}

/**
 * Start geolocation tracking
 */
function startGeolocationTracking() {
    if (!navigator.geolocation) {
        console.warn('Geolocation not supported');
        updateGPSStatus('GPS unavailable', 'error');
        startMockGPS(); // Fallback to mock data for demo
        return;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
    };
    
    watchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handlePositionError,
        options
    );
    
    updateGPSStatus('Acquiring GPS...', 'acquiring');
    console.log('Geolocation tracking started');
}

/**
 * Stop geolocation tracking
 */
function stopGeolocationTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        console.log('Geolocation tracking stopped');
    }
}

/**
 * Handle position updates from GPS
 */
function handlePositionUpdate(position) {
    const currentPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed, // m/s
        timestamp: Date.now()
    };
    
    positionHistory.push(currentPosition);
    
    // Calculate distance if we have a previous position
    let speedKph = 0;
    if (lastPosition) {
        const distance = calculateDistance(lastPosition, currentPosition);
        totalDistance += distance;
        
        // Calculate speed in km/h
        const timeDelta = (currentPosition.timestamp - lastPosition.timestamp) / 1000; // seconds
        if (timeDelta > 0) {
            speedKph = (distance / 1000) / (timeDelta / 3600); // km/h
        }
    }
    
    lastPosition = currentPosition;
    
    // Update HUD with new data
    updateHUD(speedKph, currentPosition.heading);
    
    // Update GPS status
    updateGPSStatus(`GPS: ${position.coords.accuracy}m`, 'active');
}

/**
 * Handle GPS errors
 */
function handlePositionError(error) {
    console.warn('GPS error:', error);
    updateGPSStatus('GPS error', 'error');
    
    // Fallback to mock GPS for demo purposes
    if (isRecording) {
        startMockGPS();
    }
}

/**
 * Start mock GPS data for demo (when real GPS unavailable)
 */
function startMockGPS() {
    console.log('Starting mock GPS data for demo');
    updateGPSStatus('Demo mode', 'demo');
    
    let mockSpeed = 25; // Base speed in km/h
    let mockHeading = 45; // Base heading in degrees
    
    const mockInterval = setInterval(() => {
        if (!isRecording) {
            clearInterval(mockInterval);
            return;
        }
        
        // Simulate realistic speed variations
        mockSpeed = 25 + Math.sin(Date.now() / 5000) * 15;
        mockSpeed = Math.max(0, mockSpeed);
        
        // Gradually rotate heading
        mockHeading = (mockHeading + 0.5) % 360;
        
        // Simulate distance accumulation
        const timeDelta = 1; // 1 second intervals
        const distanceM = (mockSpeed / 3.6) * timeDelta; // m/s * seconds
        totalDistance += distanceM;
        
        updateHUD(mockSpeed, mockHeading);
    }, 1000);
}

/**
 * Update HUD with current trip data
 */
function updateHUD(speedKph, headingDeg) {
    if (!hud || !isRecording) return;
    
    const elapsedMs = Date.now() - tripStartTime;
    
    // If in camera mode, composite with video background
    if (currentMode === 'camera' && elements.cameraFeed.readyState >= 2) {
        hud.drawBackgroundFrame(elements.cameraFeed);
    }
    
    hud.update({
        speedKph: speedKph || 0,
        elapsedMs: elapsedMs,
        distanceM: totalDistance,
        headingDeg: headingDeg || 0,
        vuLevel: Math.random() * 0.3 // Mock audio level
    });
    
    // Update accessibility
    const timeStr = formatTime(elapsedMs);
    const distanceStr = (totalDistance / 1000).toFixed(2);
    elements.ariaLive.textContent = 
        `Speed: ${speedKph.toFixed(1)} km/h, Time: ${timeStr}, Distance: ${distanceStr} km`;
}

/**
 * Calculate distance between two GPS points (Haversine formula)
 */
function calculateDistance(pos1, pos2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in meters
}

/**
 * Setup MediaRecorder demo for canvas recording
 */
function setupMediaRecorderDemo() {
    try {
        // Demo: How to capture the HUD canvas for recording
        const stream = elements.hudCanvas.captureStream(30);
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
        });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            console.log('MediaRecorder stopped, recorded chunks:', recordedChunks.length);
            // TODO: Handle recorded video (save, upload, etc.)
        };
        
        mediaRecorder.start(1000); // Record in 1-second chunks
        console.log('MediaRecorder demo started');
        
    } catch (error) {
        console.warn('MediaRecorder not available:', error);
    }
}

/**
 * Stop MediaRecorder demo
 */
function stopMediaRecorderDemo() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        recordedChunks = [];
    }
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
    if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
        console.log('Wake lock released');
    }
}

/**
 * Update UI state based on recording status
 */
function updateUI() {
    // Update record button
    if (isRecording) {
        elements.recordBtn.classList.add('recording');
        elements.recordIcon.textContent = '⏹️';
        elements.recordLabel.textContent = 'Stop';
        elements.recordingStatus.classList.add('recording');
    } else {
        elements.recordBtn.classList.remove('recording');
        elements.recordIcon.textContent = '▶️';
        elements.recordLabel.textContent = 'Start';
        elements.recordingStatus.classList.remove('recording');
    }
    
    // Update storage indicator
    updateStorageInfo();
}

/**
 * Update recording status
 */
function updateStatus(text, state) {
    elements.statusText.textContent = text;
    
    // Update status indicator class
    elements.recordingStatus.className = `status-indicator ${state || ''}`;
}

/**
 * Update GPS status
 */
function updateGPSStatus(text, state) {
    elements.gpsText.textContent = text;
    
    // Could add GPS status styling based on state
    console.log(`GPS Status: ${text} (${state})`);
}

/**
 * Update storage information
 */
function updateStorageInfo() {
    // Estimate storage usage
    const pointsCount = positionHistory.length;
    const estimatedKB = pointsCount * 0.1; // Rough estimate
    
    elements.storageText.textContent = `${estimatedKB.toFixed(1)}KB`;
}

/**
 * Format time from milliseconds to HH:MM:SS
 */
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Show settings dialog (placeholder)
 */
function showSettings() {
    alert('Settings panel would open here.\n\nPossible settings:\n- HUD options (heading, VU meter)\n- Recording quality\n- GPS accuracy\n- Export formats');
}

/**
 * Show trip summary after recording
 */
function showTripSummary() {
    const duration = formatTime(Date.now() - tripStartTime);
    const distance = (totalDistance / 1000).toFixed(2);
    const points = positionHistory.length;
    
    const summary = `Trip Summary:\n\nDuration: ${duration}\nDistance: ${distance} km\nGPS Points: ${points}`;
    
    console.log(summary);
    // Could show in a proper modal/dialog
}

/**
 * Handle page visibility changes
 */
function handleVisibilityChange() {
    if (document.hidden) {
        console.log('App hidden - continuing recording in background');
    } else {
        console.log('App visible - resuming active state');
    }
}

/**
 * Handle device orientation changes
 */
function handleOrientationChange() {
    setTimeout(() => {
        console.log('Orientation changed - HUD will auto-adjust');
    }, 100);
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function addEventListeners() {
    const startBtn = document.getElementById('start-trip');
    const stopBtn = document.getElementById('stop-trip');
    const exportGpxBtn = document.getElementById('export-gpx');
    const exportGeojsonBtn = document.getElementById('export-geojson');
    const clearBtn = document.getElementById('clear-storage');
    const statusDiv = document.getElementById('trip-status');
    const statsDiv = document.getElementById('trip-stats');
    
    let updateInterval;
    
    startBtn.addEventListener('click', () => {
        try {
            startBtn.classList.add('loading');
            const trip = TripRecorder.startTrip();
            console.log('Trip started:', trip);
            
            // Update UI state
            setTimeout(() => {
                startBtn.classList.remove('loading');
                startBtn.disabled = true;
                stopBtn.disabled = false;
                statusDiv.textContent = `Trip ${trip.id.substring(0, 8)}... started`;
                
                // Update stats every 2 seconds
                updateInterval = setInterval(() => {
                    updateTripStats();
                }, 2000);
            }, 500);
            
        } catch (error) {
            startBtn.classList.remove('loading');
            console.error('Failed to start trip:', error);
            statusDiv.textContent = 'Error: ' + error.message;
        }
    });
    
    stopBtn.addEventListener('click', () => {
        try {
            const trip = TripRecorder.stopTrip();
            console.log('Trip stopped:', trip);
            
            startBtn.disabled = false;
            stopBtn.disabled = true;
            exportGpxBtn.disabled = false;
            exportGeojsonBtn.disabled = false;
            statusDiv.textContent = 'Trip completed';
            
            if (updateInterval) {
                clearInterval(updateInterval);
            }
            
            updateTripStats();
            
        } catch (error) {
            console.error('Failed to stop trip:', error);
            statusDiv.textContent = 'Error: ' + error.message;
        }
    });
    
    exportGpxBtn.addEventListener('click', () => {
        try {
            const gpx = TripRecorder.exportGPX();
            console.log('GPX Export:', gpx);
            downloadFile(gpx, 'trip.gpx', 'application/gpx+xml');
        } catch (error) {
            console.error('Failed to export GPX:', error);
            alert('Error exporting GPX: ' + error.message);
        }
    });
    
    exportGeojsonBtn.addEventListener('click', () => {
        try {
            const geojson = TripRecorder.exportGeoJSON();
            console.log('GeoJSON Export:', geojson);
            downloadFile(JSON.stringify(geojson, null, 2), 'trip.geojson', 'application/json');
        } catch (error) {
            console.error('Failed to export GeoJSON:', error);
            alert('Error exporting GeoJSON: ' + error.message);
        }
    });
    
    clearBtn.addEventListener('click', () => {
        if (confirm('Clear all stored trip data?')) {
            TripRecorder.clearLocalStorage();
            statusDiv.textContent = 'Storage cleared';
        }
    });
    
    function updateTripStats() {
        const trip = TripRecorder.getCurrentTrip();
        const statsGrid = document.getElementById('trip-stats');
        
        if (trip && trip.stats && statsGrid) {
            const stats = trip.stats;
            const statItems = statsGrid.querySelectorAll('.stat-item');
            
            // Update each stat item
            if (statItems[0]) {
                statItems[0].querySelector('.stat-value').textContent = trip.points.length;
            }
            if (statItems[1]) {
                statItems[1].querySelector('.stat-value').textContent = `${(stats.distanceMeters / 1000).toFixed(2)} km`;
            }
            if (statItems[2]) {
                statItems[2].querySelector('.stat-value').textContent = `${Math.round(stats.durationMs / 1000)} sec`;
            }
            if (statItems[3]) {
                statItems[3].querySelector('.stat-value').textContent = `${stats.avgSpeedKph.toFixed(1)} km/h`;
            }
        }
    }
}

function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Example usage as requested
function demonstrateBasicUsage() {
    console.log('\n=== TripRecorder Basic Usage Example ===');
    
    // Start a trip
    const trip = TripRecorder.startTrip();
    console.log('Started trip:', trip.id);
    
    // Simulate some time passing (in real usage, GPS points would be collected)
    setTimeout(() => {
        // Stop the trip
        const completedTrip = TripRecorder.stopTrip();
        console.log('Completed trip:', completedTrip);
        
        // Get current trip data
        const currentTrip = TripRecorder.getCurrentTrip();
        console.log('Current trip:', currentTrip);
        
        // Export data (only works if there are GPS points)
        try {
            const gpx = TripRecorder.exportGPX();
            console.log('GPX export successful');
        } catch (error) {
            console.log('GPX export failed (expected - no GPS points):', error.message);
        }
        
        try {
            const geojson = TripRecorder.exportGeoJSON();
            console.log('GeoJSON export successful');
        } catch (error) {
            console.log('GeoJSON export failed (expected - no GPS points):', error.message);
        }
    }, 1000);
}