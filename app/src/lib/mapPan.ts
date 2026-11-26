// Where the camera must go so a pin stays in view — and nowhere if it is.
//
// A swipe on the place strip selects the next place, which may be off the
// edge of the map. The camera follows only as far as it must and never
// changes zoom: the reader chose that framing, and a card that zoomed the
// map every swipe would undo it.
//
// Flat arithmetic, not Mercator: the box is a few kilometres across, where
// the difference between a degree of latitude at the top of the box and at
// the bottom is a fraction of a pixel. `edge` keeps the pin that far inside
// the padded box rather than on its line, so it lands clear of the strip.

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type Box = { top: number; right: number; bottom: number; left: number };

/** How far inside the padded box a panned-to pin lands, in points. */
export const PAN_EDGE = 32;

/** The centre to glide to, or null when the pin is already inside `pad`. */
export function panTarget(
  region: Region,
  view: { width: number; height: number },
  pad: Box,
  pin: { lat: number; lng: number },
): { latitude: number; longitude: number } | null {
  const pxPerLng = view.width / region.longitudeDelta;
  const pxPerLat = view.height / region.latitudeDelta;
  // The pin, in points from the middle of the map; y grows downward.
  const dx = (pin.lng - region.longitude) * pxPerLng;
  const dy = (region.latitude - pin.lat) * pxPerLat;
  const left = -view.width / 2 + pad.left;
  const right = view.width / 2 - pad.right;
  const top = -view.height / 2 + pad.top;
  const bottom = view.height / 2 - pad.bottom;
  const mx = dx < left ? dx - (left + PAN_EDGE) : dx > right ? dx - (right - PAN_EDGE) : 0;
  const my = dy < top ? dy - (top + PAN_EDGE) : dy > bottom ? dy - (bottom - PAN_EDGE) : 0;
  if (mx === 0 && my === 0) return null;
  return {
    latitude: region.latitude - my / pxPerLat,
    longitude: region.longitude + mx / pxPerLng,
  };
}
