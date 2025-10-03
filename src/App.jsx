import React, { useEffect } from 'react'
import './App.css'

// Import context and components
import { AppProvider, useAppContext } from './context/AppContext'
import ErrorBoundary from './components/ErrorBoundary'
import DataFlowManager from './components/DataFlowManager'
import LiveHUD from './components/LiveHUD'
import MapView from './components/MapView'
import CameraView from './components/CameraView'
import StatusBar from './components/StatusBar'
import ControlBar from './components/ControlBar'

// Main App component (wrapped by context)
function AppContent() {
  const {
    state,
    tripRecorder,
    actions
  } = useAppContext();

  const { mode, isLoading } = state;
  const { currentTrip } = tripRecorder;

  // Expose actions globally for StatusBar error dismissal
  useEffect(() => {
    window.appActions = actions;
    return () => {
      delete window.appActions;
    };
  }, [actions]);

  // Log mode changes in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[App] Mode changed to:', mode);
    }
  }, [mode]);

  // Log trip changes in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && currentTrip) {
      console.log('[App] Trip points:', currentTrip.points.length);
    }
  }, [currentTrip?.points.length]);

  return (
    <div className={`min-h-screen transition-colors duration-slower ease-tesla ${mode === 'camera' ? 'mode-camera' : 'mode-map'}`}>
      {/* Data Flow Manager - Invisible component managing GPS ? UI flow */}
      <DataFlowManager />

      {/* Status Bar */}
      <StatusBar className="absolute top-0 left-0 right-0 z-50" />

      {/* Main Content Area */}
      <div className="flex-1 relative w-full h-screen">
        {mode === 'camera' ? (
          <ErrorBoundary fallback={(error, reset) => (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="glass-panel p-6 rounded-xl max-w-md mx-4">
                <div className="text-center">
                  <div className="text-4xl mb-4">??</div>
                  <h2 className="text-xl font-display text-white mb-2">Camera Error</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    {error?.message || 'Failed to load camera view'}
                  </p>
                  <button onClick={reset} className="btn-secondary">
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}>
            {/* Camera View */}
            <CameraView className="absolute inset-0" />
            
            {/* Live HUD Overlay */}
            <LiveHUD 
              visible={true}
              className="absolute inset-0 pointer-events-none"
            />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary fallback={(error, reset) => (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="glass-panel p-6 rounded-xl max-w-md mx-4">
                <div className="text-center">
                  <div className="text-4xl mb-4">???</div>
                  <h2 className="text-xl font-display text-white mb-2">Map Error</h2>
                  <p className="text-sm text-gray-400 mb-4">
                    {error?.message || 'Failed to load map view'}
                  </p>
                  <button onClick={reset} className="btn-secondary">
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}>
            {/* Map View */}
            <MapView className="absolute inset-0" />
          </ErrorBoundary>
        )}
      </div>

      {/* Control Bar */}
      <ControlBar className="absolute bottom-0 left-0 right-0 z-50" />

      {/* Loading Overlay with Enhanced Styling */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
          <div className="glass-panel text-white px-8 py-6 rounded-xl text-center">
            <div className="shimmer w-12 h-12 rounded-full mx-auto mb-3 bg-brand/20"></div>
            <div className="text-sm font-display tracking-wider">Processing...</div>
          </div>
        </div>
      )}

      {/* Accessibility announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {mode && `Switched to ${mode} mode`}
        {isLoading && 'Loading, please wait'}
      </div>
    </div>
  );
}

// Main App component with Provider and Error Boundary
function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App
