/**
 * DarkBasemap — Offline-first dark tile layer for GROUNDSHIFT.
 *
 * Uses Leaflet's GridLayer.extend() (prototype-based, not ES6 class — ES6
 * class inheritance of Leaflet internals is known to break in some builds).
 * Each tile is a 256×256 canvas painted near-black with hairline borders.
 * Zero network requests. Works fully offline / behind firewalls.
 */
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Build the layer constructor once at module load.
// Using L.GridLayer.extend() — Leaflet's own class factory, maximally compatible.
const DarkGridLayer = (L.GridLayer as any).extend({
  createTile() {
    const canvas = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Near-black fill
      ctx.fillStyle = '#0D1014';
      ctx.fillRect(0, 0, 256, 256);
      // Hairline tile border
      ctx.strokeStyle = '#1A1F26';
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(0.5, 0.5, 255, 255);
    }
    return canvas;
  },
});

export function DarkBasemap() {
  const map = useMap();

  useEffect(() => {
    // Dark fallback on the container itself (shows before tiles render)
    map.getContainer().style.background = '#0D1014';

    const layer = new DarkGridLayer({ pane: 'tilePane' });
    map.addLayer(layer);

    return () => {
      try { map.removeLayer(layer); } catch { /* already removed */ }
    };
  }, [map]);

  return null;
}
