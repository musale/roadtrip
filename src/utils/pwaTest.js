/**
 * PWA Test Utilities
 * Helper functions for testing PWA functionality
 */

/**
 * Check if service worker is registered and active
 */
export async function checkServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return {
      supported: false,
      message: 'Service Workers not supported',
    };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      return {
        supported: true,
        registered: false,
        message: 'Service Worker not registered',
      };
    }

    return {
      supported: true,
      registered: true,
      active: !!registration.active,
      installing: !!registration.installing,
      waiting: !!registration.waiting,
      scope: registration.scope,
      updateFound: !!registration.waiting,
      registration,
    };
  } catch (error) {
    return {
      supported: true,
      error: true,
      message: error.message,
    };
  }
}

/**
 * Check if app is running as PWA (installed)
 */
export function isPWA() {
  // Check if running in standalone mode (iOS)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Check if running as PWA (Android)
  const isPWAMode = window.navigator.standalone === true;
  
  // Check via display mode
  const displayMode = window.matchMedia('(display-mode: standalone)').matches ||
                      window.matchMedia('(display-mode: fullscreen)').matches ||
                      window.matchMedia('(display-mode: minimal-ui)').matches;
  
  return {
    isPWA: isStandalone || isPWAMode || displayMode,
    standalone: isStandalone,
    displayMode: displayMode ? 'standalone' : 'browser',
  };
}

/**
 * Check PWA installation prompt availability
 */
export function checkInstallPrompt() {
  let deferredPrompt = null;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  
  return {
    canInstall: () => !!deferredPrompt,
    prompt: async () => {
      if (!deferredPrompt) {
        throw new Error('Install prompt not available');
      }
      
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      
      return outcome === 'accepted';
    },
  };
}

/**
 * Test offline functionality
 */
export async function testOfflineMode() {
  const wasOnline = navigator.onLine;
  
  return {
    currentlyOnline: wasOnline,
    canDetectOffline: 'onLine' in navigator,
    listeners: {
      online: () => window.addEventListener('online', () => console.log('[PWA] Back online')),
      offline: () => window.addEventListener('offline', () => console.log('[PWA] Gone offline')),
    },
  };
}

/**
 * Check cache storage
 */
export async function checkCacheStorage() {
  if (!('caches' in window)) {
    return {
      supported: false,
      message: 'Cache Storage not supported',
    };
  }

  try {
    const cacheNames = await caches.keys();
    const cacheInfo = await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        return {
          name,
          entries: keys.length,
          urls: keys.map(req => req.url),
        };
      })
    );

    const totalEntries = cacheInfo.reduce((sum, cache) => sum + cache.entries, 0);

    return {
      supported: true,
      cacheNames,
      cacheInfo,
      totalCaches: cacheNames.length,
      totalEntries,
    };
  } catch (error) {
    return {
      supported: true,
      error: true,
      message: error.message,
    };
  }
}

/**
 * Test manifest file
 */
export async function checkManifest() {
  try {
    const response = await fetch('/manifest.webmanifest');
    if (!response.ok) {
      throw new Error(`Manifest not found: ${response.status}`);
    }
    
    const manifest = await response.json();
    
    return {
      available: true,
      manifest,
      name: manifest.name,
      shortName: manifest.short_name,
      icons: manifest.icons?.length || 0,
      startUrl: manifest.start_url,
      display: manifest.display,
      themeColor: manifest.theme_color,
    };
  } catch (error) {
    return {
      available: false,
      error: true,
      message: error.message,
    };
  }
}

/**
 * Comprehensive PWA check
 */
export async function runPWADiagnostics() {
  console.group('[PWA] Running diagnostics...');
  
  const results = {
    timestamp: new Date().toISOString(),
    serviceWorker: await checkServiceWorker(),
    pwaMode: isPWA(),
    offlineSupport: await testOfflineMode(),
    cacheStorage: await checkCacheStorage(),
    manifest: await checkManifest(),
  };
  
  console.log('Service Worker:', results.serviceWorker);
  console.log('PWA Mode:', results.pwaMode);
  console.log('Offline Support:', results.offlineSupport);
  console.log('Cache Storage:', results.cacheStorage);
  console.log('Manifest:', results.manifest);
  
  console.groupEnd();
  
  return results;
}

/**
 * Log PWA events
 */
export function monitorPWAEvents() {
  // Service Worker events
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] Service Worker controller changed');
    });
    
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('[PWA] Message from Service Worker:', event.data);
    });
  }
  
  // Install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] Install prompt available');
  });
  
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
  });
  
  // Online/Offline
  window.addEventListener('online', () => {
    console.log('[PWA] Network: Online');
  });
  
  window.addEventListener('offline', () => {
    console.log('[PWA] Network: Offline');
  });
  
  console.log('[PWA] Event monitoring active');
}

// Expose to window for manual testing
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.PWATest = {
    checkServiceWorker,
    isPWA,
    checkInstallPrompt,
    testOfflineMode,
    checkCacheStorage,
    checkManifest,
    runPWADiagnostics,
    monitorPWAEvents,
  };
  
  console.log('[PWA] Test utilities available at window.PWATest');
}