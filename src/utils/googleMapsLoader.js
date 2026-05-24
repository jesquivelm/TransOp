const CALLBACK_NAME = '__googleMapsInitCallback';
let loadPromise = null;

function injectPlacesDropdownStyle() {
  if (typeof document === 'undefined' || document.getElementById('transop-google-places-style')) return;
  const style = document.createElement('style');
  style.id = 'transop-google-places-style';
  style.textContent = `
    .pac-container {
      z-index: 2147483647 !important;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
      font-family: Calibri, "Carlito", "Segoe UI", Arial, sans-serif;
    }
  `;
  document.head.appendChild(style);
}

async function ensureMapsLibraries(maps) {
  if (!maps) return maps;
  injectPlacesDropdownStyle();
  if (maps.importLibrary) {
    await Promise.all([
      maps.importLibrary('places').catch(() => null),
      maps.importLibrary('routes').catch(() => null),
    ]);
  }
  return maps;
}

export function loadGoogleMapsApi(apiKey) {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return ensureMapsLibraries(window.google.maps);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!apiKey) {
      loadPromise = null;
      reject(new Error('Google Maps API key is required'));
      return;
    }

    window[CALLBACK_NAME] = () => {
      ensureMapsLibraries(window.google?.maps).then(resolve).catch(reject);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${CALLBACK_NAME}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete window[CALLBACK_NAME];
      loadPromise = null;
      reject(new Error('Failed to load Google Maps API'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
