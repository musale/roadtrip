/**
 * Deployment Configuration
 * Environment-specific settings for production deployment
 */

const deploymentConfig = {
  // Environment configurations
  environments: {
    development: {
      baseUrl: 'http://localhost:3000',
      apiUrl: 'http://localhost:3000/api',
      debug: true,
      serviceWorker: true,
      analytics: false,
    },
    staging: {
      baseUrl: 'https://staging.roadtrip.app',
      apiUrl: 'https://staging.roadtrip.app/api',
      debug: true,
      serviceWorker: true,
      analytics: true,
    },
    production: {
      baseUrl: 'https://roadtrip.app',
      apiUrl: 'https://api.roadtrip.app',
      debug: false,
      serviceWorker: true,
      analytics: true,
    },
  },

  // Build configurations
  build: {
    outputDir: 'dist',
    assetsDir: 'assets',
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
    cssCodeSplit: true,
    reportCompressedSize: true,
  },

  // PWA configurations
  pwa: {
    name: 'RoadTrip GPS Tracker',
    shortName: 'RoadTrip',
    description: 'Mobile-first GPS trip recording with live HUD overlay and real-time map visualization',
    themeColor: '#00f5d4', // Neon cyan
    backgroundColor: '#0d0d0d', // Dark background
    display: 'standalone',
    orientation: 'portrait-primary',
    scope: '/',
    startUrl: '/',
    registerType: 'autoUpdate',
    
    // Cache strategies
    cacheStrategies: {
      pages: 'NetworkFirst',
      images: 'CacheFirst',
      styles: 'StaleWhileRevalidate',
      scripts: 'StaleWhileRevalidate',
      mapTiles: 'CacheFirst',
    },
    
    // Offline configuration
    offline: {
      enabled: true,
      fallbackPage: '/offline.html',
      precache: [
        '/',
        '/index.html',
        '/manifest.webmanifest',
      ],
    },
  },

  // Performance monitoring
  performance: {
    enabled: true,
    reportInterval: 30000, // 30 seconds
    trackRenders: true,
    trackGPS: true,
    trackMemory: true,
    warnSlowRenders: true,
    slowRenderThreshold: 16, // ms (below 60fps)
  },

  // Feature flags
  features: {
    wakeLock: true,
    geolocation: true,
    camera: true,
    mapView: true,
    exportGPX: true,
    exportGeoJSON: true,
    performanceMonitoring: process.env.NODE_ENV === 'development',
  },

  // Error tracking (placeholder for Sentry/etc)
  errorTracking: {
    enabled: process.env.NODE_ENV === 'production',
    dsn: process.env.VITE_SENTRY_DSN || '',
    environment: process.env.NODE_ENV,
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
  },

  // Analytics (placeholder for GA/etc)
  analytics: {
    enabled: process.env.NODE_ENV === 'production',
    trackingId: process.env.VITE_GA_TRACKING_ID || '',
    anonymizeIp: true,
    debug: process.env.NODE_ENV === 'development',
  },

  // GPS configuration
  gps: {
    highAccuracy: true,
    timeout: 10000,
    maximumAge: 1000,
    accuracyThreshold: 50, // meters
    updateInterval: 1000, // ms
  },

  // Storage configuration
  storage: {
    prefix: 'roadtrip_',
    version: '1.0',
    maxTrips: 100,
    maxTripSize: 10000, // points
    autoCleanup: true,
  },

  // Map configuration
  map: {
    style: 'https://demotiles.maplibre.org/style.json',
    center: [36.8219, -1.2921], // Nairobi
    zoom: 14,
    minZoom: 8,
    maxZoom: 18,
    followModeZoom: 16,
    trackColor: '#00f5d4', // Neon cyan
    trackWidth: 4,
    markerColor: '#ff1b9b', // Neon magenta
  },

  // Camera configuration
  camera: {
    facingMode: 'environment', // Back camera by default
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  },

  // UI configuration
  ui: {
    theme: 'dark',
    animations: true,
    hapticFeedback: true,
    toastDuration: 3000,
    loadingDelay: 300,
  },
};

/**
 * Get current environment configuration
 */
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  return deploymentConfig.environments[env] || deploymentConfig.environments.development;
}

/**
 * Get full deployment configuration
 */
export function getDeploymentConfig() {
  return {
    ...deploymentConfig,
    environment: getEnvironmentConfig(),
  };
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(featureName) {
  return deploymentConfig.features[featureName] ?? false;
}

/**
 * Get configuration value by path
 */
export function getConfig(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], deploymentConfig);
}

// Export default config
export default deploymentConfig;

// Expose to window for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.deploymentConfig = deploymentConfig;
  console.log('[Config] Deployment configuration available at window.deploymentConfig');
}