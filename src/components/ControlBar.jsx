/**
 * ControlBar - Main control interface component with glassmorphism
 * Provides mode switching, recording controls, and additional actions
 */

import React from 'react';
import { useAppContext } from '../context/AppContext';
import Button from './ui/Button';

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
    <div className={`glass-panel backdrop-blur-xl ${className}`}>
      {/* Main Control Row */}
      <div className="px-4 py-4 animate-fade-in-up">
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
                <span className="text-lg">???</span>
                <span className="hidden sm:inline font-display">Map</span>
              </>
            ) : (
              <>
                <span className="text-lg">??</span>
                <span className="hidden sm:inline font-display">Camera</span>
              </>
            )}
          </Button>

          {/* Record Button (Primary Action) with Enhanced Styling */}
          <Button
            variant={isRecording ? 'danger' : 'primary'}
            size="lg"
            onClick={handleRecordToggle}
            disabled={!isGPSAvailable || isLoading}
            loading={isLoading}
            ariaLabel={isRecording ? 'Stop recording' : 'Start recording'}
            className={`${isRecording ? 'btn-recording' : ''} relative overflow-hidden`}
          >
            {isLoading ? (
              <span className="text-lg">?</span>
            ) : isRecording ? (
              <>
                <span className="text-lg">??</span>
                <span className="font-display">Stop</span>
              </>
            ) : (
              <>
                <span className="text-lg">??</span>
                <span className="font-display">Record</span>
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
              <span className="text-lg">??</span>
              <span className="hidden sm:inline font-display">Fit</span>
            </Button>
          ) : (
            <div className="w-16 sm:w-20"> {/* Spacer for layout consistency */}
            </div>
          )}
        </div>
      </div>

      {/* Trip Statistics Bar with Neon Accents (Shown when recording) */}
      {isRecording && (
        <div className="px-4 pb-4 border-t border-white/10">
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 pt-4">
            {/* Speed Stat */}
            <div className="text-center group">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-display">Speed</div>
              <div className="relative inline-block">
                <div className="font-display text-lg md:text-xl text-brand drop-shadow-[0_0_8px_rgba(0,245,212,0.5)]
                               group-hover:scale-110 transition-transform duration-med">
                  {utils.formatSpeed(stats.currentSpeedKph)}
                  <span className="text-xs text-gray-400 ml-1">km/h</span>
                </div>
              </div>
            </div>

            {/* Distance Stat */}
            <div className="text-center group">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-display">Distance</div>
              <div className="relative inline-block">
                <div className="font-display text-lg md:text-xl text-brand drop-shadow-[0_0_8px_rgba(0,245,212,0.5)]
                               group-hover:scale-110 transition-transform duration-med">
                  {utils.formatDistance(stats.distanceMeters)}
                  <span className="text-xs text-gray-400 ml-1">km</span>
                </div>
              </div>
            </div>

            {/* Time Stat */}
            <div className="text-center group">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-display">Time</div>
              <div className="relative inline-block">
                <div className="font-display text-lg md:text-xl text-brand drop-shadow-[0_0_8px_rgba(0,245,212,0.5)]
                               group-hover:scale-110 transition-transform duration-med">
                  {utils.formatDuration(stats.durationMs)}
                </div>
              </div>
            </div>

            {/* Max Speed (Desktop or when available) */}
            {stats.maxSpeedKph > 0 && (
              <div className="text-center group hidden md:block">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 font-display">Max</div>
                <div className="relative inline-block">
                  <div className="font-display text-lg md:text-xl text-accent drop-shadow-[0_0_8px_rgba(255,27,155,0.5)]
                                 group-hover:scale-110 transition-transform duration-med">
                    {utils.formatSpeed(stats.maxSpeedKph)}
                    <span className="text-xs text-gray-400 ml-1">km/h</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Actions (Development/Testing mode) with Enhanced Styling */}
      {currentTrip && currentTrip.points.length > 0 && process.env.NODE_ENV === 'development' && (
        <div className="px-4 pb-4 border-t border-white/10">
          <div className="flex gap-2 justify-center pt-3">
            <button 
              onClick={() => handleExport('download-gpx')}
              className="text-xs bg-blue-600/80 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg 
                         transition-all duration-fast border border-blue-500/30
                         hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            >
              ?? GPX
            </button>
            <button 
              onClick={() => handleExport('download-geojson')}
              className="text-xs bg-green-600/80 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg 
                         transition-all duration-fast border border-green-500/30
                         hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
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
              className="text-xs bg-purple-600/80 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg 
                         transition-all duration-fast border border-purple-500/30
                         hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]"
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