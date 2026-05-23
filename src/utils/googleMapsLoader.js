const CALLBACK_NAME = '__googleMapsInitCallback';
let loadPromise = null;

export function loadGoogleMapsApi(apiKey) {
  if (typeof google !== 'undefined' && google.maps) {
    return Promise.resolve(google.maps);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!apiKey) {
      reject(new Error('Google Maps API key is required'));
      return;
    }

    window[CALLBACK_NAME] = () => {
      resolve(google.maps);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${CALLBACK_NAME}&libraries=places,directions&loading=async`;
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
