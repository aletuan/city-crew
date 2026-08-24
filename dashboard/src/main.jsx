import React from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import App, { CityGate } from './App.jsx';
import AuthGate from './auth.jsx';
import AddPlace from './components/AddPlace.jsx';
import CityHero from './components/CityHero.jsx';
import Contributors from './components/Contributors.jsx';
import Reports from './components/Reports.jsx';
import Coverage from './components/Coverage.jsx';
import PlaceList from './components/PlaceList.jsx';
import PlaceEditor from './components/PlaceEditor.jsx';
import ScanCity from './components/ScanCity.jsx';
import SearchTerms from './components/SearchTerms.jsx';
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
      // One-city-at-a-time screens: with "All cities" selected they ask
      // for a city first instead of inventing a scope.
      { path: 'add', element: <CityGate><AddPlace /></CityGate> },
      { path: 'scan', element: <CityGate><ScanCity /></CityGate> },
      { path: 'city', element: <CityGate><CityHero /></CityGate> },
      // Not city-scoped: what somebody calls a cinema does not change
      // between Hanoi and Saigon.
      { path: 'search-words', element: <SearchTerms /> },
      { path: 'reports', element: <Reports /> },
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
