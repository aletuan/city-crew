import React from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import App from './App.jsx';
import AuthGate from './auth.jsx';
import AddPlace from './components/AddPlace.jsx';
import CityHero from './components/CityHero.jsx';
import Contributors from './components/Contributors.jsx';
import Coverage from './components/Coverage.jsx';
import PlaceList from './components/PlaceList.jsx';
import PlaceEditor from './components/PlaceEditor.jsx';
import ScanCity from './components/ScanCity.jsx';
import './theme.css';

// Hash routing: survives refreshes and deep links on GitHub Pages,
// which has no SPA rewrite rules.
const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <PlaceList /> },
      { path: 'place/:slug', element: <PlaceEditor /> },
      { path: 'add', element: <AddPlace /> },
      { path: 'scan', element: <ScanCity /> },
      { path: 'city', element: <CityHero /> },
      { path: 'analytics/contributors', element: <Contributors /> },
      { path: 'analytics/coverage', element: <Coverage /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <AuthGate>
    <RouterProvider router={router} />
  </AuthGate>,
);
