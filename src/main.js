/**
 * NADITOWN - Main Application Entrypoint
 * Dibangunkan untuk Sime Darby Property University Hackathon 2026
 * Fresh start for UI development
 */

import { TownshipMap } from './map.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log("Memulakan NADITOWN (Clean Start)...");

  // Inisialisasi Peta Utama jika elemen wujud
  const mapContainer = document.getElementById('map-viewport');
  let mapEngine = null;
  if (mapContainer) {
    mapEngine = new TownshipMap('map-viewport');
    mapEngine.init();
  }

  // Simpan rujukan ke window untuk kemudahan debugging
  window.naditown = {
    map: mapEngine
  };
});
