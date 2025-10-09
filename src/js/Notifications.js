const DEFAULT_DURATION_MS = 4200;
const CONTAINER_ID = 'appToastContainer';

function ensureContainer() {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Shows a transient notification toast near the top of the viewport.
 * @param {string} message
 * @param {{variant?: 'info'|'success'|'error', durationMs?: number}} [options]
 */
export function showNotification(message, { variant = 'info', durationMs = DEFAULT_DURATION_MS } = {}) {
  if (!message) {
    return;
  }
  const container = ensureContainer();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.variant = variant;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => {
      toast.remove();
      if (!container.hasChildNodes()) {
        container.remove();
      }
    }, { once: true });
  }, durationMs);
}

export function showError(message, options = {}) {
  showNotification(message, { variant: 'error', ...options });
}

export function showSuccess(message, options = {}) {
  showNotification(message, { variant: 'success', ...options });
}

export function showInfo(message, options = {}) {
  showNotification(message, { variant: 'info', ...options });
}
