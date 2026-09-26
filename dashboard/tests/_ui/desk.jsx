// Mount a room of the desk the way the page mounts it.
//
// Every screen reads three contexts `App.jsx` provides and nothing else
// exports — the toast, the progress counts, the workspace city — and most
// of them navigate. So a screen is not rendered on its own: it is rendered
// at its route, inside the real `<App />`, through the same route table
// `main.jsx` hands to the hash router. What a test then sees is what the
// page shows: the page head above the screen, the toast the screen fires,
// the city the desk is on. And `App.jsx` is covered by the same tests
// that cover its rooms, which is the only way it could be — it is a
// shell, and a shell with nothing in it has nothing to say.
//
// The auth gate is not here. It stands in front of the router in
// `main.jsx`; here it is the one thing tested on its own (auth.ui.test).

import React from 'react';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../src/routes.jsx';

const CITY_KEY = 'citycrew.dashboard.city';

/**
 * @param {string} route  where the desk opens, e.g. '/place/cafe-a?status=pending'
 * @param {{ city?: string }} [opts]  the workspace city — a city id, or
 *   'all'. Left out, the desk opens on Ho Chi Minh City, as it does for a
 *   fresh browser.
 */
export function renderDesk(route = '/', { city } = {}) {
  if (city !== undefined) localStorage.setItem(CITY_KEY, city);
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}

/** The toast, once it shows: the one place a screen reports an outcome. */
export const findToast = () => screen.findByRole('status');
