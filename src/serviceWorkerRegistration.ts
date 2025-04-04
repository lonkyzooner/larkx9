/**
 * Service worker registration for improved performance and offline support
 */

// Check if service workers are supported
const isServiceWorkerSupported = 'serviceWorker' in navigator;

/**
 * Register the service worker
 */
export function registerServiceWorker() {
  if (isServiceWorkerSupported) {
    window.addEventListener('load', () => {
      const swUrl = `${window.location.origin}/service-worker.js`;
      
      navigator.serviceWorker.register(swUrl)
        .then(registration => {
          console.log('ServiceWorker registration successful with scope:', registration.scope);
          
          // Check for updates on page load
          registration.update();
          
          // Set up update detection
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) {
              return;
            }
            
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New content is available; notify the user
                  console.log('New content is available; please refresh.');
                  
                  // Dispatch event to notify the app about the update
                  window.dispatchEvent(new CustomEvent('serviceWorkerUpdated'));
                } else {
                  // Content is cached for offline use
                  console.log('Content is cached for offline use.');
                }
              }
            };
          };
        })
        .catch(error => {
          console.error('Error during service worker registration:', error);
        });
    });
  }
}

/**
 * Unregister all service workers
 */
export function unregisterServiceWorker() {
  if (isServiceWorkerSupported) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}

/**
 * Update the service worker immediately
 */
export function updateServiceWorker() {
  if (isServiceWorkerSupported) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.update();
      })
      .catch(error => {
        console.error('Error updating service worker:', error);
      });
  }
}
