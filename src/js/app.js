// src/js/app.js

import '../css/styles.css';
import TripRecorder from './TripRecorder.js';
import LiveHUD from './LiveHUD.js';
import VideoComposer from './VideoComposer.js';
import MapView from './MapView.js';
import { getTrips, writeVideoToOpfs, clearVideoChunks, readVideoFromOpfs } from './storage/db.js';

document.addEventListener('DOMContentLoaded', async () => {
  const videoFeed = document.getElementById('videoFeed');
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
  const videoComposer = new VideoComposer(); // No canvas needed for videoComposer directly
  const mapView = new MapView({ container: mapContainer });

  let currentMode = 'camera'; // 'camera' or 'map'
  let currentCapture = 'single'; // 'single' or 'dual'
  let currentFacing = 'environment'; // 'environment' or 'user'
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
      videoFeed.classList.remove('hidden');
      mapContainer.classList.add('hidden');
    } else {
      videoFeed.classList.add('hidden');
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
  const renderTrip = (trip) => {
    const li = document.createElement('li');
    li.className = 'flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-black bg-opacity-50 rounded-lg mb-2';
    li.innerHTML = `
      <span class="text-white text-sm mb-2 sm:mb-0">${new Date(trip.startedAt).toLocaleString()} - ${(trip.stats.distanceM * (speedUnit === 'MPH' ? 0.000621371 : 0.001)).toFixed(2)} ${speedUnit === 'MPH' ? 'MI' : 'KM'}</span>
      <div class="flex flex-wrap justify-end gap-2">
        ${trip.videoFilename ? `<button class="replay-video px-3 py-1 bg-brand text-black rounded-md text-xs font-heading">Replay</button>` : ''}
        ${trip.videoFilename ? `<button class="download-video px-3 py-1 bg-brand text-black rounded-md text-xs font-heading">Download</button>` : ''}
        ${trip.videoFilename && navigator.share ? `<button class="share-video px-3 py-1 bg-brand text-black rounded-md text-xs font-heading">Share</button>` : ''}
        <button class="export-gpx px-3 py-1 bg-brand text-black rounded-md text-xs font-heading">GPX</button>
        <button class="export-geojson px-3 py-1 bg-brand text-black rounded-md text-xs font-heading">GeoJSON</button>
      </div>
    `;
    tripList.prepend(li);

    if (trip.videoFilename) {
      li.querySelector('.replay-video').addEventListener('click', async () => {
        console.log("Attempting to replay video:", trip.videoFilename);
        const videoBlob = await readVideoFromOpfs(trip.videoFilename);
        if (videoBlob) {
          const videoURL = URL.createObjectURL(videoBlob);
          replayVideoPlayer.src = videoURL;
          videoPlayerOverlay.classList.remove('hidden');
          replayVideoPlayer.play();
          replayVideoPlayer.addEventListener('ended', () => {
            URL.revokeObjectURL(videoURL);
            replayVideoPlayer.src = '';
            videoPlayerOverlay.classList.add('hidden');
          }, { once: true });
        } else {
          alert("Could not retrieve video.");
        }
      });

      li.querySelector('.download-video').addEventListener('click', async () => {
        console.log("Attempting to download video:", trip.videoFilename);
        const videoBlob = await readVideoFromOpfs(trip.videoFilename);
        if (videoBlob) {
          const url = URL.createObjectURL(videoBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = trip.videoFilename; // Use the stored filename for download
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          alert("Could not retrieve video for download.");
        }
      });

      if (navigator.share) {
        li.querySelector('.share-video').addEventListener('click', async () => {
          console.log("Attempting to share video:", trip.videoFilename);
          const videoBlob = await readVideoFromOpfs(trip.videoFilename);
          if (videoBlob) {
            try {
              const videoFile = new File([videoBlob], trip.videoFilename, { type: videoBlob.type });
              await navigator.share({
                files: [videoFile],
                title: `RoadTrip - ${new Date(trip.startedAt).toLocaleString()}`,
                text: `Check out my RoadTrip video from ${new Date(trip.startedAt).toLocaleString()}!`,
              });
            } catch (error) {
              console.error("Error sharing video:", error);
              alert("Failed to share video. " + (error.message || ""));
            }
          } else {
            alert("Could not retrieve video for sharing.");
          }
        });
      }
    }

    li.querySelector('.export-gpx').addEventListener('click', () => {
      const blob = tripRecorder.exportGPX(trip);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roadtrip-${trip.id}.gpx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });

    li.querySelector('.export-geojson').addEventListener('click', () => {
      const blob = tripRecorder.exportGeoJSON(trip);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roadtrip-${trip.id}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
  };

  const loadAndRenderTrips = async () => {
    const trips = await getTrips();
    tripList.innerHTML = ''; // Clear existing list
    trips.sort((a, b) => b.startedAt - a.startedAt).forEach(renderTrip);
  };

  const showPastTripsOverlay = async () => {
    await loadAndRenderTrips();
    pastTripsOverlay.classList.remove('hidden');
  };

  const hidePastTripsOverlay = () => {
    pastTripsOverlay.classList.add('hidden');
  };

  const startCamera = async () => {
    let success = false;
    if (currentCapture === 'dual') {
      success = await videoComposer.startDual();
      if (!success) {
        console.warn("Dual camera failed, falling back to single.");
        currentCapture = 'single';
        updateUI();
        success = await videoComposer.startSingle({ facing: currentFacing });
      }
    } else {
      success = await videoComposer.startSingle({ facing: currentFacing });
    }
    if (success) {
      videoFeed.srcObject = videoComposer.stream;
      videoFeed.play();
    }
    return success;
  };

  const stopCamera = () => {
    videoComposer.stopCamera();
    videoFeed.srcObject = null;
  };

  const startRecording = async () => {
    if (isRecording) return;

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
      console.log("Final video blob created, size:", finalVideoBlob.size, "type:", finalVideoBlob.type);
      const videoFilename = `roadtrip-${Date.now()}.webm`; // Or mp4
      try {
        await writeVideoToOpfs(videoFilename, finalVideoBlob);
        console.log("Final video successfully saved to OPFS:", videoFilename);
        // Store video filename with the trip for later retrieval
        const trip = await tripRecorder.stopTrip();
        if (trip) {
          trip.videoFilename = videoFilename; // Add video filename to trip object
          // renderTrip(trip); // Re-enable if past trips list is re-introduced
        }
        await clearVideoChunks(); // Clear temporary chunks after final video is composed/saved
      } catch (error) {
        console.error("Error saving final video to OPFS:", error);
      }
    } else {
      console.warn("No final video blob to save.");
      const trip = await tripRecorder.stopTrip(); // Still save trip even if no video
      if (trip) {
        // renderTrip(trip); // Re-enable if past trips list is re-introduced
      }
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

  settingsButton.addEventListener('click', () => {
    settingsMenu.classList.toggle('hidden');
  });

  settingsModalClose.addEventListener('click', hideModal);
  pastTripsClose.addEventListener('click', hidePastTripsOverlay);

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
  });

  pastTripsButton.addEventListener('click', showPastTripsOverlay);

  // Initial UI update
  updateUI();

  // Initial camera start
  await startCamera();
});