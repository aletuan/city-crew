async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  places: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    return fetch(`/api/places?${qs}`).then(handle);
  },
  place: (slug) => fetch(`/api/places/${slug}`).then(handle),
  savePlace: (slug, fields) =>
    fetch(`/api/places/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    }).then(handle),
  deletePlace: (slug) => fetch(`/api/places/${slug}`, { method: 'DELETE' }).then(handle),
  progress: () => fetch('/api/progress').then(handle),
  sync: () => fetch('/api/sync', { method: 'POST' }).then(handle),
  patchPhoto: (id, fields) =>
    fetch(`/api/photos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    }).then(handle),
  deletePhoto: (id) => fetch(`/api/photos/${id}`, { method: 'DELETE' }).then(handle),
  reorderPhotos: (slug, ids) =>
    fetch(`/api/places/${slug}/photo-order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).then(handle),
  uploadPhoto: (slug, blob, filename) =>
    fetch(`/api/places/${slug}/photos?filename=${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    }).then(handle),
};

// Client-side resize: longest edge ≤ 1600px, JPEG 0.85 — keeps uploads ~<1MB.
export async function resizeImage(file, maxEdge = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}
