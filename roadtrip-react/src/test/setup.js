/**
 * Vitest Setup File
 * Configures test environment and global utilities
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(() => 1),
  clearWatch: vi.fn(),
};

Object.defineProperty(global.navigator, 'geolocation', {
  writable: true,
  value: mockGeolocation,
});

// Mock navigator.permissions
Object.defineProperty(global.navigator, 'permissions', {
  writable: true,
  value: {
    query: vi.fn(() => Promise.resolve({ state: 'granted' })),
  },
});

// Mock wake lock
Object.defineProperty(global.navigator, 'wakeLock', {
  writable: true,
  value: {
    request: vi.fn(() => Promise.resolve({
      release: vi.fn(() => Promise.resolve()),
    })),
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: localStorageMock,
});

// Mock getUserMedia for camera tests
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn(() => Promise.resolve({
      getTracks: () => [{
        kind: 'video',
        stop: vi.fn(),
      }],
    })),
    enumerateDevices: vi.fn(() => Promise.resolve([
      { kind: 'videoinput', deviceId: 'camera1', label: 'Front Camera' },
      { kind: 'videoinput', deviceId: 'camera2', label: 'Back Camera' },
    ])),
  },
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 16); // ~60fps
  return 1;
});

global.cancelAnimationFrame = vi.fn();

// Export mocks for use in tests
export { mockGeolocation, localStorageMock };