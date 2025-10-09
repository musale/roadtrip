// src/js/app.js

import '../css/styles.css';
import maplibregl from 'maplibre-gl';
import TripRecorder from './TripRecorder.js';
import LiveHUD from './LiveHUD.js';
import VideoComposer from './VideoComposer.js';
import MapView from './MapView.js';
import { getTrips, writeVideoToOpfs, clearVideoChunks, readVideoFromOpfs, deleteTrip, clearTrips, deleteVideoFromOpfs } from './storage/db.js';
import { initShareButton, shareVideo, shareSummaryImage, downloadBlob, debounce, SHARE_MAP_STYLE_URL } from './Share.js';

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

  const cameraStatusMessage = document.getElementById('cameraStatusMessage');
  const cameraStatusTitle = document.getElementById('cameraStatusTitle');
  const cameraStatusBody = document.getElementById('cameraStatusBody');
  const cameraStatusCard = cameraStatusMessage ? cameraStatusMessage.querySelector('div') : null;

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
  let cameraCapabilities = { cameraCount: 0, hasUserFacing: false, hasEnvironmentFacing: false };
  let cameraReady = false;
  let cameraStatusTimeout = null;

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

  const clearCameraStatusTimer = () => {
    if (cameraStatusTimeout) {
      clearTimeout(cameraStatusTimeout);
      cameraStatusTimeout = null;
    }
  };

  const applyCameraStatusVariant = (variant = 'info') => {
    if (!cameraStatusCard || !cameraStatusTitle || !cameraStatusBody) return;

    const borderClasses = ['border-white/10', 'border-red-500/60', 'border-emerald-400/60', 'border-yellow-400/60'];
    const titleClasses = ['text-brand', 'text-red-300', 'text-emerald-300', 'text-yellow-300'];
    const bodyClasses = ['text-white/80', 'text-red-200', 'text-emerald-200', 'text-yellow-200'];

    cameraStatusCard.classList.remove(...borderClasses);
    cameraStatusTitle.classList.remove(...titleClasses);
    cameraStatusBody.classList.remove(...bodyClasses);

    switch (variant) {
      case 'success':
        cameraStatusCard.classList.add('border-emerald-400/60');
        cameraStatusTitle.classList.add('text-emerald-300');
        cameraStatusBody.classList.add('text-emerald-200');
        break;
      case 'error':
        cameraStatusCard.classList.add('border-red-500/60');
        cameraStatusTitle.classList.add('text-red-300');
        cameraStatusBody.classList.add('text-red-200');
        break;
      case 'warning':
        cameraStatusCard.classList.add('border-yellow-400/60');
        cameraStatusTitle.classList.add('text-yellow-300');
        cameraStatusBody.classList.add('text-yellow-200');
        break;
      default:
        cameraStatusCard.classList.add('border-white/10');
        cameraStatusTitle.classList.add('text-brand');
        cameraStatusBody.classList.add('text-white/80');
        break;
    }
  };

  const showCameraStatus = (title, message, { variant = 'info', autoHideMs = null } = {}) => {
    if (!cameraStatusMessage || !cameraStatusTitle || !cameraStatusBody) return;
    clearCameraStatusTimer();
    applyCameraStatusVariant(variant);
    cameraStatusTitle.textContent = title;
    cameraStatusBody.textContent = message;
    cameraStatusMessage.classList.remove('opacity-0');
    if (autoHideMs && autoHideMs > 0) {
      cameraStatusTimeout = setTimeout(() => {
        hideCameraStatus();
      }, autoHideMs);
    }
  };

  const hideCameraStatus = () => {
    if (!cameraStatusMessage) return;
    clearCameraStatusTimer();
    cameraStatusMessage.classList.add('opacity-0');
  };

  const toggleInteractiveState = (element, disabled) => {
    if (!element) return;
    element.disabled = disabled;
    element.setAttribute('aria-disabled', disabled);
    element.classList.toggle('opacity-40', disabled);
    element.classList.toggle('cursor-not-allowed', disabled);
  };

  const setStartButtonEnabled = (enabled) => {
    toggleInteractiveState(startStopButton, !enabled);
  };

  const syncCameraControlAvailability = () => {
    const dualSupported = cameraCapabilities.cameraCount >= 2 && cameraCapabilities.hasEnvironmentFacing && cameraCapabilities.hasUserFacing;
    const canUseEnvironment = cameraCapabilities.hasEnvironmentFacing;
    const canUseUser = cameraCapabilities.hasUserFacing;

    toggleInteractiveState(btnDual, !dualSupported);
    toggleInteractiveState(btnFacingEnvironment, !canUseEnvironment);
    toggleInteractiveState(btnFacingUser, !canUseUser);

    facingCameraButton?.setAttribute('aria-disabled', !canUseEnvironment && !canUseUser);
    facingCameraButton?.classList.toggle('opacity-40', !canUseEnvironment);

    captureSettingsButton?.setAttribute('aria-disabled', !dualSupported);
    captureSettingsButton?.classList.toggle('opacity-40', !dualSupported);
  };

  const handleCameraResult = (result, { silentSuccess = false } = {}) => {
    if (!result) return false;

    if (result.capabilities) {
      cameraCapabilities = {
        cameraCount: result.capabilities.cameraCount ?? 0,
        hasUserFacing: !!result.capabilities.hasUserFacing,
        hasEnvironmentFacing: !!result.capabilities.hasEnvironmentFacing,
      };
      syncCameraControlAvailability();
    }

    if (!result.success) {
      cameraReady = false;
      setStartButtonEnabled(false);
      const errorMessage = result.error?.message ?? 'Camera could not be started. Please check permissions and availability.';
      showCameraStatus('Camera unavailable', errorMessage, { variant: 'error' });
      return false;
    }

    cameraReady = true;
    setStartButtonEnabled(true);

    if (result.warning) {
      showCameraStatus('Using single camera', result.warning.message, { variant: 'warning', autoHideMs: 5000 });
    } else if (result.metadata?.facingChanged) {
      const facingLabel = result.metadata.actualFacing === 'environment' ? 'environment' : 'user';
      showCameraStatus('Camera adjusted', `Switched to the ${facingLabel} camera that is available on this device.`, { variant: 'warning', autoHideMs: 4000 });
    } else if (!silentSuccess) {
      showCameraStatus('Camera ready', 'Video preview is live. You can start your trip.', { variant: 'success', autoHideMs: 2500 });
    }

    if (silentSuccess) {
      hideCameraStatus();
    }

    return true;
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
      button.className = `block w-full text-left p-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-opacity-75 ${currentSelection === option.value ? 'bg-brand text-black' : 'hover:bg-brand hover:text-black'} ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}`;
      button.textContent = option.label;
      if (option.description) {
        button.title = option.description;
      }
      if (option.disabled) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      } else {
        button.addEventListener('click', () => {
          onSelect(option.value);
          hideModal();
        });
      }
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
    if (!trip) return;
    await shareSummaryImage({ trip });
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

        <!-- Share Button -->
        <button class="trip-action share-button">Share</button>
      </div>
    `;

    tripList.appendChild(li);

    // --- Event Listeners for the new element ---
    const shareButton = li.querySelector('.share-button');

    shareButton.addEventListener('click', (e) => {
      e.stopPropagation();
      openShareMenuPortal(trip, shareButton);
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
    }

    if (hasTrack) {
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

  const openShareMenuPortal = (trip, shareButtonElement) => {
    const portal = document.getElementById('shareMenuPortal');
    portal.innerHTML = ''; // Clear previous menu if any
    portal.classList.remove('pointer-events-none'); // Enable interactions

    const menuRect = shareButtonElement.getBoundingClientRect();

    const shareMenu = document.createElement('div');
    shareMenu.className = 'share-menu absolute bg-surface/95 border border-brand/30 rounded-lg shadow-neon text-sm text-white backdrop-blur z-[999] overflow-hidden';
    shareMenu.style.minWidth = `200px`; // Increased width for better readability
    portal.appendChild(shareMenu); // Append first to get offsetWidth/Height

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = shareMenu.offsetWidth;
    const menuHeight = shareMenu.offsetHeight;
    const padding = 10; // Padding from viewport edges

    let topPosition = menuRect.bottom + 8; // Default: 8px below the button
    let leftPosition = menuRect.right - menuWidth; // Default: align right edge of menu with right edge of button

    // Horizontal positioning
    if (leftPosition < padding) {
      leftPosition = padding; // If it overflows left, align with left edge of viewport with padding
    }

    // Vertical positioning
    if (topPosition + menuHeight > viewportHeight - padding) {
      // If it overflows bottom, try positioning above the button
      topPosition = menuRect.top - menuHeight - 8; // 8px above the button
      if (topPosition < padding) {
        topPosition = padding; // Fallback to top edge with padding
      }
    }

    shareMenu.style.top = `${topPosition}px`;
    shareMenu.style.left = `${leftPosition}px`;

    // Add menu items (similar to the old HTML structure)
    const hasVideo = Boolean(trip.videoFilename);

    shareMenu.innerHTML = `
      <button class="settings-item share-video-option" ${hasVideo ? '' : 'disabled'}>Share Video</button>
      <button class="settings-item download-video-option" ${hasVideo ? '' : 'disabled'}>Download Video</button>
      <button class="settings-item share-image-option">Share Summary Image</button>
    `;

    portal.appendChild(shareMenu);

    // Event listeners for menu items
    if (hasVideo) {
      shareMenu.querySelector('.share-video-option').addEventListener('click', debounce(async () => {
        closeShareMenuPortal();
        const videoBlob = await getTripVideoBlob(trip);
        if (videoBlob) {
          shareVideo(videoBlob, trip.videoFilename);
        } else {
          alert('Could not retrieve video file.');
        }
      }, 500));

      shareMenu.querySelector('.download-video-option').addEventListener('click', debounce(async () => {
        closeShareMenuPortal();
        const videoBlob = await getTripVideoBlob(trip);
        if (videoBlob) {
          downloadBlob(videoBlob, trip.videoFilename);
        } else {
          alert('Could not retrieve video file.');
        }
      }, 500));
    }

    shareMenu.querySelector('.share-image-option').addEventListener('click', debounce(() => {
      closeShareMenuPortal();
      shareSummaryImageFromPastTrip(trip);
    }, 500));

    // Click outside to close
    const clickOutsideHandler = (e) => {
      if (!shareMenu.contains(e.target) && e.target !== shareButtonElement) {
        closeShareMenuPortal();
      }
    };
    document.addEventListener('click', clickOutsideHandler);

    // Escape key to close
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeShareMenuPortal();
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Function to close the portal
    const closeShareMenuPortal = () => {
      portal.innerHTML = '';
      portal.classList.add('pointer-events-none');
      document.removeEventListener('click', clickOutsideHandler);
      document.removeEventListener('keydown', escapeHandler);
    };
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

  const startCamera = async ({ initial = false } = {}) => {
    showCameraStatus('Preparing camera', 'Checking available cameras and starting preview…', { variant: 'info' });
    setStartButtonEnabled(false);

    const result = await videoComposer.setCaptureMode(videoComposer.state.captureMode, { forceRestart: true });

    const handled = handleCameraResult(result, { silentSuccess: !initial });

    if (!handled) {
      return false;
    }

    if (cameraCapabilities.cameraCount === 0) {
      showCameraStatus(
        'No cameras detected',
        'This device does not report any cameras. You can still record GPS-only trips without video.',
        { variant: 'warning' }
      );
    }

    return true;
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
        showCameraStatus(
          'Cannot start recording',
          'We couldn’t start the camera stream. Check permissions or ensure no other app is using the camera.',
          { variant: 'error' }
        );
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
      style: SHARE_MAP_STYLE_URL,
      center: coords[0],
      zoom: 12,
      attributionControl: false,
      preserveDrawingBuffer: true,
      interactive: false,
      pitchWithRotate: false,
      dragPan: false,
      renderWorldCopies: false,
      boxZoom: false,
      doubleClickZoom: false,
      scrollZoom: false,
      touchPitch: false,
      touchZoomRotate: false,
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
    console.log('Calling initShareButton with trip:', trip, 'and summaryMap:', summaryMap);
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
    // The share menu is now handled by its own click-outside logic in openShareMenuPortal
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
    const dualSupported = cameraCapabilities.cameraCount >= 2 && cameraCapabilities.hasEnvironmentFacing && cameraCapabilities.hasUserFacing;
    showModal(
      'Capture Settings',
      [
        { label: 'Single Camera', value: 'single' },
        {
          label: dualSupported ? 'Dual Camera' : 'Dual Camera (requires front & rear cameras)',
          value: 'dual',
          disabled: !dualSupported,
          description: dualSupported ? undefined : 'Dual mode needs both user-facing and environment-facing cameras.',
        },
      ],
      videoComposer.state.captureMode,
      async (selection) => {
        const result = await videoComposer.setCaptureMode(selection, { forceRestart: true });
        handleCameraResult(result);
        updateUI();
      }
    );
  });

  facingCameraButton.addEventListener('click', () => {
    const canUseEnvironment = cameraCapabilities.hasEnvironmentFacing;
    const canUseUser = cameraCapabilities.hasUserFacing;
    showModal(
      'Facing Camera',
      [
        {
          label: canUseEnvironment ? 'Environment (Rear)' : 'Environment (rear camera not detected)',
          value: 'environment',
          disabled: !canUseEnvironment,
          description: canUseEnvironment ? undefined : 'Connect or enable a rear camera to use this option.',
        },
        {
          label: canUseUser ? 'User (Front)' : 'User (front camera not detected)',
          value: 'user',
          disabled: !canUseUser,
          description: canUseUser ? undefined : 'No user-facing camera was found.',
        },
      ],
      videoComposer.state.facing,
      async (selection) => {
        const result = await videoComposer.setFacing(selection);
        handleCameraResult(result, { silentSuccess: selection === videoComposer.state.facing });
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
    const result = await videoComposer.setCaptureMode('single', { forceRestart: true });
    handleCameraResult(result, { silentSuccess: true });
    updateUI();
    hideModal();
  });

  btnDual.addEventListener('click', async () => {
    const result = await videoComposer.setCaptureMode('dual', { forceRestart: true });
    handleCameraResult(result);
    updateUI();
    hideModal();
  });

  btnFacingUser.addEventListener('click', async () => {
    const result = await videoComposer.setFacing('user');
    handleCameraResult(result, { silentSuccess: true });
    updateUI();
    hideModal();
  });

  btnFacingEnvironment.addEventListener('click', async () => {
    const result = await videoComposer.setFacing('environment');
    handleCameraResult(result, { silentSuccess: true });
    updateUI();
    hideModal();
  });

  const bootstrapCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraStatus(
        'Camera unsupported',
        'This browser does not support camera access. You can still record GPS-only trips.',
        { variant: 'warning' }
      );
      setStartButtonEnabled(false);
      return;
    }

    try {
      const devices = await videoComposer.refreshCameraInventory();
      cameraCapabilities = {
        cameraCount: devices.cameraCount ?? 0,
        hasUserFacing: !!devices.hasUserFacing,
        hasEnvironmentFacing: !!devices.hasEnvironmentFacing,
      };
      syncCameraControlAvailability();

      if (cameraCapabilities.cameraCount === 0) {
        showCameraStatus(
          'No cameras detected',
          'We couldn’t find any cameras on this device. You can still track trips without video.',
          { variant: 'warning' }
        );
        setStartButtonEnabled(false);
        return;
      }

      const defaultFacing = cameraCapabilities.hasEnvironmentFacing ? 'environment' : 'user';
      videoComposer.state.facing = defaultFacing;

      const result = await startCamera({ initial: true });
      if (!result) {
        setStartButtonEnabled(false);
      }
    } catch (error) {
      console.error('Failed to bootstrap camera:', error);
      showCameraStatus(
        'Camera error',
        error?.message ?? 'Could not initialise the camera. Please check permissions.',
        { variant: 'error' }
      );
      setStartButtonEnabled(false);
    }
  };

  updateUI();
  bootstrapCamera();

  window.addEventListener('focus', async () => {
    if (!cameraReady && navigator.mediaDevices) {
      await startCamera({ initial: true });
    }
  });

});