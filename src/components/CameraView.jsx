/**
 * CameraView - Camera feed access and display component
 * Provides video stream access with permission handling and fallbacks
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useAppContext } from '../context/AppContext';

const CameraView = ({ className = "" }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [permission, setPermission] = useState('prompt'); // 'granted', 'denied', 'prompt'
  const [isLoading, setIsLoading] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [availableDevices, setAvailableDevices] = useState([]);

  const { actions, state } = useAppContext();

  /**
   * Get available camera devices
   */
  const getAvailableDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      setAvailableDevices(videoDevices);
      setDeviceCount(videoDevices.length);
      
      // Select back camera by default (mobile optimization)
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      
      if (backCamera && !currentDevice) {
        setCurrentDevice(backCamera.deviceId);
      } else if (videoDevices.length > 0 && !currentDevice) {
        setCurrentDevice(videoDevices[0].deviceId);
      }
      
      console.log('Available camera devices:', videoDevices.map(d => ({
        id: d.deviceId,
        label: d.label,
        kind: d.kind
      })));
      
      return videoDevices;
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      setError('Failed to access camera devices');
      return [];
    }
  }, [currentDevice]);

  /**
   * Request camera permissions and access
   */
  const requestCameraAccess = useCallback(async (deviceId = null) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = 'Camera not supported in this browser';
      setError(err);
      actions.setError(err);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Camera constraints optimized for mobile
      const constraints = {
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: deviceId ? undefined : { ideal: 'environment' }, // Back camera preferred
          deviceId: deviceId ? { exact: deviceId } : undefined
        },
        audio: false // No audio for trip recording
      };

      console.log('Requesting camera access with constraints:', constraints);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Update state
      setStream(mediaStream);
      setPermission('granted');
      actions.setCameraStream(mediaStream);
      
      // Attach to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video metadata and start playback
        videoRef.current.addEventListener('loadedmetadata', () => {
          videoRef.current.play().catch(err => {
            console.warn('Auto-play failed:', err);
          });
        });
      }

      console.log('Camera access granted:', {
        tracks: mediaStream.getVideoTracks().length,
        settings: mediaStream.getVideoTracks()[0]?.getSettings()
      });

      return mediaStream;
    } catch (err) {
      console.error('Camera access failed:', err);
      
      let errorMessage = 'Camera access failed';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied';
        setPermission('denied');
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera device found';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is in use by another application';
      } else if (err.name === 'AbortError') {
        errorMessage = 'Camera access was aborted';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Camera not supported';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints could not be satisfied';
      }
      
      setError(errorMessage);
      actions.setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [actions]);

  /**
   * Stop camera stream
   */
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped camera track:', track.kind);
      });
      setStream(null);
      actions.setCameraStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream, actions]);

  /**
   * Switch camera device
   */
  const switchCamera = useCallback(async (deviceId) => {
    stopCamera();
    setCurrentDevice(deviceId);
    await requestCameraAccess(deviceId);
  }, [stopCamera, requestCameraAccess]);

  /**
   * Check camera permission status
   */
  const checkPermissionStatus = useCallback(async () => {
    if (!navigator.permissions) return;

    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      setPermission(result.state);
      
      result.addEventListener('change', () => {
        setPermission(result.state);
        if (result.state === 'denied') {
          stopCamera();
        }
      });
    } catch (err) {
      console.warn('Could not check camera permission:', err);
    }
  }, [stopCamera]);

  // Initialize camera on mount
  useEffect(() => {
    checkPermissionStatus();
    getAvailableDevices();
  }, [checkPermissionStatus, getAvailableDevices]);

  // Auto-start camera if in camera mode
  useEffect(() => {
    if (state.mode === 'camera' && permission === 'granted' && !stream && !isLoading) {
      requestCameraAccess(currentDevice);
    }
  }, [state.mode, permission, stream, isLoading, currentDevice, requestCameraAccess]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Handle video element events
  const handleVideoPlay = useCallback(() => {
    console.log('Camera video playback started');
  }, []);

  const handleVideoError = useCallback((e) => {
    console.error('Video element error:', e);
    setError('Video playback failed');
  }, []);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Video element for camera feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        playsInline
        muted
        onPlay={handleVideoPlay}
        onError={handleVideoError}
        style={{
          transform: 'scaleX(-1)', // Mirror front camera (more natural for users)
          filter: stream ? 'none' : 'blur(2px)'
        }}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-white text-center">
            <div className="text-4xl mb-2">??</div>
            <div>Starting Camera...</div>
            <div className="text-sm opacity-75 mt-1">
              Please grant camera permission
            </div>
          </div>
        </div>
      )}
      
      {/* Error state */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-white text-center max-w-sm px-4">
            <div className="text-4xl mb-4">??</div>
            <div className="text-lg mb-2">Camera Error</div>
            <div className="text-sm opacity-75 mb-4">{error}</div>
            
            {permission === 'denied' ? (
              <div className="text-xs opacity-60">
                Please enable camera access in your browser settings and refresh the page
              </div>
            ) : (
              <button 
                onClick={() => requestCameraAccess(currentDevice)}
                className="btn-primary"
                disabled={isLoading}
              >
                Retry Camera
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* No camera state */}
      {!stream && !error && !isLoading && permission === 'prompt' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-white text-center max-w-sm px-4">
            <div className="text-6xl mb-4">??</div>
            <div className="text-lg mb-2">Camera Access Required</div>
            <div className="text-sm opacity-75 mb-4">
              Grant camera permission to start recording your trip with live overlay
            </div>
            <button 
              onClick={() => requestCameraAccess(currentDevice)}
              className="btn-primary"
              disabled={isLoading}
            >
              Enable Camera
            </button>
          </div>
        </div>
      )}
      
      {/* Camera controls overlay */}
      {stream && availableDevices.length > 1 && (
        <div className="absolute top-4 right-4 z-10">
          <select
            value={currentDevice || ''}
            onChange={(e) => switchCamera(e.target.value)}
            className="bg-black/70 text-white text-xs px-2 py-1 rounded border border-gray-600"
          >
            {availableDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Camera info overlay */}
      {stream && (
        <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-md text-sm">
          <div>Camera Active</div>
          <div className="text-xs opacity-75">
            {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight}
          </div>
        </div>
      )}

      {/* Accessibility */}
      <div className="sr-only" role="region" aria-label="Camera view">
        {stream ? (
          <div>
            Camera is active and showing live video feed.
            Video resolution: {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight}
          </div>
        ) : error ? (
          <div>Camera error: {error}</div>
        ) : isLoading ? (
          <div>Camera is loading...</div>
        ) : (
          <div>Camera access is required to use this feature</div>
        )}
      </div>
    </div>
  );
};

export default CameraView;