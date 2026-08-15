// Small hand-drawn glyph set for category/vibe chips — the dashboard has no
// icon library (see the sign-out glyph in App.jsx for the same convention).
// Shapes approximate the Ionicons used on mobile (see app/src/lib/categories.ts
// and app/src/lib/vibes.ts) closely enough to read as the same concept; they
// don't need to be pixel-identical since the two run on different renderers.

import React from 'react';

const PATHS = {
  cafe: (
    <>
      <rect x="3.5" y="6" width="7" height="6" rx="2" />
      <path d="M10.5 7.5h1a1.5 1.5 0 0 1 0 3h-1" />
      <path d="M5.5 4.3c.35-.5.35-.9 0-1.4M8 4.3c.35-.5.35-.9 0-1.4" />
    </>
  ),
  restaurant: (
    <>
      <path d="M4.2 2v3a.8.8 0 0 0 1.6 0V2M5 2v3M5 5v9" />
      <path d="M10 2c1.6.4 1.8 2.2 1.4 3.6-.3 1-1 1.4-1.4 1.4v7" />
    </>
  ),
  views: (
    <>
      <rect x="3.2" y="6" width="3.6" height="8" rx=".5" />
      <rect x="8.2" y="2.5" width="4" height="11.5" rx=".5" />
      <path d="M9.4 5h1.6M9.4 7.5h1.6M9.4 10h1.6" />
    </>
  ),
  culture: (
    <path d="M8 4.2C7 3.2 5.5 2.8 3.5 3v8.5c2 0 3.5.4 4.5 1.3M8 4.2C9 3.2 10.5 2.8 12.5 3v8.5c-2 0-3.5.4-4.5 1.3M8 4.2v9.6" />
  ),
  leaf: (
    <>
      <path d="M12.5 3.5c-6 0-9 3-9 9 6 0 9-3 9-9Z" />
      <path d="M4 12.5 9.5 7" />
    </>
  ),
  bag: (
    <>
      <path d="M4.5 5.5h7l.6 8a1 1 0 0 1-1 1.1H4.9a1 1 0 0 1-1-1.1l.6-8Z" />
      <path d="M6 5.5V4.2a2 2 0 0 1 4 0v1.3" />
    </>
  ),
  wine: (
    <>
      <path d="M5 2.5h6c0 3-1 4.7-3 4.7S5 5.5 5 2.5Z" />
      <path d="M8 7.2V13M5.5 13.5h5" />
    </>
  ),
  // View-mode toggle — plain UI chrome, not a category concept, so these
  // ignore the `color` prop's "own hue" convention and just take currentColor.
  list: (
    <path d="M3 4.5h10M3 8h10M3 11.5h10" />
  ),
  grid: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx=".8" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx=".8" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx=".8" />
      <rect x="9" y="9" width="4.5" height="4.5" rx=".8" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.3 10.3 14 14" />
    </>
  ),
  // Notice mark. A triangle rather than a circle: the desk's one warning
  // colour is already the amber in the gradient, so the shape has to carry
  // the difference between "here is a fact" and "here is a gap".
  alert: (
    <>
      <path d="M8 2.4 14.4 13.2H1.6z" />
      <path d="M8 6.4v3.1M8 11.4v.1" />
    </>
  ),
};

export function CategoryIcon({ name, color = 'currentColor' }) {
  const shape = PATHS[name];
  if (!shape) return null;
  return (
    <svg
      viewBox="0 0 16 16" width="14" height="14" fill="none"
      stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {shape}
    </svg>
  );
}
