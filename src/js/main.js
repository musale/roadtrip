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
    const appContainer = document.getElementById('app-container');
    
    // Create the trip controls panel
    const controlPanel = document.createElement('div');
    controlPanel.id = 'trip-controls';
    controlPanel.className = 'trip-controls';
    
    controlPanel.innerHTML = `
        <h3>Trip Recorder Demo</h3>
        <div class="button-grid">
            <button id="start-trip" class="btn btn-primary btn-start btn-icon">Start Trip</button>
            <button id="stop-trip" class="btn btn-secondary btn-stop btn-icon" disabled>Stop Trip</button>
            <button id="export-gpx" class="btn btn-success btn-export btn-icon" disabled>Export GPX</button>
            <button id="export-geojson" class="btn btn-success btn-export btn-icon" disabled>Export GeoJSON</button>
            <button id="clear-storage" class="btn btn-warning btn-clear btn-icon full-width">Clear Storage</button>
        </div>
        <div class="status-section">
            <div id="trip-status" class="trip-status">Ready to start</div>
            <div class="trip-stats">
                <h4>Trip Statistics</h4>
                <div id="trip-stats" class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Points</span>
                        <span class="stat-value">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Distance</span>
                        <span class="stat-value">0.00 km</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Duration</span>
                        <span class="stat-value">0 sec</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Avg Speed</span>
                        <span class="stat-value">0.0 km/h</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    appContainer.appendChild(controlPanel);
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

Load();

// Run the basic usage demonstration
demonstrateBasicUsage();