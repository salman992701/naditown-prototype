/**
 * NADITOWN - Main Application Entrypoint
 * Dibangunkan untuk Sime Darby Property University Hackathon 2026
 * Ahli 1 (Salman): Peta Utama & User Interface (UI)
 */

import { TownshipMap } from './map.js';
import { UIController } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log("Memulakan NADITOWN Adaptive Township Emergency Operating System...");

  // 1. Inisialisasi Peta Utama (Salman)
  const mapEngine = new TownshipMap('map-viewport');
  mapEngine.init();

  // 2. Inisialisasi UI Controller
  const uiController = new UIController(mapEngine);
  uiController.init();

  // Simpan rujukan ke window untuk kemudahan debugging dan rakan kumpulan
  window.naditown = {
    map: mapEngine,
    ui: uiController
  };
});
