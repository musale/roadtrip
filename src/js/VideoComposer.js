const VIDEO_WIDTH = 1280; // Internal resolution for processing
const VIDEO_HEIGHT = 720; // Internal resolution for processing
const FRAME_RATE = 30;
const CHUNK_DURATION_MS = 1000; // 1 second chunks

class VideoComposer {
  constructor({
    singleVideoEl,
    dualContainer,
    dualFrontVideo,
    dualBackVideo,
  } = {}) {
    this.singleVideoEl = singleVideoEl ?? document.getElementById('cameraFeed');
    this.dualContainer = dualContainer ?? document.getElementById('dualVideoContainer');
    this.dualFrontVideo = dualFrontVideo ?? document.getElementById('dualFrontVideo');
    this.dualBackVideo = dualBackVideo ?? document.getElementById('dualBackVideo');

    this.mediaRecorder = null;
    this.recordedBlobs = [];
    this.compositeStream = null;
    this.audioTrack = null; // To hold the audio track from the primary stream
    this.isMuted = false; // To track mute state for video overlay

    // Compositor canvas for recording
    this.compositorCanvas = document.createElement('canvas');
    this.compositorCanvas.width = VIDEO_WIDTH;
    this.compositorCanvas.height = VIDEO_HEIGHT;
    this.compositorCtx = this.compositorCanvas.getContext('2d');

    // Internal state
    this.state = {
      captureMode: 'single',      // 'single' | 'dual'
      facing: 'user',      // 'user' | 'environment' (single only)
      backStream: null,
      frontStream: null,
      isRecording: false
    };

    // Low power mode detection
    this.lowPowerMode = false;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fpsCheckInterval = null;
    this.frameCounterId = null;

    this.hud = {
      speed: '0.0 KPH',
      distance: '0.0 KM',
      time: '00:00:00',
    };

    this.capabilities = {
      cameraCount: 0,
      hasUserFacing: false,
      hasEnvironmentFacing: false,
      devices: [],
    };

    this.lastError = null;
  }

  async hasOPFS() {
    try {
      return !!(navigator.storage && navigator.storage.getDirectory);
    } catch {
      return false;
    }
  }

  async listCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.warn('Unable to enumerate devices:', error);
      return [];
    }
  }

  async refreshCameraInventory() {
    const fallback = {
      cameraCount: 0,
      hasUserFacing: false,
      hasEnvironmentFacing: false,
      devices: [],
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      this.capabilities = fallback;
      return this.capabilities;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');

      const facingFromLabels = cameras.reduce((acc, device) => {
        const label = device.label?.toLowerCase() ?? '';
        if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
          acc.hasEnvironmentFacing = true;
        }
        if (label.includes('front') || label.includes('user') || label.includes('face')) {
          acc.hasUserFacing = true;
        }
        return acc;
      }, { hasUserFacing: false, hasEnvironmentFacing: false });

      const activeFacings = this._collectActiveFacingModes();

      const hasUserFacing = facingFromLabels.hasUserFacing || activeFacings.has('user') || (cameras.length === 1);
      const hasEnvironmentFacing = facingFromLabels.hasEnvironmentFacing || activeFacings.has('environment') || (cameras.length > 1);

      this.capabilities = {
        cameraCount: cameras.length,
        hasUserFacing,
        hasEnvironmentFacing,
        devices: cameras,
      };
    } catch (error) {
      console.warn('Failed to enumerate camera devices:', error);
      this.capabilities = fallback;
    }

    return this.capabilities;
  }

  getCapabilities() {
    return this.capabilities;
  }

  _collectActiveFacingModes() {
    const facingModes = new Set();
    const tracks = [];

    if (this.state.backStream) {
      tracks.push(...this.state.backStream.getVideoTracks());
    }
    if (this.state.frontStream) {
      tracks.push(...this.state.frontStream.getVideoTracks());
    }

    tracks.forEach((track) => {
      const facing = track.getSettings?.().facingMode;
      if (facing) facingModes.add(facing);
    });

    return facingModes;
  }

  async _getMediaStream(videoConstraints, audioConstraints = false) { // audio is optional
    const constraints = { video: videoConstraints, audio: audioConstraints };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return { stream, error: null };
    } catch (error) {
      console.error('Error getting media stream with constraints:', videoConstraints, error);
      return { stream: null, error };
    }
  }

  _hasActiveStreamForMode(mode) {
    const trackIsLive = (track) => track && track.readyState === 'live';

    if (mode === 'dual') {
      const backLive = this.state.backStream?.getVideoTracks().some(trackIsLive) ?? false;
      const frontLive = this.state.frontStream?.getVideoTracks().some(trackIsLive) ?? false;
      return backLive && frontLive;
    }

    return this.state.backStream?.getVideoTracks().some(trackIsLive) ?? false;
  }

  async setCaptureMode(mode, options = {}) {
    const { forceRestart = false } = options;
    if (!['single', 'dual'].includes(mode)) {
      const error = { code: 'invalid-mode', message: `Unsupported capture mode: ${mode}` };
      this.lastError = error;
      return { success: false, error };
    }

    const shouldRestart = forceRestart || this.state.captureMode !== mode || !this._hasActiveStreamForMode(mode);

    this.state.captureMode = mode;

    if (!shouldRestart) {
      const capabilities = await this.refreshCameraInventory();
      return { success: true, capabilities };
    }

    await this.stopStreams();

    const startResult = mode === 'single'
      ? await this.startSingle()
      : await this.startDual();

    if (!startResult.success) {
      this.lastError = startResult.error ?? null;
      return startResult;
    }

    const capabilities = await this.refreshCameraInventory();
    return { success: true, capabilities, metadata: startResult.metadata };
  }

  async ensureActiveCapture() {
    if (this._hasActiveStreamForMode(this.state.captureMode)) {
      const capabilities = await this.refreshCameraInventory();
      return { success: true, capabilities };
    }
    return this.setCaptureMode(this.state.captureMode, { forceRestart: true });
  }

  async setFacing(facing) {
    if (!['user', 'environment'].includes(facing)) {
      const error = { code: 'invalid-facing', message: `Unsupported facing: ${facing}` };
      this.lastError = error;
      return { success: false, error };
    }

    const capabilities = await this.refreshCameraInventory();
    if (facing === 'environment' && !capabilities.hasEnvironmentFacing) {
      const error = {
        code: 'environment-unavailable',
        message: 'No rear camera detected on this device.',
      };
      this.lastError = error;
      return { success: false, error, capabilities };
    }

    this.state.facing = facing;

    if (this.state.captureMode === 'single') {
      return this.setCaptureMode('single', { forceRestart: true });
    }

    return { success: true, capabilities };
  }

  async startSingle() {
    const baseConstraints = { width: { ideal: VIDEO_WIDTH }, height: { ideal: VIDEO_HEIGHT } };
    const attempts = [];
    const preferredFacing = this.state.facing;

    const tryConstraints = [
      { label: preferredFacing ? `facing-${preferredFacing}` : 'preferred', constraints: { facingMode: { ideal: preferredFacing }, ...baseConstraints } },
      { label: 'default', constraints: baseConstraints },
    ];

    let stream = null;
    for (const attempt of tryConstraints) {
      if (!attempt.constraints.facingMode?.ideal) {
        delete attempt.constraints.facingMode;
      }

      const { stream: attemptStream, error } = await this._getMediaStream(attempt.constraints, { echoCancellation: true, noiseSuppression: true });
      if (attemptStream) {
        stream = attemptStream;
        break;
      }
      attempts.push({ attempt: attempt.label, error });
    }

    if (!stream) {
      const error = {
        code: 'single-stream-failed',
        message: attempts.length
          ? `Could not access the ${preferredFacing ?? 'default'} camera. Last error: ${attempts.at(-1)?.error?.message ?? 'Unknown error.'}`
          : 'Could not access any camera stream.',
        details: attempts,
      };
      return { success: false, error };
    }

    this.state.backStream = stream;
    this.state.frontStream = null;
    this.audioTrack = stream.getAudioTracks()[0] ?? null;

    const videoTrack = stream.getVideoTracks()[0] ?? null;
    const actualFacing = videoTrack?.getSettings?.().facingMode ?? null;
    const facingChanged = actualFacing && this.state.facing !== actualFacing;
    if (facingChanged) {
      this.state.facing = actualFacing;
    }

    this._setDisplayMode('single');
    this.singleVideoEl.srcObject = stream;
    await this._playVideo(this.singleVideoEl);
    this._applyMirror(this.singleVideoEl, actualFacing === 'user');

    this._startCompositeDrawing();
    this._startFpsCheck();
    this._startFrameCounter();

    return { success: true, metadata: { actualFacing: this.state.facing, facingChanged } };
  }

  async startDual() {
    const baseConstraints = { width: { ideal: VIDEO_WIDTH }, height: { ideal: VIDEO_HEIGHT } };
    const backVideoConstraints = { facingMode: { ideal: 'environment' }, ...baseConstraints };
    const frontVideoConstraints = { facingMode: { ideal: 'user' }, ...baseConstraints };

    const backResult = await this._getMediaStream(backVideoConstraints, { echoCancellation: true, noiseSuppression: true });
    const frontResult = await this._getMediaStream(frontVideoConstraints, false);

    let backStream = backResult.stream;
    let frontStream = frontResult.stream;

    // Fallback logic: if both fail, or one fails and cannot be cloned, revert to single
    if (!backStream && !frontStream) {
      console.warn('Dual camera unavailable. Falling back to single camera.');
      this.state.captureMode = 'single';
      const singleResult = await this.startSingle();
      if (singleResult.success) {
        singleResult.metadata = {
          ...(singleResult.metadata ?? {}),
          downgradedToSingle: true,
        };
      }
      return singleResult;
    }

    // Attempt to clone if one stream fails
    if (!backStream && frontStream) {
      console.warn('Back camera stream failed, attempting to clone front stream.');
      const clonedTrack = frontStream.getVideoTracks()[0]?.clone();
      if (clonedTrack) {
        backStream = new MediaStream([clonedTrack]);
        const frontAudioTrack = frontStream.getAudioTracks()[0];
        if (frontAudioTrack) backStream.addTrack(frontAudioTrack.clone());
      }
    } else if (!frontStream && backStream) {
      console.warn('Front camera stream failed, attempting to clone back stream.');
      const clonedTrack = backStream.getVideoTracks()[0]?.clone();
      if (clonedTrack) frontStream = new MediaStream([clonedTrack]);
    }

    if (!backStream || !frontStream) {
      const downgradeNotice = {
        code: 'dual-stream-failed',
        message: 'Could not establish both camera streams for dual mode. Switched back to single camera.',
        details: { backError: backResult.error, frontError: frontResult.error },
      };
      this.state.captureMode = 'single';
      const singleResult = await this.startSingle();
      if (singleResult.success) {
        singleResult.metadata = {
          ...(singleResult.metadata ?? {}),
          downgradedToSingle: true,
        };
        singleResult.warning = downgradeNotice;
        return singleResult;
      }
      return { success: false, error: downgradeNotice };
    }

    this.state.backStream = backStream;
    this.state.frontStream = frontStream;
    this.audioTrack = backStream.getAudioTracks()[0] ?? null;

    this._setDisplayMode('dual');
    this.dualBackVideo.srcObject = backStream;
    this.dualFrontVideo.srcObject = frontStream;

    await Promise.all([
      this._playVideo(this.dualBackVideo),
      this._playVideo(this.dualFrontVideo),
    ]);

    this._applyMirror(this.dualFrontVideo, true);
    this._applyMirror(this.dualBackVideo, false);

    this._startCompositeDrawing();
    this._startFpsCheck();
    this._startFrameCounter();

    const metadata = {
      backFacing: backStream.getVideoTracks()[0]?.getSettings?.().facingMode ?? null,
      frontFacing: frontStream.getVideoTracks()[0]?.getSettings?.().facingMode ?? null,
    };

    return { success: true, metadata };
  }

  async stopStreams() {
    this._stopFpsCheck();
    this._stopFrameCounter();
    this._stopCompositeDrawing();

    if (this.state.backStream) {
      this.state.backStream.getTracks().forEach(track => track.stop());
      this.state.backStream = null;
    }
    if (this.state.frontStream) {
      this.state.frontStream.getTracks().forEach(track => track.stop());
      this.state.frontStream = null;
    }

    this.audioTrack = null;
    if (this.singleVideoEl) this.singleVideoEl.srcObject = null;
    if (this.dualBackVideo) this.dualBackVideo.srcObject = null;
    if (this.dualFrontVideo) this.dualFrontVideo.srcObject = null;

    // Clear compositor canvas
    this.compositorCtx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  }

  _setDisplayMode(mode) {
    if (mode === 'dual') {
      this.dualContainer.classList.remove('invisible');
      this.singleVideoEl.classList.add('hidden'); // Use hidden class for single video
    } else {
      this.singleVideoEl.classList.remove('hidden'); // Use hidden class for single video
      this.dualContainer.classList.add('invisible');
    }
  }

  _applyMirror(videoEl, shouldMirror) {
    if (!videoEl) return;
    if (shouldMirror) {
      videoEl.classList.add('mirror');
    } else {
      videoEl.classList.remove('mirror');
    }
  }

  _startCompositeDrawing() {
    const draw = () => {
      const ctx = this.compositorCtx;
      const width = this.compositorCanvas.width;
      const height = this.compositorCanvas.height;

      ctx.clearRect(0, 0, width, height);

      if (this.state.captureMode === 'dual') {
        // Draw dual cameras split-screen
        const halfWidth = width / 2;
        // Ensure videos are ready before drawing
        if (this.dualBackVideo && this.dualBackVideo.readyState >= 2) {
          ctx.drawImage(this.dualBackVideo, 0, 0, halfWidth, height);
        }
        if (this.dualFrontVideo && this.dualFrontVideo.readyState >= 2) {
          ctx.drawImage(this.dualFrontVideo, halfWidth, 0, halfWidth, height);
        }

        // Draw camera labels for dual mode
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial'; // Smaller font for labels
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';

        // Back Camera label (top-right of left half)
        ctx.fillText('Back Camera', halfWidth - 10, 10);

        // Front Camera label (top-right of right half)
        ctx.fillText('Front Camera', width - 10, 10);

      } else { // Single camera mode
        // Ensure video is ready before drawing
        if (this.singleVideoEl && this.singleVideoEl.readyState >= 2) {
          ctx.drawImage(this.singleVideoEl, 0, 0, width, height);
        }
      }

      this._drawHUD(ctx, width, height);

      this.dualAnimationFrame = requestAnimationFrame(draw);
    };

    if (this.dualAnimationFrame) {
      cancelAnimationFrame(this.dualAnimationFrame);
    }
    draw();

    // Capture stream from the compositor canvas
    this.compositeStream = this.compositorCanvas.captureStream(FRAME_RATE);
    // Add the audio track from the primary stream (backStream)
    if (this.audioTrack) {
      // Stop existing audio tracks in compositeStream if any, before adding new one
      this.compositeStream.getAudioTracks().forEach(track => track.stop());
      this.compositeStream.addTrack(this.audioTrack);
    }
  }

  _stopCompositeDrawing() {
    if (this.dualAnimationFrame) {
      cancelAnimationFrame(this.dualAnimationFrame);
      this.dualAnimationFrame = null;
    }
    if (this.compositeStream) {
      this.compositeStream.getTracks().forEach(track => track.stop());
      this.compositeStream = null;
    }
  }

  async _playVideo(videoEl) {
    if (!videoEl) return;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', 'true');
    // Wait for metadata to be loaded before attempting to play
    if (videoEl.readyState < 1) {
      await new Promise(res => videoEl.addEventListener('loadedmetadata', res, { once: true }));
    }
    try {
      await videoEl.play();
    } catch (error) {
      console.error('Error playing video:', error);
    }
  }

  _startFpsCheck() {
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    if (this.fpsCheckInterval) {
      clearInterval(this.fpsCheckInterval);
    }
    this.fpsCheckInterval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - this.lastFrameTime;
      const fps = elapsed > 0 ? (this.frameCount / elapsed) * 1000 : 0;

      if (fps < 24 && !this.lowPowerMode) {
        this.lowPowerMode = true;
        console.warn('Entering low power mode due to low FPS.');
      } else if (fps >= 24 && this.lowPowerMode) {
        this.lowPowerMode = false;
        console.log('Exiting low power mode.');
      }

      this.frameCount = 0;
      this.lastFrameTime = now;
    }, 5000);
  }

  _stopFpsCheck() {
    if (this.fpsCheckInterval) {
      clearInterval(this.fpsCheckInterval);
      this.fpsCheckInterval = null;
    }
    this.lowPowerMode = false;
  }

  _startFrameCounter() {
    const tick = () => {
      this.frameCount += 1;
      this.frameCounterId = requestAnimationFrame(tick);
    };
    if (this.frameCounterId) {
      cancelAnimationFrame(this.frameCounterId);
    }
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.frameCounterId = requestAnimationFrame(tick);
  }

  _stopFrameCounter() {
    if (this.frameCounterId) {
      cancelAnimationFrame(this.frameCounterId);
      this.frameCounterId = null;
    }
  }

  _getMimeType() {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const mimeTypes = isSafari
      ? ['video/mp4; codecs="avc1.42E01E"', 'video/mp4']
      : ['video/webm; codecs="vp9"', 'video/webm; codecs="vp8"', 'video/mp4; codecs="avc1.42E01E"'];

    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    console.warn('No supported MIME type found for MediaRecorder.');
    return null;
  }

  startRecording(onChunkAvailable) { // Removed enableButtons as it's not used here
    if (!this.compositeStream) {
      console.error('Composite stream not available for recording.');
      return false;
    }

    const mimeType = this._getMimeType();
    if (!mimeType) return false;

    this.mediaRecorder = new MediaRecorder(this.compositeStream, { mimeType });
    this.recordedBlobs = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedBlobs.push(event.data);
        onChunkAvailable(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      // The onstop handler is now primarily for cleanup and signaling completion
      // The final blob is handled by stopRecording()
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
    };

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      this.mediaRecorder.start(); // Safari doesn't support timeslice
    } else {
      this.mediaRecorder.start(CHUNK_DURATION_MS);
    }

    this.state.isRecording = true;
    return true;
  }

  async stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      return new Promise(resolve => {
        this.mediaRecorder.addEventListener('stop', () => {
          const blob = new Blob(this.recordedBlobs, { type: this.mediaRecorder.mimeType });
          this.recordedBlobs = [];
          this.state.isRecording = false;
          if (blob.size > 0) {
            resolve(blob);
          }
          else {
            console.warn('No video blobs were recorded.');
            resolve(null);
          }
        }, { once: true });
        this.mediaRecorder.stop();
      });
    }
    console.warn('MediaRecorder not active or not initialized.');
    return null;
  }

  setHUD(hudData) {
    this.hud = { ...this.hud, ...hudData };
  }

  /**
   * Sets the muted state to be displayed on the video overlay.
   * @param {boolean} isMuted Whether the audio is currently muted.
   */
  setMutedState(isMuted) {
    this.isMuted = isMuted;
  }

  _drawHUD(ctx, width, height) {
    // Draw a semi-transparent black rectangle at the bottom for the HUD background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, height - 50, width, 50); // Adjust size as needed

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial'; // Adjust font size and family as needed
    ctx.textBaseline = 'middle'; // Align text vertically in the middle of the line

    // Speed (left aligned)
    ctx.textAlign = 'left';
    ctx.fillText(this.hud.speed, 10, height - 25); // 25 is half of 50, to center vertically

    // Time (center aligned)
    ctx.textAlign = 'center';
    ctx.fillText(this.hud.time, width / 2, height - 25);

    // Distance (right aligned)
    ctx.textAlign = 'right';
    ctx.fillText(this.hud.distance, width - 10, height - 25);

    // Draw mute indicator if muted
    if (this.isMuted) {
      const text = 'MUTED';
      ctx.font = 'bold 22px Arial';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = 22; // Approximation based on font size
      const padding = 5;

      // Draw background rectangle for better visibility
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent black
      ctx.fillRect(
        10 - padding,
        10 - padding,
        textWidth + (padding * 2),
        textHeight + (padding * 2)
      );

      // Draw text
      ctx.fillStyle = 'rgba(255, 20, 20, 0.95)'; // Bright, nearly-opaque red
      ctx.fillText(text, 10, 10);
    }
  }
}

export default VideoComposer;