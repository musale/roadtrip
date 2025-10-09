// src/js/app.js

import '../css/styles.css';
import maplibregl from 'maplibre-gl';
import TripRecorder from './TripRecorder.js';
import LiveHUD from './LiveHUD.js';
import VideoComposer from './VideoComposer.js';
import MapView from './MapView.js';
import { getTrips, writeVideoToOpfs, clearVideoChunks, readVideoFromOpfs, deleteTrip, clearTrips, deleteVideoFromOpfs } from './storage/db.js';
import { initShareButton, shareVideo, shareSummaryImage, downloadBlob, debounce } from './Share.js';

document.addEventListener('DOMContentLoaded', async () => {
  const videoContainer = document.getElementById('videoContainer');
  const cameraFeed = document.getElementById('cameraFeed'); // Corrected ID
  const dualVideoContainer = document.getElementById('dualVideoContainer');
  const dualFrontVideo = document.getElementById('dualFrontVideo');
  const dualBackVideo = document.getElementById('dualBackVideo');
  const liveHud = document.getElementById('liveHud');
  const hudSpeed = document.getElementById('hudSpeed');
  const hudDistance = document.getElementById('hudDistance');
  const hudTime = document.getElementById('hudTime');
  const startStopButton = document.getElementById('startStopButton');
  const muteButton = document.getElementById('muteButton'); // Mute button
  const settingsButton = document.getElementById('settingsButton');
  const settingsMenu = document.getElementById('settingsMenu');

  const driveTypeButton = document.getElementById('driveTypeButton');
  const currentDriveType = document.getElementById('currentDriveType');
  const captureSettingsButton = document.getElementById('captureSettingsButton');
  const currentCaptureSetting = document.getElementById('currentCaptureSetting');
  const facingCameraButton = document.getElementById('facingCameraButton');
  const currentFacingSetting = document.getElementById('currentFacingSetting');
  const recordingModeButton = document.getElementById('recordingModeButton');
  const currentRecordingModeSetting = document.getElementById('currentRecordingModeSetting');
  const speedUnitButton = document.getElementById('speedUnitButton');
  const currentSpeedUnit = document.getElementById('currentSpeedUnit');
  const pastTripsButton = document.getElementById('pastTripsButton');

  const settingsModal = document.getElementById('settingsModal');
  const settingsModalTitle = document.getElementById('settingsModalTitle');
  const settingsModalContent = document.getElementById('settingsModalContent');
  const settingsModalClose = document.getElementById('settingsModalClose');

  const btnSingle = document.getElementById('btnSingle');
  const btnDual = document.getElementById('btnDual');
  const btnFacingUser = document.getElementById('btnFacingUser');
  const btnFacingEnvironment = document.getElementById('btnFacingEnvironment');

  const pastTripsOverlay = document.getElementById('pastTripsOverlay');
  const pastTripsClose = document.getElementById('pastTripsClose');
  const tripList = document.getElementById('tripList');
  const emptyTripsMessage = document.getElementById('emptyTripsMessage');
  const clearTripsButton = document.getElementById('clearTripsButton');

  if (clearTripsButton) {
    clearTripsButton.disabled = true;
    clearTripsButton.classList.add('opacity-40', 'cursor-not-allowed');
  }

  const videoPlayerOverlay = document.getElementById('videoPlayerOverlay');
  const replayVideoPlayer = document.getElementById('replayVideoPlayer');
  const closeVideoPlayer = document.getElementById('closeVideoPlayer');

  // Trip Summary elements
  const tripSummaryOverlay = document.getElementById('tripSummaryOverlay');
  const tripSummaryClose = document.getElementById('tripSummaryClose');
  const tripSummaryMap = document.getElementById('tripSummaryMap');
  const tripStats = document.getElementById('tripStats');
  const elevationProfile = document.getElementById('elevationProfile');
  let summaryMap = null; // To hold the map instance


  // Landscape nudge elements
  const landscapeNudge = document.getElementById('landscapeNudge');
  const dismissNudge = document.getElementById('dismissNudge');
  let nudgeDismissed = false;

  // Placeholder for mapContainer if needed later, currently hidden
  const mapContainer = document.createElement('div');
  mapContainer.id = 'mapContainer';
  mapContainer.className = 'hidden';
  document.getElementById('app').appendChild(mapContainer);

  const tripRecorder = new TripRecorder();
  let speedUnit = 'KPH'; // Default speed unit
  const liveHUD = new LiveHUD({ hudSpeed, hudDistance, hudTime, speedUnit }); // Pass elements to LiveHUD
  const videoComposer = new VideoComposer({
    singleVideoEl: cameraFeed, // Corrected to cameraFeed
    dualContainer: dualVideoContainer,
    dualFrontVideo,
    dualBackVideo,
  });
  const mapView = new MapView({ container: mapContainer });

  let currentMode = 'camera'; // 'camera' or 'map'
  let isRecording = false;
  let wakeLock = null;

  // --- Orientation Handling ---
  const isLandscape = () => window.matchMedia("(orientation: landscape)").matches || window.innerWidth > window.innerHeight;

  const showNudge = () => {
    // Show nudge only if recording, not dismissed, and in portrait.
    if (isRecording && !nudgeDismissed && !isLandscape()) {
      landscapeNudge.classList.remove('hidden');
    }
  };

  const hideNudge = () => {
    landscapeNudge.classList.add('hidden');
  };

  const preferLandscape = async () => {
    if (screen.orientation && screen.orientation.lock) {
      try {
        await screen.orientation.lock('landscape');
      } catch (error) {
        // This is expected on devices that don't support it or when the user denies it.
        console.warn('Could not lock screen orientation:', error);
      }
    }
  };

  // Debounced handler for orientation changes
  let orientationTimeout;
  const handleOrientationChange = () => {
    clearTimeout(orientationTimeout);
    orientationTimeout = setTimeout(() => {
      if (isLandscape()) {
        hideNudge();
      } else {
        showNudge(); // Re-check if nudge should be shown (e.g., if recording)
      }
    }, 100); // Debounce to prevent flicker
  };

  // UI Update Functions
  const updateUI = () => {
    currentDriveType.textContent = tripRecorder.driveType;
    currentCaptureSetting.textContent = videoComposer.state.captureMode.charAt(0).toUpperCase() + videoComposer.state.captureMode.slice(1);
    currentFacingSetting.textContent = videoComposer.state.facing.charAt(0).toUpperCase() + videoComposer.state.facing.slice(1);
    currentRecordingModeSetting.textContent = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    currentSpeedUnit.textContent = speedUnit;

    // Update active states for capture mode buttons
    btnSingle.setAttribute('aria-pressed', videoComposer.state.captureMode === 'single');
    btnDual.setAttribute('aria-pressed', videoComposer.state.captureMode === 'dual');

    // Update active states for facing buttons
    btnFacingUser.setAttribute('aria-pressed', videoComposer.state.facing === 'user');
    btnFacingEnvironment.setAttribute('aria-pressed', videoComposer.state.facing === 'environment');

    if (isRecording) {
      startStopButton.innerHTML = '<span class="relative z-10">Stop Trip</span><span class="absolute inset-0 rounded-full animate-glowPulse"></span>';
      liveHud.classList.remove('hidden');
      settingsButton.classList.add('hidden'); // Hide settings during recording
      muteButton.classList.remove('hidden'); // Show mute button
      settingsMenu.classList.add('hidden'); // Ensure menu is hidden
    } else {
      startStopButton.innerHTML = '<span class="relative z-10">Start Trip</span><span class="absolute inset-0 rounded-full animate-glowPulse"></span>';
      liveHud.classList.add('hidden');
      settingsButton.classList.remove('hidden'); // Show settings when idle
      muteButton.classList.add('hidden'); // Hide mute button
      muteButton.textContent = 'Mute'; // Reset mute button text
    }

    // Handle map/camera view
    if (currentMode === 'camera') {
      videoContainer.classList.remove('hidden');
      mapContainer.classList.add('hidden');
    } else {
      videoContainer.classList.add('hidden');
      mapContainer.classList.remove('hidden');
      mapView.init(); // Ensure map is initialized when switching to map mode
    }
  };

  // Modal Functions
  const showModal = (title, options, currentSelection, onSelect) => {
    settingsModalTitle.textContent = title;
    settingsModalContent.innerHTML = '';
    options.forEach(option => {
      const button = document.createElement('button');
      button.className = `block w-full text-left p-2 rounded-md hover:bg-brand hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-opacity-75 ${currentSelection === option.value ? 'bg-brand text-black' : ''}`;
      button.textContent = option.label;
      button.addEventListener('click', () => {
        onSelect(option.value);
        hideModal();
      });
      settingsModalContent.appendChild(button);
    });
    settingsModal.classList.remove('hidden');
  };

  const hideModal = () => {
    settingsModal.classList.add('hidden');
  };

  // Past Trips Functions
  const formatDuration = (durationMs = 0) => {
    if (!durationMs || Number.isNaN(durationMs)) {
      return '00:00:00';
    }
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const getDistanceDisplay = (meters = 0) => {
    const unit = speedUnit === 'MPH' ? 'MI' : 'KM';
    const value = speedUnit === 'MPH'
      ? meters * 0.000621371
      : meters / 1000;
    return { value: value.toFixed(2), unit };
  };

  const getSpeedDisplay = (kph = 0) => {
    const unit = speedUnit === 'MPH' ? 'MPH' : 'KPH';
    const converted = speedUnit === 'MPH' ? kph * 0.621371 : kph;
    return { value: converted.toFixed(1), unit };
  };

  const getTripVideoBlob = async (trip) => {
    if (!trip || !trip.videoFilename) return null;
    return await readVideoFromOpfs(trip.videoFilename);
  };

  const updateEmptyState = (count) => {
    const isEmpty = count === 0;

    if (emptyTripsMessage) {
      emptyTripsMessage.classList.toggle('hidden', !isEmpty);
    }

    if (clearTripsButton) {
      clearTripsButton.disabled = isEmpty;
      clearTripsButton.classList.toggle('opacity-40', isEmpty);
      clearTripsButton.classList.toggle('cursor-not-allowed', isEmpty);
    }
  };

  const shareSummaryImageFromPastTrip = async (trip) => {
    if (!trip || !trip.points || trip.points.length < 2) {
      alert('Trip is too short to generate a summary image.');
      return;
    }

    const tempMapContainer = document.createElement('div');
    tempMapContainer.id = `temp-map-${trip.id}`;
    tempMapContainer.style.width = '1200px';
    tempMapContainer.style.height = '700px';
    tempMapContainer.style.position = 'absolute';
    tempMapContainer.style.left = '-9999px'; // Position off-screen
    tempMapContainer.style.top = '-9999px';
    document.body.appendChild(tempMapContainer);

    const coords = trip.points.map(p => [p.lon, p.lat]);
    const geojson = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
    };

    const tempMap = new maplibregl.Map({
      container: tempMapContainer.id,
      style: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_MAPTILER_API_KEY',
      center: coords[0],
      zoom: 12,
      interactive: false,
      attributionControl: false,
    });

    tempMap.on('load', () => {
      tempMap.addSource('route', { type: 'geojson', data: geojson });
      tempMap.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#0ea5e9', 'line-width': 4, 'line-opacity': 0.8 }
      });

      const bounds = new maplibregl.LngLatBounds();
      coords.forEach(coord => bounds.extend(coord));
      tempMap.fitBounds(bounds, { padding: 40, duration: 0 });

      tempMap.once('idle', async () => {
        await shareSummaryImage({ map: tempMap, trip });
        // Cleanup
        tempMap.remove();
        document.body.removeChild(tempMapContainer);
      });
    });
  };

  const renderTrip = (trip) => {
    const li = document.createElement('li');
    li.className = 'flex flex-col gap-3 bg-black/60 border border-white/10 rounded-lg p-4 shadow-inner backdrop-blur-sm';
    li.dataset.tripId = trip.id;

    const { value: distanceValue, unit: distanceUnit } = getDistanceDisplay(trip.stats.distanceM);
    const { value: avgSpeedValue, unit: speedUnitLabel } = getSpeedDisplay(trip.stats.avgKph);
    const { value: maxSpeedValue } = getSpeedDisplay(trip.stats.maxKph);
    const durationFormatted = formatDuration(trip.stats.durationMs);
    const hasVideo = Boolean(trip.videoFilename);
    const hasTrack = Array.isArray(trip.points) && trip.points.length > 0;

    li.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-white text-sm font-heading">${new Date(trip.startedAt).toLocaleString()}</p>
          <p class="text-xs text-white/60 mt-1">${distanceValue} ${distanceUnit} • ${durationFormatted} • Avg ${avgSpeedValue} ${speedUnitLabel} (Max ${maxSpeedValue} ${speedUnitLabel})</p>
        </div>
        <button class="delete-trip text-xs uppercase tracking-wide text-red-400 hover:text-red-300 font-heading">✕</button>
      </div>
      <div class="flex flex-wrap justify-end gap-2 items-center">
        <button class="trip-action replay-video" ${hasVideo ? '' : 'disabled'}>Replay</button>
        <button class="trip-action export-gpx" ${hasTrack ? '' : 'disabled'}>GPX</button>
        <button class="trip-action export-geojson" ${hasTrack ? '' : 'disabled'}>GeoJSON</button>

        <!-- Share Button & Menu -->
        <div class="relative">
          <button class="trip-action share-button">Share</button>
          <div class="share-menu hidden absolute right-0 top-full mt-2 w-48 bg-surface/95 border border-brand/30 rounded-lg shadow-neon text-sm text-white backdrop-blur z-20 overflow-hidden">
            <button class="settings-item share-video-option" ${hasVideo ? '' : 'disabled'}>Share Video</button>
            <button class="settings-item download-video-option" ${hasVideo ? '' : 'disabled'}>Download Video</button>
            <button class="settings-item share-image-option" ${hasTrack ? '' : 'disabled'}>Share Summary Image</button>
          </div>
        </div>
      </div>
    `;

    tripList.appendChild(li);

    // --- Event Listeners for the new element ---
    const shareButton = li.querySelector('.share-button');
    const shareMenu = li.querySelector('.share-menu');

    shareButton.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other menus
      document.querySelectorAll('.share-menu').forEach(menu => {
        if (menu !== shareMenu) menu.classList.add('hidden');
      });
      shareMenu.classList.toggle('hidden');
    });

    li.querySelector('.delete-trip').addEventListener('click', () => handleDeleteTrip(trip));

    if (hasVideo) {
      li.querySelector('.replay-video').addEventListener('click', async () => {
        const videoBlob = await getTripVideoBlob(trip);
        if (videoBlob) {
          const videoURL = URL.createObjectURL(videoBlob);
          replayVideoPlayer.src = videoURL;
          videoPlayerOverlay.classList.remove('hidden');
          replayVideoPlayer.play().catch(err => console.warn("Replay autoplay prevented:", err));
        } else {
          alert('Could not retrieve video.');
        }
      });

      li.querySelector('.share-video-option').addEventListener('click', debounce(async () => {
        shareMenu.classList.add('hidden');
        const videoBlob = await getTripVideoBlob(trip);
        if (videoBlob) {
          shareVideo(videoBlob, trip.videoFilename);
        } else {
          alert('Could not retrieve video file.');
        }
      }, 500));

      li.querySelector('.download-video-option').addEventListener('click', debounce(async () => {
        shareMenu.classList.add('hidden');
        const videoBlob = await getTripVideoBlob(trip);
        if (videoBlob) {
          downloadBlob(videoBlob, trip.videoFilename);
        } else {
          alert('Could not retrieve video file.');
        }
      }, 500));
    }

    if (hasTrack) {
      li.querySelector('.share-image-option').addEventListener('click', debounce(() => {
        shareMenu.classList.add('hidden');
        shareSummaryImageFromPastTrip(trip);
      }, 500));

      li.querySelector('.export-gpx').addEventListener('click', () => {
        const blob = tripRecorder.exportGPX(trip);
        if (blob) downloadBlob(blob, `roadtrip-${trip.id}.gpx`);
      });

      li.querySelector('.export-geojson').addEventListener('click', () => {
        const blob = tripRecorder.exportGeoJSON(trip);
        if (blob) downloadBlob(blob, `roadtrip-${trip.id}.geojson`);
      });
    }
  };

  const loadAndRenderTrips = async () => {
    const trips = await getTrips();
    tripList.innerHTML = ''; // Clear existing list
    trips.sort((a, b) => b.startedAt - a.startedAt).forEach(renderTrip);
    updateEmptyState(trips.length);
  };

  const showPastTripsOverlay = async () => {
    await loadAndRenderTrips();
    settingsMenu.classList.add('hidden');
    pastTripsOverlay.classList.remove('hidden');
  };

  const hidePastTripsOverlay = () => {
    pastTripsOverlay.classList.add('hidden');
  };

  async function handleDeleteTrip(trip) {
    if (!trip) return;
    const confirmation = confirm('Delete this trip permanently?');
    if (!confirmation) return;

    try {
      await deleteTrip(trip.id);
      if (trip.videoFilename) {
        await deleteVideoFromOpfs(trip.videoFilename);
      }
      await loadAndRenderTrips();
    } catch (error) {
      console.error('Failed to delete trip:', error);
      alert('Could not delete trip. Please try again.');
    }
  }

  async function handleClearTrips() {
    const confirmation = confirm('Clear all trips and associated videos? This cannot be undone.');
    if (!confirmation) return;

    try {
      const trips = await getTrips();
      for (const trip of trips) {
        if (trip.videoFilename) {
          await deleteVideoFromOpfs(trip.videoFilename);
        }
      }
      await clearTrips();
      await loadAndRenderTrips();
    } catch (error) {
      console.error('Failed to clear trips:', error);
      alert('Could not clear trips. Please try again.');
    }
  }

  const startCamera = async () => {
    // The videoComposer.setCaptureMode will handle starting the appropriate camera streams
    // based on the current state.captureMode and state.facing.
    const success = await videoComposer.setCaptureMode(videoComposer.state.captureMode);
    if (!success) {
      alert('Could not start camera. Please check permissions and ensure the camera is not in use by another app.');
    }
    return success;
  };

  const stopCamera = () => {
    videoComposer.stopStreams();
  };

  const startRecording = async () => {
    if (isRecording) return;

    // Ensure camera is started before recording
    if (!videoComposer.compositeStream) {
      const cameraStarted = await startCamera();
      if (!cameraStarted) {
        alert('Camera not available. Please ensure permissions are granted and the camera is not in use.');
        return;
      }
    }

    isRecording = true;
    updateUI();

    // Acquire wake lock
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Screen Wake Lock acquired!');
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }

    tripRecorder.startTrip();
    liveHUD.start();
    if (currentMode === 'map') {
      mapView.init();
      mapView.setFollow(true);
    }

    // Start video recording
    videoComposer.startRecording(async (chunk) => {
      // Progressively save video chunks
      const filename = `video-chunk-${Date.now()}.mp4`; // Or mp4
      await writeVideoToOpfs(filename, chunk);
      // Optionally, save chunk metadata to IndexedDB if needed for recovery
    });

    // Animation loop for HUD updates
    const animate = () => {
      const tripData = tripRecorder.getCurrentTrip();
      if (tripData) {
        liveHUD.update({
          speedKph: tripData.live.speedKph,
          elapsedMs: tripData.live.elapsedMs,
          distanceM: tripData.stats.distanceM,
          headingDeg: tripData.live.headingDeg,
        });
        videoComposer.setHUD({
            speed: hudSpeed.textContent,
            distance: hudDistance.textContent,
            time: hudTime.textContent,
        });

        // Continuously update mute status for video overlay
        const isMuted = videoComposer.audioTrack ? !videoComposer.audioTrack.enabled : false;
        videoComposer.setMutedState(isMuted);

        if (currentMode === 'map') {
          mapView.updateLiveTrack(tripData.points);
          mapView.setCurrentPoint(tripData.points[tripData.points.length - 1]);
        }
      }

      if (isRecording) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    isRecording = false;
    updateUI();

    // Release wake lock
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
      console.log('Screen Wake Lock released.');
    }

    liveHUD.stop();
    if (currentMode === 'map') {
      mapView.setFollow(false);
      const currentTripData = tripRecorder.getCurrentTrip();
      if (currentTripData && currentTripData.points.length > 0) {
        mapView.fitBoundsToPoints(currentTripData.points);
      }
    }

    const finalVideoBlob = await videoComposer.stopRecording();
    let savedTrip;
    if (finalVideoBlob) {
      console.log('Final video blob created, size:', finalVideoBlob.size, 'type:', finalVideoBlob.type);
      const videoFilename = `roadtrip-${Date.now()}.mp4`;
      try {
        await writeVideoToOpfs(videoFilename, finalVideoBlob);
        console.log('Final video successfully saved to OPFS:', videoFilename);
        await clearVideoChunks();
        savedTrip = await tripRecorder.stopTrip({ videoFilename });
      } catch (error) {
        console.error('Error saving final video to OPFS:', error);
        savedTrip = await tripRecorder.stopTrip();
      }
    } else {
      console.warn('No final video blob to save.');
      await clearVideoChunks();
      savedTrip = await tripRecorder.stopTrip();
    }

    if (savedTrip) {
      showTripSummary(savedTrip);
    }
  };

  // --- Trip Summary Functions ---

  const hideTripSummary = () => {
    tripSummaryOverlay.classList.add('hidden');
    if (summaryMap) {
      summaryMap.remove();
      summaryMap = null;
    }
    // Reset stats and canvas
    tripStats.innerHTML = '';
    elevationProfile.classList.add('hidden');
    const ctx = elevationProfile.getContext('2d');
    ctx.clearRect(0, 0, elevationProfile.width, elevationProfile.height);
  };

  const drawElevationProfile = (elevations) => {
    const canvas = elevationProfile;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 10;

    const validElevations = elevations.filter(e => e !== null && e !== undefined);
    if (validElevations.length < 2) {
      elevationProfile.classList.add('hidden');
      return;
    }

    elevationProfile.classList.remove('hidden');
    ctx.clearRect(0, 0, width, height);

    const minEle = Math.min(...validElevations);
    const maxEle = Math.max(...validElevations);
    const eleRange = maxEle - minEle;

    const getX = (index) => (index / (validElevations.length - 1)) * (width - 2 * padding) + padding;
    const getY = (ele) => height - (((ele - minEle) / eleRange) * (height - 2 * padding) + padding);

    // Draw profile line
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(validElevations[0]));
    validElevations.forEach((ele, index) => {
      ctx.lineTo(getX(index), getY(ele));
    });
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0ea5e9';
    ctx.stroke();

    // Draw min/max labels
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText(`${minEle.toFixed(0)}m`, 5, height - 5);
    ctx.fillText(`${maxEle.toFixed(0)}m`, 5, 15);
  };

  const showTripSummary = (trip) => {
    if (!trip || !trip.points || trip.points.length < 2) {
      alert('Trip is too short to display a summary.');
      return;
    }

    // 1. Prepare data
    const coords = trip.points.map(p => [p.lon, p.lat]);
    const elevations = trip.points.map(p => p.alt).filter(alt => alt !== null && alt !== undefined);
    const hasElevation = elevations.length === coords.length;

    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords
      },
      properties: {
        ...(hasElevation && { elevations })
      }
    };

    // 2. Display Stats
    const { value: distValue, unit: distUnit } = getDistanceDisplay(trip.stats.distanceM);
    const { value: avgSpeedValue, unit: speedUnit } = getSpeedDisplay(trip.stats.avgKph);
    tripStats.innerHTML = `
      <div>
        <div class="text-xs text-white/60">Distance</div>
        <div class="text-lg font-bold">${distValue} ${distUnit}</div>
      </div>
      <div>
        <div class="text-xs text-white/60">Duration</div>
        <div class="text-lg font-bold">${formatDuration(trip.stats.durationMs)}</div>
      </div>
      <div>
        <div class="text-xs text-white/60">Avg Speed</div>
        <div class="text-lg font-bold">${avgSpeedValue} ${speedUnit}</div>
      </div>
    `;

    // 3. Display Elevation Profile
    if (hasElevation) {
      drawElevationProfile(elevations);
    } else {
      elevationProfile.classList.add('hidden');
    }

    // 4. Show Overlay
    tripSummaryOverlay.classList.remove('hidden');

    // 5. Render Map
    if (summaryMap) summaryMap.remove();
    summaryMap = new maplibregl.Map({
      container: 'tripSummaryMap',
      style: 'https://api.maptiler.com/maps/streets/style.json?key=YOUR_MAPTILER_API_KEY', // Replace with your key
      center: coords[0],
      zoom: 12,
      attributionControl: false
    });

    summaryMap.on('load', () => {
      summaryMap.addSource('route', { type: 'geojson', data: geojson });

      summaryMap.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#0ea5e9', 'line-width': 4, 'line-opacity': 0.8 }
      });

      const startPoint = { type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] }, properties: { kind: 'start' } };
      const endPoint = { type: 'Feature', geometry: { type: 'Point', coordinates: coords[coords.length - 1] }, properties: { kind: 'end' } };

      summaryMap.addSource('route-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [startPoint, endPoint] }
      });

      summaryMap.addLayer({
        id: 'route-points-circles',
        type: 'circle',
        source: 'route-points',
        paint: {
          'circle-radius': 6,
          'circle-color': ['match', ['get', 'kind'], 'start', '#10b981', 'end', '#ef4444', '#ccc'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });

      summaryMap.addLayer({
        id: 'route-start-label',
        type: 'symbol',
        source: 'route-points',
        filter: ['==', ['get', 'kind'], 'start'],
        layout: { 'text-field': 'A', 'text-font': ['Open Sans Bold'], 'text-size': 12, 'text-offset': [0, 0.1] },
        paint: { 'text-color': '#fff' }
      });

      summaryMap.addLayer({
        id: 'route-end-label',
        type: 'symbol',
        source: 'route-points',
        filter: ['==', ['get', 'kind'], 'end'],
        layout: { 'text-field': 'B', 'text-font': ['Open Sans Bold'], 'text-size': 12, 'text-offset': [0, 0.1] },
        paint: { 'text-color': '#fff' }
      });


      const bounds = new maplibregl.LngLatBounds();
      coords.forEach(coord => bounds.extend(coord));
      summaryMap.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 0 });
    });

    // Initialize the share button now that the summary is visible
    initShareButton(trip, summaryMap, getTripVideoBlob);
  };

  // Event Listeners
  startStopButton.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // Toggles the microphone audio track on the current stream.
  const toggleMute = () => {
    if (!videoComposer.audioTrack) return;

    // Toggle the enabled state of the audio track
    videoComposer.audioTrack.enabled = !videoComposer.audioTrack.enabled;

    // Update UI
    const isMuted = !videoComposer.audioTrack.enabled;
    muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
  };

  muteButton.addEventListener('click', toggleMute);

  settingsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    settingsMenu.classList.toggle('hidden');
  });

  settingsMenu.addEventListener('click', (event) => event.stopPropagation());

  document.addEventListener('click', (e) => {
    settingsMenu.classList.add('hidden');
    // Close any open share menus in the trip list
    const openMenus = document.querySelectorAll('.share-menu:not(.hidden)');
    openMenus.forEach(menu => {
      // Check if the click was outside the menu and its corresponding button
      const shareButton = menu.previousElementSibling;
      if (!menu.contains(e.target) && e.target !== shareButton) {
        menu.classList.add('hidden');
      }
    });
  });

  settingsModalClose.addEventListener('click', hideModal);
  pastTripsClose.addEventListener('click', hidePastTripsOverlay);
  clearTripsButton.addEventListener('click', handleClearTrips);

  driveTypeButton.addEventListener('click', () => {
    const driveTypes = ['Long Drive', 'Short Drive', 'Commute', 'Errand', 'Off-road'];
    showModal(
      'Drive Type',
      driveTypes.map(type => ({ label: type, value: type })),
      tripRecorder.driveType,
      (selection) => {
        tripRecorder.setDriveType(selection);
        updateUI();
      }
    );
  });

  closeVideoPlayer.addEventListener('click', () => {
    replayVideoPlayer.pause();
    replayVideoPlayer.removeAttribute('src');
    replayVideoPlayer.load();
    videoPlayerOverlay.classList.add('hidden');
  });

  videoPlayerOverlay.addEventListener('click', (event) => {
    if (event.target === videoPlayerOverlay) {
      closeVideoPlayer.click();
    }
  });

  captureSettingsButton.addEventListener('click', () => {
    showModal(
      'Capture Settings',
      [
        { label: 'Single Camera', value: 'single' },
        { label: 'Dual Camera', value: 'dual' },
      ],
      videoComposer.state.captureMode,
      async (selection) => {
        await videoComposer.setCaptureMode(selection);
        updateUI();
      }
    );
  });

  facingCameraButton.addEventListener('click', () => {
    showModal(
      'Facing Camera',
      [
        { label: 'Environment (Rear)', value: 'environment' },
        { label: 'User (Front)', value: 'user' },
      ],
      videoComposer.state.facing,
      async (selection) => {
        await videoComposer.setFacing(selection);
        updateUI();
      }
    );
  });

  recordingModeButton.addEventListener('click', () => {
    showModal(
      'Recording Mode',
      [
        { label: 'Camera View', value: 'camera' },
        { label: 'Map View', value: 'map' },
      ],
      currentMode,
      async (selection) => {
        currentMode = selection;
        updateUI();
        // Camera/map view changes are handled by updateUI now
      }
    );
  });

  speedUnitButton.addEventListener('click', () => {
    const newUnit = speedUnit === 'MPH' ? 'KPH' : 'MPH';
    speedUnit = newUnit;
    liveHUD.setSpeedUnit(newUnit); // Inform LiveHUD of the change
    updateUI();
    if (!pastTripsOverlay.classList.contains('hidden')) {
      loadAndRenderTrips();
    }
  });

  pastTripsButton.addEventListener('click', showPastTripsOverlay);

  tripSummaryClose.addEventListener('click', hideTripSummary);
  tripSummaryOverlay.addEventListener('click', (event) => {
    if (event.target === tripSummaryOverlay) {
      hideTripSummary();
    }
  });

  // Event listeners for the modal buttons directly
  btnSingle.addEventListener('click', async () => {
    await videoComposer.setCaptureMode('single');
    updateUI();
    hideModal();
  });

  btnDual.addEventListener('click', async () => {
    await videoComposer.setCaptureMode('dual');
    updateUI();
    hideModal();
  });

  btnFacingUser.addEventListener('click', async () => {
    await videoComposer.setFacing('user');
    updateUI();
    hideModal();
  });

  btnFacingEnvironment.addEventListener('click', async () => {
    await videoComposer.setFacing('environment');
    updateUI();
    hideModal();
  });

  // Initial UI update
  updateUI();

  // Initial camera start
  await startCamera();
});