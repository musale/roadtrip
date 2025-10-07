// src/js/VideoComposer.js

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const FRAME_RATE = 30;
const CHUNK_DURATION_MS = 1000; // 1 second chunks

class VideoComposer {
  constructor({
    singleVideoEl,
    dualContainer,
    dualFrontVideo,
    dualBackVideo,
  } = {}) {
    this.singleVideoEl = singleVideoEl ?? document.getElementById('singleVideoFeed');
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

    // Low power mode detection
    this.lowPowerMode = false;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fpsCheckInterval = null;
  this.frameCounterId = null;
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

    let stream = null;
    let videoConstraints = { facingMode: { ideal: facing }, width: VIDEO_WIDTH, height: VIDEO_HEIGHT };

    stream = await this._getMediaStream(videoConstraints);

    if (!stream) {
      const cameras = await this.listCameras();
      const desiredCamera = cameras.find(camera => {
        const label = camera.label.toLowerCase();
        return facing === 'user'
          ? label.includes('front') || label.includes('user')
          : label.includes('back') || label.includes('rear') || label.includes('environment');
      });
      if (desiredCamera) {
        videoConstraints = { deviceId: { exact: desiredCamera.deviceId }, width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
        stream = await this._getMediaStream(videoConstraints);
      }
    }

    if (!stream) {
      videoConstraints = { facingMode: facing, width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
      stream = await this._getMediaStream(videoConstraints);
    }

    if (!stream) {
      videoConstraints = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
      stream = await this._getMediaStream(videoConstraints);
      if (stream) {
        this.isUserFacing = false;
      }
    }

    if (!stream) {
      console.error('Failed to acquire camera stream for single mode.');
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
      // If only one stream, clone track so we can present two views
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
      this.dualContainer.classList.remove('hidden');
      this.singleVideoEl.classList.add('hidden');
    } else {
      this.singleVideoEl.classList.remove('hidden');
      this.dualContainer.classList.add('hidden');
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

    if (backCandidates[0]) {
      backStream = await this._getMediaStream({ deviceId: { exact: backCandidates[0].deviceId }, width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
    }
    if (!backStream) {
      backStream = await this._getMediaStream({ facingMode: { ideal: 'environment' }, width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
    }

    if (frontCandidates[0]) {
      frontStream = await this._getMediaStream({ deviceId: { exact: frontCandidates[0].deviceId }, width: VIDEO_WIDTH, height: VIDEO_HEIGHT }, false);
    }
    if (!frontStream) {
      frontStream = await this._getMediaStream({ facingMode: { ideal: 'user' }, width: VIDEO_WIDTH, height: VIDEO_HEIGHT }, false);
    }

    return { backStream, frontStream };
  }

  _createCompositeStream() {
    if (!this.dualCanvas) {
      this.dualCanvas = document.createElement('canvas');
      this.dualCanvas.width = VIDEO_WIDTH;
      this.dualCanvas.height = VIDEO_HEIGHT * 2;
      this.dualCtx = this.dualCanvas.getContext('2d');
    }

    const draw = () => {
      if (!this.dualCtx) return;
      const ctx = this.dualCtx;
      const width = this.dualCanvas.width;
      const height = this.dualCanvas.height;
      const halfHeight = height / 2;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      if (this.dualBackVideo?.readyState >= 2) {
        ctx.drawImage(this.dualBackVideo, 0, 0, width, halfHeight - 4);
      }
      if (this.dualFrontVideo?.readyState >= 2) {
        ctx.drawImage(this.dualFrontVideo, 0, halfHeight + 4, width, halfHeight - 4);
      }

      this.dualAnimationFrame = requestAnimationFrame(draw);
    };

    if (this.dualAnimationFrame) {
      cancelAnimationFrame(this.dualAnimationFrame);
    }
    draw();

    const composite = this.dualCanvas.captureStream(FRAME_RATE);
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
    try {
      await videoEl.play();
    } catch (error) {
      // Some browsers require user gesture; ignore silently
      console.warn('Unable to autoplay video element:', error);
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
    const mimeTypes = [
      'video/webm; codecs="vp9"',
      'video/mp4; codecs="avc1.42001E"',
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

  startRecording(onChunkAvailable) {
    if (!this.stream) {
      console.error('No stream available for recording.');
      return false;
    }

    const mimeType = this._getMimeType();
    if (!mimeType) return false;

    const finalStream = new MediaStream();
    this.stream.getVideoTracks().forEach(track => finalStream.addTrack(track));
    if (this.audioTrack) {
      finalStream.addTrack(this.audioTrack);
    }

    this.mediaRecorder = new MediaRecorder(finalStream, { mimeType });
    this.recordedBlobs = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedBlobs.push(event.data);
        console.log(`Video chunk available: ${event.data.size} bytes`);
        onChunkAvailable(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      console.log('MediaRecorder stopped. Final recorded blobs count:', this.recordedBlobs.length);
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
    };

    this.mediaRecorder.start(CHUNK_DURATION_MS);
    console.log('MediaRecorder started with MIME type:', mimeType, 'State:', this.mediaRecorder.state);
    return true;
  }

  async stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log('Stopping MediaRecorder. Current state:', this.mediaRecorder.state);
      this.mediaRecorder.stop();
      await new Promise(resolve => this.mediaRecorder.addEventListener('stop', resolve, { once: true }));
      console.log('Recording stopped. Total chunks collected:', this.recordedBlobs.length);
      if (this.recordedBlobs.length > 0) {
        const superBuffer = new Blob(this.recordedBlobs, { type: this.recordedBlobs[0].type });
        this.recordedBlobs = [];
        return superBuffer;
      }
      console.warn('No video blobs were recorded.');
      return null;
    }
    console.warn('MediaRecorder not active or not initialized.');
    return null;
  }
}

export default VideoComposer;
