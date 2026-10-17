// The desk's rooms, as one table.
//
// It lived inline in `main.jsx` beside `createRoot`, which is the one line
// in this package that cannot run outside a browser with a `#root` in it.
// Pulled out so the UI tests can mount exactly these routes — the same
// elements, the same gates, the same paths — through a memory router
// instead of copying the list and letting the copy drift.

import React from 'react';
import App, { CityGate } from './App.jsx';
import AddPlace from './components/AddPlace.jsx';
import CityHero from './components/CityHero.jsx';
import CoverReview from './components/CoverReview.jsx';
import Contributors from './components/Contributors.jsx';
import Reports from './components/Reports.jsx';
import Coverage from './components/Coverage.jsx';
import PlaceList from './components/PlaceList.jsx';
import PhotoTypes from './components/PhotoTypes.jsx';
import LabelRound from './components/LabelRound.jsx';
import PlaceEditor from './components/PlaceEditor.jsx';
import ScanCity from './components/ScanCity.jsx';
import SearchTerms from './components/SearchTerms.jsx';

export const routes = [
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
      { path: 'covers', element: <CoverReview /> },
      { path: 'analytics/contributors', element: <Contributors /> },
      { path: 'analytics/coverage', element: <Coverage /> },
      // Not in the navigation: a measurement round, reached by its link.
      { path: 'photo-types', element: <PhotoTypes /> },
      { path: 'photo-types-1b', element: <PhotoTypes round="r1b" /> },
      { path: 'photo-types-2', element: <PhotoTypes round="r2" /> },
      { path: 'photo-types-3', element: <LabelRound /> },
      { path: 'photo-types-3b', element: <LabelRound round="r3b" /> },
      { path: 'photo-types-3c', element: <LabelRound round="r3c" /> },
    ],
  },
];
