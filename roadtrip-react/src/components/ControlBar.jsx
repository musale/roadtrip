/**
 * ControlBar - Main control interface component
 * Provides mode switching, recording controls, and additional actions
 */

import React from 'react';
import { useAppContext } from '../context/AppContext';
import Button from './ui/Button';
import IconButton from './ui/IconButton';

const ControlBar = ({ className = '' }) => {
  const {
    state,
    tripRecorder,
    actions,
    utils
  } = useAppContext();

  const { mode, isLoading } = state;
  const { isRecording, currentTrip, stats } = tripRecorder;

  // Handle recording toggle
  const handleRecordToggle = async () => {
    try {
      if (isRecording) {
        await actions.stopRecording();
      } else {
        await actions.startRecording();
      }
    } catch (err) {
      console.error('Recording toggle failed:', err);
    }
  };

  // Handle mode switching
  const handleModeSwitch = () => {
    const newMode = mode === 'camera' ? 'map' : 'camera';
    actions.setMode(newMode);
  };

  // Handle fit bounds (map mode)
  const handleFitBounds = () => {
    if (window.roadtripMapFitBounds) {
      window.roadtripMapFitBounds();
    }
  };

  // Handle export
  const handleExport = (format) => {
    try {
      if (format === 'download-gpx') {
        actions.downloadTrip('gpx');
      } else if (format === 'download-geojson') {
        actions.downloadTrip('geojson');
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Check if GPS is available
  const isGPSAvailable = state.gpsStatus.supported && !state.gpsStatus.error;

  return (
    <div className={`bg-black/50 text-white ${className}`}>
      {/* Main Control Row */}
      <div className="px-4 py-3">
        <div className="flex justify-between items-center gap-3">
          {/* Mode Toggle Button */}
          <Button
            variant="secondary"
            size="md"
            onClick={handleModeSwitch}
            disabled={isLoading}
            ariaLabel={`Switch to ${mode === 'camera' ? 'map' : 'camera'} mode`}
          >
            {mode === 'camera' ? (
              <>
                <span>???</span>
                <span className="hidden sm:inline">Map</span>
              </>
            ) : (
              <>
                <span>??</span>
                <span className="hidden sm:inline">Camera</span>
              </>
            )}
          </Button>

          {/* Record Button (Primary Action) */}
          <Button
            variant={isRecording ? 'danger' : 'primary'}
            size="lg"
            onClick={handleRecordToggle}
            disabled={!isGPSAvailable || isLoading}
            loading={isLoading}
            ariaLabel={isRecording ? 'Stop recording' : 'Start recording'}
            className={isRecording ? 'animate-pulse' : ''}
          >
            {isLoading ? (
              <span>?</span>
            ) : isRecording ? (
              <>
                <span>??</span>
                <span>Stop</span>
              </>
            ) : (
              <>
                <span>??</span>
                <span>Record</span>
              </>
            )}
          </Button>

          {/* Mode-Specific Actions */}
          {mode === 'map' ? (
            <Button
              variant="secondary"
              size="md"
              onClick={handleFitBounds}
              disabled={!currentTrip || currentTrip.points.length === 0}
              ariaLabel="Fit map to trip bounds"
            >
              <span>??</span>
              <span className="hidden sm:inline">Fit</span>
            </Button>
          ) : (
            <div className="w-16 sm:w-20"> {/* Spacer for layout consistency */}
            </div>
          )}
        </div>
      </div>

      {/* Trip Statistics Bar (Shown when recording) */}
      {isRecording && (
        <div className="px-4 pb-3 border-t border-white/10">
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 pt-3">
            {/* Speed */}
            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Speed</div>
              <div className="font-display text-base md:text-lg text-brand">
                {utils.formatSpeed(stats.currentSpeedKph)}
                <span className="text-xs text-gray-400 ml-1">km/h</span>
              </div>
            </div>

            {/* Distance */}
            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Distance</div>
              <div className="font-display text-base md:text-lg text-brand">
                {utils.formatDistance(stats.distanceMeters)}
                <span className="text-xs text-gray-400 ml-1">km</span>
              </div>
            </div>

            {/* Time */}
            <div className="text-center">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Time</div>
              <div className="font-display text-base md:text-lg text-brand">
                {utils.formatDuration(stats.durationMs)}
              </div>
            </div>

            {/* Max Speed (Desktop only or when available) */}
            {stats.maxSpeedKph > 0 && (
              <div className="text-center hidden md:block">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Max</div>
                <div className="font-display text-base md:text-lg text-accent">
                  {utils.formatSpeed(stats.maxSpeedKph)}
                  <span className="text-xs text-gray-400 ml-1">km/h</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Actions (Development/Testing mode) */}
      {currentTrip && currentTrip.points.length > 0 && process.env.NODE_ENV === 'development' && (
        <div className="px-4 pb-3 border-t border-white/10">
          <div className="flex gap-2 justify-center pt-3">
            <button 
              onClick={() => handleExport('download-gpx')}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition"
            >
              ?? GPX
            </button>
            <button 
              onClick={() => handleExport('download-geojson')}
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition"
            >
              ?? GeoJSON
            </button>
            <button 
              onClick={() => {
                try {
                  const gpx = actions.exportTrip('gpx');
                  console.log('GPX Export:', gpx.substring(0, 200) + '...');
                } catch (err) {
                  console.error('GPX Export Error:', err);
                }
              }}
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 transition"
            >
              ?? Test
            </button>
          </div>
        </div>
      )}

      {/* Accessibility Announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isRecording && (
          `Recording trip. Current speed ${utils.formatSpeed(stats.currentSpeedKph)} kilometers per hour. ` +
          `Distance ${utils.formatDistance(stats.distanceMeters)} kilometers. ` +
          `Time ${utils.formatDuration(stats.durationMs)}.`
        )}
      </div>
    </div>
  );
};

export default ControlBar;