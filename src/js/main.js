import TripRecorder from './TripRecorder.js';

function Load() {
    console.log("Hello, RoadTrip!");
    setupTripRecorderDemo();
}

function setupTripRecorderDemo() {
    console.log("Setting up TripRecorder demo...");
    
    // Create UI elements for testing
    createDemoControls();
    
    // Add event listeners
    addEventListeners();
}

function createDemoControls() {
    const body = document.body;
    
    // Create a demo control panel
    const controlPanel = document.createElement('div');
    controlPanel.id = 'trip-controls';
    controlPanel.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        z-index: 1000;
    `;
    
    controlPanel.innerHTML = `
        <h3>Trip Recorder Demo</h3>
        <button id="start-trip">Start Trip</button>
        <button id="stop-trip" disabled>Stop Trip</button>
        <button id="export-gpx" disabled>Export GPX</button>
        <button id="export-geojson" disabled>Export GeoJSON</button>
        <button id="clear-storage">Clear Storage</button>
        <div id="trip-status">Ready to start</div>
        <div id="trip-stats"></div>
    `;
    
    body.appendChild(controlPanel);
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
            const trip = TripRecorder.startTrip();
            console.log('Trip started:', trip);
            
            startBtn.disabled = true;
            stopBtn.disabled = false;
            statusDiv.textContent = `Trip ${trip.id.substring(0, 8)}... started`;
            
            // Update stats every 2 seconds
            updateInterval = setInterval(() => {
                updateTripStats();
            }, 2000);
            
        } catch (error) {
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
        if (trip && trip.stats) {
            const stats = trip.stats;
            statsDiv.innerHTML = `
                <div><strong>Points:</strong> ${trip.points.length}</div>
                <div><strong>Distance:</strong> ${(stats.distanceMeters / 1000).toFixed(2)} km</div>
                <div><strong>Duration:</strong> ${Math.round(stats.durationMs / 1000)} seconds</div>
                <div><strong>Avg Speed:</strong> ${stats.avgSpeedKph.toFixed(1)} km/h</div>
            `;
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

Load();

// Run the basic usage demonstration
demonstrateBasicUsage();