/**
 * NADITOWN State Manager
 * Membolehkan Ahli 1 (Salman), Ahli 2 (Ana), Ahli 3 (Aufa),
 * Ahli 4 (Routing), dan Ahli 5 (Piqa) berkomunikasi dengan lancar.
 */

import { 
  TOWNSHIP_META, 
  FACILITIES, 
  SENSORS, 
  ROAD_SEGMENTS, 
  FLOOD_ZONES, 
  RESOURCES_SUMMARY, 
  INITIAL_EVENT_LOG 
} from './data.js';

class StateManager {
  constructor() {
    this.state = {
      meta: { ...TOWNSHIP_META },
      facilities: [...FACILITIES],
      sensors: [...SENSORS],
      roads: [...ROAD_SEGMENTS],
      floodZones: [...FLOOD_ZONES],
      resources: JSON.parse(JSON.stringify(RESOURCES_SUMMARY)),
      eventLogs: [...INITIAL_EVENT_LOG],
      
      // UI State
      activeTab: 'map-nav', // 'map-nav', 'dashboard', 'simulation', 'routing', 'data'
      emergencyLevel: 'YELLOW', // 'GREEN', 'YELLOW', 'ORANGE', 'RED'
      activeLayerToggles: {
        floodZones: true,
        pps: true,
        medical: true,
        responders: true,
        roads: true,
        sensors: true
      },
      mapStyle: 'dark', // 'dark', 'street', 'satellite'
      selectedEntity: null, // item yang dipilih pada peta
      
      // Simulation State (Slot Ahli 3)
      simulationActive: false,
      simulationScenario: 'flash_flood_monsoon',
      waterLevelMultiplier: 1.0,
      
      // Routing State (Slot Ahli 4)
      routeOrigin: null,
      routeDestination: 'pps-01',
      activeCalculatedRoute: null
    };

    this.listeners = new Map();
  }

  // Subscribe to changes
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
          console.error(`Error executing listener for ${event}:`, err);
        }
      });
    }
    // Also trigger general 'change' event
    if (event !== 'change' && this.listeners.has('change')) {
      this.listeners.get('change').forEach(cb => cb({ event, data }));
    }
  }

  // State setters
  setActiveTab(tabId) {
    this.state.activeTab = tabId;
    this.emit('tab_changed', tabId);
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

  // Road status updates (Untuk Ahli 3 / Aufa & Ahli 4)
  setRoadStatus(roadId, newStatus) {
    const road = this.state.roads.find(r => r.id === roadId);
    if (road) {
      road.status = newStatus;
      this.addLog(
        newStatus === 'closed' ? 'danger' : 'info',
        `Kemaskini Jalan: ${road.name}`,
        `Status jalan ditukar kepada: ${newStatus.toUpperCase()}`
      );
      this.emit('road_status_changed', { roadId, newStatus, road });
    }
  }

  // Facility update (Untuk Ahli 2 / Ana)
  updateFacility(facilityId, updates) {
    const fac = this.state.facilities.find(f => f.id === facilityId);
    if (fac) {
      Object.assign(fac, updates);
      this.emit('facility_updated', fac);
    }
  }

  // Add event log (Untuk Ahli 5 / Piqa)
  addLog(type, title, message, author = 'Sistem NADITOWN') {
    const time = new Date().toLocaleTimeString('en-GB');
    const logItem = {
      id: `evt-${Date.now()}`,
      timestamp: time,
      type,
      title,
      message,
      author
    };
    this.state.eventLogs.unshift(logItem);
    this.emit('log_added', logItem);
  }

  // Add new building / road dynamically (Untuk Ahli 5 / Piqa)
  addFacility(facilityData) {
    this.state.facilities.push(facilityData);
    this.addLog('info', 'Fasiliti Baharu Ditambah', `${facilityData.name} (${facilityData.category})`);
    this.emit('facility_added', facilityData);
  }
}

export const store = new StateManager();
