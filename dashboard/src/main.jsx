import React from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import AuthGate from './auth.jsx';
import { routes } from './routes.jsx';
import './theme.css';

// Hash routing: survives refreshes and deep links on GitHub Pages,
// which has no SPA rewrite rules. The rooms themselves are in routes.jsx.
const router = createHashRouter(routes);

createRoot(document.getElementById('root')).render(
  <AuthGate>
    <RouterProvider router={router} />
  </AuthGate>,
);
