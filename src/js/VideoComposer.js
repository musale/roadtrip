// src/VideoComposer.js

import { writeVideoToOpfs, addVideoChunk } from './storage/db.js';

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const FRAME_RATE = 30;
const CHUNK_DURATION_MS = 1000; // 1 second chunks

class VideoComposer {
  constructor(hudCanvas) {
    this.hudCanvas = hudCanvas;
    this.hudCtx = hudCanvas.getContext('2d');
    this.cameraFeed = document.getElementById('cameraFeed');
    this.mediaRecorder = null;
    this.recordedBlobs = [];
    this.stream = null;
    this.audioTrack = null;
    this.videoTracks = [];
    this.recordingInterval = null;
    this.isDualCamera = false;
    this.facingMode = 'environment';

    // Low power mode detection
    this.lowPowerMode = false;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fpsCheckInterval = null;
  }

  async listCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  }

  async getStreamByDeviceId(deviceId, { audio = true } = {}) {
    const constraints = {
      video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
      audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  async startSingle({ facing = 'environment' }) {
    this.facingMode = facing;
    const constraints = {
      video: { facingMode: facing, width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
      audio: { echoCancellation: true, noiseSuppression: true },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.cameraFeed.srcObject = this.stream;
      this.videoTracks = this.stream.getVideoTracks();
      this.audioTrack = this.stream.getAudioTracks()[0];
      this.isDualCamera = false;
      this._startFpsCheck();
      return true;
    } catch (error) {
      console.error("Error starting single camera stream:", error);
      return false;
    }
  }

  async startDual() {
    let backCameraStream = null;
    let frontCameraStream = null;

    try {
      // Try to get environment camera
      backCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      this.audioTrack = backCameraStream.getAudioTracks()[0]; // Use audio from back camera

      // Try to get user camera
      frontCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: VIDEO_WIDTH / 2, height: VIDEO_HEIGHT / 2 }, // Smaller for PiP
        audio: false, // No audio for front camera to avoid echo
      });

      // If both streams are successful, combine them
      if (backCameraStream && frontCameraStream) {
        this.stream = new MediaStream();
        backCameraStream.getVideoTracks().forEach(track => this.stream.addTrack(track));
        frontCameraStream.getVideoTracks().forEach(track => this.stream.addTrack(track));
        this.stream.addTrack(this.audioTrack);

        this.cameraFeed.srcObject = this.stream;
        this.videoTracks = this.stream.getVideoTracks();
        this.isDualCamera = true;
        this._startFpsCheck();
        return true;
      }
    } catch (error) {
      console.warn("Could not start dual camera, falling back to single:", error);
      // Fallback to single camera if dual fails
      if (backCameraStream) {
        backCameraStream.getTracks().forEach(track => track.stop());
      }
      if (frontCameraStream) {
        frontCameraStream.getTracks().forEach(track => track.stop());
      }
      return this.startSingle({ facing: this.facingMode });
    }
    return false;
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.cameraFeed.srcObject = null;
      this.videoTracks = [];
      this.audioTrack = null;
      this.isDualCamera = false;
      this._stopFpsCheck();
    }
  }

  _startFpsCheck() {
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsCheckInterval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - this.lastFrameTime;
      const fps = (this.frameCount / elapsed) * 1000;
      // console.log("Current FPS:", fps);

      if (fps < 24 && !this.lowPowerMode) {
        this.lowPowerMode = true;
        console.warn("Entering low power mode due to low FPS.");
        // TODO: Trigger UI changes for low power mode (e.g., smaller PiP, fewer shadows)
      } else if (fps >= 24 && this.lowPowerMode) {
        this.lowPowerMode = false;
        console.log("Exiting low power mode.");
        // TODO: Revert UI changes
      }

      this.frameCount = 0;
      this.lastFrameTime = now;
    }, 5000); // Check FPS every 5 seconds
  }

  _stopFpsCheck() {
    if (this.fpsCheckInterval) {
      clearInterval(this.fpsCheckInterval);
      this.fpsCheckInterval = null;
      this.lowPowerMode = false;
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
    console.warn("No supported MIME type found for MediaRecorder.");
    return null;
  }

  startRecording(onChunkAvailable) {
    if (!this.stream) {
      console.error("No stream available for recording.");
      return false;
    }

    const mimeType = this._getMimeType();
    if (!mimeType) return false;

    // Create a new stream from the canvas and the audio track
    const canvasStream = this.hudCanvas.captureStream(FRAME_RATE);
    const finalStream = new MediaStream();

    canvasStream.getVideoTracks().forEach(track => finalStream.addTrack(track));
    if (this.audioTrack) {
      finalStream.addTrack(this.audioTrack);
    }

    this.mediaRecorder = new MediaRecorder(finalStream, { mimeType });
    this.recordedBlobs = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedBlobs.push(event.data);
        console.log(`Video chunk available: ${event.data.size} bytes`);
        onChunkAvailable(event.data); // Callback to progressively save chunks
      } else {
        console.warn("ondataavailable event fired with no data.");
      }
    };

    this.mediaRecorder.onstop = () => {
      console.log("MediaRecorder stopped. Final recorded blobs count:", this.recordedBlobs.length);
      // The final blob will be handled by the onChunkAvailable callback for the last chunk
    };

    this.mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error);
    };

    this.mediaRecorder.start(CHUNK_DURATION_MS); // Record in 1-second chunks
    console.log("MediaRecorder started with MIME type:", mimeType, "State:", this.mediaRecorder.state);
    return true;
  }

  async stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log("Stopping MediaRecorder. Current state:", this.mediaRecorder.state);
      this.mediaRecorder.stop();
      // Wait for the last dataavailable event to fire and onstop to complete
      await new Promise(resolve => this.mediaRecorder.addEventListener('stop', resolve, { once: true }));
      console.log("Recording stopped. Total chunks collected:", this.recordedBlobs.length);
      if (this.recordedBlobs.length > 0) {
        const superBuffer = new Blob(this.recordedBlobs, { type: this.recordedBlobs[0].type });
        this.recordedBlobs = []; // Clear for next recording
        return superBuffer;
      } else {
        console.warn("No video blobs were recorded.");
        return null;
      }
    }
    console.warn("MediaRecorder not active or not initialized.");
    return null;
  }

  // This method will draw the camera feed(s) onto the HUD canvas
  // It needs to be called continuously, e.g., from LiveHUD's animation loop
  drawCameraFeedToCanvas() {
    if (!this.hudCtx || !this.cameraFeed || !this.cameraFeed.srcObject) return;

    // Clear the canvas before drawing the video frame
    this.hudCtx.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);

    // Draw main camera feed
    this.hudCtx.drawImage(this.cameraFeed, 0, 0, this.hudCanvas.width, this.hudCanvas.height);

    // If dual camera, draw PiP
    if (this.isDualCamera && this.videoTracks.length > 1) {
      const pipWidth = this.hudCanvas.width * (this.lowPowerMode ? 0.2 : 0.3);
      const pipHeight = this.hudCanvas.height * (this.lowPowerMode ? 0.2 : 0.3);
      const padding = 20;

      // Assuming the second video track is the front camera for PiP
      // This requires a separate <video> element for the PiP stream or more complex canvas drawing
      // For simplicity, let's assume cameraFeed shows the main stream, and we'd need another element for PiP
      // Or, more ideally, draw directly from the MediaStreamTrack if possible, which is not straightforward.
      // A simpler approach for dual camera on canvas is to draw two separate video elements.
      // For now, this will just draw the main feed.

      // To properly implement PiP with two distinct video streams on a single canvas for recording,
      // you would typically have two <video> elements, each playing one stream, and then draw both
      // onto the canvas. Since we only have one `cameraFeed` element, this part is simplified.
      // A more robust solution would involve creating an OffscreenCanvas for each video track
      // or managing multiple video elements and drawing them.

      // For now, let's just draw a placeholder for PiP if dual camera is active
      this.hudCtx.save();
      this.hudCtx.strokeStyle = 'var(--color-brand)';
      this.hudCtx.lineWidth = 5;
      const pipX = this.hudCanvas.width - pipWidth - padding;
      const pipY = this.hudCanvas.height - pipHeight - padding;
      this.hudCtx.strokeRect(pipX, pipY, pipWidth, pipHeight);
      this.hudCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this.hudCtx.fillRect(pipX, pipY, pipWidth, pipHeight);
      this.hudCtx.fillStyle = 'white';
      this.hudCtx.font = '20px Arial';
      this.hudCtx.textAlign = 'center';
      this.hudCtx.fillText('PiP', pipX + pipWidth / 2, pipY + pipHeight / 2);
      this.hudCtx.restore();
    }
  }
}

export default VideoComposer;
