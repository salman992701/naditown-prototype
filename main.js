/**
 * NADITOWN - Main Application Entrypoint
 * Sime Darby Property University Hackathon 2026
 * Menyatukan Ahli 1 (Salman: Peta), Ahli 2 (Ana: Dashboard),
 * Ahli 3 (Aufa: Simulasi), Ahli 4 (Routing), Ahli 5 (Piqa: Data & Ujian).
 */

import { TownshipMap } from './map.js';
import { Dashboard } from './dashboard.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log("Memulakan NADITOWN Adaptive Township Operations Engine...");

  // 1. Inisialisasi Peta (Ahli 1: Salman)
  let mapEngine = null;
  const mapContainer = document.getElementById('map-viewport');
  if (mapContainer && typeof window.L !== 'undefined') {
    mapEngine = new TownshipMap('map-viewport');
    mapEngine.init();
  }

  // 2. Inisialisasi Dashboard (Ahli 2: Ana)
  const dashboard = new Dashboard(mapEngine);
  dashboard.init();

  // 3. Simpan rujukan ke window untuk integrasi & debugging
  window.naditown = {
    map: mapEngine,
    dashboard: dashboard
  };
});
