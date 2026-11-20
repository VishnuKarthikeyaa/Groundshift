import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Leaflet CSS must be imported before any map component renders.
// Loaded from local node_modules — no CDN dependency, works behind firewall.
import 'leaflet/dist/leaflet.css';
import './styles/main.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

