// src/js/app.js

import '../css/styles.css';
import TripRecorder from './TripRecorder.js';
import LiveHUD from './LiveHUD.js';
import VideoComposer from './VideoComposer.js';
import MapView from './MapView.js';
import { getTrips, writeVideoToOpfs, clearVideoChunks, readVideoFromOpfs } from './storage/db.js';

document.addEventListener('DOMContentLoaded', async () => {
  const modeToggle = document.getElementById('modeToggle');
  const captureToggle = document.getElementById('captureToggle');
  const facingToggle = document.getElementById('facingToggle');
  const startButton = document.getElementById('startButton');
  const stopButton = document.getElementById('stopButton');
  const cameraFeed = document.getElementById('cameraFeed');
  const mapContainer = document.getElementById('mapContainer');
  const hudCanvas = document.getElementById('hudCanvas');
  const hudAria = document.getElementById('hud-aria');
  const storageMeter = document.getElementById('storageMeter');
  const tripList = document.getElementById('tripList');
  const pastTripsToggle = document.getElementById('pastTripsToggle');

  // Add a video player overlay to the main element
  const mainElement = document.querySelector('main');
  const videoPlayerOverlay = document.createElement('div');
  videoPlayerOverlay.id = 'videoPlayerOverlay';
  videoPlayerOverlay.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 hidden';
  videoPlayerOverlay.innerHTML = `
    <div class="relative bg-surface p-4 rounded-DEFAULT shadow-neon">
      <button id="closeVideoPlayer" class="absolute top-2 right-2 text-brand text-xl font-bold">X</button>
      <video id="replayVideoPlayer" controls class="w-[80vw] h-[80vh] max-w-4xl max-h-2xl"></video>
    </div>
  `;
  mainElement.appendChild(videoPlayerOverlay);

  const replayVideoPlayer = document.getElementById('replayVideoPlayer');
  const closeVideoPlayer = document.getElementById('closeVideoPlayer');

  closeVideoPlayer.addEventListener('click', () => {
    replayVideoPlayer.pause();
    replayVideoPlayer.src = '';
    videoPlayerOverlay.classList.add('hidden');
  });

  const tripRecorder = new TripRecorder();
  const liveHUD = new LiveHUD();
  const videoComposer = new VideoComposer(hudCanvas);
  const mapView = new MapView({ container: mapContainer });

  liveHUD.attach(hudCanvas);

  let currentMode = 'camera'; // 'camera' or 'map'
  let currentCapture = 'single'; // 'single' or 'dual'
  let currentFacing = 'environment'; // 'environment' or 'user'
  let isRecording = false;
  let wakeLock = null;

  // Initialize UI states
  const updateUI = () => {
    modeToggle.textContent = `Mode: ${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}`;
    captureToggle.textContent = `Capture: ${currentCapture.charAt(0).toUpperCase() + currentCapture.slice(1)}`;
    facingToggle.textContent = `Facing: ${currentFacing.charAt(0).toUpperCase() + currentFacing.slice(1)}`;

    if (currentMode === 'camera') {
      cameraFeed.classList.remove('hidden');
      mapContainer.classList.add('hidden');
    } else {
      cameraFeed.classList.add('hidden');
      mapContainer.classList.remove('hidden');
    }

    if (isRecording) {
      startButton.classList.add('hidden');
      stopButton.classList.remove('hidden');
    } else {
      startButton.classList.remove('hidden');
      stopButton.classList.add('hidden');
    }
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
      cameraFeed.srcObject = videoComposer.stream;
      cameraFeed.play();
    }
    return success;
  };

  const stopCamera = () => {
    videoComposer.stopCamera();
    cameraFeed.srcObject = null;
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

    // Animation loop for HUD and video composition
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
      // Draw camera feed and HUD onto the canvas
      videoComposer.drawCameraFeedToCanvas(); // Draws video to canvas
      liveHUD._draw(); // Draws HUD on top

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
          renderTrip(trip);
        }
        await clearVideoChunks(); // Clear temporary chunks after final video is composed/saved
      } catch (error) {
        console.error("Error saving final video to OPFS:", error);
      }
    } else {
      console.warn("No final video blob to save.");
      const trip = await tripRecorder.stopTrip(); // Still save trip even if no video
      if (trip) {
        renderTrip(trip);
      }
    }
  };

  // Event Listeners
  modeToggle.addEventListener('click', async () => {
    currentMode = currentMode === 'camera' ? 'map' : 'camera';
    updateUI();
    if (currentMode === 'camera') {
      mapView.destroy();
      await startCamera();
    } else {
      stopCamera();
      mapView.init();
    }
  });

  captureToggle.addEventListener('click', async () => {
    currentCapture = currentCapture === 'single' ? 'dual' : 'single';
    updateUI();
    if (isRecording) {
      // Restart camera with new capture mode
      stopCamera();
      await startCamera();
    }
  });

  facingToggle.addEventListener('click', async () => {
    currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
    updateUI();
    if (isRecording) {
      // Restart camera with new facing mode
      stopCamera();
      await startCamera();
    }
  });

  startButton.addEventListener('click', startRecording);
  stopButton.addEventListener('click', stopRecording);

  if (pastTripsToggle) {
    pastTripsToggle.addEventListener('click', () => {
      tripList.classList.toggle('hidden');
    });
  }

  // Initial UI update
  updateUI();

  // Placeholder for storage meter
  const updateStorageMeter = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      const percentageUsed = (usage / quota) * 100;
      const freeGB = (quota - usage) / (1024 * 1024 * 1024);
      storageMeter.textContent = `Storage: ${freeGB.toFixed(2)} GB free (${percentageUsed.toFixed(2)}% used)`;
    } else {
      storageMeter.textContent = 'Storage: Not supported';
    }
  };
  updateStorageMeter();
  setInterval(updateStorageMeter, 30000); // Update every 30 seconds

  // Crash-resume logic (simplified)
  const checkCrashResume = async () => {
    const trips = await getTrips();
    const activeTrip = trips.find(trip => !trip.endedAt);
    if (activeTrip) {
      if (confirm("It looks like you have an unsaved trip. Do you want to recover it?")) {
        // TODO: Implement actual recovery logic, e.g., load points, video chunks
        console.log("Recovering trip:", activeTrip);
        // For now, just mark it as ended
        activeTrip.endedAt = Date.now();
        // await addTrip(activeTrip); // Re-save the ended trip
        renderTrip(activeTrip);
      } else {
        // Optionally delete the active trip if user doesn't want to recover
        // For now, leave it as is.
      }
    }
  };
  checkCrashResume();

  // Render past trips
  const renderTrip = (trip) => {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center p-2 bg-surface rounded-DEFAULT mb-2';
    li.innerHTML = `
      <span>${new Date(trip.startedAt).toLocaleString()} - ${(trip.stats.distanceM / 1000).toFixed(2)} km</span>
      <div class="flex flex-col sm:flex-row sm:space-x-2 space-y-1">
        ${trip.videoFilename ? `<button class="replay-video px-3 py-1 bg-accent text-bg rounded-DEFAULT text-sm">Replay Video</button>` : ''}
        ${trip.videoFilename ? `<button class="download-video px-3 py-1 bg-accent text-bg rounded-DEFAULT text-sm">Download Video</button>` : ''}
        ${trip.videoFilename && navigator.share ? `<button class="share-video px-3 py-1 bg-accent text-bg rounded-DEFAULT text-sm">Share Video</button>` : ''}
        <button class="export-gpx px-3 py-1 bg-brand text-bg rounded-DEFAULT text-sm">GPX</button>
        <button class="export-geojson px-3 py-1 bg-brand text-bg rounded-DEFAULT text-sm">GeoJSON</button>
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
    trips.sort((a, b) => b.startedAt - a.startedAt).slice(0, 2).forEach(renderTrip);
  };
  loadAndRenderTrips();

  // Initial camera start
  await startCamera();
});