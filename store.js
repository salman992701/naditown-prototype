/**
 * NADITOWN State Manager
 * Facilitates seamless communication across all modules:
 * Ahli 1 (Map & UI), Ahli 2 (Dashboard & Reports), Ahli 3 (Simulation),
 * Ahli 4 (Routing & Dijkstra Engine), and Ahli 5 (Data & Verification).
 */

import { 
  TOWNSHIP_META, 
  FACILITIES, 
  SENSORS, 
  ROAD_SEGMENTS, 
  FLOOD_ZONES, 
  RESOURCES_SUMMARY, 
  INITIAL_EVENT_LOG,
  INITIAL_REQUESTS,
  INITIAL_DECISIONS,
  DECLARED_RESOURCES
} from './data.js';
import { findRoute, fetchRoadFollowingRoute } from './routing.js';
import { auditHash } from './audit.js';

const STORAGE_KEY = 'naditown.operationalState.v1';
const RESIDENT_QUEUE_KEY = 'naditown.sosQueue.v1';
const VALID_ROLES = ['commander', 'operator', 'auditor'];

class StateManager {
  constructor() {
    this.state = {
      meta: { ...TOWNSHIP_META },
      facilities: JSON.parse(JSON.stringify(FACILITIES)),
      sensors: JSON.parse(JSON.stringify(SENSORS)),
      roads: JSON.parse(JSON.stringify(ROAD_SEGMENTS)),
      floodZones: JSON.parse(JSON.stringify(FLOOD_ZONES)),
      resources: JSON.parse(JSON.stringify(RESOURCES_SUMMARY)),
      declaredResources: JSON.parse(JSON.stringify(DECLARED_RESOURCES)),
      requests: JSON.parse(JSON.stringify(INITIAL_REQUESTS)),
      decisions: JSON.parse(JSON.stringify(INITIAL_DECISIONS)),
      eventLogs: JSON.parse(JSON.stringify(INITIAL_EVENT_LOG)).reverse(),
      role: 'commander',
      
      // Multi-Page Navigation State
      // 'dashboard' | 'map' | 'reports' | 'community'
      activePage: 'dashboard',
      emergencyLevel: 'ORANGE', // 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
      activeLayerToggles: {
        floodZones: true,
        pps: true,
        medical: true,
        responders: true,
        roads: true,
        sensors: true,
        route: true
      },
      mapStyle: 'dark', // 'dark' | 'street' | 'satellite'
      selectedEntity: null,
      
      // Simulation State (Ahli 3: Simulation)
      simulation: {
        activePreset: 'sector2_flood',
        rainfall: 68, // mm/h
        waterSurge: 0.95, // meters
        riskMultiplier: 1.4,
        autoRecalculate: true
      },
      
      // Routing & Dijkstra Benchmark (Ahli 4: Routing)
      routing: {
        originId: "pps-01",
        originName: "Elmina West Community Hall",
        originCoords: [3.1855, 101.5042],
        destinationId: "pps-02",
        destinationName: "SK Subang Bestari (Main Hall)",
        destinationCoords: [3.1780, 101.5280],
        activePath: [],
        pathDistanceKm: 0,
        estimatedTimeMin: 0,
        recalcTimeMs: 0,
        bypassedHazards: 0,
        hazardSegmentsUsed: 0,
        closedRoadsExcluded: 0,
        routeFound: false,
        pathStatus: "Calculating simulated route...",
        routePreference: 'safest',
        alternatives: null,
        limitations: []
      },

      // Verification & Compliance (Ahli 5: Verification)
      verification: {
        lastSync: new Date().toLocaleTimeString('en-GB'),
        totalMatchedCount: 4,
        totalApprovalsCount: 2,
        recalcBenchmarkMs: 8.4,
        systemAuditHash: 'GENESIS',
        chainLength: 0,
        chainValid: true,
        lastVerifiedAt: null,
        blockedAllocations: 0
      }
    };

    this.listeners = new Map();
    this._lastRouteFingerprint = null;
    this._persistTimer = null;
    this._hydrated = false;
    this._resetting = false;
    this._restorePersistedState();
    this.normalizeDeclaredResources();
    this.syncSummaryFromResources();
    this.rebuildAuditChain();
    this._hydrated = true;
    this.computeDijkstraRoute(false);
    this._bindStorageEvents();
  }

  _bindStorageEvents() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('storage', event => {
      if (event.key === RESIDENT_QUEUE_KEY) this.importResidentQueue();
    });
    window.addEventListener('beforeunload', () => this.persistState());
    setInterval(() => this.importResidentQueue(), 5000);
  }

  _restorePersistedState() {
    if (typeof localStorage === 'undefined') return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved || saved.version !== 1 || !saved.state) return false;
      const next = saved.state;
      ['facilities', 'sensors', 'roads', 'floodZones', 'resources', 'declaredResources', 'requests', 'decisions', 'eventLogs'].forEach(key => {
        if (next[key] !== undefined) this.state[key] = next[key];
      });
      if (next.simulation) this.state.simulation = { ...this.state.simulation, ...next.simulation };
      if (next.verification) this.state.verification = { ...this.state.verification, ...next.verification };
      if (next.routing) {
        this.state.routing = {
          ...this.state.routing,
          originId: next.routing.originId || this.state.routing.originId,
          destinationId: next.routing.destinationId || this.state.routing.destinationId,
          routePreference: next.routing.routePreference === 'fastest' ? 'fastest' : 'safest'
        };
      }
      if (VALID_ROLES.includes(next.role)) this.state.role = next.role;
      if (Number.isFinite(next.emergencyLevel)) this.state.emergencyLevel = next.emergencyLevel;
      else if (typeof next.emergencyLevel === 'string') this.state.emergencyLevel = next.emergencyLevel;
      return true;
    } catch (error) {
      console.warn('NADITOWN: stored operational state could not be restored.', error);
      return false;
    }
  }

  _serializableState() {
    return {
      facilities: this.state.facilities,
      sensors: this.state.sensors,
      roads: this.state.roads,
      floodZones: this.state.floodZones,
      resources: this.state.resources,
      declaredResources: this.state.declaredResources,
      requests: this.state.requests,
      decisions: this.state.decisions,
      eventLogs: this.state.eventLogs,
      simulation: this.state.simulation,
      emergencyLevel: this.state.emergencyLevel,
      role: this.state.role,
      routing: {
        originId: this.state.routing.originId,
        destinationId: this.state.routing.destinationId,
        routePreference: this.state.routing.routePreference
      },
      verification: this.state.verification
    };
  }

  schedulePersist() {
    if (!this._hydrated || this._resetting || typeof localStorage === 'undefined') return;
    clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => this.persistState(), 150);
  }

  persistState() {
    if (!this._hydrated || this._resetting || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        state: this._serializableState()
      }));
    } catch (error) {
      console.warn('NADITOWN: operational state could not be persisted.', error);
    }
  }

  resetDemo() {
    this._resetting = true;
    clearTimeout(this._persistTimer);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(RESIDENT_QUEUE_KEY);
    } catch (error) {
      // Ignore storage errors in restricted contexts.
    }
    window.location.hash = 'dashboard';
    window.location.reload();
  }

  setRole(role) {
    if (!VALID_ROLES.includes(role)) return this.state.role;
    this.state.role = role;
    this.addLog('info', 'ROLE', `Operator role switched to ${role.toUpperCase()}.`, 'PKOB Access Control', { actorRole: 'system' });
    this.emit('role_changed', role);
    return role;
  }

  canEdit() {
    return this.state.role !== 'auditor';
  }

  canApprove() {
    return this.state.role === 'commander';
  }

  // Subscribe to state events
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => {
      const callbacks = this.listeners.get(event);
      this.listeners.set(event, callbacks.filter(cb => cb !== callback));
    };
  }

  // Emit event
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in listener for [${event}]:`, err);
        }
      });
    }
    if (event !== 'change' && this.listeners.has('change')) {
      this.listeners.get('change').forEach(cb => cb({ event, data }));
    }
    this.schedulePersist();
  }

  // Multi-Page Navigation setter
  setActivePage(pageId) {
    this.state.activePage = pageId;
    this.emit('page_changed', pageId);
  }

  toggleLayer(layerKey, isVisible) {
    this.state.activeLayerToggles[layerKey] = isVisible;
    this.emit('layer_toggled', { layerKey, isVisible });
  }

  setMapStyle(style) {
    this.state.mapStyle = style;
    this.emit('map_style_changed', style);
  }

  selectEntity(entity) {
    this.state.selectedEntity = entity;
    this.emit('entity_selected', entity);
  }

  setEmergencyLevel(level) {
    this.state.emergencyLevel = level;
    this.emit('emergency_level_changed', level);
  }

  // ==========================================
  // FLOOD & ROAD CLOSURE SIMULATION (Ahli 3)
  // ==========================================
  setSimulationValue(key, value) {
    this.state.simulation[key] = parseFloat(value);
    this.state.simulation.activePreset = 'custom';
    this.applyHydrologyModel();
  }

  applyScenarioPreset(presetName) {
    this.state.simulation.activePreset = presetName;

    if (presetName === 'normal') {
      this.state.simulation.rainfall = 12;
      this.state.simulation.waterSurge = 0.05;
      this.state.simulation.riskMultiplier = 1.0;
      this.state.emergencyLevel = 'GREEN';
      this.state.roads.forEach(r => {
        r.status = 'clear';
        r.surfaceWater = '0 cm';
        r.riskLevel = 'Low';
        r.passableFor = 'All Vehicles';
      });
      this.addLog('info', 'SIMULATION', 'Normal Baseline Scenario (Dry Weather) activated.', 'PKOB Command Desk');
    } else if (presetName === 'sector2_flood') {
      this.state.simulation.rainfall = 68;
      this.state.simulation.waterSurge = 0.95;
      this.state.simulation.riskMultiplier = 1.4;
      this.state.emergencyLevel = 'ORANGE';
      this.setRoadStatusDirect('road-02', 'closed', '65 cm (Rapid Flow)', 'Danger', 'Closed (Boats Only)');
      this.setRoadStatusDirect('road-05', 'hazard', '25 cm', 'Moderate', 'Emergency Vehicles Only');
      this.setRoadStatusDirect('road-03', 'hazard', '20 cm', 'Moderate', 'Heavy 4x4 Only');
      this.setRoadStatusDirect('road-01', 'clear', '0 cm', 'Low', 'All Vehicles');
      this.setRoadStatusDirect('road-04', 'clear', '0 cm', 'Low', 'All Vehicles (Evacuation Bypass)');
      this.setRoadStatusDirect('road-06', 'clear', '0 cm', 'Low', 'All Vehicles');
      this.addLog('warning', 'SIMULATION', 'Sector 2 Flash Flood Alert & Sg. Buloh Bridge Breach activated.', 'PKOB Command Desk');
    } else if (presetName === 'monsoon_deluge') {
      this.state.simulation.rainfall = 118;
      this.state.simulation.waterSurge = 1.75;
      this.state.simulation.riskMultiplier = 1.9;
      this.state.emergencyLevel = 'RED';
      this.setRoadStatusDirect('road-02', 'closed', '95 cm (Full Inundation)', 'Danger', 'Closed (Boats Only)');
      this.setRoadStatusDirect('road-05', 'closed', '55 cm (Lake Overflow)', 'Danger', 'Closed (Boats Only)');
      this.setRoadStatusDirect('road-03', 'closed', '45 cm', 'Danger', 'Closed (Boats Only)');
      this.setRoadStatusDirect('road-01', 'hazard', '30 cm', 'Moderate', 'Heavy 4x4 Only');
      this.setRoadStatusDirect('road-04', 'clear', '0 cm', 'Low', 'All Vehicles (Main Bypass)');
      this.setRoadStatusDirect('road-06', 'clear', '10 cm', 'Low', 'All Vehicles');
      this.addLog('danger', 'SIMULATION', 'Severe Monsoon Deluge (Multi-Sector Inundation) activated!', 'PKOB Command Desk');
    } else if (presetName === 'max_evacuation') {
      this.state.simulation.rainfall = 145;
      this.state.simulation.waterSurge = 2.40;
      this.state.simulation.riskMultiplier = 2.4;
      this.state.emergencyLevel = 'RED';
      this.setRoadStatusDirect('road-02', 'closed', '120 cm (Critical Overflow)', 'Danger', 'Closed');
      this.setRoadStatusDirect('road-05', 'closed', '80 cm', 'Danger', 'Closed');
      this.setRoadStatusDirect('road-03', 'closed', '70 cm', 'Danger', 'Closed');
      this.setRoadStatusDirect('road-01', 'closed', '50 cm', 'Danger', 'Closed');
      this.setRoadStatusDirect('road-04', 'hazard', '20 cm', 'Moderate', 'Heavy 4x4 Only');
      this.setRoadStatusDirect('road-06', 'clear', '10 cm', 'Low', 'All Vehicles');
      this.addLog('danger', 'SIMULATION', 'Maximum Evacuation Surge Stress Test activated.', 'PKOB Command Desk');
    }

    this.applyHydrologyModel();
  }

  // Hydrology model updating sensor readings dynamically
  applyHydrologyModel() {
    const { rainfall, waterSurge, riskMultiplier } = this.state.simulation;

    this.state.sensors.forEach(sensor => {
      let baseRise = waterSurge * (riskMultiplier * 0.85);
      if (sensor.id === 'sensor-02') { // Sungai Buloh bridge (most sensitive)
        sensor.waterLevel = Number((1.20 + baseRise * 1.35 + (rainfall / 140)).toFixed(2));
      } else if (sensor.id === 'sensor-01') { // Retention Pond West
        sensor.waterLevel = Number((1.50 + baseRise * 1.10 + (rainfall / 160)).toFixed(2));
      } else if (sensor.id === 'sensor-04') { // Denai Alam Drain
        sensor.waterLevel = Number((1.00 + baseRise * 1.05 + (rainfall / 150)).toFixed(2));
      } else { // Rainbow Bridge
        sensor.waterLevel = Number((1.10 + baseRise * 0.80 + (rainfall / 190)).toFixed(2));
      }

      if (sensor.waterLevel >= sensor.dangerLevel) {
        sensor.status = 'danger';
        sensor.trend = 'rising';
      } else if (sensor.waterLevel >= sensor.warningLevel) {
        sensor.status = 'warning';
        sensor.trend = 'rising';
      } else {
        sensor.status = 'normal';
        sensor.trend = 'steady';
      }
    });

    if (this.state.simulation.activePreset === 'custom') {
      const sgBulohWater = this.state.sensors.find(s => s.id === 'sensor-02')?.waterLevel || 0;
      const pondWater = this.state.sensors.find(s => s.id === 'sensor-01')?.waterLevel || 0;

      if (sgBulohWater >= 3.10) {
        this.setRoadStatusDirect('road-02', 'closed', `${Math.round((sgBulohWater - 2.5) * 50)} cm`, 'Danger', 'Closed (Boats Only)');
      } else if (sgBulohWater >= 2.40) {
        this.setRoadStatusDirect('road-02', 'hazard', '20 cm', 'Moderate', 'Heavy 4x4 Only');
      } else {
        this.setRoadStatusDirect('road-02', 'clear', '0 cm', 'Low', 'All Vehicles');
      }

      if (pondWater >= 3.10) {
        this.setRoadStatusDirect('road-05', 'closed', `${Math.round((pondWater - 2.6) * 40)} cm`, 'Danger', 'Closed');
      } else if (pondWater >= 2.50) {
        this.setRoadStatusDirect('road-05', 'hazard', '15 cm', 'Moderate', 'Emergency Vehicles Only');
      } else {
        this.setRoadStatusDirect('road-05', 'clear', '0 cm', 'Low', 'All Vehicles');
      }
    }

    this.computeDijkstraRoute(true);

    this.emit('simulation_updated', this.state.simulation);
    this.emit('sensors_updated', this.state.sensors);
    this.emit('roads_updated', this.state.roads);
  }

  setRoadStatusDirect(roadId, newStatus, surfaceWater, riskLevel, passableFor) {
    const road = this.state.roads.find(r => r.id === roadId);
    if (road) {
      road.status = newStatus;
      if (surfaceWater) road.surfaceWater = surfaceWater;
      if (riskLevel) road.riskLevel = riskLevel;
      if (passableFor) road.passableFor = passableFor;
    }
  }

  setRoadStatus(roadId, newStatus) {
    if (!this.canEdit()) return { ok: false, code: 'not_authorized', message: 'Auditors cannot change road status.' };
    const road = this.state.roads.find(r => r.id === roadId);
    if (road) {
      road.status = newStatus;
      if (newStatus === 'closed') {
        road.surfaceWater = "55 cm (Inundation)";
        road.riskLevel = "Danger";
        road.passableFor = "Closed (Boats Only)";
      } else if (newStatus === 'hazard') {
        road.surfaceWater = "25 cm";
        road.riskLevel = "Moderate";
        road.passableFor = "Heavy 4x4 Only";
      } else {
        road.surfaceWater = "0 cm";
        road.riskLevel = "Low";
        road.passableFor = "All Vehicles";
      }

      this.addLog(
        newStatus === 'closed' ? 'danger' : (newStatus === 'hazard' ? 'warning' : 'success'),
        'ROAD_STATUS',
        `Operator manually changed status of [${road.name}] to ${newStatus.toUpperCase()}`,
        'PKOB Operator OPR-8841'
      );

      this.computeDijkstraRoute(true);
      this.emit('road_status_changed', { roadId, newStatus, road });
      this.emit('roads_updated', this.state.roads);
    }
  }

  // ==========================================
  // DIJKSTRA / A* ROUTING ENGINE (Ahli 4)
  // ==========================================
  setRouteEndpoints(originId, destinationId, recordLog = true) {
    const origin = this.state.facilities.find(f => f.id === originId);
    const destination = this.state.facilities.find(f => f.id === destinationId);
    if (!origin || !destination) {
      console.warn('Route endpoints not found in facilities dataset.');
      return null;
    }

    this.state.routing.originId = origin.id;
    this.state.routing.destinationId = destination.id;
    return this.computeDijkstraRoute(recordLog);
  }

  setRoutePreference(preference, recordLog = true) {
    this.state.routing.routePreference = preference === 'fastest' ? 'fastest' : 'safest';
    if (recordLog) {
      this.addLog(
        'info',
        'REROUTE',
        `Route priority set to ${this.state.routing.routePreference.toUpperCase()} (${this.state.routing.routePreference === 'safest' ? 'hazard-avoidance cost active' : 'travel-time only'}).`,
        'PKOB Route Engine'
      );
    }
    return this.computeDijkstraRoute(recordLog);
  }

  _routeOptions() {
    return this.state.routing.routePreference === 'fastest'
      ? { costModel: 'time', hazardPenaltyMinutes: 0 }
      : { costModel: 'time', hazardPenaltyMinutes: 25 };
  }

  _routeSummary(result) {
    if (!result) return null;
    return {
      found: Boolean(result.routeFound),
      distanceKm: result.pathDistanceKm,
      etaMin: result.estimatedTimeMin,
      hazardSegmentsUsed: result.hazardSegmentsUsed,
      closedRoadsExcluded: result.closedRoadsExcluded,
      activeRoadIds: (result.roadsUsed || []).map(road => road.roadId),
      pathStatus: result.pathStatus
    };
  }

  backfillRequestRoutes(force = false) {
    let updated = 0;
    this.state.requests.forEach(request => {
      if (!['matched', 'dispatched', 'resolved'].includes(request.status)) return;
      if (!force && request.matchRoute && Number.isFinite(request.matchRoute.etaMin)) return;
      const resource = request.matchedResourceId
        ? this.state.declaredResources.find(item => item.id === request.matchedResourceId)
        : null;
      const facility = resource ? this.state.facilities.find(item => item.id === resource.facilityId) : null;
      const coordinates = this.requestCoordinates(request);
      if (!facility || !coordinates) return;
      const route = findRoute(
        facility,
        { id: request.id, name: request.location || request.requester, coordinates },
        this.state.roads,
        this._routeOptions()
      );
      if (!route || !route.routeFound) {
        if (force && request.matchRoute) {
          request.matchRoute = null;
          request.eta = 'Route unavailable';
          updated += 1;
        }
        return;
      }
      request.matchRoute = this._routeSummary(route);
      request.eta = `${route.estimatedTimeMin} mins`;
      updated += 1;
    });
    if (updated > 0) {
      this.emit('requests_updated');
      this.emit('coordination_updated', this.getCoordinationMetrics());
      this.emit('verification_updated', this.state.verification);
    }
    return updated;
  }

  async computeDijkstraRoute(recordLog = false) {
    const routing = this.state.routing;
    const requestId = (this._routeRequestId || 0) + 1;
    this._routeRequestId = requestId;
    let origin = this.state.facilities.find(f => f.id === routing.originId);
    let destination = this.state.facilities.find(f => f.id === routing.destinationId);

    if (!origin) {
      origin = this.state.facilities[0];
      routing.originId = origin.id;
    }
    if (!destination) {
      destination = this.state.facilities.find(f => f.id !== origin.id) || this.state.facilities[0];
      routing.destinationId = destination.id;
    }

    const preference = routing.routePreference === 'fastest' ? 'fastest' : 'safest';
    const fastestResult = findRoute(origin, destination, this.state.roads, {
      costModel: 'time',
      hazardPenaltyMinutes: 0
    });
    const safestResult = findRoute(origin, destination, this.state.roads, {
      costModel: 'time',
      hazardPenaltyMinutes: 25
    });
    const fastestEnriched = await fetchRoadFollowingRoute(fastestResult, this.state.roads);
    if (requestId !== this._routeRequestId) return null;
    const safestEnriched = await fetchRoadFollowingRoute(safestResult, this.state.roads);
    if (requestId !== this._routeRequestId) return null;
    const result = preference === 'fastest' ? fastestEnriched : safestEnriched;

    routing.originId = origin.id;
    routing.originName = origin.name;
    routing.originCoords = origin.coordinates;
    routing.destinationId = destination.id;
    routing.destinationName = destination.name;
    routing.destinationCoords = destination.coordinates;
    routing.routePreference = preference;
    Object.assign(routing, result);
    routing.alternatives = {
      fastest: this._routeSummary(fastestEnriched),
      safest: this._routeSummary(safestEnriched)
    };

    this.state.verification.recalcBenchmarkMs = result.recalcTimeMs;
    this.state.verification.lastSync = new Date().toLocaleTimeString('en-GB');

    const fingerprint = [
      routing.originId,
      routing.destinationId,
      routing.routePreference,
      routing.routeFound ? 'found' : 'none',
      routing.pathDistanceKm,
      routing.hazardSegmentsUsed,
      routing.closedRoadsExcluded,
      routing.activePath.map(point => point.join(',')).join('|')
    ].join('::');

    if (recordLog && fingerprint !== this._lastRouteFingerprint) {
      const message = routing.routeFound
        ? `Dijkstra simulated route computed in ${result.recalcTimeMs} ms: ${routing.originName} to ${routing.destinationName}, ${routing.pathDistanceKm} km, ${routing.estimatedTimeMin} min, ${routing.hazardSegmentsUsed} hazard segment(s), ${routing.closedRoadsExcluded} closed segment(s) excluded.`
        : `No simulated route found from ${routing.originName} to ${routing.destinationName} with current closures (${routing.closedRoadsExcluded} closed segment(s) excluded).`;
      this.addLog(routing.routeFound ? 'success' : 'danger', 'REROUTE', message, 'NADITOWN Route Engine');
    }

    this._lastRouteFingerprint = fingerprint;

    this.backfillRequestRoutes(true);
    this.emit('route_recalculated', routing);
    this.emit('verification_updated', this.state.verification);
    return routing;
  }

  // ==========================================
  // DECISION SUPPORT & APPROVALS (Ahli 2)
  // ==========================================
  approveDecision(decisionId) {
    const dec = this.state.decisions.find(d => d.id === decisionId);
    if (!dec) return { ok: false, code: 'not_found' };
    if (!this.canApprove()) {
      return { ok: false, code: 'not_authorized', message: 'Commander authorization is required for this approval.' };
    }

    dec.status = 'approved';
    this.state.verification.totalApprovalsCount += 1;

    if (dec.actionType === 'reroute_guthrie') {
      this.setRoadStatusDirect('road-02', 'closed', '65 cm', 'Danger', 'Closed (Boats Only)');
      this.computeDijkstraRoute(false);
      this.addLog('success', 'APPROVAL', `OPERATOR APPROVAL CONFIRMED: ${dec.title}. Variable Message Signs (VMS) activated.`, 'PKOB Operator OPR-8841');
    } else if (dec.actionType === 'activate_pps_denai') {
      const pps3 = this.state.facilities.find(f => f.id === 'pps-03');
      if (pps3) {
        pps3.status = 'active';
        pps3.availabilityStatus = 'available';
        pps3.acceptingIntake = true;
        pps3.limitations = pps3.limitations.filter(item => !item.toLowerCase().includes('not activated'));
        pps3.lastUpdated = 'Just now';
      }
      this.addLog('success', 'APPROVAL', `OPERATOR APPROVAL CONFIRMED: Denai Alam Sports Complex activated as Active Evacuation Shelter.`, 'PKOB Operator OPR-8841');
      this.emit('facility_updated', pps3);
    } else if (dec.actionType === 'dispatch_boats') {
      const boats = this.state.declaredResources.find(resource => resource.id === 'res-boat-01');
      const deployable = boats ? Math.min(2, this.getResourceAvailable(boats)) : 0;
      if (boats && deployable > 0) {
        boats.quantityAllocated += deployable;
        boats.lastUpdated = 'Just now';
        this.syncResourceStatus(boats);
        this.syncSummaryFromResources();
        this.emit('resource_updated', boats);
      }
      this.addLog('success', 'APPROVAL', `OPERATOR APPROVAL CONFIRMED: ${deployable}x JBPM Water Rescue Boat(s) dispatched to Lowland Flood Basin.`, 'PKOB Operator OPR-8841');
      this.emit('resources_updated', this.state.resources);
    } else {
      this.addLog('success', 'APPROVAL', `OPERATOR APPROVAL CONFIRMED: ${dec.title}`, 'PKOB Operator OPR-8841');
    }

    this.emit('decision_updated', dec);
    this.emit('coordination_updated', this.getCoordinationMetrics());
    this.emit('verification_updated', this.state.verification);
    return { ok: true, code: 'approved', decision: dec };
  }

  dismissDecision(decisionId, reason = "Dismissed by operator following risk re-assessment") {
    const dec = this.state.decisions.find(d => d.id === decisionId);
    if (!dec) return { ok: false, code: 'not_found' };
    if (!this.canEdit()) return { ok: false, code: 'not_authorized', message: 'Auditors cannot change decisions.' };

    dec.status = 'dismissed';
    this.addLog('info', 'OVERRIDE', `DECISION DISMISSED: ${dec.id} (${dec.title}). Reason: ${reason}`, 'PKOB Operator OPR-8841');
    this.emit('decision_updated', dec);
    return { ok: true, code: 'dismissed', decision: dec };
  }

  // ==========================================
  // FACILITY & RESOURCE COORDINATION (Ahli 2 & 5)
  // ==========================================
  normalizeDeclaredResources() {
    this.state.declaredResources.forEach(resource => {
      resource.quantityTotal = Math.max(0, Number(resource.quantityTotal) || 0);
      resource.quantityAllocated = Math.min(
        resource.quantityTotal,
        Math.max(0, Number(resource.quantityAllocated) || 0)
      );
      resource.quantityUnavailable = Math.min(
        resource.quantityTotal - resource.quantityAllocated,
        Math.max(0, Number(resource.quantityUnavailable) || 0)
      );
      this.syncResourceStatus(resource);
    });
  }

  getResourceAvailable(resource) {
    if (!resource) return 0;
    return Math.max(
      0,
      (Number(resource.quantityTotal) || 0) -
      (Number(resource.quantityAllocated) || 0) -
      (Number(resource.quantityUnavailable) || 0)
    );
  }

  syncResourceStatus(resource) {
    if (!resource) return null;
    const available = this.getResourceAvailable(resource);
    if (resource.availability !== 'unavailable' && resource.availability !== 'maintenance') {
      if (available <= 0) resource.availability = 'depleted';
      else if (resource.availability === 'depleted') resource.availability = 'available';
    }
    if (resource.quantityAllocated <= 0) resource.allocationStatus = 'unallocated';
    else if (available <= 0) resource.allocationStatus = 'fully_allocated';
    else resource.allocationStatus = 'partially_allocated';
    return resource;
  }

  syncSummaryFromResources() {
    const findResource = id => this.state.declaredResources.find(resource => resource.id === id);
    const boats = findResource('res-boat-01');
    const vehicles = findResource('res-4x4-01');
    const food = findResource('res-food-01');
    const medicalTeams = findResource('res-med-team-01');
    const generators = findResource('res-gen-01');

    if (food) {
      this.state.resources.foodPacks.total = food.quantityTotal;
      this.state.resources.foodPacks.distributed = food.quantityAllocated;
      this.state.resources.foodPacks.stockRemaining = this.getResourceAvailable(food);
    }
    if (boats) {
      this.state.resources.rescueBoats.total = boats.quantityTotal;
      this.state.resources.rescueBoats.deployed = boats.quantityAllocated;
      this.state.resources.rescueBoats.standby = this.getResourceAvailable(boats);
    }
    if (vehicles) {
      this.state.resources.fourByFourVehicles.total = vehicles.quantityTotal;
      this.state.resources.fourByFourVehicles.deployed = vehicles.quantityAllocated;
      this.state.resources.fourByFourVehicles.standby = this.getResourceAvailable(vehicles);
    }
    if (medicalTeams) {
      this.state.resources.medicalTeams.total = medicalTeams.quantityTotal;
      this.state.resources.medicalTeams.deployed = medicalTeams.quantityAllocated;
      this.state.resources.medicalTeams.standby = this.getResourceAvailable(medicalTeams);
    }
    if (generators) {
      this.state.resources.emergencyGenerators.total = generators.quantityTotal;
      this.state.resources.emergencyGenerators.operational = this.getResourceAvailable(generators);
      this.state.resources.emergencyGenerators.underMaintenance = generators.quantityUnavailable;
    }

    const approvedShelters = this.state.facilities.filter(facility => facility.shelterApproved);
    this.state.resources.totalPPSCapacity = approvedShelters.reduce((sum, facility) => sum + Number(facility.capacity || 0), 0);
    this.state.resources.currentPPSOccupancy = approvedShelters.reduce((sum, facility) => sum + Number(facility.currentOccupants || 0), 0);
    this.state.resources.availableBeds = Math.max(
      0,
      this.state.resources.totalPPSCapacity - this.state.resources.currentPPSOccupancy
    );
  }

  getFacilityRemainingCapacity(facility) {
    if (!facility) return 0;
    return Math.max(0, Number(facility.capacity || 0) - Number(facility.currentOccupants || 0));
  }

  isFacilityAvailable(facility) {
    if (!facility) return false;
    const availability = facility.availabilityStatus || 'available';
    return availability !== 'unavailable' && !['closed', 'unavailable'].includes(facility.status);
  }

  getCoordinationMetrics() {
    const facilities = this.state.facilities;
    const resources = this.state.declaredResources;
    const requests = this.state.requests;
    const approvedShelters = facilities.filter(facility => facility.shelterApproved);

    return {
      availableFacilities: facilities.filter(facility => this.isFacilityAvailable(facility)).length,
      unavailableFacilities: facilities.filter(facility => !this.isFacilityAvailable(facility)).length,
      approvedShelters: approvedShelters.length,
      availableShelterBeds: approvedShelters.reduce(
        (sum, facility) => sum + (facility.acceptingIntake ? this.getFacilityRemainingCapacity(facility) : 0),
        0
      ),
      availableUnits: resources.reduce((sum, resource) => sum + this.getResourceAvailable(resource), 0),
      allocatedUnits: resources.reduce((sum, resource) => sum + Number(resource.quantityAllocated || 0), 0),
      allocatedResourceCount: resources.filter(resource => Number(resource.quantityAllocated || 0) > 0).length,
      attentionRequests: requests.filter(request => ['pending', 'insufficient', 'unmatched'].includes(request.status)).length,
      unmatchedRequests: requests.filter(request => request.status === 'unmatched').length,
      insufficientRequests: requests.filter(request => request.status === 'insufficient').length,
      matchedRequests: requests.filter(request => ['matched', 'dispatched', 'resolved'].includes(request.status)).length
    };
  }

  getImpactMetrics() {
    const requests = this.state.requests;
    const covered = requests.filter(request => ['matched', 'dispatched', 'resolved'].includes(request.status)).length;
    const etas = requests
      .map(request => request.matchRoute?.etaMin ?? null)
      .filter(value => Number.isFinite(value));
    const averageEta = etas.length ? Math.round(etas.reduce((sum, value) => sum + value, 0) / etas.length) : null;
    const routing = this.state.routing;
    const fastest = routing.alternatives?.fastest;
    const safest = routing.alternatives?.safest;
    return {
      requestsTotal: requests.length,
      requestsCovered: covered,
      coveragePct: requests.length ? Math.round((covered / requests.length) * 100) : 0,
      averageEtaMin: averageEta,
      activeRouteHazards: routing.hazardSegmentsUsed || 0,
      activeRouteClosedAvoided: routing.closedRoadsExcluded || 0,
      fastestHazards: fastest?.hazardSegmentsUsed ?? null,
      safestHazards: safest?.hazardSegmentsUsed ?? null,
      overAllocationsBlocked: Number(this.state.verification.blockedAllocations || 0),
      availableShelterBeds: this.state.resources.availableBeds || 0,
      auditChainValid: Boolean(this.state.verification.chainValid),
      auditEntries: this.state.verification.chainLength || this.state.eventLogs.length
    };
  }

  buildSituationReport() {
    const metrics = this.getImpactMetrics();
    const coordination = this.getCoordinationMetrics();
    return {
      generatedAt: new Date().toISOString(),
      township: this.state.meta.name,
      district: this.state.meta.district,
      incident: this.state.simulation.label || 'Sector 2 Flash Flood',
      emergencyLevel: this.state.emergencyLevel,
      role: this.state.role,
      route: {
        origin: this.state.routing.originName,
        destination: this.state.routing.destinationName,
        preference: this.state.routing.routePreference,
        distanceKm: this.state.routing.pathDistanceKm,
        etaMin: this.state.routing.estimatedTimeMin,
        hazards: this.state.routing.hazardSegmentsUsed,
        closuresAvoided: this.state.routing.closedRoadsExcluded,
        pathStatus: this.state.routing.pathStatus,
        alternatives: this.state.routing.alternatives
      },
      roads: {
        clear: this.state.roads.filter(road => road.status === 'clear').length,
        hazard: this.state.roads.filter(road => road.status === 'hazard').length,
        closed: this.state.roads.filter(road => road.status === 'closed').length,
        closedNames: this.state.roads.filter(road => road.status === 'closed').map(road => road.name)
      },
      requests: {
        total: metrics.requestsTotal,
        covered: metrics.requestsCovered,
        coveragePct: metrics.coveragePct,
        pending: this.state.requests.filter(request => request.status === 'pending').length,
        insufficient: this.state.requests.filter(request => request.status === 'insufficient').length,
        unmatched: this.state.requests.filter(request => request.status === 'unmatched').length,
        dispatched: this.state.requests.filter(request => request.status === 'dispatched').length
      },
      resources: {
        availableUnits: coordination.availableUnits,
        allocatedUnits: coordination.allocatedUnits,
        availableShelterBeds: coordination.availableShelterBeds,
        overAllocationsBlocked: metrics.overAllocationsBlocked
      },
      decisions: {
        pending: this.state.decisions.filter(decision => decision.status === 'pending').length,
        approved: this.state.decisions.filter(decision => decision.status === 'approved').length,
        dismissed: this.state.decisions.filter(decision => decision.status === 'dismissed').length
      },
      audit: {
        chainValid: metrics.auditChainValid,
        entries: metrics.auditEntries,
        headHash: this.state.verification.systemAuditHash,
        lastVerifiedAt: this.state.verification.lastVerifiedAt
      },
      requestsDetail: this.state.requests.map(request => ({
        id: request.id,
        requester: request.requester,
        location: request.location,
        need: request.need,
        status: request.status,
        urgency: request.urgency,
        resource: request.matchedResource,
        eta: request.eta
      }))
    };
  }

  inferCategoryForResource(text) {
    const value = String(text || '').toLowerCase();
    if (value.includes('boat') || value.includes('water rescue')) return 'water_rescue';
    if (value.includes('ambulance') || value.includes('medic')) return 'medical_evacuation';
    if (value.includes('generator') || value.includes('power')) return 'power_supply';
    if (value.includes('mattress') || value.includes('hygiene') || value.includes('shelter kit')) return 'shelter_supplies';
    if (value.includes('4x4') || value.includes('evacuation')) return 'evacuation_transport';
    if (value.includes('truck') || value.includes('logistics') || value.includes('food')) return 'food_supply';
    return 'logistics';
  }

  defaultResourceTypeForCategory(category) {
    return {
      medical_evacuation: 'ambulance',
      medical_support: 'medical_team',
      water_rescue: 'boat',
      food_supply: 'food',
      shelter_supplies: 'shelter_kit',
      power_supply: 'generator',
      evacuation_transport: '4x4',
      logistics: 'truck',
      aerial_medical: 'helicopter'
    }[category] || 'logistics';
  }

  defaultUnitForCategory(category) {
    return {
      medical_evacuation: 'ambulance',
      medical_support: 'teams',
      water_rescue: 'boats',
      food_supply: 'packs',
      shelter_supplies: 'kits',
      power_supply: 'generators',
      evacuation_transport: 'vehicles',
      logistics: 'trucks',
      aerial_medical: 'aircraft'
    }[category] || 'units';
  }

  sectorCoordinates(location) {
    const match = String(location || '').match(/sector\s*([1-7])/i);
    const sector = match ? Number(match[1]) : null;
    const centroids = {
      1: [3.1552, 101.5102],
      2: [3.1592, 101.5254],
      3: [3.1668, 101.5412],
      4: [3.1741, 101.5538],
      5: [3.1812, 101.5664],
      6: [3.1885, 101.5792],
      7: [3.1958, 101.5918]
    };
    return sector && centroids[sector] ? centroids[sector] : null;
  }

  requestCoordinates(request) {
    if (Array.isArray(request.coordinates) && request.coordinates.length >= 2) return request.coordinates;
    return this.sectorCoordinates(request.location);
  }

  evaluateRequest(request) {
    const quantity = Math.max(1, Number(request.quantity) || 1);
    const category = request.category || this.inferCategoryForResource(request.requiredResource);
    const requestedType = String(request.requestedResourceType || '').toLowerCase();
    const destinationCoordinates = this.requestCoordinates(request);
    const destination = {
      id: request.id,
      name: request.location || request.requester,
      coordinates: destinationCoordinates
    };

    const candidates = this.state.declaredResources.map(resource => {
      const facility = this.state.facilities.find(item => item.id === resource.facilityId);
      const categories = Array.isArray(resource.compatibleCategories)
        ? resource.compatibleCategories
        : [resource.category];
      const compatible = categories.includes(category);
      const typeMatch = !!requestedType && (
        resource.resourceType === requestedType ||
        resource.resourceType.includes(requestedType) ||
        requestedType.includes(resource.resourceType)
      );
      const route = facility && destinationCoordinates
        ? findRoute(facility, destination, this.state.roads, this._routeOptions())
        : null;
      return {
        resource,
        facility,
        available: this.getResourceAvailable(resource),
        compatible,
        typeMatch,
        facilityAvailable: this.isFacilityAvailable(facility),
        route,
        routeFound: Boolean(route && route.routeFound),
        etaMin: route && route.routeFound ? route.estimatedTimeMin : Infinity,
        hazardSegments: route ? route.hazardSegmentsUsed : 0
      };
    }).filter(candidate => candidate.compatible || candidate.typeMatch);

    if (candidates.length === 0) {
      return {
        status: 'unmatched',
        code: 'no_compatible_resource',
        category,
        quantity,
        note: `No declared compatible resource for category "${category}".`
      };
    }

    const dispatchable = candidates.filter(candidate =>
      candidate.facilityAvailable &&
      !['unavailable', 'maintenance'].includes(candidate.resource.availability)
    );
    const withStock = dispatchable.filter(candidate => candidate.available > 0);

    if (withStock.length > 0) {
      const sufficient = withStock.filter(candidate => candidate.available >= quantity);
      if (sufficient.length > 0) {
        sufficient.sort((a, b) => {
          if (a.typeMatch !== b.typeMatch) return a.typeMatch ? -1 : 1;
          if (a.routeFound !== b.routeFound) return a.routeFound ? -1 : 1;
          if (a.etaMin !== b.etaMin) return a.etaMin - b.etaMin;
          if (a.hazardSegments !== b.hazardSegments) return a.hazardSegments - b.hazardSegments;
          if (a.available !== b.available) return b.available - a.available;
          return a.resource.id.localeCompare(b.resource.id);
        });
        const best = sufficient[0];
        const routeNote = best.routeFound
          ? ` Route: ${best.route.pathDistanceKm} km, ~${best.route.estimatedTimeMin} min, ${best.route.hazardSegmentsUsed} hazard segment(s), ${best.route.closedRoadsExcluded} closure(s) avoided.`
          : ' Warning: no simulated route currently reaches this location.';
        return {
          status: 'matched',
          code: 'matched',
          category,
          quantity,
          available: best.available,
          resource: best.resource,
          facility: best.facility,
          route: best.route,
          routeFound: best.routeFound,
          note: `${quantity} ${best.resource.unit} available at ${best.resource.name}.${routeNote}`
        };
      }

      const best = withStock.slice().sort((a, b) => b.available - a.available)[0];
      return {
        status: 'insufficient',
        code: 'insufficient_capacity',
        category,
        quantity,
        available: best.available,
        shortfall: Math.max(0, quantity - best.available),
        resource: best.resource,
        facility: best.facility,
        note: `Insufficient capacity: requested ${quantity} ${best.resource.unit}, only ${best.available} available at ${best.resource.name}.`
      };
    }

    const unavailableFacility = candidates.find(candidate => !candidate.facilityAvailable);
    if (unavailableFacility) {
      return {
        status: 'unmatched',
        code: 'facility_unavailable',
        category,
        quantity,
        resource: unavailableFacility.resource,
        facility: unavailableFacility.facility,
        note: `Compatible resource "${unavailableFacility.resource.name}" is located at ${unavailableFacility.facility ? unavailableFacility.facility.name : 'an unknown facility'}, which is unavailable for dispatch.`
      };
    }

    const allocated = candidates.slice().sort((a, b) => a.available - b.available)[0];
    return {
      status: 'unmatched',
      code: 'fully_allocated',
      category,
      quantity,
      resource: allocated.resource,
      facility: allocated.facility,
      note: `All compatible ${allocated.resource.unit} are already allocated at ${allocated.resource.name}.`
    };
  }

  matchRequest(requestId) {
    const req = this.state.requests.find(request => request.id === requestId);
    if (!req) return { ok: false, code: 'not_found', message: 'Request not found.' };
    if (!this.canEdit()) {
      return { ok: false, code: 'not_authorized', message: 'Auditors cannot allocate resources.' };
    }
    if (!['pending', 'insufficient', 'unmatched'].includes(req.status)) {
      return {
        ok: false,
        code: 'already_processed',
        message: `${req.id} is already ${req.status}. Release the allocation before re-matching.`
      };
    }

    const evaluation = this.evaluateRequest(req);
    if (evaluation.status !== 'matched') {
      req.status = evaluation.status;
      req.matchedResource = null;
      req.matchedResourceId = null;
      req.allocatedQuantity = 0;
      req.shortfall = evaluation.shortfall || 0;
      req.matchNote = evaluation.note;
      req.eta = '--';
      this.addLog(
        evaluation.status === 'insufficient' ? 'warning' : 'danger',
        'RESOURCE_MATCH',
        `${evaluation.status === 'insufficient' ? 'RESOURCE SHORTFALL' : 'UNMATCHED REQUEST'} [${req.id} - ${req.requester}]: ${evaluation.note}`,
        'NADITOWN Coordination Engine'
      );
      this.emit('request_updated', req);
      this.emit('coordination_updated', this.getCoordinationMetrics());
      this.emit('verification_updated', this.state.verification);
      return {
        ok: false,
        code: evaluation.code,
        message: evaluation.note,
        request: req,
        evaluation
      };
    }

    const resource = evaluation.resource;
    const quantity = evaluation.quantity;
    if (this.getResourceAvailable(resource) < quantity) {
      this.state.verification.blockedAllocations = Number(this.state.verification.blockedAllocations || 0) + 1;
      return {
        ok: false,
        code: 'over_allocation_blocked',
        message: `Allocation blocked: ${resource.name} no longer has ${quantity} ${resource.unit} available.`,
        request: req
      };
    }

    resource.quantityAllocated += quantity;
    resource.lastUpdated = 'Just now';
    this.syncResourceStatus(resource);
    this.syncSummaryFromResources();

    req.status = 'matched';
    req.matchedResourceId = resource.id;
    req.matchedResource = `${resource.name} - ${resource.location}`;
    req.allocatedQuantity = quantity;
    req.shortfall = 0;
    req.matchNote = evaluation.note;
    req.eta = evaluation.routeFound && evaluation.route
      ? `${evaluation.route.estimatedTimeMin} mins`
      : 'Route unavailable';
    req.matchRoute = evaluation.route ? {
      distanceKm: evaluation.route.pathDistanceKm,
      etaMin: evaluation.route.estimatedTimeMin,
      hazardSegmentsUsed: evaluation.route.hazardSegmentsUsed,
      closedRoadsExcluded: evaluation.route.closedRoadsExcluded,
      activeRoadIds: (evaluation.route.roadsUsed || []).map(road => road.roadId),
      pathStatus: evaluation.route.pathStatus
    } : null;

    this.state.verification.totalMatchedCount = this.state.requests.filter(
      request => ['matched', 'dispatched', 'resolved'].includes(request.status)
    ).length;

    this.addLog(
      'info',
      'RESOURCE_MATCH',
      `Request [${req.id} - ${req.requester}] allocated ${quantity} ${resource.unit} from ${resource.name}; ${this.getResourceAvailable(resource)} ${resource.unit} remain available. ${req.matchNote}`,
      'NADITOWN Coordination Engine'
    );

    this.emit('resource_updated', resource);
    this.emit('resources_updated', this.state.resources);
    this.emit('request_updated', req);
    this.emit('coordination_updated', this.getCoordinationMetrics());
    this.emit('verification_updated', this.state.verification);

    return {
      ok: true,
      code: 'matched',
      message: req.matchNote,
      request: req,
      resource
    };
  }

  dispatchRequest(requestId) {
    const req = this.state.requests.find(request => request.id === requestId);
    if (!req) return { ok: false, code: 'not_found', message: 'Request not found.' };
    if (!this.canEdit()) return { ok: false, code: 'not_authorized', message: 'Auditors cannot dispatch resources.' };
    if (req.status !== 'matched') {
      return { ok: false, code: 'not_allocated', message: 'Only matched requests with an allocated resource can be dispatched.' };
    }

    req.status = 'dispatched';
    req.eta = req.matchRoute ? `En route • ${req.matchRoute.etaMin} min` : 'En Route to Scene';

    this.addLog(
      'warning',
      'DISPATCH',
      `Allocated asset for [${req.id}] dispatched to field location: ${req.location}${req.matchRoute ? `; planned route ${req.matchRoute.distanceKm} km / ${req.matchRoute.etaMin} min` : ''}.`,
      'PKOB Dispatch Desk'
    );

    this.emit('request_updated', req);
    this.emit('coordination_updated', this.getCoordinationMetrics());
    return { ok: true, code: 'dispatched', message: 'Allocated resource dispatched.', request: req };
  }

  releaseRequest(requestId) {
    const req = this.state.requests.find(request => request.id === requestId);
    if (!req) return { ok: false, code: 'not_found', message: 'Request not found.' };
    if (!this.canApprove()) {
      return { ok: false, code: 'not_authorized', message: 'Commander authorization is required to release an allocation.' };
    }
    if (!req.matchedResourceId || !req.allocatedQuantity) {
      return { ok: false, code: 'nothing_to_release', message: 'This request has no allocated resource to release.' };
    }

    const resource = this.state.declaredResources.find(item => item.id === req.matchedResourceId);
    if (resource) {
      resource.quantityAllocated = Math.max(0, resource.quantityAllocated - req.allocatedQuantity);
      resource.lastUpdated = 'Just now';
      this.syncResourceStatus(resource);
      this.syncSummaryFromResources();
      this.emit('resource_updated', resource);
      this.emit('resources_updated', this.state.resources);
    }

    const releasedQuantity = req.allocatedQuantity;
    req.status = 'pending';
    req.matchedResource = null;
    req.matchedResourceId = null;
    req.allocatedQuantity = 0;
    req.shortfall = 0;
    req.matchNote = `Released ${releasedQuantity} allocated unit(s); request returned to matching queue.`;
    req.eta = '--';

    this.addLog(
      'info',
      'RESOURCE_MATCH',
      `Allocation for [${req.id}] released back to ${resource ? resource.name : 'the resource pool'}.`,
      'PKOB Coordination Desk'
    );

    this.emit('request_updated', req);
    this.emit('coordination_updated', this.getCoordinationMetrics());
    return { ok: true, code: 'released', message: req.matchNote, request: req };
  }

  autoMatchAllRequests() {
    if (!this.canEdit()) {
      return { attempted: 0, matched: 0, insufficient: 0, unmatched: 0, notAuthorized: true };
    }
    const candidates = this.state.requests.filter(request =>
      ['pending', 'insufficient', 'unmatched'].includes(request.status)
    );
    const summary = { attempted: candidates.length, matched: 0, insufficient: 0, unmatched: 0 };
    candidates.forEach(request => {
      const result = this.matchRequest(request.id);
      if (result.ok) summary.matched += 1;
      else if (result.code === 'insufficient_capacity') summary.insufficient += 1;
      else if (result.code === 'no_compatible_resource' || result.code === 'fully_allocated' || result.code === 'facility_unavailable') {
        summary.unmatched += 1;
      }
    });
    return summary;
  }

  maskPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length < 4) return '';
    return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
  }

  importResidentQueue() {
    if (typeof localStorage === 'undefined') return 0;
    let queue = [];
    try {
      queue = JSON.parse(localStorage.getItem(RESIDENT_QUEUE_KEY) || '[]');
    } catch (error) {
      return 0;
    }
    if (!Array.isArray(queue) || queue.length === 0) return 0;
    let imported = 0;
    queue.forEach(item => {
      if (!item || item.imported) return;
      const alreadyImported = this.state.requests.some(request => request.externalId === item.id);
      if (!alreadyImported) {
        const category = this.inferCategoryForResource(item.need || item.category);
        this.addCitizenRequest({
          requester: item.requester || 'Resident SOS',
          contactMasked: this.maskPhone(item.phone),
          location: item.location,
          coordinates: item.coordinates || this.sectorCoordinates(item.location),
          need: item.need,
          category,
          urgency: item.urgency || 'critical',
          quantity: item.quantity || 1,
          source: 'resident-sos',
          externalId: item.id,
          submittedAt: item.submittedAt
        });
      }
      item.imported = true;
      item.importedAt = new Date().toISOString();
      imported += 1;
    });
    try {
      localStorage.setItem(RESIDENT_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      // Ignore storage errors.
    }
    if (imported > 0) {
      this.addLog('danger', 'NEW_REQUEST', `${imported} resident SOS request(s) imported from the offline queue.`, 'Resident PWA Sync', {
        details: { source: 'resident-sos', imported }
      });
    }
    return imported;
  }

  addCitizenRequest(requestData) {
    const category = requestData.category || this.inferCategoryForResource(requestData.requiredResource || requestData.need);
    return this.addResourceRequest({
      ...requestData,
      category,
      coordinates: requestData.coordinates || this.sectorCoordinates(requestData.location),
      contactMasked: requestData.contactMasked || this.maskPhone(requestData.phone),
      requestedResourceType: requestData.requestedResourceType || this.defaultResourceTypeForCategory(category),
      quantity: requestData.quantity || 1,
      unit: requestData.unit || this.defaultUnitForCategory(category)
    }, { logCategory: 'NEW_REQUEST', author: requestData.source === 'resident-sos' ? 'Resident SOS Channel' : 'PKOB Emergency Hotline' });
  }

  addResourceRequest(requestData, options = {}) {
    const nextNumber = this.state.requests.reduce((max, request) => {
      const numeric = parseInt(String(request.id).replace(/\D/g, ''), 10);
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 400) + 1;
    const category = requestData.category || this.inferCategoryForResource(requestData.requiredResource);
    const quantity = Math.max(1, Number(requestData.quantity) || 1);

    const newReq = {
      id: `REQ-${nextNumber}`,
      externalId: requestData.externalId || null,
      source: requestData.source || 'operator',
      requester: requestData.requester || 'Bandar Elmina Coordination Request',
      contactMasked: requestData.contactMasked || '',
      location: requestData.location || 'Sector 4, Bandar Elmina',
      coordinates: requestData.coordinates || this.sectorCoordinates(requestData.location) || [3.1800, 101.5050],
      need: requestData.need || 'Emergency resource support',
      urgency: requestData.urgency || 'high',
      category,
      requestedResourceType: requestData.requestedResourceType || this.defaultResourceTypeForCategory(category),
      quantity,
      unit: requestData.unit || this.defaultUnitForCategory(category),
      requiredResource: requestData.requiredResource || `${quantity} ${this.defaultUnitForCategory(category)}`,
      matchedResource: null,
      matchedResourceId: null,
      allocatedQuantity: 0,
      shortfall: 0,
      matchNote: null,
      matchRoute: null,
      status: 'pending',
      timestamp: new Date().toLocaleTimeString('en-GB'),
      submittedAt: requestData.submittedAt || new Date().toISOString(),
      eta: '--'
    };

    this.state.requests.unshift(newReq);
    this.addLog(
      'warning',
      options.logCategory || 'NEW_REQUEST',
      `New resource request received: ${newReq.id} (${newReq.requester}) for ${newReq.quantity} ${newReq.unit} at ${newReq.location}`,
      options.author || 'PKOB Coordination Desk'
    );

    this.emit('request_added', newReq);
    this.emit('coordination_updated', this.getCoordinationMetrics());
    return newReq;
  }

  setResourceAvailability(resourceId, availability) {
    const resource = this.state.declaredResources.find(item => item.id === resourceId);
    if (!resource) return { ok: false, code: 'not_found', message: 'Resource not found.' };
    if (!['available', 'limited', 'maintenance', 'unavailable'].includes(availability)) {
      return { ok: false, code: 'invalid_status', message: 'Unsupported resource availability status.' };
    }

    resource.availability = availability;
    resource.lastUpdated = 'Just now';
    this.syncResourceStatus(resource);
    this.addLog(
      availability === 'available' ? 'success' : 'warning',
      'RESOURCE_MATCH',
      `Resource [${resource.name}] availability changed to ${availability.toUpperCase()}.`,
      'PKOB Coordination Desk'
    );
    this.emit('resource_updated', resource);
    this.emit('coordination_updated', this.getCoordinationMetrics());
    return { ok: true, code: 'updated', resource };
  }

  // ==========================================
  // VERIFICATION & AUDIT TRAIL (Ahli 5)
  // ==========================================
  addLog(type, category, message, author = 'NADITOWN System', metadata = {}) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB');
    const previousHash = this.state.eventLogs[0]?.auditHash || 'GENESIS';
    const logItem = {
      id: `evt-${now.getTime()}-${this.state.eventLogs.length + 1}`,
      timestamp: time,
      occurredAt: now.toISOString(),
      type, // 'info' | 'warning' | 'danger' | 'success'
      category, // 'TELEMETRY' | 'ROAD_STATUS' | 'SIMULATION' | 'REROUTE' | 'APPROVAL' | 'RESOURCE_MATCH' | 'DISPATCH'
      title: category,
      message,
      author,
      actorRole: metadata.actorRole || this.state.role || 'system',
      metadata: metadata.details || {},
      prevHash: previousHash
    };
    logItem.auditHash = auditHash(previousHash, logItem);

    this.state.eventLogs.unshift(logItem);
    this.state.verification.lastSync = time;
    this.state.verification.systemAuditHash = logItem.auditHash;
    this.state.verification.chainLength = this.state.eventLogs.length;
    this.state.verification.chainValid = true;
    this.state.verification.lastVerifiedAt = now.toISOString();

    this.emit('log_added', logItem);
    this.emit('verification_updated', this.state.verification);
    return logItem;
  }

  rebuildAuditChain() {
    const oldestFirst = [...this.state.eventLogs].reverse();
    let previousHash = 'GENESIS';
    oldestFirst.forEach(entry => {
      entry.occurredAt = entry.occurredAt || new Date().toISOString();
      entry.actorRole = entry.actorRole || 'system';
      entry.metadata = entry.metadata || {};
      entry.prevHash = previousHash;
      entry.auditHash = auditHash(previousHash, entry);
      previousHash = entry.auditHash;
    });
    this.state.eventLogs = oldestFirst.reverse();
    this.state.verification.systemAuditHash = previousHash;
    this.state.verification.chainLength = this.state.eventLogs.length;
    this.state.verification.chainValid = true;
    this.state.verification.lastVerifiedAt = new Date().toISOString();
  }

  verifyAuditChain(emitResult = true) {
    const oldestFirst = [...this.state.eventLogs].reverse();
    let previousHash = 'GENESIS';
    let brokenAt = null;
    for (const entry of oldestFirst) {
      const expected = auditHash(previousHash, entry);
      if (entry.prevHash !== previousHash || entry.auditHash !== expected) {
        brokenAt = entry.id;
        break;
      }
      previousHash = entry.auditHash;
    }
    this.state.verification.chainValid = !brokenAt;
    this.state.verification.lastVerifiedAt = new Date().toISOString();
    this.state.verification.chainLength = this.state.eventLogs.length;
    const result = {
      valid: !brokenAt,
      checked: oldestFirst.length,
      brokenAt,
      headHash: previousHash
    };
    if (emitResult) this.emit('verification_updated', this.state.verification);
    return result;
  }

  exportAuditLogJSON() {
    const integrity = this.verifyAuditChain(false);
    const auditPayload = {
      schema: 'naditown-audit-v1',
      township: this.state.meta.name,
      district: this.state.meta.district,
      exportTimestamp: new Date().toISOString(),
      verifiedBy: 'Disaster Operation Command Center (PKOB) - role: ' + this.state.role,
      integrity: {
        algorithm: 'SHA-256 hash chain',
        valid: integrity.valid,
        checkedEntries: integrity.checked,
        brokenAt: integrity.brokenAt,
        headHash: integrity.headHash
      },
      impact: this.getImpactMetrics(),
      metrics: {
        openRoads: this.state.roads.filter(r => r.status === 'clear').length,
        closedRoads: this.state.roads.filter(r => r.status === 'closed').length,
        hazardRoads: this.state.roads.filter(r => r.status === 'hazard').length,
        shelterCapacityTotal: this.state.resources.totalPPSCapacity,
        shelterOccupancy: this.state.resources.currentPPSOccupancy,
        totalRequests: this.state.requests.length,
        matchedRequests: this.state.requests.filter(r => r.status === 'matched').length,
        dispatchedRequests: this.state.requests.filter(r => ['dispatched', 'resolved'].includes(r.status)).length,
        insufficientRequests: this.state.requests.filter(r => r.status === 'insufficient').length,
        unmatchedRequests: this.state.requests.filter(r => r.status === 'unmatched').length,
        coordination: this.getCoordinationMetrics(),
        routeRecalculationBenchmarkMs: this.state.routing.recalcTimeMs,
        activeRouteStatus: this.state.routing.pathStatus
      },
      auditLogs: this.state.eventLogs,
      decisions: this.state.decisions,
      requestsQueue: this.state.requests,
      facilities: this.state.facilities,
      declaredResources: this.state.declaredResources,
      resourcesSummary: this.state.resources
    };

    return JSON.stringify(auditPayload, null, 2);
  }
}

export const store = new StateManager();
