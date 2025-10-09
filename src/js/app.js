// src/js/app.js

import '../css/styles.css';
import maplibregl from 'maplibre-gl';
import TripRecorder from './TripRecorder.js';
import LiveHUD from './LiveHUD.js';
import VideoComposer from './VideoComposer.js';
import MapView from './MapView.js';
import { getTrips, writeVideoToOpfs, clearVideoChunks, readVideoFromOpfs, deleteTrip, clearTrips, deleteVideoFromOpfs } from './storage/db.js';
import { initShareButton, shareVideo, shareSummaryImage, downloadBlob, debounce, SHARE_MAP_STYLE_URL } from './Share.js';
import { showNotification } from './Notifications.js';

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
  const pauseResumeButton = document.getElementById('pauseResumeButton');
  const recordingControls = document.getElementById('recordingControls');
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
  const tripSummaryName = document.getElementById('tripSummaryName');
  const tripSummaryStatsLine = document.getElementById('tripSummaryStatsLine');
  const tripSummaryNarrative = document.getElementById('tripSummaryNarrative');
  const tripSummaryElevation = document.getElementById('tripSummaryElevation');
  const tripSummaryStartTime = document.getElementById('tripSummaryStartTime');
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
  let isPaused = false;
  let wakeLock = null;
  let cameraCapabilities = { cameraCount: 0, hasUserFacing: false, hasEnvironmentFacing: false };
  let cameraReady = false;
  let cameraStatusTimeout = null;
  const CONTROLS_AUTO_HIDE_MS = 5000;
  let controlHideTimeoutId = null;
  let controlsAreHidden = false;

  const clearControlHideTimeout = () => {
    if (controlHideTimeoutId) {
      clearTimeout(controlHideTimeoutId);
      controlHideTimeoutId = null;
    }
  };

  const hideRecordingControls = () => {
    if (!recordingControls) return;
    recordingControls.classList.add('controls-hidden');
    controlsAreHidden = true;
  };

  const showRecordingControls = () => {
    if (!recordingControls) return;
    recordingControls.classList.remove('controls-hidden');
    controlsAreHidden = false;
  };

  const scheduleControlAutoHide = (restart = false) => {
    if (!recordingControls) return;
    if (!isRecording || isPaused) return;
    if (restart && controlHideTimeoutId) {
      clearTimeout(controlHideTimeoutId);
      controlHideTimeoutId = null;
    }
    if (controlHideTimeoutId) return;
    controlHideTimeoutId = setTimeout(() => {
      hideRecordingControls();
      controlHideTimeoutId = null;
    }, CONTROLS_AUTO_HIDE_MS);
  };

  const refreshRecordingControlsVisibility = () => {
    if (!recordingControls) return;
    if (!isRecording || isPaused) {
      clearControlHideTimeout();
      showRecordingControls();
      return;
    }
    if (!controlsAreHidden) {
      scheduleControlAutoHide();
    }
  };

  const handleRecordingControlsInteraction = (event) => {
    if (!isRecording) return;
    if (event.type === 'pointermove' && !controlsAreHidden) {
      return;
    }
    showRecordingControls();
    scheduleControlAutoHide(true);
  };

  window.addEventListener('pointerdown', handleRecordingControlsInteraction, { passive: true });
  window.addEventListener('pointermove', handleRecordingControlsInteraction, { passive: true });
  window.addEventListener('touchstart', handleRecordingControlsInteraction, { passive: true });
  window.addEventListener('keydown', handleRecordingControlsInteraction);

  // --- Orientation Handling ---
  const isLandscape = () => window.matchMedia("(orientation: landscape)").matches || window.innerWidth > window.innerHeight;
  const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches;

  const showNudge = () => {
    // Show nudge only if recording, not dismissed, on mobile, and in portrait.
    if (!landscapeNudge) return;
    if (isRecording && !nudgeDismissed && isMobileViewport() && !isLandscape()) {
      landscapeNudge.classList.remove('hidden');
    }
  };

  const hideNudge = () => {
    if (!landscapeNudge) return;
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

  let recordingFullscreenRequested = false;

  const requestRecordingFullscreen = async () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      recordingFullscreenRequested = true;
      return;
    }

    const fullscreenTarget = videoContainer ?? document.documentElement;
    if (!fullscreenTarget) return;

    const request = fullscreenTarget.requestFullscreen
      || fullscreenTarget.webkitRequestFullscreen
      || fullscreenTarget.mozRequestFullScreen
      || fullscreenTarget.msRequestFullscreen;

    if (!request) return;

    try {
      await request.call(fullscreenTarget);
      recordingFullscreenRequested = true;
    } catch (error) {
      recordingFullscreenRequested = false;
      console.warn('Could not enter fullscreen for recording:', error);
    }
  };

  const exitRecordingFullscreen = async () => {
    if (typeof document === 'undefined') return;
    if (!recordingFullscreenRequested) return;

    const exit = document.exitFullscreen
      || document.webkitExitFullscreen
      || document.mozCancelFullScreen
      || document.msExitFullscreen;

    if (!exit) {
      recordingFullscreenRequested = false;
      return;
    }

    try {
      await exit.call(document);
    } catch (error) {
      console.warn('Could not exit fullscreen after recording:', error);
    } finally {
      recordingFullscreenRequested = false;
    }
  };

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      recordingFullscreenRequested = false;
    }
  };

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

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
      syncDualPreviewLayout();
    }, 100); // Debounce to prevent flicker
  };

  function syncDualPreviewLayout() {
    if (!dualVideoContainer) return;
    const dualActive = videoComposer?.state?.captureMode === 'dual' && !dualVideoContainer.classList.contains('invisible');
    if (!dualActive) {
      dualVideoContainer.classList.remove('dual-landscape', 'dual-portrait');
      return;
    }

    const landscape = isLandscape();
    dualVideoContainer.classList.toggle('dual-landscape', landscape);
    dualVideoContainer.classList.toggle('dual-portrait', !landscape);
  }

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

    const formatErrorValue = (error) => {
      if (!error) return null;
      if (typeof error === 'string') return error;
      if (error instanceof Error) return error.message || error.name || 'Unknown error';
      if (typeof error === 'object') {
        return error.message || error.name || JSON.stringify(error);
      }
      return String(error);
    };

    const summarizeAttempts = (attempts) => {
      if (!attempts || typeof attempts !== 'object') return [];
      const summaries = [];
      for (const [key, value] of Object.entries(attempts)) {
        if (!Array.isArray(value) || value.length === 0) continue;
        const attemptMessages = value
          .map(item => formatErrorValue(item?.error))
          .filter(Boolean);
        if (attemptMessages.length === 0) continue;
        summaries.push(`${key} errors: ${attemptMessages.join(' | ')}`);
      }
      return summaries;
    };

    const notifyDualIssue = (issue, variant = 'error') => {
      if (!issue) return;
      const code = typeof issue.code === 'string' ? issue.code.toLowerCase() : '';
      if (code.includes('dual')) {
        const baseMessage = issue.message ?? 'Dual camera error occurred.';
        const detailParts = [];

        const details = issue.details ?? {};
        if (typeof details.deviceCount === 'number') {
          detailParts.push(`Detected cameras: ${details.deviceCount}`);
        }
        if (details.selectedBack) {
          const label = details.selectedBack.label || details.selectedBack.deviceId;
          if (label) detailParts.push(`Back: ${label}`);
        }
        if (details.selectedFront) {
          const label = details.selectedFront.label || details.selectedFront.deviceId;
          if (label) detailParts.push(`Front: ${label}`);
        }

        detailParts.push(...summarizeAttempts(details.attempts));

        if (details.error) {
          const errorMsg = formatErrorValue(details.error);
          if (errorMsg) detailParts.push(`Error: ${errorMsg}`);
        }

        const detailText = detailParts.length > 0 ? ` (${detailParts.join('; ')})` : '';
        showNotification(`${baseMessage}${detailText}`, { variant });
      }
    };

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
      notifyDualIssue(result.error, 'error');
      return false;
    }

    cameraReady = true;
    setStartButtonEnabled(true);

    if (result.warning) {
      showCameraStatus('Using single camera', result.warning.message, { variant: 'warning', autoHideMs: 5000 });
      notifyDualIssue(result.warning, 'warning');
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
      startStopButton.classList.toggle('hidden', isPaused);
      liveHud.classList.remove('hidden');
      settingsButton.classList.add('hidden'); // Hide settings during recording
      muteButton.classList.remove('hidden'); // Show mute button
      settingsMenu.classList.add('hidden'); // Ensure menu is hidden
      pauseResumeButton.classList.remove('hidden');
      if (isPaused) {
        pauseResumeButton.textContent = 'Resume Trip';
        pauseResumeButton.setAttribute('aria-label', 'Resume trip');
        pauseResumeButton.classList.remove('bg-yellow-400/90', 'border-yellow-200/60');
        pauseResumeButton.classList.add('bg-emerald-400/90', 'border-emerald-300/60', 'text-black');
      } else {
        pauseResumeButton.textContent = 'Pause Trip';
        pauseResumeButton.setAttribute('aria-label', 'Pause trip');
        pauseResumeButton.classList.add('bg-yellow-400/90', 'border-yellow-200/60', 'text-black');
        pauseResumeButton.classList.remove('bg-emerald-400/90', 'border-emerald-300/60');
      }
    } else {
      startStopButton.innerHTML = '<span class="relative z-10">Start Trip</span><span class="absolute inset-0 rounded-full animate-glowPulse"></span>';
      liveHud.classList.add('hidden');
      settingsButton.classList.remove('hidden'); // Show settings when idle
      muteButton.classList.add('hidden'); // Hide mute button
      muteButton.textContent = 'Mute'; // Reset mute button text
      pauseResumeButton.classList.add('hidden');
      pauseResumeButton.textContent = 'Pause Trip';
      pauseResumeButton.classList.remove('bg-emerald-400/90', 'border-emerald-300/60');
      pauseResumeButton.classList.add('bg-yellow-400/90', 'border-yellow-200/60', 'text-black');
      startStopButton.classList.remove('hidden');
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

    refreshRecordingControlsVisibility();
    syncDualPreviewLayout();
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

  const showDualCameraSelector = async () => {
    const capabilities = await videoComposer.refreshCameraInventory();
    const devices = capabilities?.devices ?? [];

    if (!Array.isArray(devices) || devices.length < 2) {
      showNotification('Dual mode needs both a front and rear camera.', { variant: 'warning' });
      showCameraStatus('Dual mode unavailable', 'We need both front and rear cameras to enable dual capture.', { variant: 'warning', autoHideMs: 6000 });
      return false;
    }

    let candidates;
    try {
      candidates = await videoComposer.getDualDeviceCandidates();
    } catch (error) {
      console.error('Unable to prepare dual camera candidates:', error);
      showNotification('Could not inspect available cameras. Try again.', { variant: 'error' });
      return false;
    }

    const suggestedBack = candidates?.back ?? null;
    const suggestedFront = candidates?.front ?? null;
    const preferred = videoComposer.getDualPreferences?.() ?? {};

    const FRONT_LABEL_KEYWORDS = ['front', 'user', 'selfie', 'facing front', 'front camera'];
    const BACK_LABEL_KEYWORDS = ['back', 'rear', 'environment', 'facing back', 'rear camera'];

    const labelConfidence = (label = '') => {
      const lower = label.toLowerCase();
      let score = 0;
      if (!lower) return score;
      if (FRONT_LABEL_KEYWORDS.some(keyword => lower.includes(keyword))) score += 2;
      if (BACK_LABEL_KEYWORDS.some(keyword => lower.includes(keyword))) score += 2;
      score += Math.min(lower.length, 40) / 5;
      return score;
    };

    const deviceMap = new Map();
    devices.forEach((device) => {
      const key = device.groupId && device.groupId !== ''
        ? device.groupId
        : device.deviceId && device.deviceId !== 'default'
          ? device.deviceId
          : `${device.label ?? 'unnamed'}::${device.deviceId ?? 'nodevice'}`;
      const existing = deviceMap.get(key);
      if (!existing || labelConfidence(device.label) > labelConfidence(existing.label)) {
        deviceMap.set(key, device);
      }
    });

    const uniqueDevices = Array.from(deviceMap.values());
    if (uniqueDevices.length < 2) {
      showNotification('We need at least two distinct cameras to enable dual mode.', { variant: 'warning' });
      return false;
    }

    const categorizeFacing = (label = '') => {
      const lower = label.toLowerCase();
      if (FRONT_LABEL_KEYWORDS.some(keyword => lower.includes(keyword))) return 'front';
      if (BACK_LABEL_KEYWORDS.some(keyword => lower.includes(keyword))) return 'back';
      return 'unknown';
    };

    const annotatedDevices = uniqueDevices.map(device => ({
      device,
      facing: categorizeFacing(device.label ?? ''),
    }));

    const frontDevices = annotatedDevices.filter(item => item.facing === 'front');
    const backDevices = annotatedDevices.filter(item => item.facing === 'back');
    const unknownDevices = annotatedDevices.filter(item => item.facing === 'unknown');

    const ensureAvailableId = (deviceId, fallbackFacing) => {
      if (!deviceId) return null;
      const exists = annotatedDevices.some(({ device }) => device.deviceId === deviceId);
      if (exists) return deviceId;
      const pool = fallbackFacing === 'back' ? backDevices : frontDevices;
      if (pool.length > 0) {
        return pool[0].device.deviceId;
      }
      const altPool = fallbackFacing === 'back' ? unknownDevices : unknownDevices;
      if (altPool.length > 0) {
        return altPool[0].device.deviceId;
      }
      return annotatedDevices[0]?.device?.deviceId ?? null;
    };

    let defaultBackId = preferred.backDeviceId ?? suggestedBack?.deviceId ?? null;
    let defaultFrontId = preferred.frontDeviceId ?? suggestedFront?.deviceId ?? null;

    defaultBackId = ensureAvailableId(defaultBackId, 'back')
      ?? backDevices[0]?.device?.deviceId
      ?? annotatedDevices[0].device.deviceId;

    defaultFrontId = ensureAvailableId(defaultFrontId, 'front')
      ?? frontDevices.find(item => item.device.deviceId !== defaultBackId)?.device?.deviceId
      ?? unknownDevices.find(item => item.device.deviceId !== defaultBackId)?.device?.deviceId
      ?? annotatedDevices.find(item => item.device.deviceId !== defaultBackId)?.device?.deviceId
      ?? annotatedDevices[0].device.deviceId;

  settingsModalTitle.textContent = 'Select Dual Cameras';
  settingsModalContent.innerHTML = '';
  settingsModalContent.classList.add('flex', 'flex-col', 'max-h-[80vh]', 'overflow-hidden');

  const instructions = document.createElement('p');
  instructions.className = 'text-sm text-white/80 mb-3 flex-shrink-0';
    instructions.textContent = 'Choose which physical cameras feed the rear and front views. Dual recording will restart using your selections.';
    settingsModalContent.appendChild(instructions);

  const form = document.createElement('form');
  form.className = 'flex flex-col gap-4 flex-1 min-h-0';
    settingsModalContent.appendChild(form);

    const selectionState = {
      back: defaultBackId,
      front: defaultFrontId,
    };

    const facingDescription = (item) => {
      if (item.facing === 'front') {
        return 'Front-facing · mapped to user-facing camera';
      }
      if (item.facing === 'back') {
        return 'Rear-facing · mapped to environment camera';
      }
      return item.device.label ? 'Orientation unclear · treat as external/unknown' : 'Orientation unclear';
    };

    const buildFieldset = (name, legendText, description, sortedDevices, recommendedId) => {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'space-y-2';

      const legend = document.createElement('legend');
      legend.className = 'text-sm font-medium text-white';
      legend.textContent = legendText;
      fieldset.appendChild(legend);

      if (description) {
        const desc = document.createElement('p');
        desc.className = 'text-xs text-white/60';
        desc.textContent = description;
        fieldset.appendChild(desc);
      }

      const seen = new Set();
      sortedDevices.forEach((item, index) => {
        const { device } = item;
        const key = device.groupId && device.groupId !== '' ? device.groupId : device.deviceId ?? `unknown-${index}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        const optionId = `${name}-${index}`;
        const wrapper = document.createElement('label');
        wrapper.className = 'flex items-center gap-3 rounded-md border border-white/10 px-3 py-2 cursor-pointer transition hover:border-brand focus-within:border-brand';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = device.deviceId;
        input.id = optionId;
        input.className = 'h-4 w-4 text-brand focus:ring-brand';
        if (name === 'backCamera' && device.deviceId === selectionState.back) {
          input.checked = true;
        }
        if (name === 'frontCamera' && device.deviceId === selectionState.front) {
          input.checked = true;
        }

        input.addEventListener('change', () => {
          if (name === 'backCamera') {
            selectionState.back = input.value;
          } else {
            selectionState.front = input.value;
          }
          validateSelections();
        });

    const textContainer = document.createElement('div');
    textContainer.className = 'flex flex-col';

    const primaryLabel = document.createElement('span');
    primaryLabel.className = 'text-sm text-white';
    primaryLabel.textContent = device.label || `Camera ${index + 1}`;
    textContainer.appendChild(primaryLabel);

    const facingHint = facingDescription(item);
        if (facingHint) {
          const secondary = document.createElement('span');
          secondary.className = 'text-xs text-white/60';
          secondary.textContent = facingHint;
          textContainer.appendChild(secondary);
        }

        if (recommendedId && device.deviceId === recommendedId) {
          const badge = document.createElement('span');
          badge.className = 'mt-1 inline-flex w-max items-center rounded bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200';
          badge.textContent = 'Recommended';
          textContainer.appendChild(badge);
        }

        wrapper.appendChild(input);
        wrapper.appendChild(textContainer);
        fieldset.appendChild(wrapper);
      });

      return fieldset;
    };

    const mergeUnique = (...groups) => {
      const seen = new Set();
      const result = [];
      groups.forEach(group => {
        group.forEach(item => {
          const key = item.device.groupId && item.device.groupId !== ''
            ? item.device.groupId
            : item.device.deviceId || `${item.device.label ?? 'unnamed'}::${item.device.groupId ?? 'unknown'}`;
          if (seen.has(key)) return;
          seen.add(key);
          result.push(item);
        });
      });
      return result;
    };

    let sortedForBack = mergeUnique(backDevices, unknownDevices);
    if (sortedForBack.length === 0) {
      sortedForBack = mergeUnique(unknownDevices, frontDevices, annotatedDevices);
    }

    let sortedForFront = mergeUnique(frontDevices, unknownDevices);
    if (sortedForFront.length === 0) {
      sortedForFront = mergeUnique(unknownDevices, backDevices, annotatedDevices);
    }

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'flex-1 overflow-y-auto pr-2 space-y-6 min-h-0';
    form.appendChild(contentWrapper);

    const backFieldset = buildFieldset('backCamera', 'Back camera (rear view)', 'Pick the camera pointed at the road.', sortedForBack, defaultBackId);
    const frontFieldset = buildFieldset('frontCamera', 'Front camera (self view)', 'Pick the camera facing you.', sortedForFront, defaultFrontId);

    contentWrapper.appendChild(backFieldset);
    contentWrapper.appendChild(frontFieldset);

    const validationMessage = document.createElement('p');
    validationMessage.className = 'text-sm text-red-300 hidden';
    validationMessage.textContent = 'Choose two different cameras for front and back.';
    contentWrapper.appendChild(validationMessage);

    const actions = document.createElement('div');
    actions.className = 'flex items-center justify-end gap-3 pt-3 border-t border-white/10 bg-slate-900/90 backdrop-blur-sm flex-shrink-0';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'px-4 py-2 rounded-md border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', hideModal);

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'px-4 py-2 rounded-md bg-brand text-black font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition';
    submitButton.textContent = 'Set cameras';

    actions.appendChild(cancelButton);
    actions.appendChild(submitButton);
    form.appendChild(actions);

    const validateSelections = () => {
      const hasBack = !!selectionState.back;
      const hasFront = !!selectionState.front;
      const distinct = selectionState.back !== selectionState.front;
      const valid = hasBack && hasFront && distinct;
      submitButton.disabled = !valid;
      validationMessage.classList.toggle('hidden', valid);
      return valid;
    };

    validateSelections();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!validateSelections()) {
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Setting…';

      try {
        videoComposer.setDualPreferences({
          backDeviceId: selectionState.back,
          frontDeviceId: selectionState.front,
        });
        const result = await videoComposer.setCaptureMode('dual', { forceRestart: true });
        handleCameraResult(result);
        if (result.success) {
          updateUI();
          hideModal();
        } else {
          submitButton.disabled = false;
          submitButton.textContent = 'Set cameras';
        }
      } catch (error) {
        console.error('Failed to set dual cameras:', error);
        showNotification('Could not switch to dual cameras. Please try again.', { variant: 'error' });
        submitButton.disabled = false;
        submitButton.textContent = 'Set cameras';
      }
    });

    settingsModal.classList.remove('hidden');
    return true;
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

  const formatDurationSummary = (durationMs = 0) => {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return '0 min';
    }
    const totalSeconds = Math.round(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours >= 1) {
      const hourLabel = `${hours} hr${hours > 1 ? 's' : ''}`;
      if (minutes > 0) {
        return `${hourLabel} ${minutes} min`;
      }
      return hourLabel;
    }
    if (minutes >= 1) {
      return `${minutes} min`;
    }
    return 'Less than a minute';
  };

  const formatDistanceSummary = (meters = 0) => {
    if (!Number.isFinite(meters) || meters <= 0) {
      const unitLabel = speedUnit === 'MPH' ? 'mi' : 'km';
      return `0 ${unitLabel}`;
    }
    const unitLabel = speedUnit === 'MPH' ? 'mi' : 'km';
    const value = speedUnit === 'MPH' ? meters * 0.000621371 : meters / 1000;
    const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    const formatted = value.toFixed(decimals).replace(/\.0+$/, '');
    return `${formatted} ${unitLabel}`;
  };

  const formatAverageSpeedSummary = (avgKph = 0) => {
    const converted = speedUnit === 'MPH' ? avgKph * 0.621371 : avgKph;
    const unitLabel = speedUnit === 'MPH' ? 'mph' : 'km/h';
    if (!Number.isFinite(converted) || converted <= 0) {
      return `0 ${unitLabel}`;
    }
    const rounded = converted >= 100 ? Math.round(converted) : Math.round(converted * 10) / 10;
    const formatted = Number.isInteger(rounded) ? rounded : rounded.toFixed(1);
    return `${formatted} ${unitLabel}`;
  };

  const formatStartTimeSummary = (timestamp) => {
    if (!timestamp) {
      return '—';
    }
    const startDate = new Date(timestamp);
    if (Number.isNaN(startDate.getTime())) {
      return '—';
    }
    const now = new Date();
    const sameDay = startDate.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const dayLabel = sameDay
      ? 'Today'
      : startDate.toDateString() === yesterday.toDateString()
        ? 'Yesterday'
        : startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const timeLabel = startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${dayLabel} · ${timeLabel}`;
  };

  const buildNarrative = (trip) => {
    if (!trip?.stats) {
      return 'You cruised smoothly today.';
    }
    const distanceKm = Number.isFinite(trip.stats.distanceM) ? trip.stats.distanceM / 1000 : 0;
    const avgKph = Number.isFinite(trip.stats.avgKph) ? trip.stats.avgKph : 0;

    if (distanceKm < 1) {
      return 'A short spin, but every moment counted.';
    }
    if (avgKph < 20) {
      return 'You took it easy and savored the drive.';
    }
    if (avgKph < 45) {
      return 'You cruised smoothly today.';
    }
    if (avgKph < 70) {
      return 'You kept a confident rhythm on the road.';
    }
    return 'You pushed the pace and owned the night.';
  };

  const formatElevationSummary = (points = []) => {
    if (!Array.isArray(points) || points.length === 0) {
      return 'Not recorded';
    }
    const elevations = points
      .map((p) => (typeof p?.alt === 'number' && Number.isFinite(p.alt) ? p.alt : null))
      .filter((alt) => alt !== null);
    if (elevations.length === 0) {
      return 'Not recorded';
    }
    const minEleMeters = Math.min(...elevations);
    const maxEleMeters = Math.max(...elevations);
    const toUnit = (value) => {
      if (speedUnit === 'MPH') {
        const feet = value * 3.28084;
        return `${Math.round(feet)} ft`;
      }
      return `${Math.round(value)} m`;
    };
    if (Math.abs(maxEleMeters - minEleMeters) < 3) {
      return `Flat · ${toUnit(maxEleMeters)}`;
    }
    return `Min ${toUnit(minEleMeters)} · Max ${toUnit(maxEleMeters)}`;
  };

  const resolveTripName = (trip) => {
    const explicit = typeof trip?.name === 'string' ? trip.name.trim() : '';
    if (explicit) {
      return explicit;
    }
    const driveTypeLabel = typeof trip?.driveType === 'string' ? trip.driveType.trim() : '';
    if (driveTypeLabel) {
      return driveTypeLabel;
    }
    const startDate = new Date(trip?.startedAt ?? Date.now());
    if (!Number.isNaN(startDate.getTime())) {
      return startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return 'Untitled Drive';
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
          showNotification('Could not retrieve video.', { variant: 'error' });
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
          showNotification('Could not retrieve video file.', { variant: 'error' });
        }
      }, 500));

      shareMenu.querySelector('.download-video-option').addEventListener('click', debounce(async () => {
        closeShareMenuPortal();
        const videoBlob = await getTripVideoBlob(trip);
        if (videoBlob) {
          downloadBlob(videoBlob, trip.videoFilename);
        } else {
          showNotification('Could not retrieve video file.', { variant: 'error' });
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
  showNotification('Could not delete trip. Please try again.', { variant: 'error' });
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
  showNotification('Could not clear trips. Please try again.', { variant: 'error' });
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

    nudgeDismissed = false;
    isRecording = true;
    isPaused = false;
    await requestRecordingFullscreen();
    await preferLandscape();
    updateUI();
    showNudge();

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
        if (!isPaused) {
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

          if (currentMode === 'map') {
            mapView.updateLiveTrack(tripData.points, tripData.pauseEvents || []);
            if (tripData.points.length > 0) {
              mapView.setCurrentPoint(tripData.points[tripData.points.length - 1]);
            }
          }
        }

        const isMuted = videoComposer.audioTrack ? !videoComposer.audioTrack.enabled : false;
        videoComposer.setMutedState(isMuted);
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
    isPaused = false;
    videoComposer.resumeCapture();
    updateUI();
    hideNudge();

    // Release wake lock
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
      console.log('Screen Wake Lock released.');
    }

    await exitRecordingFullscreen();

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
    // Reset narrative content
    if (tripSummaryName) tripSummaryName.textContent = 'Untitled Drive';
    if (tripSummaryStatsLine) tripSummaryStatsLine.textContent = '0 km · 0 min · Avg 0 km/h';
    if (tripSummaryNarrative) tripSummaryNarrative.textContent = 'You cruised smoothly today.';
    if (tripSummaryElevation) tripSummaryElevation.textContent = '—';
    if (tripSummaryStartTime) tripSummaryStartTime.textContent = '—';
  };

  const showTripSummary = (trip) => {
    if (!trip || !trip.points || trip.points.length < 2) {
      showNotification('Trip is too short to display a summary.', { variant: 'info' });
      return;
    }

    // 1. Prepare data
    const coords = trip.points
      .filter((point) => Number.isFinite(point?.lon) && Number.isFinite(point?.lat))
      .map(p => [p.lon, p.lat]);
    if (coords.length < 2) {
      showNotification('Trip data is missing location details.', { variant: 'error' });
      return;
    }
    const highestPoint = trip.points.reduce((highest, point) => {
      if (!point || typeof point.alt !== 'number' || !Number.isFinite(point.alt)) return highest;
      if (!highest || point.alt > highest.alt) return point;
      return highest;
    }, null);
    const hasAltitude = !!(highestPoint && Number.isFinite(highestPoint.alt));

    if (tripSummaryName) {
      tripSummaryName.textContent = resolveTripName(trip);
    }

    if (tripSummaryStatsLine) {
      const distanceText = formatDistanceSummary(trip.stats.distanceM);
      const durationLabel = formatDurationSummary(trip.stats.durationMs);
      const avgSpeedLabel = formatAverageSpeedSummary(trip.stats.avgKph);
      tripSummaryStatsLine.textContent = `${distanceText} · ${durationLabel} · Avg ${avgSpeedLabel}`;
    }

    const narrativeBase = buildNarrative(trip);
    let narrativeLine = narrativeBase;

    if (hasAltitude && highestPoint && Number.isFinite(highestPoint.alt)) {
      const altitudeValue = speedUnit === 'MPH'
        ? Math.round(highestPoint.alt * 3.28084)
        : Math.round(highestPoint.alt);
      const altitudeUnit = speedUnit === 'MPH' ? 'ft' : 'm';
      if (altitudeValue > 0) {
        narrativeLine = `${narrativeBase} Highest climb reached ${altitudeValue} ${altitudeUnit}.`;
      }
    }

    if (tripSummaryNarrative) {
      tripSummaryNarrative.textContent = narrativeLine;
    }

    if (tripSummaryElevation) {
      tripSummaryElevation.textContent = formatElevationSummary(trip.points);
    }

    if (tripSummaryStartTime) {
      tripSummaryStartTime.textContent = formatStartTimeSummary(trip.startedAt);
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
      summaryMap.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        },
      });

      summaryMap.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#00F5D4',
          'line-width': 4,
          'line-opacity': 0.9,
          'line-blur': 0.2,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
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
          'circle-radius': 5,
          'circle-color': '#0f172a',
          'circle-stroke-width': 2,
          'circle-stroke-color': ['match', ['get', 'kind'], 'start', '#22ffcc', 'end', '#ffffff', '#ffffff'],
          'circle-stroke-opacity': 0.9,
        }
      });

      summaryMap.addLayer({
        id: 'route-start-label',
        type: 'symbol',
        source: 'route-points',
        filter: ['==', ['get', 'kind'], 'start'],
        layout: { 'text-field': 'Start', 'text-font': ['Open Sans Bold'], 'text-size': 11, 'text-offset': [0, 0.8] },
        paint: { 'text-color': '#22ffcc', 'text-halo-color': '#000000', 'text-halo-width': 1.2 }
      });

      summaryMap.addLayer({
        id: 'route-end-label',
        type: 'symbol',
        source: 'route-points',
        filter: ['==', ['get', 'kind'], 'end'],
        layout: { 'text-field': 'Finish', 'text-font': ['Open Sans Bold'], 'text-size': 11, 'text-offset': [0, 0.8] },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.2 }
      });


      if (Array.isArray(trip.pauseEvents) && trip.pauseEvents.length > 0) {
        const pauseFeatures = trip.pauseEvents.map((event, index) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [event.lon, event.lat],
          },
          properties: {
            type: event.type,
            timestamp: event.t,
            label: event.type === 'pause' ? `Pause ${index + 1}` : `Resume ${index + 1}`,
          },
        }));

        summaryMap.addSource('pause-events', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: pauseFeatures,
          },
        });

        summaryMap.addLayer({
          id: 'pause-events-markers',
          type: 'circle',
          source: 'pause-events',
          paint: {
            'circle-radius': 5,
            'circle-color': [
              'match',
              ['get', 'type'],
              'pause', '#fbbf24',
              'resume', '#34d399',
              '#e5e7eb'
            ],
            'circle-stroke-color': '#111827',
            'circle-stroke-width': 1.2,
          },
        });

        summaryMap.addLayer({
          id: 'pause-events-labels',
          type: 'symbol',
          source: 'pause-events',
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Open Sans Bold'],
            'text-size': 10,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#f9fafb',
            'text-halo-color': '#111827',
            'text-halo-width': 1,
          },
        });
      }


      const bounds = new maplibregl.LngLatBounds();
      coords.forEach(coord => bounds.extend(coord));
      if (Array.isArray(trip.pauseEvents)) {
        trip.pauseEvents.forEach(event => bounds.extend([event.lon, event.lat]));
      }
      summaryMap.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 0 });
    });

    // Initialize the share button now that the summary is visible
    console.log('Calling initShareButton with trip:', trip, 'and summaryMap:', summaryMap);
    initShareButton(trip, summaryMap, getTripVideoBlob);
  };

  if (dismissNudge) {
    dismissNudge.addEventListener('click', () => {
      nudgeDismissed = true;
      hideNudge();
    });
  }

  window.addEventListener('resize', handleOrientationChange, { passive: true });
  window.addEventListener('orientationchange', handleOrientationChange);

  const orientationMedia = window.matchMedia('(orientation: landscape)');
  if (orientationMedia) {
    if (typeof orientationMedia.addEventListener === 'function') {
      orientationMedia.addEventListener('change', handleOrientationChange);
    } else if (typeof orientationMedia.addListener === 'function') {
      orientationMedia.addListener(handleOrientationChange);
    }
  }

  handleOrientationChange();

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

  const pauseRecording = () => {
    if (!isRecording || isPaused) return;

    const pauseEvent = tripRecorder.pauseTrip();
    if (!pauseEvent) {
      console.warn('Trip paused without position snapshot.');
    }

    isPaused = true;
    videoComposer.pauseCapture();
    showNotification('Trip paused.', { variant: 'info' });
    updateUI();
  };

  const resumeRecording = () => {
    if (!isRecording || !isPaused) return;

    const resumed = tripRecorder.resumeTrip();
    if (!resumed) {
      console.warn('Could not resume trip.');
      return;
    }

    isPaused = false;
    videoComposer.resumeCapture();
    showNotification('Trip resumed.', { variant: 'success' });
    updateUI();
  };

  pauseResumeButton.addEventListener('click', () => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  });

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
        if (selection === 'dual') {
          await showDualCameraSelector();
        } else {
          const result = await videoComposer.setCaptureMode(selection, { forceRestart: true });
          handleCameraResult(result);
          updateUI();
        }
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
    hideModal();
    await showDualCameraSelector();
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