const engine = typeof window !== 'undefined'
  ? window.NADITOWN_ROUTING
  : (typeof globalThis !== 'undefined' ? globalThis.NADITOWN_ROUTING : null);

if (!engine) {
  throw new Error('Route engine not loaded. Include route-engine.js before the application modules.');
}

export const GRAPH_NODES = engine.GRAPH_NODES;
export const GRAPH_EDGES = engine.GRAPH_EDGES;
export const CONNECTORS = engine.CONNECTORS;
export const ACCESS_NODE_BY_LOCATION = engine.ACCESS_NODE_BY_LOCATION;
export const accessNodeFor = engine.accessNodeFor;
export const distanceKm = engine.distanceKm;
export const findRoute = engine.findRoute;
export const fetchRoadFollowingRoute = engine.fetchRoadFollowingRoute;
export const fetchRoadSegmentGeometry = engine.fetchRoadSegmentGeometry;
export const fetchAllRoadGeometries = engine.fetchAllRoadGeometries;
export const decodePolyline = engine.decodePolyline;
export const ROUTE_ENGINE_VERSION = engine.version;
