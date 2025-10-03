/**
 * ErrorBoundary - React error boundary component
 * Catches JavaScript errors anywhere in the component tree and displays fallback UI
 */

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Log to external error tracking service if configured
    if (window.errorTracker) {
      window.errorTracker.logError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorCount } = this.state;
      const { fallback } = this.props;

      // Custom fallback if provided
      if (fallback) {
        return fallback(error, this.handleReset);
      }

      // Default fallback UI with glassmorphism styling
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full p-6 rounded-xl animate-fade-in-up">
            {/* Error Icon */}
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">??</div>
              <h1 className="text-2xl font-display text-white mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-400 text-sm">
                The application encountered an unexpected error
              </p>
            </div>

            {/* Error Details (Development mode) */}
            {process.env.NODE_ENV === 'development' && error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                <h2 className="text-sm font-display text-red-300 mb-2 uppercase tracking-wider">
                  Error Details
                </h2>
                <div className="text-xs font-mono text-red-200 mb-2">
                  {error.toString()}
                </div>
                {errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-300 cursor-pointer hover:text-red-200">
                      Stack Trace
                    </summary>
                    <pre className="mt-2 text-xs text-red-200 overflow-auto max-h-48 p-2 bg-black/30 rounded">
                      {errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Error Count Warning */}
            {errorCount > 1 && (
              <div className="mb-6 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                <p className="text-xs text-yellow-200">
                  ?? This error has occurred {errorCount} times. Consider reloading the page.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="btn-secondary px-6 py-3"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="btn-primary px-6 py-3"
              >
                Reload App
              </button>
            </div>

            {/* Help Text */}
            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-xs text-gray-400 mb-2">
                If this problem persists, try:
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Clearing your browser cache</li>
                <li>• Checking your internet connection</li>
                <li>• Updating your browser</li>
                <li>• Disabling browser extensions</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;