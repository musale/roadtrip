// src/LiveHUD.js

class LiveHUD {
  constructor({ hudSpeed, hudDistance, hudTime, speedUnit = 'MPH' }) {
    this.hudSpeedElement = hudSpeed;
    this.hudDistanceElement = hudDistance;
    this.hudTimeElement = hudTime;
    this.speedUnit = speedUnit;

    // Default HUD values
    this.speedKph = 0;
    this.elapsedMs = 0;
    this.distanceM = 0;
    this.headingDeg = 0;
  }

  setSpeedUnit(unit) {
    this.speedUnit = unit;
    this._updateDomElements(); // Update immediately when unit changes
  }

  start() {
    // No specific start logic needed for DOM updates, but keeping for consistency with app.js
  }

  stop() {
    // No specific stop logic needed for DOM updates, but keeping for consistency with app.js
    this.hudSpeedElement.textContent = `0.0 ${this.speedUnit}`;
    this.hudDistanceElement.textContent = `0.0 ${this.speedUnit === 'MPH' ? 'MI' : 'KM'}`;
    this.hudTimeElement.textContent = '00:00:00';
  }

  update({ speedKph, elapsedMs, distanceM, headingDeg }) {
    this.speedKph = speedKph !== undefined ? speedKph : this.speedKph;
    this.elapsedMs = elapsedMs !== undefined ? elapsedMs : this.elapsedMs;
    this.distanceM = distanceM !== undefined ? distanceM : this.distanceM;
    this.headingDeg = headingDeg !== undefined ? headingDeg : this.headingDeg;

    this._updateDomElements();
  }

  _updateDomElements() {
    let displaySpeed;
    let displayDistance;
    let speedLabel;
    let distanceLabel;

    if (this.speedUnit === 'MPH') {
      displaySpeed = (this.speedKph * 0.621371).toFixed(1);
      displayDistance = (this.distanceM * 0.000621371).toFixed(1);
      speedLabel = 'MPH';
      distanceLabel = 'MI';
    } else { // KPH
      displaySpeed = this.speedKph.toFixed(1);
      displayDistance = (this.distanceM / 1000).toFixed(1);
      speedLabel = 'KPH';
      distanceLabel = 'KM';
    }

    const timeStr = new Date(this.elapsedMs).toISOString().substr(11, 8);

    if (this.hudSpeedElement) {
      this.hudSpeedElement.textContent = `${displaySpeed} ${speedLabel}`;
    }
    if (this.hudDistanceElement) {
      this.hudDistanceElement.textContent = `${displayDistance} ${distanceLabel}`;
    }
    if (this.hudTimeElement) {
      this.hudTimeElement.textContent = `${timeStr}`;
    }
  }
}

export default LiveHUD;
