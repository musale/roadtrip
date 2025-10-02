/**
 * LiveHUD - Real-time trip stats overlay component for mobile PWA
 * 
 * High-performance canvas-based HUD that renders speed, time, distance
 * with optional heading and audio VU meter. Optimized for mobile devices
 * with DPR scaling and 60fps rendering.
 * 
 * Usage:
 *   const hud = new LiveHUD({ showHeading: true, showVU: true });
 *   hud.attach(canvasElement);
 *   hud.start();
 *   hud.update({ speedKph: 25.5, elapsedMs: 60000, distanceM: 1200 });
 */

// Formatting utility functions
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function formatTime(elapsedMs) {
  if (!elapsedMs || elapsedMs < 0) return '00:00:00';
  
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function kmStr(distanceM) {
  if (!distanceM || distanceM < 0) return '0.00';
  const km = distanceM / 1000;
  return km.toFixed(2);
}

function compassFromDegrees(degrees) {
  if (typeof degrees !== 'number' || degrees < 0) return 'N';
  
  const normalized = degrees % 360;
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

/**
 * LiveHUD Component Class
 * Renders real-time trip statistics on a canvas overlay
 */
class LiveHUD {
  constructor(opts = {}) {
    // Configuration with mobile-optimized defaults
    this.width = opts.width || window.innerWidth;
    this.height = opts.height || window.innerHeight;
    this.dpr = opts.dpr || window.devicePixelRatio || 1;
    this.showHeading = opts.showHeading || false;
    this.showVU = opts.showVU || false;
    
    // Theme colors optimized for overlay visibility
    this.theme = {
      fg: '#ffffff',
      shadow: '#000000',
      accent: '#00ff88',
      danger: '#ff4444',
      warning: '#ffaa00',
      ...opts.theme
    };
    
    // Canvas and rendering context
    this.canvas = null;
    this.ctx = null;
    
    // Animation and state management
    this.isRunning = false;
    this.animationId = null;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    
    // Trip data state
    this.data = {
      speedKph: 0,
      elapsedMs: 0,
      distanceM: 0,
      headingDeg: 0,
      vuLevel: 0
    };
    
    // Smooth VU level for audio meter animation
    this.smoothVU = 0;
    this.vuDecay = 0.85;
    
    // Background compositing source
    this.backgroundSrc = null;
    
    // Pre-computed layout and fonts (performance optimization)
    this.layout = null;
    this.fonts = null;
    
    // Initialize pre-computed values
    this._initializeFonts();
    this._setupResizeHandler();
  }
  
  /**
   * Pre-compute font configurations to avoid allocations in render loop
   */
  _initializeFonts() {
    const baseSize = Math.min(this.width, this.height) / 20;
    const scaleFactor = this.dpr;
    
    this.fonts = {
      speedLarge: `bold ${Math.round(baseSize * 2.5 * scaleFactor)}px system-ui, -apple-system, sans-serif`,
      medium: `bold ${Math.round(baseSize * 1.2 * scaleFactor)}px system-ui, -apple-system, sans-serif`,
      small: `bold ${Math.round(baseSize * 0.8 * scaleFactor)}px system-ui, -apple-system, sans-serif`,
      label: `${Math.round(baseSize * 0.6 * scaleFactor)}px system-ui, -apple-system, sans-serif`
    };
  }
  
  /**
   * Calculate responsive layout positions
   */
  _calculateLayout() {
    const margin = Math.min(this.width, this.height) * 0.05;
    const safeMargin = margin * this.dpr;
    const lineHeight = Math.min(this.width, this.height) * 0.08 * this.dpr;
    
    this.layout = {
      margin: safeMargin,
      lineHeight,
      // Left column - main stats
      speed: { 
        x: safeMargin, 
        y: safeMargin * 2 
      },
      time: { 
        x: safeMargin, 
        y: safeMargin * 2 + lineHeight * 1.8 
      },
      distance: { 
        x: safeMargin, 
        y: safeMargin * 2 + lineHeight * 3.2 
      },
      // Right side - heading
      heading: { 
        x: this.width * this.dpr - safeMargin, 
        y: safeMargin * 2 
      },
      // Bottom - VU meter
      vu: { 
        x: safeMargin, 
        y: this.height * this.dpr - safeMargin * 3,
        width: Math.min(this.width * 0.4, 200) * this.dpr,
        height: 16 * this.dpr
      }
    };
  }
  
  /**
   * Handle window resize to maintain responsive layout
   */
  _setupResizeHandler() {
    const handleResize = () => {
      if (this.canvas) {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this._initializeFonts();
        this._resizeCanvas();
      }
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 100); // Delay for orientation change
    });
  }
  
  /**
   * Resize canvas to match current viewport
   */
  _resizeCanvas() {
    if (!this.canvas) return;
    
    // Update canvas size
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    
    // Reset context and scale for DPR
    this.ctx.scale(this.dpr, this.dpr);
    this.ctx.textBaseline = 'top';
    this.ctx.imageSmoothingEnabled = false;
    
    // Recalculate layout
    this._calculateLayout();
  }
  
  /**
   * Attach HUD to a canvas element
   * @param {HTMLCanvasElement} canvasEl - Target canvas element
   */
  attach(canvasEl) {
    if (!canvasEl || !(canvasEl instanceof HTMLCanvasElement)) {
      throw new Error('LiveHUD.attach() requires a valid HTMLCanvasElement');
    }
    
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d', { 
      alpha: true,
      desynchronized: true // Better performance on some devices
    });
    
    this._resizeCanvas();
  }
  
  /**
   * Start HUD rendering loop
   */
  start() {
    if (this.isRunning || !this.canvas) return;
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this._scheduleFrame();
  }
  
  /**
   * Stop HUD rendering loop
   */
  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  /**
   * Update trip data
   * @param {Object} newData - Trip data object
   * @param {number} [newData.speedKph] - Speed in km/h
   * @param {number} [newData.elapsedMs] - Elapsed time in milliseconds
   * @param {number} [newData.distanceM] - Distance in meters
   * @param {number} [newData.headingDeg] - Heading in degrees (0-360)
   * @param {number} [newData.vuLevel] - Audio VU level (0-1)
   */
  update(newData) {
    // Validate and update speed
    if (typeof newData.speedKph === 'number' && !isNaN(newData.speedKph)) {
      this.data.speedKph = Math.max(0, newData.speedKph);
    }
    
    // Validate and update elapsed time
    if (typeof newData.elapsedMs === 'number' && !isNaN(newData.elapsedMs)) {
      this.data.elapsedMs = Math.max(0, newData.elapsedMs);
    }
    
    // Validate and update distance
    if (typeof newData.distanceM === 'number' && !isNaN(newData.distanceM)) {
      this.data.distanceM = Math.max(0, newData.distanceM);
    }
    
    // Validate and update heading
    if (typeof newData.headingDeg === 'number' && !isNaN(newData.headingDeg)) {
      this.data.headingDeg = newData.headingDeg % 360;
    }
    
    // Validate and update VU level with smoothing
    if (typeof newData.vuLevel === 'number' && !isNaN(newData.vuLevel)) {
      const clampedVU = clamp(newData.vuLevel, 0, 1);
      this.smoothVU = this.vuDecay * this.smoothVU + (1 - this.vuDecay) * clampedVU;
    }
  }
  
  /**
   * Set background source for compositing
   * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} src - Background source
   */
  drawBackgroundFrame(src) {
    this.backgroundSrc = src;
  }
  
  /**
   * Schedule next animation frame
   * @private
   */
  _scheduleFrame() {
    if (!this.isRunning) return;
    
    this.animationId = requestAnimationFrame((timestamp) => {
      this._renderFrame(timestamp);
      this._scheduleFrame();
    });
  }
  
  /**
   * Render single frame
   * @private
   */
  _renderFrame(timestamp) {
    if (!this.ctx) return;
    
    const deltaTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    this.frameCount++;
    
    // Clear canvas
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background if provided (compositing mode)
    if (this.backgroundSrc) {
      try {
        this.ctx.drawImage(this.backgroundSrc, 0, 0, this.canvas.width, this.canvas.height);
      } catch (e) {
        // Silently handle invalid background source
      }
    }
    
    this.ctx.restore();
    
    // Set up text shadow for legibility
    this.ctx.shadowColor = this.theme.shadow;
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;
    
    // Render HUD elements
    this._renderSpeed();
    this._renderTime();
    this._renderDistance();
    
    if (this.showHeading) {
      this._renderHeading();
    }
    
    if (this.showVU) {
      this._renderVUMeter();
    }
    
    // Clear shadow for next frame
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
  }
  
  /**
   * Render speed display
   * @private
   */
  _renderSpeed() {
    const speed = round1(this.data.speedKph);
    const speedText = `${speed.toFixed(1)}`;
    const unitText = 'km/h';
    
    // Speed value in accent color
    this.ctx.fillStyle = this.theme.accent;
    this.ctx.font = this.fonts.speedLarge;
    this.ctx.fillText(speedText, this.layout.speed.x, this.layout.speed.y);
    
    // Get text width for unit positioning
    const speedWidth = this.ctx.measureText(speedText).width;
    
    // Speed unit
    this.ctx.fillStyle = this.theme.fg;
    this.ctx.font = this.fonts.small;
    this.ctx.fillText(unitText, this.layout.speed.x + speedWidth + 10, this.layout.speed.y + 20);
    
    // Speed label
    this.ctx.font = this.fonts.label;
    this.ctx.fillText('SPEED', this.layout.speed.x, this.layout.speed.y - 20);
  }
  
  /**
   * Render elapsed time
   * @private
   */
  _renderTime() {
    const timeText = formatTime(this.data.elapsedMs);
    
    this.ctx.fillStyle = this.theme.fg;
    this.ctx.font = this.fonts.medium;
    this.ctx.fillText(timeText, this.layout.time.x, this.layout.time.y);
    
    // Time label
    this.ctx.font = this.fonts.label;
    this.ctx.fillText('TIME', this.layout.time.x, this.layout.time.y - 20);
  }
  
  /**
   * Render distance traveled
   * @private
   */
  _renderDistance() {
    const distanceText = `${kmStr(this.data.distanceM)} km`;
    
    this.ctx.fillStyle = this.theme.fg;
    this.ctx.font = this.fonts.medium;
    this.ctx.fillText(distanceText, this.layout.distance.x, this.layout.distance.y);
    
    // Distance label
    this.ctx.font = this.fonts.label;
    this.ctx.fillText('DISTANCE', this.layout.distance.x, this.layout.distance.y - 20);
  }
  
  /**
   * Render heading/compass display
   * @private
   */
  _renderHeading() {
    const compass = compassFromDegrees(this.data.headingDeg);
    const degrees = Math.round(this.data.headingDeg);
    const headingText = `${compass} ${degrees.toString().padStart(3, '0')}°`;
    
    this.ctx.fillStyle = this.theme.accent;
    this.ctx.font = this.fonts.medium;
    this.ctx.textAlign = 'right';
    this.ctx.fillText(headingText, this.layout.heading.x, this.layout.heading.y);
    
    // Heading label
    this.ctx.fillStyle = this.theme.fg;
    this.ctx.font = this.fonts.label;
    this.ctx.fillText('HEADING', this.layout.heading.x, this.layout.heading.y - 20);
    
    // Reset text alignment
    this.ctx.textAlign = 'left';
  }
  
  /**
   * Render audio VU meter
   * @private
   */
  _renderVUMeter() {
    const vu = this.layout.vu;
    const level = this.smoothVU;
    
    // VU meter background
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.fillRect(vu.x, vu.y, vu.width, vu.height);
    
    // VU meter level with gradient
    if (level > 0) {
      const levelWidth = vu.width * level;
      const gradient = this.ctx.createLinearGradient(vu.x, 0, vu.x + vu.width, 0);
      gradient.addColorStop(0, this.theme.accent);
      gradient.addColorStop(0.7, this.theme.warning);
      gradient.addColorStop(1, this.theme.danger);
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(vu.x, vu.y, levelWidth, vu.height);
    }
    
    // VU meter border
    this.ctx.strokeStyle = this.theme.fg;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(vu.x, vu.y, vu.width, vu.height);
    
    // VU label
    this.ctx.fillStyle = this.theme.fg;
    this.ctx.font = this.fonts.label;
    this.ctx.fillText('AUDIO', vu.x, vu.y - 20);
  }
  
  /**
   * Get current performance statistics
   * @returns {Object} Performance stats
   */
  getPerformanceStats() {
    return {
      isRunning: this.isRunning,
      frameCount: this.frameCount,
      dpr: this.dpr,
      canvasSize: this.canvas ? `${this.canvas.width}x${this.canvas.height}` : 'unattached',
      displaySize: `${this.width}x${this.height}`,
      hasBackground: !!this.backgroundSrc
    };
  }
}

export default LiveHUD;

/*
Example usage for MediaRecorder integration:

import LiveHUD from './LiveHUD.js';

const hud = new LiveHUD({ 
  showHeading: true, 
  showVU: true 
});
const canvas = document.querySelector('#hudCanvas');
hud.attach(canvas);
hud.start();

// For recording with MediaRecorder:
const stream = canvas.captureStream(30);
const recorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9'
});

// Update with real GPS/sensor data:
hud.update({
  speedKph: gpsSpeed,
  elapsedMs: Date.now() - startTime,
  distanceM: totalDistance,
  headingDeg: gpsHeading,
  vuLevel: audioAnalyser.getByteFrequencyData()[0] / 255
});

// For camera compositing:
const video = document.querySelector('#cameraFeed');
function render() {
  hud.drawBackgroundFrame(video);
  requestAnimationFrame(render);
}
render();
*/