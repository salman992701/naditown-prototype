/**
 * NADITOWN - Peta Utama (Core Map Engine)
 * Dibina oleh Ahli 1: Salman
 * Komponen: Interactive Leaflet Map, Custom Tactical Markers,
 * Geo-Layers (Flood Zones, Roads, Facilities, IoT Sensors).
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { store } from './store.js';

export class TownshipMap {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.baseLayers = {};
    this.layerGroups = {
      floodZones: L.layerGroup(),
      pps: L.layerGroup(),
      medical: L.layerGroup(),
      responders: L.layerGroup(),
      roads: L.layerGroup(),
      sensors: L.layerGroup(),
      route: L.layerGroup(),
      highlights: L.layerGroup()
    };
    this.markersMap = new Map();
    this.roadsMap = new Map();
  }

  init() {
    const meta = store.state.meta;

    // 1. Inisialisasi Peta Leaflet
    this.map = L.map(this.containerId, {
      center: meta.coordinates,
      zoom: meta.zoom,
      minZoom: 12,
      maxZoom: 18,
      zoomControl: false // Kita gunakan custom floating controls
    });

    // 2. Definisi Base Tile Layers
    this.baseLayers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> | OpenStreetMap contributors',
      subdomains: 'abcd',
      maxZoom: 19
    });

    this.baseLayers.street = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> | OpenStreetMap contributors',
      subdomains: 'abcd',
      maxZoom: 19
    });

    this.baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 18
    });

    // Pasang default tile layer (Dark Command Center mode)
    this.baseLayers.dark.addTo(this.map);

    // 3. Masukkan kesemua Layer Groups ke dalam peta
    Object.values(this.layerGroups).forEach(group => group.addTo(this.map));

    // 4. Muatkan data awal ke atas peta
    this.renderTownshipBoundary();
    this.renderFloodZones();
    this.renderRoads();
    this.renderFacilities();
    this.renderSensors();

    // 5. Sambungkan ke State Manager (Reactive Updates)
    this.setupStateListeners();

    // 6. Map Event listeners
    this.map.on('click', (e) => {
      // Jika pengguna klik kawasan kosong peta
      if (e.originalEvent.target.id === this.containerId || e.originalEvent.target.classList.contains('leaflet-container')) {
        // Nyahpilih
      }
    });

    // Letak scale bar
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(this.map);

    console.log("NADITOWN: Peta Utama berjaya diinisialisasi untuk " + meta.name);
  }

  setupStateListeners() {
    // Dengarkan perubahan switch layer
    store.subscribe('layer_toggled', ({ layerKey, isVisible }) => {
      const group = this.layerGroups[layerKey];
      if (group) {
        if (isVisible) {
          if (!this.map.hasLayer(group)) this.map.addLayer(group);
        } else {
          if (this.map.hasLayer(group)) this.map.removeLayer(group);
        }
      }
    });

    // Perubahan gaya peta (Dark / Street / Satellite)
    store.subscribe('map_style_changed', (styleKey) => {
      this.switchBaseLayer(styleKey);
    });

    // Kemaskini status jalan dari simulasi
    store.subscribe('road_status_changed', ({ roadId, newStatus }) => {
      this.updateRoadDisplay(roadId, newStatus);
    });

    // Penambahan fasiliti baharu secara langsung (Ahli 5)
    store.subscribe('facility_added', (facility) => {
      this.addFacilityMarker(facility);
    });
  }

  switchBaseLayer(styleKey) {
    Object.values(this.baseLayers).forEach(layer => {
      if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
    });

    if (this.baseLayers[styleKey]) {
      this.baseLayers[styleKey].addTo(this.map);
    }
  }

  // Sempadan Bandar Elmina (Sime Darby Property)
  renderTownshipBoundary() {
    const boundaryCoords = [
      [3.1600, 101.4880],
      [3.1950, 101.4920],
      [3.2100, 101.5200],
      [3.1900, 101.5360],
      [3.1650, 101.5280]
    ];

    L.polygon(boundaryCoords, {
      color: '#00f2fe',
      weight: 2,
      dashArray: '6, 8',
      fillColor: '#00f2fe',
      fillOpacity: 0.03,
      interactive: false
    }).addTo(this.map);
  }

  // Zon Risiko Banjir (Poligon)
  renderFloodZones() {
    this.layerGroups.floodZones.clearLayers();

    store.state.floodZones.forEach(zone => {
      const polygon = L.polygon(zone.polygon, {
        color: zone.color,
        weight: 2,
        fillColor: zone.fillColor,
        fillOpacity: zone.fillOpacity,
        className: `flood-polygon flood-${zone.severity}`
      });

      polygon.bindTooltip(`
        <div class="custom-map-tooltip">
          <strong>${zone.name}</strong><br>
          <span class="badge badge-${zone.severity}">${zone.level}</span><br>
          <small>Kedalaman Air Jangkaan: ${zone.depth}</small>
        </div>
      `, { sticky: true, className: 'leaflet-tactical-tooltip' });

      polygon.on('click', () => {
        store.selectEntity({ ...zone, entityType: 'floodZone' });
      });

      polygon.addTo(this.layerGroups.floodZones);
    });
  }

  // Rangkaian Jalan Raya
  renderRoads() {
    this.layerGroups.roads.clearLayers();
    this.roadsMap.clear();

    store.state.roads.forEach(road => {
      this.createRoadPolyline(road);
    });
  }

  createRoadPolyline(road) {
    let color = '#00e676'; // Hijau / Clear
    let weight = 5;
    let dashArray = null;

    if (road.status === 'closed') {
      color = '#ff1744'; // Merah / Terputus
      weight = 6;
      dashArray = '8, 8';
    } else if (road.status === 'hazard') {
      color = '#ff9100'; // Oren / Amaran
      weight = 5;
      dashArray = '4, 6';
    }

    const polyline = L.polyline(road.coordinates, {
      color: color,
      weight: weight,
      dashArray: dashArray,
      opacity: 0.88,
      lineCap: 'round',
      lineJoin: 'round',
      className: `road-line road-${road.status}`
    });

    const popupHtml = `
      <div class="map-popup road-popup">
        <div class="popup-header">
          <span class="popup-tag road-tag-${road.status}">
            ${road.status === 'closed' ? '🔴 JALAN DITUTUP' : (road.status === 'hazard' ? '⚠️ AIR BERTATANG' : '🟢 LALUAN SELAMAT')}
          </span>
          <h4>${road.name}</h4>
        </div>
        <div class="popup-body">
          <div class="popup-info-row">
            <span>Kedalaman Air:</span>
            <strong>${road.surfaceWater}</strong>
          </div>
          <div class="popup-info-row">
            <span>Akses Kenderaan:</span>
            <strong>${road.passableFor}</strong>
          </div>
          <div class="popup-info-row">
            <span>Tahap Risiko:</span>
            <strong class="text-risk-${road.riskLevel.toLowerCase()}">${road.riskLevel}</strong>
          </div>
        </div>
        <div class="popup-actions">
          <button class="btn-popup-toggle" data-road-id="${road.id}" data-current-status="${road.status}">
            ${road.status === 'closed' ? 'Buka Semula Laluan' : 'Tutup Laluan (Simulasi Banjir)'}
          </button>
        </div>
      </div>
    `;

    polyline.bindPopup(popupHtml, { className: 'tactical-popup-wrapper' });

    polyline.on('popupopen', () => {
      const btn = document.querySelector(`.btn-popup-toggle[data-road-id="${road.id}"]`);
      if (btn) {
        btn.onclick = (e) => {
          e.stopPropagation();
          const nextStatus = road.status === 'closed' ? 'clear' : 'closed';
          store.setRoadStatus(road.id, nextStatus);
          polyline.closePopup();
        };
      }
    });

    polyline.addTo(this.layerGroups.roads);
    this.roadsMap.set(road.id, polyline);
  }

  updateRoadDisplay(roadId, newStatus) {
    const road = store.state.roads.find(r => r.id === roadId);
    if (!road) return;

    const existingPolyline = this.roadsMap.get(roadId);
    if (existingPolyline) {
      this.layerGroups.roads.removeLayer(existingPolyline);
    }
    this.createRoadPolyline(road);
  }

  // Fasiliti (PPS, Hospital, Bomba, PKOB, Depot)
  renderFacilities() {
    this.layerGroups.pps.clearLayers();
    this.layerGroups.medical.clearLayers();
    this.layerGroups.responders.clearLayers();
    this.markersMap.clear();

    store.state.facilities.forEach(fac => {
      this.addFacilityMarker(fac);
    });
  }

  addFacilityMarker(fac) {
    let targetGroup = this.layerGroups.pps;
    if (fac.type === 'medical') targetGroup = this.layerGroups.medical;
    else if (fac.type === 'responder' || fac.type === 'command' || fac.type === 'logistics') targetGroup = this.layerGroups.responders;

    const iconHtml = this.getCustomIconHtml(fac);
    const customIcon = L.divIcon({
      html: iconHtml,
      className: `tactical-div-icon fac-icon-${fac.type}`,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -20]
    });

    const marker = L.marker(fac.coordinates, { icon: customIcon });

    const occupancyRate = fac.capacity > 0 ? Math.round((fac.currentOccupants / fac.capacity) * 100) : 0;
    const progressClass = occupancyRate >= 90 ? 'danger' : (occupancyRate >= 70 ? 'warning' : 'safe');

    const popupHtml = `
      <div class="map-popup facility-popup">
        <div class="popup-header">
          <span class="popup-tag tag-${fac.type}">${fac.category}</span>
          <h4>${fac.name}</h4>
        </div>
        <div class="popup-body">
          <div class="capacity-bar-container">
            <div class="capacity-text">
              <span>Kapasiti Dihuni:</span>
              <strong>${fac.currentOccupants} / ${fac.capacity} (${occupancyRate}%)</strong>
            </div>
            <div class="progress-track">
              <div class="progress-fill fill-${progressClass}" style="width: ${Math.min(occupancyRate, 100)}%"></div>
            </div>
          </div>

          <div class="popup-info-row">
            <span>Kemudahan:</span>
            <strong>${fac.amenities.slice(0, 2).join(', ')}</strong>
          </div>
          <div class="popup-info-row">
            <span>Hubungi:</span>
            <strong>${fac.contact}</strong>
          </div>
          <div class="popup-info-row">
            <span>Kemaskini:</span>
            <small>${fac.lastUpdated}</small>
          </div>
        </div>
        <div class="popup-actions">
          <button class="btn-popup-evac" data-facility-id="${fac.id}">
            🧭 Set Sebagai Destinasi Evakuasi
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml, { className: 'tactical-popup-wrapper' });

    marker.on('click', () => {
      store.selectEntity({ ...fac, entityType: 'facility' });
    });

    marker.on('popupopen', () => {
      const btn = document.querySelector(`.btn-popup-evac[data-facility-id="${fac.id}"]`);
      if (btn) {
        btn.onclick = (e) => {
          e.stopPropagation();
          store.state.routeDestination = fac.id;
          store.setActiveTab('routing');
          store.addLog('info', 'Destinasi Dipilih', `Menetapkan destinasi evakuasi ke: ${fac.name}`);
          marker.closePopup();
        };
      }
    });

    marker.addTo(targetGroup);
    this.markersMap.set(fac.id, marker);
  }

  // Telemetri Sensor Paras Air Pintar
  renderSensors() {
    this.layerGroups.sensors.clearLayers();

    store.state.sensors.forEach(sensor => {
      const isDanger = sensor.status === 'danger';
      const isWarning = sensor.status === 'warning';
      const color = isDanger ? '#ff1744' : (isWarning ? '#ff9100' : '#00e676');

      const sensorHtml = `
        <div class="sensor-marker ${sensor.status}">
          <div class="sensor-ring" style="border-color: ${color}"></div>
          <div class="sensor-core" style="background: ${color}">
            <span class="sensor-val">${sensor.waterLevel}m</span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: sensorHtml,
        className: 'tactical-div-icon sensor-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -15]
      });

      const marker = L.marker(sensor.coordinates, { icon });

      const popupHtml = `
        <div class="map-popup sensor-popup">
          <div class="popup-header">
            <span class="popup-tag tag-${sensor.status}">STATUS: ${sensor.status.toUpperCase()}</span>
            <h4>${sensor.name}</h4>
          </div>
          <div class="popup-body">
            <div class="sensor-display-gauge">
              <span class="gauge-label">Paras Semasa:</span>
              <span class="gauge-value ${sensor.status}">${sensor.waterLevel} Meter</span>
            </div>
            <div class="popup-info-row">
              <span>Aras Amaran / Bahaya:</span>
              <strong>${sensor.warningLevel}m / ${sensor.dangerLevel}m</strong>
            </div>
            <div class="popup-info-row">
              <span>Trend:</span>
              <strong>${sensor.trend === 'rising' ? '⬆️ Sedang Meningkat' : '➡️ Stabil'}</strong>
            </div>
            <div class="popup-info-row">
              <span>Bateri IoT / Terkini:</span>
              <strong>${sensor.battery} (${sensor.lastReading})</strong>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { className: 'tactical-popup-wrapper' });
      marker.addTo(this.layerGroups.sensors);
    });
  }

  // Ikon SVG Khusus & Berkilau
  getCustomIconHtml(fac) {
    let iconSvg = '';
    let bgColor = '#00f2fe';

    switch (fac.type) {
      case 'pps':
        bgColor = '#29b6f6';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
        break;
      case 'medical':
        bgColor = '#ff5252';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`;
        break;
      case 'responder':
        bgColor = '#ff7043';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
        break;
      case 'command':
        bgColor = '#7c4dff';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 19 21 12 17 5 21 12 2"></polygon></svg>`;
        break;
      case 'logistics':
        bgColor = '#26a69a';
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
        break;
      default:
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
    }

    return `
      <div class="tactical-marker-pin" style="--pin-accent: ${bgColor}">
        <div class="pin-glow"></div>
        <div class="pin-icon">${iconSvg}</div>
      </div>
    `;
  }

  // Laluan Evakuasi (Untuk Ahli 4 - Routing)
  drawEvacuationRoute(latLngPoints, isAlternative = false) {
    this.layerGroups.route.clearLayers();

    if (!latLngPoints || latLngPoints.length === 0) return;

    // Garisan glow luar
    L.polyline(latLngPoints, {
      color: isAlternative ? '#00e5ff' : '#00e676',
      weight: 10,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.layerGroups.route);

    // Garisan utama beranimasi
    const routeLine = L.polyline(latLngPoints, {
      color: isAlternative ? '#00f2fe' : '#69f0ae',
      weight: 5,
      opacity: 0.95,
      dashArray: '12, 10',
      className: 'animated-route-flow',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.layerGroups.route);

    // Mula dan Tamat markers
    const startPoint = latLngPoints[0];
    const endPoint = latLngPoints[latLngPoints.length - 1];

    L.circleMarker(startPoint, {
      radius: 8,
      fillColor: '#ffd600',
      fillOpacity: 1,
      color: '#ffffff',
      weight: 2
    }).bindTooltip('Lokasi Permulaan Penduduk', { permanent: true, direction: 'top' })
      .addTo(this.layerGroups.route);

    L.circleMarker(endPoint, {
      radius: 9,
      fillColor: '#00e676',
      fillOpacity: 1,
      color: '#ffffff',
      weight: 2
    }).bindTooltip('Destinasi Selamat (PPS)', { permanent: true, direction: 'top' })
      .addTo(this.layerGroups.route);

    this.map.fitBounds(routeLine.getBounds(), { padding: [60, 60], maxZoom: 16 });
  }

  clearRoute() {
    this.layerGroups.route.clearLayers();
  }

  // Fokus lokasi tertentu
  focusLocation(lat, lng, zoom = 16) {
    this.map.flyTo([lat, lng], zoom, {
      animate: true,
      duration: 1.2
    });
  }

  // Set semula ke paparan penuh bandar Elmina
  resetView() {
    const meta = store.state.meta;
    this.map.flyTo(meta.coordinates, meta.zoom, {
      animate: true,
      duration: 1.0
    });
  }
}
