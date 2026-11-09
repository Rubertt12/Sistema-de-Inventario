(() => {
  'use strict';
  if (window.__RRN_MAP_TILE_FALLBACK__) return;
  window.__RRN_MAP_TILE_FALLBACK__ = true;

  const CARTO = 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
  const OSM_DE = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';

  function fallbackUrl(src) {
    try {
      const url = new URL(src, location.href);
      const match = url.pathname.match(/\\/(\\d+)\\/(\\d+)\\/(\\d+)\\.png$/i);
      if (!match) return null;
      const [, z, x, y] = match;
      const path = base => base.replace('{z}', z).replace('{x}', x).replace('{y}', y);
      if (/\\.tile\\.openstreetmap\\.org$/i.test(url.hostname) || /^tile\\.openstreetmap\\.org$/i.test(url.hostname)) return path(CARTO);
      if (/^basemaps\\.cartocdn\\.com$/i.test(url.hostname)) return path(OSM_DE);
      return null;
    } catch {
      return null;
    }
  }

  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('leaflet-tile')) return;
    const attempts = Number(img.dataset.rrnTileFallback || 0);
    if (attempts >= 2) return;
    const next = fallbackUrl(img.currentSrc || img.src);
    if (!next) return;
    img.dataset.rrnTileFallback = String(attempts + 1);
    img.src = next;
  }, true);
})();