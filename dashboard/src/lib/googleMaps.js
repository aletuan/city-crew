// The Google Maps JavaScript API, loaded once for whoever asks first.
//
// Why the JS API and not the cheaper options: the key this desk was given is
// a browser key whose API restrictions allow the JavaScript API and nothing
// else. Maps Embed (an <iframe>, which is what the OSM version was) and Maps
// Static (which is what the Coverage tile mosaic was) are both blocked on
// it, so neither of the small ways across was open. See
// docs/superpowers/specs/2026-09-22-datadesk-google-maps-design.md.
//
// Two consequences worth knowing before editing anything here:
//
//   - No Map ID. Creating one needs the Cloud Console, so cloud styling is
//     out and `DARK_STYLE` below is inline — which only works on a map that
//     has no `mapId`. Do not add one without moving the style with it.
//   - `google.maps.Marker` stays. `AdvancedMarkerElement` needs a Map ID too.

// Vite inlines this at build time; outside a Vite build `import.meta.env` is
// simply undefined, which is what lets the tests import this file at all.
const ENV_KEY = import.meta.env?.VITE_GOOGLE_MAPS_KEY ?? '';

let pending = null;

/**
 * Resolves the `google.maps` namespace, or **null** when there is no map to
 * be had — no key configured, or the script failed to load. Null is a normal
 * answer, not an error: both screens that call this draw something useful
 * without a basemap, and a rejection here would take them down with it.
 *
 * Safe to call from anywhere, any number of times: the first call injects
 * the one <script> the API tolerates, the rest wait on the same promise.
 */
export function loadGoogleMaps({
  key = ENV_KEY,
  doc = globalThis.document,
  win = globalThis.window,
} = {}) {
  if (pending) return pending;

  pending = new Promise((resolve) => {
    if (win?.google?.maps) return resolve(win.google.maps);
    if (!key || !doc) return resolve(null);

    // The API calls a global by name; a unique one keeps a second loader in
    // some future component from being handed this one's resolve.
    const cb = `__citycrewMaps${Date.now().toString(36)}`;
    win[cb] = () => {
      delete win[cb];
      resolve(win.google?.maps ?? null);
    };

    const el = doc.createElement('script');
    el.src = 'https://maps.googleapis.com/maps/api/js'
      + `?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=${cb}`;
    el.async = true;
    // A blocked key, an offline desk, an ad blocker: all the same answer.
    el.onerror = () => {
      delete win[cb];
      resolve(null);
    };
    doc.head.appendChild(el);
  });

  return pending;
}

/**
 * The desk's palette, said in Google's vocabulary. Inline styling is the
 * legacy path and Google would rather sell a cloud style, but a cloud style
 * needs a Map ID we cannot create — and this one has to match tokens the
 * stylesheet already owns, not live in someone's console.
 *
 * Ground is `#0d0a12`, the same value `.covmap` falls back to when there is
 * no basemap at all, so a map that fails to load looks like a darker map
 * rather than a hole in the page.
 */
export const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d0a12' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9b93a8' }] },
  // Labels are read over bubbles that are themselves translucent, so they
  // get a dark casing rather than the default halo.
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0910' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a2333' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#14241c' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#241f2e' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2c2638' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3049' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7d748c' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1520' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4c5a66' }] },
];
