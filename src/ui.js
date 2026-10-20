/**
 * NADITOWN UI Controller
 * Mengendalikan interaksi pengguna, tab modular, panel slot setiap ahli pasukan,
 * dan penyelarasan antara Peta Utama dengan Komponen UI.
 */

import { store } from './store.js';

export class UIController {
  constructor(townshipMap) {
    this.map = townshipMap;
  }

  init() {
    this.setupClock();
    this.setupSidebarTabs();
    this.setupSidebarCollapse();
    this.setupLayerSwitches();
    this.setupMapStyleButtons();
    this.setupQuickLocations();
    this.setupSearchInput();
    this.setupTeamModal();
    this.setupDashboardTab();
    this.setupSimulationTab();
    this.setupRoutingTab();
    this.setupDataTab();

    // Dengarkan perubahan state
    this.setupStateSubscriptions();

    console.log("NADITOWN UI Controller berjaya diinisialisasi.");
  }

  // 1. Live Clock
  setupClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;

    const updateTime = () => {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString('en-GB') + ' MYT';
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  // 2. Tab Navigation
  setupSidebarTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(`pane-${targetTab}`);
        if (activePane) activePane.classList.add('active');

        store.setActiveTab(targetTab);
      });
    });

    // Subskripsi luaran jika tab diubah programmatically
    store.subscribe('tab_changed', (tabId) => {
      const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
      if (btn && !btn.classList.contains('active')) {
        btn.click();
      }
    });
  }

  // 3. Sidebar Collapse / Expand
  setupSidebarCollapse() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const arrow = document.getElementById('sidebar-toggle-arrow');
    const mainContent = document.getElementById('main-content');

    if (toggleBtn && mainContent) {
      toggleBtn.addEventListener('click', () => {
        mainContent.classList.toggle('sidebar-collapsed');
        const isCollapsed = mainContent.classList.contains('sidebar-collapsed');
        arrow.textContent = isCollapsed ? '▶' : '◀';

        // Beritahu Leaflet peta untuk resize
        setTimeout(() => {
          if (this.map && this.map.map) {
            this.map.map.invalidateSize();
          }
        }, 320);
      });
    }
  }

  // 4. Layer Switch Checkboxes (Salman's Map Layer Controls)
  setupLayerSwitches() {
    const layersMap = [
      { id: 'layer-flood', key: 'floodZones' },
      { id: 'layer-pps', key: 'pps' },
      { id: 'layer-medical', key: 'medical' },
      { id: 'layer-responders', key: 'responders' },
      { id: 'layer-roads', key: 'roads' },
      { id: 'layer-sensors', key: 'sensors' }
    ];

    layersMap.forEach(item => {
      const checkbox = document.getElementById(item.id);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          store.toggleLayer(item.key, e.target.checked);
        });
      }
    });

    // Zoom buttons
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnRecenter = document.getElementById('btn-recenter');
    const btnLegend = document.getElementById('btn-toggle-legend');
    const legendBox = document.getElementById('map-legend');

    if (btnZoomIn) btnZoomIn.onclick = () => this.map.map.zoomIn();
    if (btnZoomOut) btnZoomOut.onclick = () => this.map.map.zoomOut();
    if (btnRecenter) btnRecenter.onclick = () => this.map.resetView();
    if (btnLegend && legendBox) {
      btnLegend.onclick = () => {
        legendBox.style.display = legendBox.style.display === 'none' ? 'block' : 'none';
      };
    }
  }

  // 5. Map Style Switcher (Dark, Street, Satellite)
  setupMapStyleButtons() {
    const styleButtons = document.querySelectorAll('.btn-style-pill');
    styleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        styleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const style = btn.getAttribute('data-style');
        store.setMapStyle(style);
      });
    });
  }

  // 6. Quick Location Jump
  setupQuickLocations() {
    const locButtons = document.querySelectorAll('.btn-quick-loc[data-lat]');
    locButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const lat = parseFloat(btn.getAttribute('data-lat'));
        const lng = parseFloat(btn.getAttribute('data-lng'));
        this.map.focusLocation(lat, lng, 16);
      });
    });
  }

  // 7. Search Input
  setupSearchInput() {
    const input = document.getElementById('map-search-input');
    if (!input) return;

    input.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) return;

      // Cari fasiliti sepadan
      const match = store.state.facilities.find(f => 
        f.name.toLowerCase().includes(query) || f.category.toLowerCase().includes(query)
      );

      if (match) {
        this.map.focusLocation(match.coordinates[0], match.coordinates[1], 17);
        const marker = this.map.markersMap.get(match.id);
        if (marker) marker.openPopup();
      }
    });
  }

  // 8. Team Structure Modal
  setupTeamModal() {
    const btnOpen = document.getElementById('btn-open-team-modal');
    const btnClose = document.getElementById('btn-close-modal');
    const modal = document.getElementById('team-modal');

    if (btnOpen && modal) {
      btnOpen.onclick = () => modal.classList.add('open');
    }
    if (btnClose && modal) {
      btnClose.onclick = () => modal.classList.remove('open');
    }
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) modal.classList.remove('open');
      };
    }
  }

  // 9. Dashboard Tab (Slot Ahli 2: Ana)
  setupDashboardTab() {
    this.renderDashboardFacilityList();

    store.subscribe('facility_updated', () => {
      this.renderDashboardFacilityList();
    });
  }

  renderDashboardFacilityList() {
    const container = document.getElementById('dashboard-facility-list');
    if (!container) return;

    const ppsList = store.state.facilities.filter(f => f.type === 'pps');
    container.innerHTML = '';

    ppsList.forEach(fac => {
      const rate = Math.round((fac.currentOccupants / fac.capacity) * 100);
      const badgeColor = rate >= 90 ? '#ef4444' : (rate >= 60 ? '#f59e0b' : '#10b981');
      
      const row = document.createElement('div');
      row.className = 'facility-item-row';
      row.innerHTML = `
        <div class="item-left">
          <div style="font-size: 1.1rem;">🏠</div>
          <div>
            <div class="item-name">${fac.name}</div>
            <div class="item-tag">${fac.currentOccupants} / ${fac.capacity} orang (${rate}%)</div>
          </div>
        </div>
        <div>
          <span class="item-badge-pill" style="background: rgba(255,255,255,0.08); color: ${badgeColor}; border: 1px solid ${badgeColor};">
            ${rate >= 90 ? 'Penuh' : (rate >= 60 ? 'Amaran' : 'Tersedia')}
          </span>
        </div>
      `;

      row.onclick = () => {
        this.map.focusLocation(fac.coordinates[0], fac.coordinates[1], 17);
        const marker = this.map.markersMap.get(fac.id);
        if (marker) marker.openPopup();
      };

      container.appendChild(row);
    });
  }

  // 10. Simulation Tab (Slot Ahli 3: Aufa)
  setupSimulationTab() {
    this.renderSimulationRoadsList();

    const slider = document.getElementById('sim-water-slider');
    const valText = document.getElementById('sim-water-val');
    if (slider && valText) {
      slider.oninput = (e) => {
        valText.textContent = `+${parseFloat(e.target.value).toFixed(2)} m`;
      };
    }

    const btnTrigger = document.getElementById('btn-trigger-sim');
    const btnReset = document.getElementById('btn-reset-sim');

    if (btnTrigger) {
      btnTrigger.onclick = () => {
        const addedWater = slider ? parseFloat(slider.value) : 0.6;
        store.setEmergencyLevel('RED');
        
        // Tutup Jalan Jambatan Sg Buloh & Tasik Elmina
        store.setRoadStatus('road-02', 'closed');
        store.setRoadStatus('road-05', 'closed');

        store.addLog('danger', 'Simulasi Banjir Kilat Aktif', `Kenaikan air +${addedWater}m menyebabkan limpahan di Sektor Tasik Elmina.`);
        alert('Simulasi dijalankan! Status amaran dinaikkan ke KOD MERAH dan 2 segmen jalan telah ditutup pada peta.');
      };
    }

    if (btnReset) {
      btnReset.onclick = () => {
        store.setEmergencyLevel('YELLOW');
        store.setRoadStatus('road-01', 'clear');
        store.setRoadStatus('road-02', 'closed'); // default 1 closed
        store.setRoadStatus('road-03', 'hazard');
        store.setRoadStatus('road-04', 'clear');
        store.setRoadStatus('road-05', 'hazard');
        this.map.clearRoute();
        const routeResult = document.getElementById('route-result-container');
        if (routeResult) routeResult.style.display = 'none';

        store.addLog('info', 'Simulasi Ditetapkan Semula', 'Sistem kembali ke status pemantauan asas.');
      };
    }
  }

  renderSimulationRoadsList() {
    const container = document.getElementById('simulation-roads-list');
    if (!container) return;

    container.innerHTML = '';
    store.state.roads.forEach(road => {
      const isClosed = road.status === 'closed';
      const row = document.createElement('div');
      row.className = 'facility-item-row';
      row.style.marginBottom = '6px';
      row.innerHTML = `
        <div class="item-left">
          <span style="font-size: 0.9rem;">${isClosed ? '🔴' : '🟢'}</span>
          <div>
            <div class="item-name" style="font-size: 0.78rem;">${road.name}</div>
            <div class="item-tag">${isClosed ? 'Ditutup / Terputus' : 'Laluan Dibuka'}</div>
          </div>
        </div>
        <div>
          <button class="btn-quick-loc" style="padding: 4px 8px; font-size: 0.7rem; color: ${isClosed ? '#00e676' : '#ef4444'};">
            ${isClosed ? 'Buka' : 'Tutup'}
          </button>
        </div>
      `;

      const btn = row.querySelector('button');
      btn.onclick = () => {
        store.setRoadStatus(road.id, isClosed ? 'clear' : 'closed');
        this.renderSimulationRoadsList();
      };

      container.appendChild(row);
    });
  }

  // 11. Routing Tab (Slot Ahli 4)
  setupRoutingTab() {
    const btnCalc = document.getElementById('btn-calc-route');
    const resultBox = document.getElementById('route-result-container');

    if (btnCalc) {
      btnCalc.onclick = () => {
        // Koordinat demonstrasi laluan adaptif (mengelak kawasan banjir di Sg Buloh)
        const safeAlternativeRouteCoords = [
          [3.1720, 101.4980], // Mula dari zon penduduk
          [3.1810, 101.4980], // Mengelak jambatan bawah -> ikut Persiaran Elmina Barat
          [3.1835, 101.5030],
          [3.1900, 101.5000], // Bypass Elmina East
          [3.1920, 101.5120],
          [3.1855, 101.5042]  // Tiba di Dewan Komuniti Elmina West
        ];

        this.map.drawEvacuationRoute(safeAlternativeRouteCoords, true);
        if (resultBox) resultBox.style.display = 'block';

        store.addLog('success', 'Laluan Alternatif Dihasilkan', 'Algoritma mendapati laluan selamat melalui Persiaran Elmina Utara dengan jarak 3.8 km.');
      };
    }
  }

  // 12. Data & Testing Tab (Slot Ahli 5: Piqa)
  setupDataTab() {
    this.renderAuditLogs();

    const btnAdd = document.getElementById('btn-add-dummy-fac');
    const btnExport = document.getElementById('btn-export-geojson');

    if (btnAdd) {
      btnAdd.onclick = () => {
        const idNum = Math.floor(Math.random() * 900) + 100;
        const newFac = {
          id: `fac-new-${idNum}`,
          name: `Pos Kawalan Bencana Tambahan #${idNum}`,
          type: 'responder',
          category: 'Pos Pantau Sokongan',
          coordinates: [
            3.1800 + (Math.random() * 0.015 - 0.007),
            101.5050 + (Math.random() * 0.015 - 0.007)
          ],
          capacity: 30,
          currentOccupants: 5,
          status: 'active',
          amenities: ['Kenderaan Pacuan 4 Roda', 'Kit Pertolongan Cemas'],
          contact: '012-3344556',
          lastUpdated: 'Baru sahaja'
        };

        store.addFacility(newFac);
        this.map.focusLocation(newFac.coordinates[0], newFac.coordinates[1], 16);
      };
    }

    if (btnExport) {
      btnExport.onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store.state, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `naditown_township_data_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        store.addLog('info', 'Eksport Data Berjaya', 'Fail JSON data perbandaran dimuat turun.');
      };
    }

    store.subscribe('log_added', () => {
      this.renderAuditLogs();
    });
  }

  renderAuditLogs() {
    const container = document.getElementById('audit-log-list');
    if (!container) return;

    container.innerHTML = '';
    store.state.eventLogs.forEach(log => {
      const entry = document.createElement('div');
      entry.className = `log-entry ${log.type}`;
      entry.innerHTML = `
        <div class="log-time">[${log.timestamp}] &bull; ${log.author}</div>
        <div class="log-title">${log.title}</div>
        <div class="log-desc">${log.message}</div>
      `;
      container.appendChild(entry);
    });
  }

  // 13. State Subscriptions
  setupStateSubscriptions() {
    const pill = document.getElementById('emergency-pill');
    const pillText = document.getElementById('emergency-pill-text');

    store.subscribe('emergency_level_changed', (level) => {
      if (pill && pillText) {
        pill.className = `emergency-code-pill ${level.toLowerCase()}`;
        if (level === 'RED') {
          pillText.textContent = 'TAHAP: KOD MERAH (EVAKUASI SEGERA)';
        } else if (level === 'ORANGE') {
          pillText.textContent = 'TAHAP: KOD JINGGA (BERSEDIA BERPINDAH)';
        } else {
          pillText.textContent = 'TAHAP: KOD KUNING (WASPADA)';
        }
      }
    });

    store.subscribe('road_status_changed', () => {
      this.renderSimulationRoadsList();
      // Update KPI
      const closedCount = store.state.roads.filter(r => r.status === 'closed').length;
      const hazardCount = store.state.roads.filter(r => r.status === 'hazard').length;
      const kpiEl = document.getElementById('kpi-roads-affected');
      if (kpiEl) {
        kpiEl.textContent = `${closedCount + hazardCount} Jalan`;
      }
    });
  }
}
