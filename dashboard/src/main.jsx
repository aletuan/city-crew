import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App.jsx';
import PlaceList from './components/PlaceList.jsx';
import PlaceEditor from './components/PlaceEditor.jsx';
import './theme.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <PlaceList /> },
      { path: 'place/:slug', element: <PlaceEditor /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
