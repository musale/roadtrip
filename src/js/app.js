// src/js/app.js

import '../css/styles.css';
import TripRecorder from './TripRecorder.js';
import LiveHUD from './LiveHUD.js';
import VideoComposer from './VideoComposer.js';
import MapView from './MapView.js';
import { getTrips, writeVideoToOpfs, clearVideoChunks, readVideoFromOpfs, deleteTrip, clearTrips, deleteVideoFromOpfs } from './storage/db.js';

document.addEventListener('DOMContentLoaded', async () => {
  const videoContainer = document.getElementById('videoContainer');
  const singleVideoFeed = document.getElementById('singleVideoFeed');
  const dualVideoContainer = document.getElementById('dualVideoContainer');
  const dualFrontVideo = document.getElementById('dualFrontVideo');
  const dualBackVideo = document.getElementById('dualBackVideo');
  const liveHud = document.getElementById('liveHud');
  const hudSpeed = document.getElementById('hudSpeed');
  const hudDistance = document.getElementById('hudDistance');
  const hudTime = document.getElementById('hudTime');
  const startStopButton = document.getElementById('startStopButton');
  const settingsButton = document.getElementById('settingsButton');
  const settingsMenu = document.getElementById('settingsMenu');

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

  // Placeholder for mapContainer if needed later, currently hidden
  const mapContainer = document.createElement('div');
  mapContainer.id = 'mapContainer';
  mapContainer.className = 'hidden';
  document.getElementById('app').appendChild(mapContainer);

  const tripRecorder = new TripRecorder();
  let speedUnit = 'MPH'; // Default speed unit
  const liveHUD = new LiveHUD({ hudSpeed, hudDistance, hudTime, speedUnit }); // Pass elements to LiveHUD
  const videoComposer = new VideoComposer({
    singleVideoEl: singleVideoFeed,
    dualContainer: dualVideoContainer,
    dualFrontVideo,
    dualBackVideo,
  });
  const mapView = new MapView({ container: mapContainer });

  let currentMode = 'camera'; // 'camera' or 'map'
  let currentCapture = 'single'; // 'single' or 'dual'
  let currentFacing = 'user'; // 'environment' or 'user'
  let isRecording = false;
  let wakeLock = null;

  // UI Update Functions
  const updateUI = () => {
    currentCaptureSetting.textContent = currentCapture.charAt(0).toUpperCase() + currentCapture.slice(1);
    currentFacingSetting.textContent = currentFacing.charAt(0).toUpperCase() + currentFacing.slice(1);
    currentRecordingModeSetting.textContent = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    currentSpeedUnit.textContent = speedUnit;

    if (isRecording) {
      startStopButton.innerHTML = '<span class="relative z-10">Stop Trip</span><span class="absolute inset-0 rounded-full animate-glowPulse"></span>';
      liveHud.classList.remove('hidden');
      settingsButton.classList.add('hidden'); // Hide settings during recording
      settingsMenu.classList.add('hidden'); // Ensure menu is hidden
    } else {
      startStopButton.innerHTML = '<span class="relative z-10">Start Trip</span><span class="absolute inset-0 rounded-full animate-glowPulse"></span>';
      liveHud.classList.add('hidden');
      settingsButton.classList.remove('hidden'); // Show settings when idle
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

  const renderTrip = (trip) => {
    const li = document.createElement('li');
    li.className = 'flex flex-col gap-3 bg-black/60 border border-white/10 rounded-lg p-4 shadow-inner backdrop-blur-sm';

    const { value: distanceValue, unit: distanceUnit } = getDistanceDisplay(trip.stats.distanceM);
    const { value: avgSpeedValue, unit: speedUnitLabel } = getSpeedDisplay(trip.stats.avgKph);
    const { value: maxSpeedValue } = getSpeedDisplay(trip.stats.maxKph);
    const durationFormatted = formatDuration(trip.stats.durationMs);
    const hasVideo = Boolean(trip.videoFilename);
    const hasTrack = Array.isArray(trip.points) && trip.points.length > 0;

    const videoButtons = hasVideo
      ? `
        <button class="trip-action replay-video">Replay</button>
        <button class="trip-action download-video">Download</button>
        <button class="trip-action share-video">Share</button>
      `
      : `
        <button class="trip-action cursor-not-allowed opacity-40" disabled>Replay</button>
        <button class="trip-action cursor-not-allowed opacity-40" disabled>Download</button>
        <button class="trip-action cursor-not-allowed opacity-40" disabled>Share</button>
      `;

    li.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-white text-sm font-heading">${new Date(trip.startedAt).toLocaleString()}</p>
          <p class="text-xs text-white/60 mt-1">${distanceValue} ${distanceUnit} • ${durationFormatted} • Avg ${avgSpeedValue} ${speedUnitLabel} (Max ${maxSpeedValue} ${speedUnitLabel})</p>
        </div>
        <button class="delete-trip text-xs uppercase tracking-wide text-red-400 hover:text-red-300 font-heading">✕</button>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        ${videoButtons}
        <button class="trip-action export-gpx${hasTrack ? '' : ' opacity-40'}" ${hasTrack ? '' : 'disabled'}>GPX</button>
        <button class="trip-action export-geojson${hasTrack ? '' : ' opacity-40'}" ${hasTrack ? '' : 'disabled'}>GeoJSON</button>
      </div>
    `;

  tripList.appendChild(li);

    li.querySelector('.delete-trip').addEventListener('click', () => handleDeleteTrip(trip));

    if (hasVideo) {
      li.querySelector('.replay-video').addEventListener('click', async () => {
        const videoBlob = await getTripVideoBlob(trip);
        if (videoBlob) {
          const videoURL = URL.createObjectURL(videoBlob);
          replayVideoPlayer.src = videoURL;
          videoPlayerOverlay.classList.remove('hidden');
          try {
            await replayVideoPlayer.play();
          } catch (error) {
            console.warn('Unable to autoplay replay video:', error);
          }
          replayVideoPlayer.addEventListener('ended', () => {
            URL.revokeObjectURL(videoURL);
            replayVideoPlayer.src = '';
            videoPlayerOverlay.classList.add('hidden');
          }, { once: true });
        } else {
          alert('Could not retrieve video.');
        }
      });

      li.querySelector('.download-video').addEventListener('click', async () => {
        const videoBlob = await getTripVideoBlob(trip);
        if (videoBlob) {
          const url = URL.createObjectURL(videoBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = trip.videoFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          alert('Could not retrieve video for download.');
        }
      });

      li.querySelector('.share-video').addEventListener('click', async () => {
        const videoBlob = await getTripVideoBlob(trip);
        if (!videoBlob) {
          alert('Could not retrieve video for sharing.');
          return;
        }

        try {
          const videoFile = new File([videoBlob], trip.videoFilename, { type: videoBlob.type });
          if (navigator.canShare && navigator.canShare({ files: [videoFile] }) && navigator.share) {
            await navigator.share({
              files: [videoFile],
              title: `RoadTrip - ${new Date(trip.startedAt).toLocaleString()}`,
              text: `Check out my RoadTrip video from ${new Date(trip.startedAt).toLocaleString()}!`,
            });
          } else if (navigator.share) {
            await navigator.share({
              title: `RoadTrip - ${new Date(trip.startedAt).toLocaleString()}`,
              text: `Check out my RoadTrip video from ${new Date(trip.startedAt).toLocaleString()}!`,
            });
          } else {
            const url = URL.createObjectURL(videoBlob);
            const shareWindow = window.open(url, '_blank');
            if (!shareWindow) {
              alert('Sharing not supported in this browser. The video will be downloaded instead.');
              const a = document.createElement('a');
              a.href = url;
              a.download = trip.videoFilename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
          }
        } catch (error) {
          console.error('Error sharing video:', error);
          alert('Failed to share video. ' + (error.message || ''));
        }
      });
    }

    li.querySelector('.export-gpx').addEventListener('click', () => {
      if (!hasTrack) {
        alert('This trip has no GPS track to export.');
        return;
      }
      const blob = tripRecorder.exportGPX(trip);
      if (!blob) {
        alert('Something went wrong while creating the GPX file.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roadtrip-${trip.id}.gpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    li.querySelector('.export-geojson').addEventListener('click', () => {
      if (!hasTrack) {
        alert('This trip has no GPS track to export.');
        return;
      }
      const blob = tripRecorder.exportGeoJSON(trip);
      if (!blob) {
        alert('Something went wrong while creating the GeoJSON file.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roadtrip-${trip.id}.geojson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
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
    let success = false;
    if (currentCapture === 'dual') {
      success = await videoComposer.startDual();
      if (!success) {
        currentCapture = 'single';
        updateUI();
      }
    } else {
      success = await videoComposer.startSingle({ facing: currentFacing });
    }

    if (!success) {
      alert('Could not start camera. Please check permissions and ensure the camera is not in use by another app.');
    }
    return success;
  };

  const stopCamera = () => {
    videoComposer.stopCamera();
  };

  const startRecording = async () => {
    if (isRecording) return;

    if (!videoComposer.stream) {
      alert('Camera not available. Please ensure permissions are granted and the camera is not in use.');
      const cameraStarted = await startCamera();
      if (!cameraStarted) {
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
      const filename = `video-chunk-${Date.now()}.webm`; // Or mp4
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
    if (finalVideoBlob) {
      console.log('Final video blob created, size:', finalVideoBlob.size, 'type:', finalVideoBlob.type);
      const videoFilename = `roadtrip-${Date.now()}.webm`;
      try {
        await writeVideoToOpfs(videoFilename, finalVideoBlob);
        console.log('Final video successfully saved to OPFS:', videoFilename);
        await tripRecorder.stopTrip({ videoFilename });
        await clearVideoChunks();
      } catch (error) {
        console.error('Error saving final video to OPFS:', error);
      }
    } else {
      console.warn('No final video blob to save.');
      await tripRecorder.stopTrip();
      await clearVideoChunks();
    }
  };

  // Event Listeners
  startStopButton.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  settingsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    settingsMenu.classList.toggle('hidden');
  });

  settingsMenu.addEventListener('click', (event) => event.stopPropagation());

  document.addEventListener('click', () => {
    settingsMenu.classList.add('hidden');
  });

  settingsModalClose.addEventListener('click', hideModal);
  pastTripsClose.addEventListener('click', hidePastTripsOverlay);
  clearTripsButton.addEventListener('click', handleClearTrips);

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
      currentCapture,
      async (selection) => {
        currentCapture = selection;
        updateUI();
        if (isRecording) {
          stopCamera();
          await startCamera();
        }
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
      currentFacing,
      async (selection) => {
        currentFacing = selection;
        updateUI();
        if (isRecording) {
          stopCamera();
          await startCamera();
        }
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

  // Initial UI update
  updateUI();

  // Initial camera start
  await startCamera();
});