// src/LiveHUD.js

class LiveHUD {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
    this.hudAriaElement = document.getElementById('hud-aria');

    // Default HUD values
    this.speedKph = 0;
    this.elapsedMs = 0;
    this.distanceM = 0;
    this.headingDeg = 0;

    // Colors from CSS variables
    this.brandColor = '#00F5D4'; // Default
    this.textColor = '#E0E0E0'; // Default
    this.bgColor = 'rgba(13, 13, 13, 0.5)'; // Default with transparency

    this._readCssVariables();
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener(
      'change', this._handleReducedMotionChange.bind(this)
    );
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  _readCssVariables() {
    const style = getComputedStyle(document.documentElement);
    this.brandColor = style.getPropertyValue('--color-brand').trim() || this.brandColor;
    this.textColor = style.getPropertyValue('--color-text-primary').trim() || this.textColor;
    this.bgColor = style.getPropertyValue('--color-bg').trim() || this.bgColor;
  }

  _handleReducedMotionChange(event) {
    this.prefersReducedMotion = event.matches;
    // Re-render or adjust animations if necessary
  }

  attach(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._resizeCanvas();
    window.addEventListener('resize', this._resizeCanvas.bind(this));
  }

  _resizeCanvas() {
    if (!this.canvas) return;
    // Internal resolution 1280x720, then scale with DPR
    const internalWidth = 1280;
    const internalHeight = 720;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.width = internalWidth * dpr;
    this.canvas.height = internalHeight * dpr;
    this.ctx.scale(dpr, dpr);

    // Store internal dimensions for drawing calculations
    this.internalWidth = internalWidth;
    this.internalHeight = internalHeight;
  }

  start() {
    if (!this.canvas || !this.ctx) {
      console.error("HUD canvas not attached.");
      return;
    }
    this.animationFrameId = requestAnimationFrame(this._draw.bind(this));
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  update({ speedKph, elapsedMs, distanceM, headingDeg }) {
    this.speedKph = speedKph !== undefined ? speedKph : this.speedKph;
    this.elapsedMs = elapsedMs !== undefined ? elapsedMs : this.elapsedMs;
    this.distanceM = distanceM !== undefined ? distanceM : this.distanceM;
    this.headingDeg = headingDeg !== undefined ? headingDeg : this.headingDeg;

    this._mirrorToAria();
  }

  _mirrorToAria() {
    if (this.hudAriaElement) {
      const speed = this.speedKph.toFixed(1);
      const distance = (this.distanceM / 1000).toFixed(2);
      const time = new Date(this.elapsedMs).toISOString().substr(11, 8);
      this.hudAriaElement.textContent = `Speed: ${speed} kilometers per hour, Distance: ${distance} kilometers, Time: ${time}, Heading: ${this.headingDeg.toFixed(0)} degrees.`;
    }
  }

  drawBackgroundFrame(videoEl) {
    if (!this.ctx || !videoEl) return;

    // Clear the canvas
    this.ctx.clearRect(0, 0, this.internalWidth, this.internalHeight);

    // Draw the video frame
    this.ctx.drawImage(videoEl, 0, 0, this.internalWidth, this.internalHeight);
  }

  _draw() {
    if (!this.ctx) return;

    // Clear previous HUD elements (assuming drawBackgroundFrame handles the full clear)
    // If not drawing video, clear the whole canvas here.

    this.ctx.save();

    // Apply neon glow effect (optional, based on prefers-reduced-motion)
    if (!this.prefersReducedMotion) {
      this.ctx.shadowColor = this.brandColor;
      this.ctx.shadowBlur = 15;
    }

    this.ctx.fillStyle = this.brandColor;
    this.ctx.strokeStyle = this.brandColor;
    this.ctx.lineWidth = 2;
    this.ctx.textBaseline = 'top'; // Ensure consistent text baseline

    // Speed
    this.ctx.font = 'bold 80px monospace';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${this.speedKph.toFixed(0)}`, Math.floor(this.internalWidth - 40), Math.floor(100));
    this.ctx.font = '30px monospace';
    this.ctx.fillText('KPH', Math.floor(this.internalWidth - 40), Math.floor(140));

    // Distance
    this.ctx.font = 'bold 40px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`DIST: ${(this.distanceM / 1000).toFixed(2)}`, Math.floor(40), Math.floor(100));
    this.ctx.font = '25px monospace'; // Smaller font for KM
    this.ctx.fillText('KM', Math.floor(40), Math.floor(135)); // Position KM below the value

    // Elapsed Time
    const timeStr = new Date(this.elapsedMs).toISOString().substr(11, 8);
    this.ctx.fillText(`TIME: ${timeStr}`, Math.floor(40), Math.floor(150));

    // Heading (simple compass)
    this.ctx.font = 'bold 40px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`HDG: ${this.headingDeg.toFixed(0)}°`, Math.floor(this.internalWidth / 2), Math.floor(80));

    // Draw a simple heading indicator
    this.ctx.beginPath();
    this.ctx.arc(Math.floor(this.internalWidth / 2), Math.floor(150), 30, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.beginPath();
    const angle = (this.headingDeg - 90) * Math.PI / 180; // Adjust for canvas 0deg being right
    const arrowLength = 25;
    const centerX = Math.floor(this.internalWidth / 2);
    const centerY = Math.floor(150);
    this.ctx.moveTo(centerX, centerY);
    this.ctx.lineTo(centerX + arrowLength * Math.cos(angle), centerY + arrowLength * Math.sin(angle));
    this.ctx.stroke();

    this.ctx.restore();

    this.animationFrameId = requestAnimationFrame(this._draw.bind(this));
  }
}

export default LiveHUD;
