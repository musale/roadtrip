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
    this.stream = null; // Stream used for recording (single or composite)
    this.audioTrack = null;
    this.videoTracks = [];
    this.isDualCamera = false;
    this.facingMode = 'user';
    this.isUserFacing = false;

    this.frontStream = null;
    this.backStream = null;
    this.dualCanvas = null;
    this.dualCtx = null;
    this.dualAnimationFrame = null;
    this.compositeStream = null;

    // Compositor canvas for recording
    this.compositorCanvas = document.createElement('canvas');
    this.compositorCanvas.width = VIDEO_WIDTH;
    this.compositorCanvas.height = VIDEO_HEIGHT;
    this.compositorCtx = this.compositorCanvas.getContext('2d');

    // Low power mode detection
    this.lowPowerMode = false;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fpsCheckInterval = null;
    this.frameCounterId = null;

    this.hud = {
      speed: '0.0 MPH',
      distance: '0.0 MI',
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

  async _getMediaStream(videoConstraints, audioConstraints = { echoCancellation: true, noiseSuppression: true }) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: audioConstraints });
    } catch (error) {
      console.error('Error getting media stream with constraints:', videoConstraints, error);
      return null;
    }
  }

  async startSingle({ facing = 'user' } = {}) {
    this.facingMode = facing;
    this.isUserFacing = facing === 'user';

    const constraintsToTry = [
      { video: { width: { ideal: VIDEO_WIDTH }, height: { ideal: VIDEO_HEIGHT }, facingMode: { ideal: facing } }, audio: true },
      { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: { ideal: facing } }, audio: true },
      { video: { width: { ideal: VIDEO_WIDTH }, height: { ideal: VIDEO_HEIGHT } }, audio: true },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: true },
      { video: true, audio: true }
    ];

    let stream = null;
    for (const constraints of constraintsToTry) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) {
          console.log('Successfully acquired media stream with constraints:', constraints);
          break;
        }
      } catch (error) {
        console.warn(`Failed to get media stream with constraints:`, constraints, error);
      }
    }

    if (!stream) {
      console.error('Failed to acquire camera stream for single mode after trying all constraints.');
      return false;
    }

    this._setDisplayMode('single');
    this.stream = stream;
    this.videoTracks = stream.getVideoTracks();
    this.audioTrack = stream.getAudioTracks()[0] ?? null;
    this.isDualCamera = false;

    this.singleVideoEl.srcObject = stream;
    await this._playVideo(this.singleVideoEl);
    this._applyMirror(this.singleVideoEl, this.isUserFacing);

    this._startFpsCheck();
    this._startFrameCounter();
    return true;
  }

  async startDual() {
    const { backStream, frontStream } = await this._getDualStreams();

    if (!backStream && !frontStream) {
      console.warn('Dual camera unavailable. Falling back to single camera.');
      return this.startSingle({ facing: this.facingMode });
    }

    this.backStream = backStream ?? frontStream;
    this.frontStream = frontStream ?? backStream;

    if (!this.backStream || !this.frontStream) {
      const originalStream = this.backStream ?? this.frontStream;
      const clonedTrack = originalStream?.getVideoTracks()[0]?.clone();
      const duplicateStream = clonedTrack ? new MediaStream([clonedTrack]) : null;

      if (!duplicateStream) {
        console.warn('Unable to clone track for dual fallback. Reverting to single camera.');
        this._stopSupplementaryStreams();
        return this.startSingle({ facing: this.facingMode });
      }

      if (!this.backStream) {
        this.backStream = duplicateStream;
      }
      if (!this.frontStream) {
        this.frontStream = duplicateStream;
      }
    }

    this._setDisplayMode('dual');
    this.dualBackVideo.srcObject = this.backStream;
    this.dualFrontVideo.srcObject = this.frontStream;

    await Promise.all([
      this._playVideo(this.dualBackVideo),
      this._playVideo(this.dualFrontVideo),
    ]);

    this._applyMirror(this.dualFrontVideo, true);
    this._applyMirror(this.dualBackVideo, false);

    this.audioTrack = this.backStream.getAudioTracks()[0] ?? this.frontStream.getAudioTracks()[0] ?? null;
    this.stream = this._createCompositeStream();
    this.videoTracks = this.stream.getVideoTracks();
    this.isDualCamera = true;
    this.isUserFacing = false;

    this._startFpsCheck();
    this._startFrameCounter();
    return true;
  }

  stopCamera() {
    this._stopFpsCheck();
    this._stopFrameCounter();
    this._stopComposite();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.frontStream) {
      this.frontStream.getTracks().forEach(track => track.stop());
      this.frontStream = null;
    }

    if (this.backStream) {
      this.backStream.getTracks().forEach(track => track.stop());
      this.backStream = null;
    }

    this.audioTrack = null;
    this.videoTracks = [];
    this.isDualCamera = false;
    this.isUserFacing = false;

    this._setDisplayMode('single');
    this.singleVideoEl.srcObject = null;
    this.dualBackVideo.srcObject = null;
    this.dualFrontVideo.srcObject = null;
  }

  _setDisplayMode(mode) {
    if (mode === 'dual') {
      this.dualContainer.classList.remove('invisible');
      this.singleVideoEl.style.visibility = 'hidden';
    } else {
      this.singleVideoEl.style.visibility = 'visible';
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

  async _getDualStreams() {
    const cameras = await this.listCameras();
    const backCandidates = cameras.filter(device => /back|rear|environment/i.test(device.label));
    const frontCandidates = cameras.filter(device => /front|user|face/i.test(device.label));

    let backStream = null;
    let frontStream = null;

    const videoConstraints = (deviceId) => ({
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: VIDEO_WIDTH },
        height: { ideal: VIDEO_HEIGHT },
    });

    if (backCandidates[0]) {
      backStream = await this._getMediaStream(videoConstraints(backCandidates[0].deviceId));
    }
    if (!backStream) {
      backStream = await this._getMediaStream({ facingMode: { ideal: 'environment' }, width: { ideal: VIDEO_WIDTH }, height: { ideal: VIDEO_HEIGHT } });
    }

    if (frontCandidates[0]) {
      frontStream = await this._getMediaStream(videoConstraints(frontCandidates[0].deviceId), false);
    }
    if (!frontStream) {
      frontStream = await this._getMediaStream({ facingMode: { ideal: 'user' }, width: { ideal: VIDEO_WIDTH }, height: { ideal: VIDEO_HEIGHT } }, false);
    }

    return { backStream, frontStream };
  }

  _createCompositeStream() {
    const draw = () => {
      const ctx = this.compositorCtx;
      const width = this.compositorCanvas.width;
      const height = this.compositorCanvas.height;

      ctx.clearRect(0, 0, width, height);

      if (this.isDualCamera) {
        const halfHeight = height / 2;
        if (this.dualBackVideo?.readyState >= 2) {
          ctx.drawImage(this.dualBackVideo, 0, 0, width, halfHeight - 4);
        }
        if (this.dualFrontVideo?.readyState >= 2) {
          ctx.drawImage(this.dualFrontVideo, 0, halfHeight + 4, width, halfHeight - 4);
        }
      } else if (this.singleVideoEl?.readyState >= 2) {
        ctx.drawImage(this.singleVideoEl, 0, 0, width, height);
      }

      this._drawHUD(ctx, width, height);

      this.dualAnimationFrame = requestAnimationFrame(draw);
    };

    if (this.dualAnimationFrame) {
      cancelAnimationFrame(this.dualAnimationFrame);
    }
    draw();

    const composite = this.compositorCanvas.captureStream(FRAME_RATE);
    if (this.audioTrack) {
      composite.addTrack(this.audioTrack);
    }
    this.compositeStream = composite;
    return composite;
  }

  _stopComposite() {
    if (this.dualAnimationFrame) {
      cancelAnimationFrame(this.dualAnimationFrame);
      this.dualAnimationFrame = null;
    }
    if (this.compositeStream) {
      this.compositeStream.getTracks().forEach(track => track.stop());
      this.compositeStream = null;
    }
  }

  _stopSupplementaryStreams() {
    if (this.frontStream) {
      this.frontStream.getTracks().forEach(track => track.stop());
      this.frontStream = null;
    }
    if (this.backStream) {
      this.backStream.getTracks().forEach(track => track.stop());
      this.backStream = null;
    }
  }

  async _playVideo(videoEl) {
    console.log('Attempting to play video element:', videoEl.id);
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', 'true');
    if (videoEl.readyState < 1) {
      console.log('Video readyState is < 1, waiting for loadedmetadata');
      await new Promise(res => videoEl.addEventListener('loadedmetadata', res, { once: true }));
      console.log('loadedmetadata event fired');
    }
    try {
      await videoEl.play();
      console.log('videoEl.play() resolved for:', videoEl.id);
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
    const mimeTypes = [
        'video/mp4; codecs="avc1.42E01E"',
        'video/mp4',
        'video/webm; codecs="vp9"',
        'video/webm; codecs="vp8"',
    ];

    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    console.warn('No supported MIME type found for MediaRecorder.');
    return null;
  }

  startRecording(onChunkAvailable, enableButtons) {
    if (!this.stream) {
      console.error('No stream available for recording.');
      return false;
    }

    const mimeType = this._getMimeType();
    if (!mimeType) return false;

    // Ensure the composite stream is created and used for recording
    if (!this.compositeStream) {
      // If compositeStream is not yet created (e.g., in single camera mode),
      // create it now using the current camera stream.
      this.compositeStream = this.compositorCanvas.captureStream(FRAME_RATE);
      if (this.audioTrack) {
        this.compositeStream.addTrack(this.audioTrack);
      }
      // Start the drawing loop for the compositor canvas
      const draw = () => {
        const ctx = this.compositorCtx;
        const width = this.compositorCanvas.width;
        const height = this.compositorCanvas.height;

        ctx.clearRect(0, 0, width, height);

        if (this.isDualCamera) {
          const halfHeight = height / 2;
          if (this.dualBackVideo?.readyState >= 2) {
            ctx.drawImage(this.dualBackVideo, 0, 0, width, halfHeight - 4);
          }
          if (this.dualFrontVideo?.readyState >= 2) {
            ctx.drawImage(this.dualFrontVideo, 0, halfHeight + 4, width, halfHeight - 4);
          }
        } else if (this.singleVideoEl?.readyState >= 2) {
          ctx.drawImage(this.singleVideoEl, 0, 0, width, height);
        }

        this._drawHUD(ctx, width, height);

        this.dualAnimationFrame = requestAnimationFrame(draw);
      };

      if (this.dualAnimationFrame) {
        cancelAnimationFrame(this.dualAnimationFrame);
      }
      draw();
    }

    const finalStream = this.compositeStream;

    this.mediaRecorder = new MediaRecorder(finalStream, { mimeType });
    this.recordedBlobs = [];

    this.mediaRecorder.ondataavailable = (event) => {
      console.log('ondataavailable event fired');
      if (event.data && event.data.size > 0) {
        this.recordedBlobs.push(event.data);
        console.log(`Video chunk available: ${event.data.size} bytes. Total chunks: ${this.recordedBlobs.length}`);
        onChunkAvailable(event.data);
      } else {
        console.log('event.data is empty or size is 0');
      }
    };

    this.mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped. Final recorded blobs count:', this.recordedBlobs.length);
      const mime = this.mediaRecorder.mimeType;
      const blob = new Blob(this.recordedBlobs, { type: mime });
      if (blob.size > 0) {
        enableButtons(blob);
      } else {
        alert('Recording failed or unsupported codec.');
      }
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

    console.log('MediaRecorder started with MIME type:', mimeType, 'State:', this.mediaRecorder.state);
    return true;
  }

  async stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log('Stopping MediaRecorder. Current state:', this.mediaRecorder.state);
      return new Promise(resolve => {
        this.mediaRecorder.addEventListener('stop', () => {
          const mime = this.mediaRecorder.mimeType;
          const blob = new Blob(this.recordedBlobs, { type: mime });
          this.recordedBlobs = [];
          if (blob.size > 0) {
            resolve(blob);
          } else {
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

  _drawHUD(ctx, width, height) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, height - 50, width, 50);

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(this.hud.speed, 10, height - 20);
    ctx.textAlign = 'center';
    ctx.fillText(this.hud.time, width / 2, height - 20);
    ctx.textAlign = 'right';
    ctx.fillText(this.hud.distance, width - 10, height - 20);
  }
}

export default VideoComposer;