// src/js/Share.js

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
    alert('Video data is not available.');
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
      alert('Could not share video. It will be downloaded instead.');
      downloadBlob(blob, filename);
    }
  }
}

/**
 * Composites a map image with trip stats and shares it.
 * @param {object} options
 * @param {maplibregl.Map} options.map The MapLibre GL map instance.
 * @param {object} options.trip The trip data object.
 */
export async function shareSummaryImage({ map, trip }) {
  console.log('shareSummaryImage called with:', { map, trip });
  if (!map || !trip) {
    alert('Map or trip data is missing.');
    console.error('Map or trip data is missing.', { map, trip });
    return;
  }

  // Ensure map is fully rendered before capture
  if (map.areTilesLoaded() === false) {
    console.log('Map not idle, waiting...');
    map.once('idle', () => shareSummaryImage({ map, trip }));
    return;
  }
   // If map container is hidden, it might have 0 dimensions. Resize it.
  const mapCanvas = map.getCanvas();
  if (mapCanvas.clientHeight === 0) {
    map.resize();
  }

  console.log('Map is ready, capturing canvas...');
  const mapDataUrl = map.getCanvas().toDataURL('image/png');
  const img = new Image();
  img.src = mapDataUrl;
  await img.decode();

  const W = 1200, H = 628, pad = 48, mapH = H * 0.65;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // Background
  ctx.fillStyle = '#18181B'; // A dark, neutral color
  ctx.fillRect(0, 0, W, H);

  // Draw Map Image
  ctx.drawImage(img, pad, pad, W - pad * 2, mapH - pad);

  // --- Draw Stats ---
  const statsY = mapH + pad + 20;
  ctx.fillStyle = '#E0E0E0';
  ctx.font = 'bold 48px "Orbitron", system-ui, sans-serif';
  ctx.fillText(trip.title || 'Trip Summary', pad, statsY);

  ctx.fillStyle = '#C0C0C0';
  ctx.font = '24px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(new Date(trip.date).toLocaleDateString(), pad, statsY + 40);

  ctx.font = '32px "IBM Plex Sans", system-ui, sans-serif';

  const s = trip.stats;
  const distanceKm = (s.distanceM / 1000).toFixed(2);
  const avgKph = s.avgKph.toFixed(1);
  const duration = new Date(s.durationMs).toISOString().substr(11, 8);

  ctx.fillText(`${distanceKm} km`, pad, statsY + 90);
  ctx.fillText(`${avgKph} kph avg`, pad + 250, statsY + 90);
  ctx.fillText(duration, pad + 550, statsY + 90);

  if (trip.driveType) {
    ctx.font = 'italic 28px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillStyle = '#909090';
    ctx.fillText(`Drive Type: ${trip.driveType}`, pad, statsY + 140);
  }

  // --- Draw Elevation Sparkline ---
  const elevations = trip.points.map(p => p.alt).filter(alt => alt !== null && alt !== undefined);
  if (elevations.length > 1) {
    const sparklineX = W - 300 - pad;
    const sparklineY = statsY + 20;
    const sparklineW = 300;
    const sparklineH = 100;
    const sparklinePadding = 10;

    // Draw sparkline background
    ctx.fillStyle = '#28282B';
    ctx.fillRect(sparklineX, sparklineY, sparklineW, sparklineH);

    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);

    ctx.strokeStyle = '#00BFFF'; // Deep Sky Blue
    ctx.lineWidth = 3;
    ctx.beginPath();

    const getSparklineX = (index) => sparklineX + sparklinePadding + (index / (elevations.length - 1)) * (sparklineW - 2 * sparklinePadding);
    const getSparklineY = (elevation) => {
      const normalizedElevation = (elevation - minEle) / (maxEle - minEle);
      return sparklineY + sparklineH - sparklinePadding - normalizedElevation * (sparklineH - 2 * sparklinePadding);
    };

    ctx.moveTo(getSparklineX(0), getSparklineY(elevations[0]));
    elevations.forEach((ele, index) => {
      ctx.lineTo(getSparklineX(index), getSparklineY(ele));
    });
    ctx.stroke();

    // Add min/max elevation text
    ctx.fillStyle = '#E0E0E0';
    ctx.font = '18px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillText(`Min: ${minEle.toFixed(0)}m`, sparklineX + sparklinePadding, sparklineY + sparklineH - 5);
    ctx.fillText(`Max: ${maxEle.toFixed(0)}m`, sparklineX + sparklineW - ctx.measureText(`Max: ${maxEle.toFixed(0)}m`).width - sparklinePadding, sparklineY + sparklineH - 5);
  }

  // Convert to blob and share
  const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.92));
  const file = new File([blob], 'roadtrip-summary.jpg', { type: 'image/jpeg' });

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'My RoadTrip Summary',
      });
      console.log('Summary image shared successfully.');
    } else {
      downloadBlob(blob, 'roadtrip-summary.jpg');
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error sharing image:', error);
      alert('Could not share image. It will be downloaded instead.');
      downloadBlob(blob, 'roadtrip-summary.jpg');
    }
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
      alert('Could not retrieve video file.');
    }
  }, 500);

  shareImageOption.onclick = debounce(() => {
    toggleMenu(false);
    shareSummaryImage({ map: summaryMap, trip });
  }, 500);

  // Make the button visible now that it's configured
  shareBtn.classList.remove('hidden');
}
