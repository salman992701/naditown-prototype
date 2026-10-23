/**
 * NADITOWN - Tactical Map Engine
 * Developed for Sime Darby Property - Bandar Elmina Township
 * Component: Interactive Leaflet Map, Tactical Markers,
 * Geo-Layers (Flood Zones, Roads, Facilities, IoT Sensors, Dijkstra Route).
 */

import { store } from './store.js';
import { CONNECTORS, fetchAllRoadGeometries } from './routing.js';

const L = typeof window !== 'undefined' && window.L ? window.L : null;

export class TownshipMap {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.baseLayers = {};
    this.layerGroups = {
      floodZones: L ? L.layerGroup() : null,
      pps: L ? L.layerGroup() : null,
      medical: L ? L.layerGroup() : null,
      responders: L ? L.layerGroup() : null,
      roads: L ? L.layerGroup() : null,
      sensors: L ? L.layerGroup() : null,
      route: L ? L.layerGroup() : null
    };
    this.markersMap = new Map();
    this.roadsMap = new Map();
    this.roadGeometryPromise = null;
  }

  init() {
    if (!L) {
      console.error("Leaflet (L) not found. Please ensure Leaflet CDN is loaded.");
      return;
    }

    const meta = store.state.meta;

    // 1. Initialize Leaflet Map
    this.map = L.map(this.containerId, {
      center: meta.coordinates,
      zoom: meta.zoom,
      minZoom: 12,
      maxZoom: 19,
      zoomControl: false
    });

    // 2. Base Tile Layers
    // Satellite first: real aerial imagery so individual buildings are recognisable
    // when the operator zooms in, similar to Google Maps satellite view.
    this.baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxZoom: 19
    });

    this.baseLayers.street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    this.baseLayers.dark = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, DeLorme, NAVTEQ',
      maxZoom: 16
    });

    this.baseLayers.satellite.addTo(this.map);

    // 3. Add Layer Groups
    Object.values(this.layerGroups).forEach(group => {
      if (group) group.addTo(this.map);
    });

    // 4. Render Initial Layers
    this.renderTownshipBoundary();
    this.renderFloodZones();
    this.renderRoads();
    this.renderFacilities();
    this.renderSensors();
    this.renderActiveRoute();

    // 5. Connect State Listeners
    this.setupStateListeners();

    // 6. Align road-status corridors to OpenStreetMap asynchronously.
    this.snapRoadGeometries();

    // Scale Bar
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(this.map);

    console.log("NADITOWN: Tactical Map initialized for " + meta.name);
  }

  setupStateListeners() {
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

    store.subscribe('map_style_changed', (styleKey) => {
      this.switchBaseLayer(styleKey);
    });

    store.subscribe('road_status_changed', ({ roadId, newStatus }) => {
      this.updateRoadDisplay(roadId, newStatus);
    });

    store.subscribe('roads_updated', () => {
      this.renderRoads();
    });

    store.subscribe('sensors_updated', () => {
      this.renderSensors();
    });

    store.subscribe('simulation_updated', () => {
      this.renderFloodZones();
    });

    store.subscribe('route_recalculated', (routingData) => {
      this.renderActiveRoute(routingData);
    });

    store.subscribe('facility_added', (facility) => {
      this.addFacilityMarker(facility);
    });

    store.subscribe('facility_updated', () => {
      this.renderFacilities();
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

  renderTownshipBoundary() {
    const boundaryCoords = [
      [3.1600, 101.4880],
      [3.1950, 101.4920],
      [3.2100, 101.5200],
      [3.1900, 101.5360],
      [3.1650, 101.5280]
    ];

    L.polygon(boundaryCoords, {
      color: '#117c96',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#117c96',
      fillOpacity: 0.03,
      interactive: false
    }).addTo(this.map);
  }

  renderFloodZones() {
    this.layerGroups.floodZones.clearLayers();
    const multiplier = store.state.simulation.riskMultiplier || 1.0;

    store.state.floodZones.forEach(zone => {
      const polygon = L.polygon(zone.polygon, {
        color: zone.color,
        weight: 2,
        fillColor: zone.fillColor,
        fillOpacity: Math.min(0.65, zone.fillOpacity * (multiplier * 0.9)),
        className: `flood-polygon flood-${zone.severity}`
      });

      polygon.bindTooltip(`
        <div style="font-family: inherit; font-size: 12px; color: #fff;">
          <strong style="color: ${zone.color};">${zone.name}</strong><br>
          <span style="display:inline-block; margin-top:2px; padding: 2px 6px; border-radius: 4px; font-weight:700; font-size:10px; background: ${zone.color}33; color: ${zone.color};">${zone.level}</span><br>
          <small style="color: #a7c3cc;">Expected Water Depth: ${zone.depth}</small>
        </div>
      `, { sticky: true, className: 'leaflet-dark-tooltip' });

      polygon.on('click', () => {
        store.selectEntity({ ...zone, entityType: 'floodZone' });
      });

      polygon.addTo(this.layerGroups.floodZones);
    });
  }

  renderRoads() {
    this.layerGroups.roads.clearLayers();
    this.roadsMap.clear();

    store.state.roads.forEach(road => {
      this.createRoadPolyline(road);
    });

    CONNECTORS.forEach(connector => {
      L.polyline(connector.geometry, {
        color: '#6b8a93',
        weight: 2,
        opacity: 0.55,
        dashArray: '4, 7',
        lineCap: 'round'
      })
        .bindTooltip(`Simulated local connector: ${connector.name}`, { sticky: true, direction: 'top' })
        .addTo(this.layerGroups.roads);
    });
  }

  updateRoadGeometryLegend(summary) {
    const note = document.getElementById('road-geometry-legend-note');
    if (!note) return;

    if (!summary) {
      note.textContent = 'Road status overlay: loading OSM alignment...';
      note.style.color = '#93aab2';
      return;
    }
    if (summary.aligned === summary.total && summary.total > 0) {
      note.textContent = `Road status overlay: ${summary.aligned}/${summary.total} OSM-aligned${summary.cached ? ' (cached)' : ''}`;
      note.style.color = '#33bfd6';
      return;
    }
    if (summary.aligned > 0) {
      note.textContent = `Road status overlay: ${summary.aligned}/${summary.total} OSM-aligned, ${summary.fallback} schematic`;
      note.style.color = '#f59e0b';
      return;
    }
    note.textContent = 'Road status overlay: schematic fallback';
    note.style.color = '#f59e0b';
  }

  async snapRoadGeometries() {
    if (this.roadGeometryPromise) return this.roadGeometryPromise;
    if (typeof fetchAllRoadGeometries !== 'function' || !store.state.roads || store.state.roads.length === 0) {
      this.updateRoadGeometryLegend({ total: 0, aligned: 0, fallback: 0, cached: 0 });
      return null;
    }

    this.updateRoadGeometryLegend(null);
    this.roadGeometryPromise = fetchAllRoadGeometries(store.state.roads, {
      timeoutMs: 8000,
      concurrency: 2
    })
      .then(summary => {
        this.renderRoads();
        this.updateRoadGeometryLegend(summary);
        return summary;
      })
      .catch(error => {
        console.warn('NADITOWN: road geometry alignment failed; keeping schematic corridors.', error);
        this.updateRoadGeometryLegend({ total: store.state.roads.length, aligned: 0, fallback: store.state.roads.length, cached: 0 });
        return null;
      })
      .finally(() => {
        this.roadGeometryPromise = null;
      });
    return this.roadGeometryPromise;
  }

  createRoadPolyline(road) {
    let color = '#33bfd6'; // Green / Clear
    let weight = 5;
    let dashArray = null;

    if (road.status === 'closed') {
      color = '#ef4444'; // Red / Closed
      weight = 6;
      dashArray = '8, 8';
    } else if (road.status === 'hazard') {
      color = '#b45309'; // Amber / Hazard
      weight = 5;
      dashArray = '5, 6';
    }

    const polyline = L.polyline(road.coordinates, {
      color: color,
      weight: weight,
      dashArray: dashArray,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      className: `tactical-road-line road-${road.status}`
    });

    const statusBadge = road.status === 'closed' 
      ? '<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">🔴 ROAD CLOSED</span>'
      : (road.status === 'hazard' 
        ? '<span style="background: rgba(180, 83, 9, 0.2); color: #f59e0b; border: 1px solid #b45309; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">⚠️ WATER LOGGED</span>'
        : '<span style="background: rgba(51, 191, 214, 0.18); color: #33bfd6; border: 1px solid #117c96; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px;">🟢 ROAD CLEAR (OPEN)</span>');

    const popupHtml = `
      <div style="font-family: inherit; color: #f8fafc; min-width: 230px;">
        <div style="margin-bottom: 8px;">
          ${statusBadge}
          <h4 style="margin-top: 6px; font-size: 14px; font-weight: 700; color: #fff;">${road.name}</h4>
        </div>
        <div style="background: #1a2428; padding: 8px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 10px; border: 1px solid #2a3a40;">
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span style="color: #93aab2;">Water Depth:</span>
            <strong style="color: #fff;">${road.surfaceWater}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span style="color: #93aab2;">Passable For:</span>
            <strong style="color: #fff; text-align:right;">${road.passableFor}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span style="color: #93aab2;">Risk Level:</span>
            <strong style="color: ${road.status === 'closed' ? '#ef4444' : (road.status === 'hazard' ? '#f59e0b' : '#33bfd6')};">${road.riskLevel}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color: #93aab2;">Road Geometry:</span>
            <strong style="color: ${road.roadGeometryStatus === 'aligned' ? '#33bfd6' : '#f59e0b'};">${road.roadGeometryStatus === 'aligned' ? 'OSM-aligned' : 'Schematic fallback'}</strong>
          </div>
        </div>
        <button id="toggle-road-btn-${road.id}" ${store.canEdit() ? '' : 'disabled title="Auditors are read-only"'} style="width: 100%; padding: 6px 12px; border-radius: 4px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; background: ${road.status === 'closed' ? '#117c96' : '#ef4444'}; color: #fff; opacity:${store.canEdit() ? '1' : '0.5'};">
          ${road.status === 'closed' ? 'Reopen Road Segment' : 'Close Road Segment (Simulate Flood)'}
        </button>
      </div>
    `;

    polyline.bindPopup(popupHtml, { className: 'tactical-map-popup' });

    polyline.on('popupopen', () => {
      const btn = document.getElementById(`toggle-road-btn-${road.id}`);
      if (btn) {
        btn.onclick = () => {
          if (!store.canEdit()) return;
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

    const existing = this.roadsMap.get(roadId);
    if (existing) {
      this.layerGroups.roads.removeLayer(existing);
    }
    this.createRoadPolyline(road);
  }

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

    const occupancyRate = fac.capacity > 0 ? Math.round((fac.currentOccupants / fac.capacity) * 100) : 0;
    const iconHtml = this.getCustomIconHtml(fac, occupancyRate);

    const customIcon = L.divIcon({
      html: iconHtml,
      className: `tactical-icon-wrap fac-${fac.type}`,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      popupAnchor: [0, -22]
    });

    const marker = L.marker(fac.coordinates, { icon: customIcon });

    const barColor = occupancyRate >= 90 ? '#ef4444' : (occupancyRate >= 70 ? '#b45309' : '#33bfd6');

    const popupHtml = `
      <div style="font-family: inherit; color: #f8fafc; min-width: 250px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: rgba(51, 191, 214, 0.18); color: #9fe8f4; border: 1px solid rgba(51, 191, 214, 0.3);">
            ${fac.category}
          </span>
          <span style="font-size: 11px; color: ${fac.status === 'active' ? '#33bfd6' : (fac.status === 'warning' ? '#f59e0b' : '#93aab2')}; font-weight: 700;">
            ● ${fac.status.toUpperCase()}
          </span>
        </div>
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #fff;">${fac.name}</h4>
        
        <div style="background: #1a2428; padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 10px; border: 1px solid #2a3a40;">
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <span style="color: #93aab2;">Shelter Occupancy:</span>
            <strong style="color: #fff;">${fac.currentOccupants} / ${fac.capacity} (${occupancyRate}%)</strong>
          </div>
          <div style="height: 6px; width: 100%; background: #2a3a40; border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
            <div style="width: ${Math.min(occupancyRate, 100)}%; height: 100%; background: ${barColor};"></div>
          </div>
          <div style="margin-bottom: 4px; color: #cbd5e1;">
            <span style="color: #93aab2;">Amenities:</span> ${fac.amenities.slice(0, 2).join(', ')}
          </div>
          <div style="color: #cbd5e1;">
            <span style="color: #93aab2;">Contact:</span> ${fac.contact}
          </div>
        </div>

        <button id="set-dest-btn-${fac.id}" style="width: 100%; padding: 6px 12px; border-radius: 4px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; background: #117c96; color: #fff;">
          🧭 Set as Simulated Route Destination
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml, { className: 'tactical-map-popup' });

    marker.on('popupopen', () => {
      const btn = document.getElementById(`set-dest-btn-${fac.id}`);
      if (btn) {
        btn.onclick = () => {
          const originId = store.state.routing.originId;
          const nextOriginId = fac.id === originId
            ? store.state.routing.destinationId
            : originId;
          store.setRouteEndpoints(nextOriginId, fac.id);
          marker.closePopup();
        };
      }
    });

    marker.addTo(targetGroup);
    this.markersMap.set(fac.id, marker);
  }

  renderSensors() {
    this.layerGroups.sensors.clearLayers();

    store.state.sensors.forEach(sensor => {
      const isDanger = sensor.status === 'danger';
      const isWarning = sensor.status === 'warning';
      const color = isDanger ? '#ef4444' : (isWarning ? '#b45309' : '#33bfd6');

      const sensorHtml = `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: 0; border-radius: 50%; border: 2px solid ${color}; opacity: 0.8; animation: pulseGlow 2s infinite ease-in-out;"></div>
          <div style="background: #1a2428; border: 2px solid ${color}; border-radius: 50%; width: 34px; height: 34px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 10px ${color}88;">
            <span style="font-size: 10px; font-weight: 800; color: ${color}; line-height: 1;">${sensor.waterLevel}m</span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: sensorHtml,
        className: 'tactical-sensor-icon',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -18]
      });

      const marker = L.marker(sensor.coordinates, { icon });

      const popupHtml = `
        <div style="font-family: inherit; color: #f8fafc; min-width: 240px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${color}22; color: ${color}; border: 1px solid ${color};">
              STATUS: ${sensor.status.toUpperCase()}
            </span>
            <small style="color: #a7c3cc;">Battery ${sensor.battery}</small>
          </div>
          <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #fff;">${sensor.name}</h4>
          
          <div style="background: #1a2428; padding: 10px; border-radius: 6px; font-size: 12px; border: 1px solid #2a3a40;">
            <div style="display:flex; justify-content:space-between; margin-bottom: 6px; align-items:baseline;">
              <span style="color: #93aab2;">Current Water Level:</span>
              <strong style="color: ${color}; font-size: 16px;">${sensor.waterLevel} Meters</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
              <span style="color: #93aab2;">Danger Threshold:</span>
              <strong style="color: #ef4444;">${sensor.dangerLevel}m</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
              <span style="color: #93aab2;">Warning Threshold:</span>
              <strong style="color: #f59e0b;">${sensor.warningLevel}m</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color: #93aab2;">Telemetry Trend:</span>
              <strong style="color: ${sensor.trend === 'rising' ? '#ef4444' : '#33bfd6'};">
                ${sensor.trend === 'rising' ? '⬆️ Rising Rapidly' : '➡️ Steady'}
              </strong>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { className: 'tactical-map-popup' });
      marker.addTo(this.layerGroups.sensors);
    });
  }

  renderActiveRoute(routingData = null) {
    this.layerGroups.route.clearLayers();

    const data = routingData || store.state.routing;
    const points = data.activePath || data.pathCoords || [];
    const startPoint = data.originCoords || (points.length > 0 ? points[0] : null);
    const endPoint = data.destinationCoords || (points.length > 0 ? points[points.length - 1] : null);
    const routeFound = !!data.routeFound && points.length > 1;

    if (routeFound) {
      L.polyline(points, {
        color: '#06252c',
        weight: 10,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.layerGroups.route);

      const geometryLabel = data.roadGeometryStatus === 'aligned'
        ? 'Road-following geometry: OpenStreetMap'
        : 'Schematic graph alignment';

      L.polyline(points, {
        color: '#1fa9b8',
        weight: 6,
        opacity: 0.98,
        lineCap: 'round',
        lineJoin: 'round'
      }).bindPopup(`
        <div style="font-family:inherit; color:#f8fafc; min-width:240px;">
          <strong style="color:#33bfd6;">Road-Following Simulated Route</strong><br>
          <span style="font-size:12px;">${data.originName} &rarr; ${data.destinationName}</span><br>
          <span style="font-size:11px; color:#cbd5e1;">Distance: ${data.pathDistanceKm} km | ETA: ~${data.estimatedTimeMin} min</span><br>
          <span style="font-size:11px; color:${data.hazardSegmentsUsed > 0 ? '#f59e0b' : '#93aab2'};">
            Hazard segments on route: ${data.hazardSegmentsUsed} | Closed segments excluded: ${data.closedRoadsExcluded}
          </span>
          <div style="font-size:10px; color:${data.roadGeometryStatus === 'aligned' ? '#33bfd6' : '#f59e0b'}; margin-top:6px;">${geometryLabel}</div>
          <div style="font-size:10px; color:#93aab2; margin-top:4px;">Simulation only - not a real-world safety assessment.</div>
        </div>
      `, { className: 'tactical-map-popup' }).addTo(this.layerGroups.route);
    }

    if (startPoint) {
      L.circleMarker(startPoint, {
        radius: 8,
        fillColor: '#b45309',
        fillOpacity: 1,
        color: '#ffffff',
        weight: 2
      }).bindTooltip(`Origin: ${data.originName}`, { direction: 'top' })
        .addTo(this.layerGroups.route);
    }

    if (endPoint) {
      L.circleMarker(endPoint, {
        radius: 9,
        fillColor: routeFound ? '#117c96' : '#ef4444',
        fillOpacity: 1,
        color: '#ffffff',
        weight: 2
      }).bindTooltip(
        routeFound ? `Destination: ${data.destinationName}` : `No simulated route reached ${data.destinationName}`,
        { direction: 'top' }
      ).addTo(this.layerGroups.route);
    }
  }

  getCustomIconHtml(fac, occupancyRate) {
    let color = '#33bfd6';
    let iconChar = '🏛️';

    if (fac.type === 'pps') {
      color = '#33bfd6';
      iconChar = '🏠';
    } else if (fac.type === 'medical') {
      color = '#ef4444';
      iconChar = '🏥';
    } else if (fac.type === 'responder') {
      color = '#f97316';
      iconChar = '🚒';
    } else if (fac.type === 'command') {
      color = '#8b5cf6';
      iconChar = '🛡️';
    } else if (fac.type === 'logistics') {
      color = '#4f8b9b';
      iconChar = '📦';
    }

    return `
      <div style="position:relative; width:42px; height:42px; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; inset:0; background: ${color}22; border: 2px solid ${color}; border-radius: 50%; box-shadow: 0 0 12px ${color}66;"></div>
        <div style="position:relative; font-size:18px;">${iconChar}</div>
        ${fac.capacity > 0 ? `<div style="position:absolute; bottom:-4px; background:#1a2428; border: 1px solid ${color}; color:#fff; font-size:9px; font-weight:700; padding:1px 4px; border-radius:10px;">${occupancyRate}%</div>` : ''}
      </div>
    `;
  }

  focusLocation(lat, lng, zoom = 16) {
    if (!this.map) return;
    this.map.flyTo([lat, lng], zoom, { animate: true, duration: 1.0 });
  }

  resetView() {
    if (!this.map) return;
    const meta = store.state.meta;
    this.map.flyTo(meta.coordinates, meta.zoom, { animate: true, duration: 1.0 });
  }
}
