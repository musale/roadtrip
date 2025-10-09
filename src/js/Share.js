// src/js/Share.js

import maplibregl from 'maplibre-gl';
import { showNotification } from './Notifications.js';

const SHARE_CANVAS_WIDTH = 1200;
const SHARE_CANVAS_HEIGHT = 628;
const MAP_PORTION_RATIO = 0.62;
const SHARE_CANVAS_PADDING = 48;
const MIN_ROUTE_DISTANCE_METERS = 200; // ~0.2 km minimum before sharing

const MAP_CAPTURE_WIDTH = SHARE_CANVAS_WIDTH;
const MAP_CAPTURE_HEIGHT = Math.round(SHARE_CANVAS_HEIGHT * MAP_PORTION_RATIO);

const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export const SHARE_MAP_STYLE_URL = MAP_STYLE_URL;

/**
 * Debounces a function to prevent it from being called too frequently.
 * @param {Function} func The function to debounce.
 * @param {number} wait The debounce delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Triggers a browser download for a given Blob.
 * @param {Blob} blob The data to download.
 * @param {string} filename The name of the file.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log(`Fallback: Downloading ${filename}`);
}

/**
 * Shares a video file using the Web Share API, with a download fallback.
 * @param {Blob} blob The video blob to share.
 * @param {string} filename The desired filename.
 */
export async function shareVideo(blob, filename) {
  if (!blob) {
    showNotification('Video data is not available.', { variant: 'error' });
    return;
  }
  const file = new File([blob], filename, { type: blob.type || 'video/mp4' });

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'RoadTrip Video',
        text: 'A video of my latest drive recorded with RoadTrip.',
      });
      console.log('Video shared successfully.');
    } else {
      downloadBlob(blob, filename);
    }
  } catch (error) {
    console.error('Error sharing video:', error);
    // If the user cancels the share, it's not an error we need to show.
    if (error.name !== 'AbortError') {
      showNotification('Could not share video. It will be downloaded instead.', { variant: 'error' });
      downloadBlob(blob, filename);
    }
  }
}


function formatDuration(durationMs = 0) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '00:00:00';
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function kmFromMeters(distanceM = 0) {
  if (!Number.isFinite(distanceM)) return '0.00';
  return (distanceM / 1000).toFixed(2);
}

function getDistanceMeters(trip) {
  if (Number.isFinite(trip?.stats?.distanceM)) {
    return trip.stats.distanceM;
  }
  const pts = Array.isArray(trip?.points) ? trip.points : [];
  if (pts.length < 2) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const dLat = toRad(curr.lat - prev.lat);
    const dLon = toRad(curr.lon - prev.lon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(prev.lat)) * Math.cos(toRad(curr.lat)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return total;
}

function kph(value = 0) {
  if (!Number.isFinite(value)) return '0.0';
  return value.toFixed(1);
}

async function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas could not be converted to a blob.'));
      }
    }, type, quality);
  });
}

async function captureMapImage({ map, trip }) {
  try {
    return await renderOffscreenMap(trip);
  } catch (error) {
    console.warn('Offscreen map capture failed, attempting to reuse existing map canvas.', error);
    if (map?.getCanvas) {
      try {
        if (map.areTilesLoaded?.() === false) {
          await new Promise((resolve) => map.once('idle', resolve));
        }
        const existingCanvas = map.getCanvas();
        if (existingCanvas?.width === 0 || existingCanvas?.height === 0) {
          map.resize();
        }
        return existingCanvas.toDataURL('image/png');
      } catch (fallbackError) {
        console.error('Fallback map capture failed.', fallbackError);
      }
    }
    throw error;
  }
}

async function renderOffscreenMap(trip) {
  if (!trip?.points?.length) {
    throw new Error('Trip does not contain any GPS points.');
  }

  const coords = trip.points.map((p) => [p.lon, p.lat]);
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${MAP_CAPTURE_WIDTH}px`;
  container.style.height = `${MAP_CAPTURE_HEIGHT}px`;
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  document.body.appendChild(container);

  const mapInstance = new maplibregl.Map({
    container,
    style: MAP_STYLE_URL,
    interactive: false,
    attributionControl: false,
    preserveDrawingBuffer: true,
    fadeDuration: 0,
    pitchWithRotate: false,
    dragPan: false,
    keyboard: false,
    scrollZoom: false,
    boxZoom: false,
    doubleClickZoom: false,
    touchPitch: false,
    touchZoomRotate: false,
    renderWorldCopies: false,
  });

  const mapReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Map did not become idle in time.')), 15000);
    const cleanup = () => {
      clearTimeout(timeout);
      mapInstance.off('error', errorHandler);
    };
    const errorHandler = (event) => {
      cleanup();
      reject(event?.error ?? new Error('Unknown map error.'));
    };
    mapInstance.on('error', errorHandler);

    mapInstance.on('load', () => {
      const routeSourceId = 'share-route';
      mapInstance.addSource(routeSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
        },
      });

      mapInstance.addLayer({
        id: 'share-route-line',
        type: 'line',
        source: routeSourceId,
        paint: {
          'line-color': '#0ea5e9',
          'line-width': 6,
          'line-opacity': 0.85,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });

      if (coords.length >= 2) {
        const bounds = new maplibregl.LngLatBounds();
        coords.forEach((coord) => bounds.extend(coord));
        mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 0 });
      } else {
        mapInstance.setCenter(coords[0]);
        mapInstance.setZoom(14);
      }

      mapInstance.once('idle', () => {
        cleanup();
        resolve();
      });
    });
  });

  try {
    await mapReady;
    const dataUrl = mapInstance.getCanvas().toDataURL('image/png');
    return dataUrl;
  } finally {
    mapInstance.remove();
    container.remove();
  }
}

async function loadImageFromDataUrl(dataUrl) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return img;
}

function createFallbackMapCanvas(trip) {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_CAPTURE_WIDTH;
  canvas.height = MAP_CAPTURE_HEIGHT;

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#111c33');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const points = Array.isArray(trip?.points) ? trip.points : [];
  if (points.length < 2) {
    return canvas;
  }

  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);

  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const lonRange = Math.max(maxLon - minLon, 0.00001);
  const latRange = Math.max(maxLat - minLat, 0.00001);

  const padding = Math.min(canvas.width, canvas.height) * 0.14;
  const scale = Math.min(
    (canvas.width - padding * 2) / lonRange,
    (canvas.height - padding * 2) / latRange,
  );

  const offsetX = (canvas.width - scale * lonRange) / 2;
  const offsetY = (canvas.height - scale * latRange) / 2;

  const project = (lon, lat) => ({
    x: offsetX + (lon - minLon) * scale,
    y: canvas.height - (offsetY + (lat - minLat) * scale),
  });

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)';
  ctx.shadowColor = 'rgba(14, 165, 233, 0.35)';
  ctx.shadowBlur = 18;

  ctx.beginPath();
  const start = project(points[0].lon, points[0].lat);
  ctx.moveTo(start.x, start.y);
  for (let i = 1; i < points.length; i += 1) {
    const projected = project(points[i].lon, points[i].lat);
    ctx.lineTo(projected.x, projected.y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  const drawMarker = (point, color) => {
    const pos = project(point.lon, point.lat);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1120';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  drawMarker(points[0], '#10b981');
  drawMarker(points[points.length - 1], '#ef4444');

  return canvas;
}

function drawSparkline(ctx, elevations, { x, y, width, height }) {
  if (!Array.isArray(elevations) || elevations.length < 2) return;
  const sparklinePadding = 12;
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const range = maxEle - minEle || 1;

  ctx.fillStyle = '#232327';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, 12);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 3;
  ctx.beginPath();

  const usableWidth = width - sparklinePadding * 2;
  const usableHeight = height - sparklinePadding * 2;

  const getX = (index) => x + sparklinePadding + (index / (elevations.length - 1)) * usableWidth;
  const getY = (ele) => {
    const normalized = (ele - minEle) / range;
    return y + height - sparklinePadding - normalized * usableHeight;
  };

  ctx.moveTo(getX(0), getY(elevations[0]));
  elevations.forEach((ele, index) => {
    ctx.lineTo(getX(index), getY(ele));
  });
  ctx.stroke();

  ctx.fillStyle = '#cbd5f5';
  ctx.font = '18px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(`Min ${minEle.toFixed(0)}m`, x + sparklinePadding, y + height - 10);
  const maxLabel = `Max ${maxEle.toFixed(0)}m`;
  ctx.fillText(maxLabel, x + width - sparklinePadding - ctx.measureText(maxLabel).width, y + height - 10);
}

function getTripDate(trip) {
  const raw = trip?.startedAt ?? trip?.date ?? trip?.endedAt ?? Date.now();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function copyImageToClipboard(blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch (error) {
    console.warn('Clipboard write failed for summary image.', error);
    return false;
  }
}

function buildShareFilename(trip) {
  const timestamp = new Date(trip?.endedAt ?? trip?.startedAt ?? Date.now())
    .toISOString()
    .replace(/[:.]/g, '-');
  const base = trip?.title ?? trip?.driveType ?? 'roadtrip';
  const slug = String(base).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'roadtrip';
  return `${slug}-${timestamp}-summary.png`;
}

function composeSummaryCanvas(mapImage, trip) {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_CANVAS_WIDTH;
  canvas.height = SHARE_CANVAS_HEIGHT;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#09090f';
  ctx.fillRect(0, 0, SHARE_CANVAS_WIDTH, SHARE_CANVAS_HEIGHT);

  const mapHeight = Math.round(SHARE_CANVAS_HEIGHT * MAP_PORTION_RATIO);
  const mapWidth = SHARE_CANVAS_WIDTH - SHARE_CANVAS_PADDING * 2;
  const mapX = SHARE_CANVAS_PADDING;
  const mapY = SHARE_CANVAS_PADDING;

  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 24;
  ctx.drawImage(mapImage, mapX, mapY, mapWidth, mapHeight - SHARE_CANVAS_PADDING);
  ctx.shadowBlur = 0;

  const statsBaseY = mapY + mapHeight + 20;
  const title = trip?.title || trip?.name || 'Trip Summary';
  const subtitle = getTripDate(trip);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 48px "Orbitron", system-ui, sans-serif';
  ctx.fillText(title, SHARE_CANVAS_PADDING, statsBaseY);

  if (subtitle) {
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '24px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillText(subtitle, SHARE_CANVAS_PADDING, statsBaseY + 34);
  }

  const stats = trip?.stats ?? {};
  const distanceText = `${kmFromMeters(stats.distanceM)} km`; // Always kms for share asset
  const avgSpeedText = `${kph(stats.avgKph)} kph avg`;
  const maxSpeedText = `${kph(stats.maxKph)} kph max`;
  const durationText = formatDuration(stats.durationMs);

  const statBlocks = [
    { label: 'Distance', value: distanceText },
    { label: 'Duration', value: durationText },
    { label: 'Avg Speed', value: avgSpeedText },
    { label: 'Max Speed', value: maxSpeedText },
  ];

  const statBlockWidth = (SHARE_CANVAS_WIDTH - SHARE_CANVAS_PADDING * 2 - 60) / statBlocks.length;
  const statBlockHeight = 120;
  ctx.font = '24px "IBM Plex Sans", system-ui, sans-serif';

  statBlocks.forEach((block, index) => {
    const blockX = SHARE_CANVAS_PADDING + index * (statBlockWidth + 20);
    const blockY = statsBaseY + 50;
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(blockX, blockY, statBlockWidth, statBlockHeight, 18);
    } else {
      ctx.rect(blockX, blockY, statBlockWidth, statBlockHeight);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillText(block.label.toUpperCase(), blockX + 24, blockY + 32);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '36px "Orbitron", system-ui, sans-serif';
    ctx.fillText(block.value, blockX + 24, blockY + 82);
  });

  if (trip?.driveType) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'italic 26px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillText(`Drive type: ${trip.driveType}`, SHARE_CANVAS_PADDING, SHARE_CANVAS_HEIGHT - SHARE_CANVAS_PADDING);
  }

  const elevations = trip?.points?.map((p) => p.alt).filter((alt) => alt !== null && alt !== undefined) ?? [];
  if (elevations.length > 1) {
    drawSparkline(ctx, elevations, {
      x: SHARE_CANVAS_WIDTH - SHARE_CANVAS_PADDING - 320,
      y: SHARE_CANVAS_HEIGHT - SHARE_CANVAS_PADDING - 130,
      width: 320,
      height: 110,
    });
  }

  return canvas;
}

/**
 * Composites a map image with trip stats and shares it.
 * @param {object} options
 * @param {maplibregl.Map} [options.map] Optional existing map instance.
 * @param {object} options.trip The trip data object.
 */
export async function shareSummaryImage({ map, trip }) {
  console.log('shareSummaryImage requested', { hasMap: !!map, tripId: trip?.id });

  try {
    if (!trip) {
      throw new Error('Trip data is missing.');
    }

    if (!Array.isArray(trip.points) || trip.points.length < 2) {
  showNotification('Trip is too short to share. Record a little longer until we have a full route.', { variant: 'error' });
      return;
    }

    const distanceMeters = getDistanceMeters(trip);
    if (distanceMeters < MIN_ROUTE_DISTANCE_METERS) {
      const kmNeeded = (MIN_ROUTE_DISTANCE_METERS / 1000).toFixed(2);
      const kmRecorded = (distanceMeters / 1000).toFixed(2);
  showNotification(`Trip too short to share (${kmRecorded} km). Record at least ${kmNeeded} km to generate a summary image.`, { variant: 'error' });
      return;
    }

    let mapSource;
    try {
      const mapDataUrl = await captureMapImage({ map, trip });
      mapSource = await loadImageFromDataUrl(mapDataUrl);
    } catch (mapError) {
      console.warn('Map capture failed, using fallback canvas rendering.', mapError);
      mapSource = createFallbackMapCanvas(trip);
    }

    const composedCanvas = composeSummaryCanvas(mapSource, trip);
    const blob = await canvasToBlob(composedCanvas, 'image/png');
    const filename = buildShareFilename(trip);

    const clipboardCopied = await copyImageToClipboard(blob);
    let shared = false;

    const file = new File([blob], filename, { type: blob.type });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'My RoadTrip Summary',
          text: 'Highlights from my recent drive captured with RoadTrip.',
        });
        shared = true;
  showNotification(`Shared summary image${clipboardCopied ? ' and copied to clipboard' : ''}.`, { variant: 'success' });
      } catch (error) {
        if (error.name === 'AbortError') {
          console.info('User canceled share dialog. Falling back to download.');
        } else {
          console.error('Error sharing image.', error);
          showNotification('Sharing failed. The image was downloaded instead.', { variant: 'error' });
        }
      }
    }

    if (!shared) {
      downloadBlob(blob, filename);
      if (clipboardCopied) {
  showNotification('Summary image downloaded and copied to clipboard.', { variant: 'success' });
      } else {
  showNotification('Summary image downloaded. Clipboard copy may not be supported.', { variant: 'info' });
      }
    }
  } catch (error) {
    console.error('shareSummaryImage failed:', error);
  showNotification(error?.message ?? 'Could not generate summary image.', { variant: 'error' });
  }
}

/**
 * Initializes the share button and its menu in the trip summary view.
 * @param {object} trip The trip data.
 * @param {maplibregl.Map} summaryMap The map instance.
 * @param {Function} getVideoBlob A function to retrieve the video blob.
 */
export function initShareButton(trip, summaryMap, getVideoBlob) {
  const shareBtn = document.getElementById('shareTripSummaryBtn');
  const shareMenu = document.getElementById('shareMenu');
  const shareVideoOption = document.getElementById('shareVideoOption');
  const shareImageOption = document.getElementById('shareImageOption');

  if (!shareBtn || !shareMenu || !shareVideoOption || !shareImageOption) {
    console.error('Share UI elements not found.');
    return;
  }

  // Show/hide video option based on availability
  const hasVideo = !!trip.videoFilename;
  shareVideoOption.style.display = hasVideo ? 'block' : 'none';

  // --- Event Listeners ---
  const toggleMenu = (show) => {
    shareMenu.classList.toggle('hidden', !show);
  };

  shareBtn.onclick = (e) => {
    e.stopPropagation();
    toggleMenu(shareMenu.classList.contains('hidden'));
  };

  // Hide menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!shareMenu.contains(e.target)) {
      toggleMenu(false);
    }
  }, { once: true });


  shareVideoOption.onclick = debounce(async () => {
    toggleMenu(false);
    const videoBlob = await getVideoBlob(trip);
    if (videoBlob) {
      shareVideo(videoBlob, trip.videoFilename);
    } else {
  showNotification('Could not retrieve video file.', { variant: 'error' });
    }
  }, 500);

  shareImageOption.onclick = debounce(() => {
    toggleMenu(false);
    shareSummaryImage({ map: summaryMap, trip });
  }, 500);

  // Make the button visible now that it's configured
  shareBtn.classList.remove('hidden');
}
