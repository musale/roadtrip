// src/VideoComposer.js

import { writeVideoToOpfs, addVideoChunk } from './storage/db.js';

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const FRAME_RATE = 30;
const CHUNK_DURATION_MS = 1000; // 1 second chunks

class VideoComposer {
  constructor() {
    this.cameraFeed = document.getElementById('videoFeed');
    this.mediaRecorder = null;
    this.recordedBlobs = [];
    this.stream = null;
    this.audioTrack = null;
    this.videoTracks = [];
    this.recordingInterval = null;
    this.isDualCamera = false;
    this.facingMode = 'environment';
    this.isUserFacing = false; // New property to track if user-facing camera is active

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

  async _getMediaStream(videoConstraints, audioConstraints = { echoCancellation: true, noiseSuppression: true }) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: audioConstraints });
    } catch (error) {
      console.error("Error getting media stream with constraints:", videoConstraints, error);
      return null;
    }
  }

  async startSingle({ facing = 'environment' }) {
    this.facingMode = facing;
    this.isUserFacing = (facing === 'user');

    let stream = null;
    let videoConstraints = {};

    // Attempt 1: Ideal facing mode
    videoConstraints = { facingMode: { ideal: facing }, width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
    stream = await this._getMediaStream(videoConstraints);

    // Attempt 2: If environment, try to find a specific back camera by label
    if (!stream && facing === 'environment') {
      const cameras = await this.listCameras();
      const rearCamera = cameras.find(camera =>
        camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('rear')
      );
      if (rearCamera) {
        videoConstraints = { deviceId: { exact: rearCamera.deviceId }, width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
        stream = await this._getMediaStream(videoConstraints);
      }
    }

    // Attempt 3: Fallback to any camera with the specified facing mode
    if (!stream) {
      videoConstraints = { facingMode: facing, width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
      stream = await this._getMediaStream(videoConstraints);
    }

    // Attempt 4: Fallback to any available camera
    if (!stream) {
      videoConstraints = { width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
      stream = await this._getMediaStream(videoConstraints);
      // If we got here, we don't know the facing mode for sure, but assume it's not user for mirroring
      this.isUserFacing = false;
    }

    if (stream) {
      this.stream = stream;
      this.cameraFeed.srcObject = this.stream;
      this.videoTracks = this.stream.getVideoTracks();
      this.audioTrack = this.stream.getAudioTracks()[0];
      this.isDualCamera = false;
      this._startFpsCheck();
      return true;
    } else {
      console.error("Failed to get any camera stream.");
      return false;
    }
  }

  async startDual() {
    let backCameraStream = null;
    let frontCameraStream = null;

    // Try to get environment camera (back)
    const backVideoConstraints = { facingMode: { ideal: 'environment' }, width: VIDEO_WIDTH, height: VIDEO_HEIGHT };
    backCameraStream = await this._getMediaStream(backVideoConstraints);

    if (!backCameraStream) {
      const cameras = await this.listCameras();
      const rearCamera = cameras.find(camera =>
        camera.label.toLowerCase().includes('back') || camera.label.toLowerCase().includes('rear')
      );
      if (rearCamera) {
        backCameraStream = await this._getMediaStream({ deviceId: { exact: rearCamera.deviceId }, width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
      }
    }

    if (!backCameraStream) {
      backCameraStream = await this._getMediaStream({ facingMode: 'environment', width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
    }

    // Try to get user camera (front)
    const frontVideoConstraints = { facingMode: { ideal: 'user' }, width: VIDEO_WIDTH / 2, height: VIDEO_HEIGHT / 2 };
    frontCameraStream = await this._getMediaStream(frontVideoConstraints, false); // No audio for front camera

    if (!frontCameraStream) {
      frontCameraStream = await this._getMediaStream({ facingMode: 'user', width: VIDEO_WIDTH / 2, height: VIDEO_HEIGHT / 2 }, false);
    }

    // If both streams are successful, combine them
    if (backCameraStream && frontCameraStream) {
      this.stream = new MediaStream();
      backCameraStream.getVideoTracks().forEach(track => this.stream.addTrack(track));
      frontCameraStream.getVideoTracks().forEach(track => this.stream.addTrack(track));
      this.audioTrack = backCameraStream.getAudioTracks()[0];
      if (this.audioTrack) {
        this.stream.addTrack(this.audioTrack);
      }

      this.cameraFeed.srcObject = this.stream;
      this.videoTracks = this.stream.getVideoTracks();
      this.isDualCamera = true;
      this.isUserFacing = false; // Main stream is environment camera
      this._startFpsCheck();
      return true;
    } else {
      console.warn("Could not start dual camera, falling back to single.");
      // Fallback to single camera if dual fails
      if (backCameraStream) {
        backCameraStream.getTracks().forEach(track => track.stop());
      }
      if (frontCameraStream) {
        frontCameraStream.getTracks().forEach(track => track.stop());
      }
      return this.startSingle({ facing: this.facingMode });
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.cameraFeed.srcObject = null;
      this.videoTracks = [];
      this.audioTrack = null;
      this.isDualCamera = false;
      this.isUserFacing = false; // Reset on stop
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
}

export default VideoComposer;
