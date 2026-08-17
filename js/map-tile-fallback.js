(() => {
  'use strict';
  if (window.__RRN_MAP_TILE_FALLBACK__) return;
  window.__RRN_MAP_TILE_FALLBACK__ = true;

  const CARTO = 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';

  function fallbackUrl(src) {
    try {
      const url = new URL(src, location.href);
      if (!/\.tile\.openstreetmap\.org$/i.test(url.hostname) && !/^tile\.openstreetmap\.org$/i.test(url.hostname)) return null;
      const match = url.pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/i);
      if (!match) return null;
      const [, z, x, y] = match;
      return CARTO.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    } catch {
      return null;
    }
  }

  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('leaflet-tile')) return;
    if (img.dataset.rrnTileFallback === '1') return;
    const next = fallbackUrl(img.currentSrc || img.src);
    if (!next) return;
    img.dataset.rrnTileFallback = '1';
    img.src = next;
  }, true);
})();