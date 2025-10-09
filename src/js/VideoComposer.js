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

  async _getMediaStream(videoConstraints, audioConstraints = false) { // audio is optional
    try {
      return await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: audioConstraints });
    } catch (error) {
      console.error('Error getting media stream with constraints:', videoConstraints, error);
      return null;
    }
  }

  async setCaptureMode(mode) {
    if (this.state.captureMode === mode) return;
    this.state.captureMode = mode;
    await this.stopStreams();
    if (mode === 'single') {
      await this.startSingle();
    } else {
      await this.startDual();
    }
  }

  async setFacing(facing) {
    if (this.state.facing === facing) return;
    this.state.facing = facing;
    if (this.state.captureMode === 'single') {
      await this.stopStreams();
      await this.startSingle();
    }
  }

  async startSingle() {
    const baseConstraints = { width: { ideal: VIDEO_WIDTH }, height: { ideal: VIDEO_HEIGHT } };
    const videoConstraints = { facingMode: { ideal: this.state.facing }, ...baseConstraints };

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true });
    } catch (error) {
      console.error('Failed to get single camera stream:', error);
      return false;
    }

    if (!stream) {
      console.error('No stream acquired for single mode.');
      return false;
    }

    this.state.backStream = stream; // Use backStream for single camera
    this.state.frontStream = null;
    this.audioTrack = stream.getAudioTracks()[0] ?? null;

    this._setDisplayMode('single');
    this.singleVideoEl.srcObject = stream;
    await this._playVideo(this.singleVideoEl);
    this._applyMirror(this.singleVideoEl, false); // Do not apply mirror for single camera, let browser handle default mirroring

    this._startCompositeDrawing();
    this._startFpsCheck();
    this._startFrameCounter();
    return true;
  }

  async startDual() {
    const baseConstraints = { width: { ideal: VIDEO_WIDTH }, height: { ideal: VIDEO_HEIGHT } };
    const backVideoConstraints = { facingMode: { ideal: 'environment' }, ...baseConstraints };
    const frontVideoConstraints = { facingMode: { ideal: 'user' }, ...baseConstraints };

    let backStream = await this._getMediaStream(backVideoConstraints, { echoCancellation: true, noiseSuppression: true });
    let frontStream = await this._getMediaStream(frontVideoConstraints, false); // No audio for front

    // Fallback logic: if both fail, or one fails and cannot be cloned, revert to single
    if (!backStream && !frontStream) {
      console.warn('Dual camera unavailable. Falling back to single camera.');
      this.state.captureMode = 'single'; // Update state for fallback
      return this.startSingle();
    }

    // Attempt to clone if one stream fails
    if (!backStream && frontStream) {
      console.warn('Back camera stream failed, attempting to clone front stream.');
      const clonedTrack = frontStream.getVideoTracks()[0]?.clone();
      if (clonedTrack) {
        backStream = new MediaStream([clonedTrack]);
        // If frontStream has audio, use it for backStream's audio
        const frontAudioTrack = frontStream.getAudioTracks()[0];
        if (frontAudioTrack) backStream.addTrack(frontAudioTrack.clone());
      }
    } else if (!frontStream && backStream) {
      console.warn('Front camera stream failed, attempting to clone back stream.');
      const clonedTrack = backStream.getVideoTracks()[0]?.clone();
      if (clonedTrack) frontStream = new MediaStream([clonedTrack]);
    }

    if (!backStream || !frontStream) {
      console.error('Could not establish dual streams, even with cloning. Falling back to single.');
      this.state.captureMode = 'single'; // Update state for fallback
      return this.startSingle();
    }

    this.state.backStream = backStream;
    this.state.frontStream = frontStream;
    this.audioTrack = backStream.getAudioTracks()[0] ?? null; // Prefer audio from back camera

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
    return true;
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