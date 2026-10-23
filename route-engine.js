(function (global) {
  'use strict';

  const GRAPH_NODES = {
    W1: { id: 'W1', coordinates: [3.1810, 101.4980], label: 'Persiaran Elmina West' },
    C1: { id: 'C1', coordinates: [3.1835, 101.5030], label: 'Central Junction' },
    E1: { id: 'E1', coordinates: [3.1855, 101.5080], label: 'Persiaran Elmina East' },
    S1: { id: 'S1', coordinates: [3.1730, 101.4990], label: 'Sungai Buloh West' },
    S2: { id: 'S2', coordinates: [3.1755, 101.5020], label: 'Sungai Buloh Bridge' },
    S3: { id: 'S3', coordinates: [3.1775, 101.5065], label: 'Sungai Buloh East' },
    D1: { id: 'D1', coordinates: [3.1660, 101.5120], label: 'Denai Alam West' },
    D2: { id: 'D2', coordinates: [3.1695, 101.5180], label: 'Denai Alam Central' },
    D3: { id: 'D3', coordinates: [3.1740, 101.5240], label: 'Denai Alam East' },
    N1: { id: 'N1', coordinates: [3.1900, 101.5000], label: 'Guthrie West' },
    N2: { id: 'N2', coordinates: [3.1920, 101.5120], label: 'Guthrie Interchange' },
    N3: { id: 'N3', coordinates: [3.1890, 101.5250], label: 'Guthrie East' },
    P1: { id: 'P1', coordinates: [3.1840, 101.5060], label: 'Central Park West' },
    P2: { id: 'P2', coordinates: [3.1865, 101.5090], label: 'Central Park North' },
    P3: { id: 'P3', coordinates: [3.1880, 101.5120], label: 'Central Park East' },
    M1: { id: 'M1', coordinates: [3.1700, 101.4900], label: 'Mokhtar Dahari North' },
    M2: { id: 'M2', coordinates: [3.1650, 101.5050], label: 'Mokhtar Dahari Central' },
    M3: { id: 'M3', coordinates: [3.1620, 101.5150], label: 'Denai Alam Sports Complex' }
  };

  function roadEdge(id, from, to, roadId, name) {
    return {
      id,
      from,
      to,
      roadId,
      name,
      geometry: [
        GRAPH_NODES[from].coordinates.slice(),
        GRAPH_NODES[to].coordinates.slice()
      ]
    };
  }

  function localEdge(id, from, to, name) {
    return {
      id,
      from,
      to,
      roadId: null,
      name,
      geometry: [
        GRAPH_NODES[from].coordinates.slice(),
        GRAPH_NODES[to].coordinates.slice()
      ]
    };
  }

  const GRAPH_EDGES = [
    roadEdge('R01A', 'W1', 'C1', 'road-01', 'Persiaran Elmina (West Sector Corridor)'),
    roadEdge('R01B', 'C1', 'E1', 'road-01', 'Persiaran Elmina (West Sector Corridor)'),
    roadEdge('R02A', 'S1', 'S2', 'road-02', 'Sungai Buloh Bridge Crossway (Sector 2 Link)'),
    roadEdge('R02B', 'S2', 'S3', 'road-02', 'Sungai Buloh Bridge Crossway (Sector 2 Link)'),
    roadEdge('R03A', 'D1', 'D2', 'road-03', 'Denai Alam East Road (SK Subang Bestari Link)'),
    roadEdge('R03B', 'D2', 'D3', 'road-03', 'Denai Alam East Road (SK Subang Bestari Link)'),
    roadEdge('R04A', 'N1', 'N2', 'road-04', 'Guthrie Corridor Interchange - Elmina East Bypass'),
    roadEdge('R04B', 'N2', 'N3', 'road-04', 'Guthrie Corridor Interchange - Elmina East Bypass'),
    roadEdge('R05A', 'P1', 'P2', 'road-05', 'Elmina Central Park Lake Perimeter Ring'),
    roadEdge('R05B', 'P2', 'P3', 'road-05', 'Elmina Central Park Lake Perimeter Ring'),
    roadEdge('R06A', 'M1', 'M2', 'road-06', 'Persiaran Mokhtar Dahari Bypass Corridor'),
    roadEdge('R06B', 'M2', 'M3', 'road-06', 'Persiaran Mokhtar Dahari Bypass Corridor'),

    localEdge('L-WN', 'W1', 'N1', 'Elmina West-North Local Link'),
    localEdge('L-WS', 'W1', 'S1', 'Sector 4 West Local Link'),
    localEdge('L-SP', 'S1', 'M1', 'Sungai Buloh South Local Link'),
    localEdge('L-SQ', 'S1', 'M2', 'Sector 4 South Local Link'),
    localEdge('L-CP', 'C1', 'P1', 'Central Square Local Link'),
    localEdge('L-EP', 'E1', 'P2', 'Persiaran Elmina-Central Park Local Link'),
    localEdge('L-S3P1', 'S3', 'P1', 'Sungai Buloh East Local Link'),
    localEdge('L-DQ', 'D1', 'M2', 'Denai Alam West Local Link'),
    localEdge('L-DR', 'D3', 'M3', 'Sports Complex Local Link'),
    localEdge('L-P3N2', 'P3', 'N2', 'Guthrie Interchange Local Link'),
    localEdge('L-N3D3', 'N3', 'D3', 'East Gateway Local Link')
  ];

  const CONNECTORS = GRAPH_EDGES.filter(edge => !edge.roadId);

  const ACCESS_NODE_BY_LOCATION = {
    'pps-01': 'C1',
    'pps-02': 'D3',
    'pps-03': 'M3',
    'med-01': 'D2',
    'med-02': 'N3',
    'resp-01': 'N2',
    'resp-02': 'C1',
    'log-01': 'D2'
  };

  const HAZARD_COST_MULTIPLIER = 2.5;
  const SPEED_KMH = { clear: 30, hazard: 12, link: 25, access: 15 };

  function toRadians(value) {
    return value * Math.PI / 180;
  }

  function distanceKm(a, b) {
    if (!a || !b) return 0;
    const earthRadiusKm = 6371;
    const dLat = toRadians(b[0] - a[0]);
    const dLng = toRadians(b[1] - a[1]);
    const lat1 = toRadians(a[0]);
    const lat2 = toRadians(b[0]);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function lineLengthKm(coordinates) {
    let total = 0;
    for (let i = 1; i < coordinates.length; i += 1) {
      total += distanceKm(coordinates[i - 1], coordinates[i]);
    }
    return total;
  }

  function round(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  function sameCoordinate(a, b) {
    return !!a && !!b && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  }

  function nearestNode(coordinates) {
    if (!coordinates) return null;
    let best = null;
    let bestDistance = Infinity;
    Object.values(GRAPH_NODES).forEach(node => {
      const d = distanceKm(coordinates, node.coordinates);
      if (d < bestDistance) {
        bestDistance = d;
        best = node;
      }
    });
    return best;
  }

  function accessNodeFor(location) {
    if (!location) return null;
    const explicitId = location.accessNodeId || ACCESS_NODE_BY_LOCATION[location.id];
    if (explicitId && GRAPH_NODES[explicitId]) return GRAPH_NODES[explicitId];
    return nearestNode(location.coordinates);
  }

  function createDirectedEdge(edge, forward, status, road, options) {
    const geometry = forward ? edge.geometry : edge.geometry.slice().reverse();
    const km = lineLengthKm(geometry);
    const hazardPenalty = Number(options.hazardPenaltyMinutes) || 0;
    const hazardMultiplier = status === 'hazard'
      ? Math.max(HAZARD_COST_MULTIPLIER, 1 + hazardPenalty)
      : 1;
    return {
      id: edge.id,
      from: forward ? edge.from : edge.to,
      to: forward ? edge.to : edge.from,
      roadId: edge.roadId,
      name: edge.name,
      status,
      passableFor: road ? road.passableFor : 'All Vehicles (simulated local link)',
      km,
      cost: km * hazardMultiplier,
      coordinates: geometry
    };
  }

  function dijkstra(adjacency, startId, goalId) {
    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set(Object.keys(GRAPH_NODES));
    let nodesExplored = 0;

    unvisited.forEach(id => distances.set(id, Infinity));
    distances.set(startId, 0);

    while (unvisited.size > 0) {
      let currentId = null;
      let currentDistance = Infinity;
      unvisited.forEach(id => {
        const d = distances.get(id);
        if (d < currentDistance) {
          currentDistance = d;
          currentId = id;
        }
      });

      if (currentId === null || currentDistance === Infinity) break;
      unvisited.delete(currentId);
      nodesExplored += 1;
      if (currentId === goalId) break;

      const outgoing = adjacency.get(currentId) || [];
      outgoing.forEach(edge => {
        if (!unvisited.has(edge.to)) return;
        const alternative = currentDistance + edge.cost;
        if (alternative < distances.get(edge.to)) {
          distances.set(edge.to, alternative);
          previous.set(edge.to, edge);
        }
      });
    }

    const cost = distances.get(goalId);
    if (!Number.isFinite(cost)) {
      return { found: false, cost: Infinity, edges: [], nodesExplored };
    }

    const edges = [];
    let cursor = goalId;
    while (cursor !== startId) {
      const edge = previous.get(cursor);
      if (!edge) return { found: false, cost: Infinity, edges: [], nodesExplored };
      edges.unshift(edge);
      cursor = edge.from;
    }

    return { found: true, cost, edges, nodesExplored };
  }

  function notFoundResult(origin, destination, startNode, endNode, closedRoads, reason, elapsedMs) {
    const closedNames = closedRoads.map(road => road.name);
    return {
      found: false,
      routeFound: false,
      algorithm: 'Dijkstra',
      originId: origin ? origin.id : null,
      destinationId: destination ? destination.id : null,
      originName: origin ? origin.name : 'Unknown origin',
      destinationName: destination ? destination.name : 'Unknown destination',
      originCoords: origin ? origin.coordinates : null,
      destinationCoords: destination ? destination.coordinates : null,
      originAccessNode: startNode ? startNode.id : null,
      destinationAccessNode: endNode ? endNode.id : null,
      activePath: [],
      pathCoords: [],
      legs: [],
      roadsUsed: [],
      linksUsed: [],
      hazardSegments: [],
      hazardSegmentsUsed: 0,
      bypassedHazards: 0,
      closedRoads: closedNames,
      closedRoadsExcluded: closedRoads.length,
      pathDistanceKm: 0,
      estimatedTimeMin: 0,
      pathEtaMin: 0,
      activeRoadIds: [],
      weightedCost: null,
      nodesExplored: 0,
      recalcTimeMs: elapsedMs,
      pathStatus: reason,
      limitations: [
        'Simulation only - not a field-verified route or real-world safety assessment.',
        reason
      ],
      graph: {
        nodes: Object.keys(GRAPH_NODES).length,
        edges: GRAPH_EDGES.length,
        activeEdges: GRAPH_EDGES.filter(edge => !edge.roadId || !closedRoads.some(road => road.id === edge.roadId)).length
      }
    };
  }

  function findRoute(origin, destination, roads, options) {
    const startedAt = (global.performance && typeof global.performance.now === 'function')
      ? global.performance.now()
      : Date.now();
    const optionsSafe = options || {};
    const roadList = Array.isArray(roads) ? roads : [];
    const closedRoads = roadList.filter(road => road.status === 'closed');
    const roadById = new Map(roadList.map(road => [road.id, road]));

    const startNode = accessNodeFor(origin);
    const endNode = accessNodeFor(destination);

    const finish = result => {
      const endedAt = (global.performance && typeof global.performance.now === 'function')
        ? global.performance.now()
        : Date.now();
      result.elapsedMs = round(Math.max(0, endedAt - startedAt), 2);
      result.recalcTimeMs = result.elapsedMs;
      result.computedAt = new Date().toISOString();
      return result;
    };

    if (!origin || !destination || !origin.coordinates || !destination.coordinates) {
      return finish(notFoundResult(origin, destination, startNode, endNode, closedRoads, 'Origin or destination coordinates are missing.', 0));
    }

    if (!startNode || !endNode) {
      return finish(notFoundResult(origin, destination, startNode, endNode, closedRoads, 'Origin or destination is not connected to the simulated road graph.', 0));
    }

    if (origin.id && destination.id && origin.id === destination.id) {
      return finish({
        found: true,
        routeFound: true,
        algorithm: 'Dijkstra',
        originId: origin.id,
        destinationId: destination.id,
        originName: origin.name,
        destinationName: destination.name,
        originCoords: origin.coordinates,
        destinationCoords: destination.coordinates,
        originAccessNode: startNode.id,
        destinationAccessNode: endNode.id,
        activePath: [origin.coordinates.slice()],
        pathCoords: [origin.coordinates.slice()],
        legs: [],
        roadsUsed: [],
        linksUsed: [],
        hazardSegments: [],
        hazardSegmentsUsed: 0,
        bypassedHazards: 0,
        closedRoads: closedRoads.map(road => road.name),
        closedRoadsExcluded: closedRoads.length,
        pathDistanceKm: 0,
        estimatedTimeMin: 0,
        pathEtaMin: 0,
        activeRoadIds: [],
        weightedCost: 0,
        nodesExplored: 0,
        pathStatus: 'Origin and destination are the same location; no route is required.',
        limitations: [
          'Simulation only - not a field-verified route or real-world safety assessment.',
          'Origin and destination are identical.'
        ],
        graph: {
          nodes: Object.keys(GRAPH_NODES).length,
          edges: GRAPH_EDGES.length,
          activeEdges: GRAPH_EDGES.filter(edge => !edge.roadId || !closedRoads.some(road => road.id === edge.roadId)).length
        }
      });
    }

    const adjacency = new Map();
    Object.keys(GRAPH_NODES).forEach(id => adjacency.set(id, []));

    GRAPH_EDGES.forEach(edge => {
      const road = edge.roadId ? roadById.get(edge.roadId) : null;
      const status = edge.roadId ? (road ? road.status : 'clear') : 'link';
      if (status === 'closed') return;
      adjacency.get(edge.from).push(createDirectedEdge(edge, true, status, road, optionsSafe));
      adjacency.get(edge.to).push(createDirectedEdge(edge, false, status, road, optionsSafe));
    });

    const search = dijkstra(adjacency, startNode.id, endNode.id);

    if (!search.found) {
      const reason = closedRoads.length > 0
        ? `No simulated route found: all connected paths are cut by ${closedRoads.length} closed road segment(s).`
        : 'No simulated route found: origin and destination are not connected on the sample road graph.';
      const result = notFoundResult(origin, destination, startNode, endNode, closedRoads, reason, 0);
      result.nodesExplored = search.nodesExplored;
      return finish(result);
    }

    const originAccessKm = distanceKm(origin.coordinates, startNode.coordinates);
    const destinationAccessKm = distanceKm(endNode.coordinates, destination.coordinates);
    const routeCoordinates = [];

    const pushCoordinate = coordinate => {
      if (!coordinate) return;
      if (routeCoordinates.length === 0 || !sameCoordinate(routeCoordinates[routeCoordinates.length - 1], coordinate)) {
        routeCoordinates.push([coordinate[0], coordinate[1]]);
      }
    };

    pushCoordinate(origin.coordinates);
    pushCoordinate(startNode.coordinates);
    search.edges.forEach(edge => {
      edge.coordinates.forEach(pushCoordinate);
    });
    pushCoordinate(endNode.coordinates);
    pushCoordinate(destination.coordinates);

    let distanceTotal = originAccessKm + destinationAccessKm;
    let minutesTotal = (originAccessKm / SPEED_KMH.access) * 60 + (destinationAccessKm / SPEED_KMH.access) * 60;

    search.edges.forEach(edge => {
      distanceTotal += edge.km;
      const speed = SPEED_KMH[edge.status] || SPEED_KMH.clear;
      minutesTotal += (edge.km / speed) * 60;
    });

    const roadsUsedById = new Map();
    search.edges.forEach(edge => {
      if (!edge.roadId) return;
      if (!roadsUsedById.has(edge.roadId)) {
        const road = roadById.get(edge.roadId);
        roadsUsedById.set(edge.roadId, {
          roadId: edge.roadId,
          name: edge.name,
          status: edge.status,
          passableFor: edge.passableFor,
          distanceKm: 0
        });
      }
      roadsUsedById.get(edge.roadId).distanceKm += edge.km;
    });

    const roadsUsed = Array.from(roadsUsedById.values()).map(road => ({
      ...road,
      distanceKm: round(road.distanceKm, 2)
    }));
    const hazardSegments = roadsUsed.filter(road => road.status === 'hazard');
    const linksUsed = Array.from(new Set(search.edges.filter(edge => !edge.roadId).map(edge => edge.name)));
    const limitations = ['Simulation only - not a field-verified route or real-world safety assessment.'];

    hazardSegments.forEach(road => {
      limitations.push(`Hazard segment traversed: ${road.name} (${road.passableFor || 'restricted passability'}).`);
    });
    if (closedRoads.length > 0) {
      limitations.push(`Excluded closed segment(s): ${closedRoads.map(road => road.name).join('; ')}.`);
    }
    if (linksUsed.length > 0) {
      limitations.push(`Includes ${linksUsed.length} simulated local connector(s) that may not match every real minor road.`);
    }
    if (originAccessKm + destinationAccessKm > 0.03) {
      limitations.push('Includes short facility access spur(s) between the mapped facility and the simulated road graph.');
    }
    if (optionsSafe.extraLimitation) {
      limitations.push(optionsSafe.extraLimitation);
    }

    const roadNames = roadsUsed.map(road => road.name);
    const distanceKmRounded = round(distanceTotal, 2);
    const etaMinutes = Math.max(1, Math.round(minutesTotal));
    const pathStatus = roadNames.length === 0
      ? 'Simulated access-only route: both locations connect to the same junction; no public road segment is traversed.'
      : `Simulated route via ${roadNames.join('; ')}. ${hazardSegments.length} hazard segment(s) on route; ${closedRoads.length} closed segment(s) excluded.`;

    return finish({
      found: true,
      routeFound: true,
      algorithm: 'Dijkstra',
      originId: origin.id,
      destinationId: destination.id,
      originName: origin.name,
      destinationName: destination.name,
      originCoords: origin.coordinates,
      destinationCoords: destination.coordinates,
      originAccessNode: startNode.id,
      destinationAccessNode: endNode.id,
      activePath: routeCoordinates,
      pathCoords: routeCoordinates,
      legs: search.edges.map(edge => ({
        id: edge.id,
        roadId: edge.roadId,
        name: edge.name,
        status: edge.status,
        distanceKm: round(edge.km, 2),
        coordinates: edge.coordinates
      })),
      roadsUsed,
      linksUsed,
      hazardSegments,
      hazardSegmentsUsed: hazardSegments.length,
      bypassedHazards: hazardSegments.length,
      closedRoads: closedRoads.map(road => road.name),
      closedRoadsExcluded: closedRoads.length,
      pathDistanceKm: distanceKmRounded,
      estimatedTimeMin: etaMinutes,
      pathEtaMin: etaMinutes,
      activeRoadIds: roadsUsed.map(road => road.roadId),
      weightedCost: round(search.cost, 2),
      nodesExplored: search.nodesExplored,
      hazardPenaltyMinutes: Number(optionsSafe.hazardPenaltyMinutes) || 0,
      pathStatus,
      limitations,
      graph: {
        nodes: Object.keys(GRAPH_NODES).length,
        edges: GRAPH_EDGES.length,
        activeEdges: GRAPH_EDGES.filter(edge => !edge.roadId || !closedRoads.some(road => road.id === edge.roadId)).length
      }
    });
  }

  const VALHALLA_ROUTE_ENDPOINT = 'https://valhalla1.openstreetmap.de/route';
  const OSRM_ROUTE_ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';
  const ROAD_GEOMETRY_STORAGE_KEY = 'naditown.roadGeometry.v1';
  const roadGeometryCache = new Map();
  const roadSegmentGeometryCache = new Map();
  let storedRoadGeometryCache = null;

  function decodePolyline(encoded, precision = 6) {
    const points = [];
    const factor = Math.pow(10, precision);
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      lat += (result & 1) ? ~(result >> 1) : (result >> 1);

      shift = 0;
      result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      points.push([lat / factor, lng / factor]);
    }

    return points;
  }

  function mergeRoutePoints(points) {
    const merged = [];
    points.forEach(point => {
      if (!point) return;
      const coordinate = [Number(point[0]), Number(point[1])];
      if (!Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1])) return;
      if (merged.length === 0 || !sameCoordinate(merged[merged.length - 1], coordinate)) {
        merged.push(coordinate);
      }
    });
    return merged;
  }

  function applyRoadGeometry(result, points, source, geometryTimeMs) {
    const aligned = mergeRoutePoints(points);
    if (!result || !result.routeFound || aligned.length < 2) return result;

    const distanceKmAligned = round(lineLengthKm(aligned), 2);
    const distanceRatio = result.pathDistanceKm > 0
      ? distanceKmAligned / result.pathDistanceKm
      : 1;

    result.activePath = aligned;
    result.pathCoords = aligned;
    result.pathDistanceKm = distanceKmAligned;
    result.estimatedTimeMin = Math.max(1, Math.round(result.estimatedTimeMin * distanceRatio));
    result.roadGeometrySource = source;
    result.roadGeometryStatus = 'aligned';
    result.roadGeometryTimeMs = geometryTimeMs;
    result.geometryUpdatedAt = new Date().toISOString();

    const note = 'Road geometry is aligned to OpenStreetMap; distance and ETA are recalculated for the drawn alignment.';
    if (!result.limitations.includes(note)) result.limitations.push(note);
    if (source.includes('OSRM')) {
      const fallbackNote = 'Fallback road geometry may not honor every simulated road closure.';
      if (!result.limitations.includes(fallbackNote)) result.limitations.push(fallbackNote);
    }

    return result;
  }

  function markSchematicGeometry(result, reason) {
    if (!result || !result.routeFound) return result;
    result.roadGeometrySource = 'Schematic graph alignment';
    result.roadGeometryStatus = 'fallback';
    result.roadGeometryError = reason || 'Road-following geometry service unavailable.';
    const note = 'Live road-following geometry was unavailable; this is a schematic graph alignment, not a road-accurate path.';
    if (!result.limitations.includes(note)) result.limitations.push(note);
    return result;
  }

  async function fetchJsonWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function roadSchematicCoordinates(road) {
    const source = road && (road.schematicCoordinates || road.coordinates);
    return Array.isArray(source)
      ? source.filter(point => Array.isArray(point) && point.length >= 2)
      : [];
  }

  function roadGeometrySignature(road) {
    return roadSchematicCoordinates(road)
      .map(([lat, lon]) => `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`)
      .join(';');
  }

  function roadSegmentCacheKey(road) {
    return `${road.id || road.name || 'road'}|${roadGeometrySignature(road)}`;
  }

  function getStoredRoadGeometryCache() {
    if (storedRoadGeometryCache) return storedRoadGeometryCache;
    try {
      const parsed = JSON.parse(global.localStorage.getItem(ROAD_GEOMETRY_STORAGE_KEY) || '{}');
      if (parsed && parsed.version === 1 && parsed.records && typeof parsed.records === 'object') {
        storedRoadGeometryCache = parsed;
      }
    } catch (error) {
      storedRoadGeometryCache = null;
    }
    if (!storedRoadGeometryCache) storedRoadGeometryCache = { version: 1, records: {} };
    return storedRoadGeometryCache;
  }

  function persistRoadGeometryCache() {
    if (!storedRoadGeometryCache) return;
    try {
      global.localStorage.setItem(ROAD_GEOMETRY_STORAGE_KEY, JSON.stringify(storedRoadGeometryCache));
    } catch (error) {
      // Storage can be unavailable in private or file:// contexts; in-memory caching still works.
    }
  }

  function applyRoadSegmentGeometry(road, points, source, updatedAt) {
    const aligned = mergeRoutePoints(points);
    if (!road || aligned.length < 2) return false;

    if (!Array.isArray(road.schematicCoordinates)) {
      road.schematicCoordinates = roadSchematicCoordinates(road).map(point => point.slice());
    }
    road.coordinates = aligned;
    road.roadGeometrySource = source;
    road.roadGeometryStatus = 'aligned';
    road.roadGeometryUpdatedAt = updatedAt || new Date().toISOString();
    road.roadGeometryError = null;
    return true;
  }

  function markRoadSegmentSchematic(road, reason) {
    if (road && road.roadGeometryStatus !== 'aligned') {
      road.roadGeometryStatus = 'fallback';
      road.roadGeometrySource = 'Schematic corridor fallback';
      road.roadGeometryError = reason;
    }
    return reason;
  }

  async function fetchRoadSegmentGeometry(road, options = {}) {
    if (!road) return { roadId: null, status: 'fallback', error: 'Road segment missing.' };
    if (!global.fetch || typeof global.fetch !== 'function') {
      const reason = 'Fetch API unavailable.';
      markRoadSegmentSchematic(road, reason);
      return { roadId: road.id, status: 'fallback', error: reason };
    }

    const samples = roadSchematicCoordinates(road);
    if (samples.length < 2) {
      const reason = 'Road segment has fewer than two sample coordinates.';
      markRoadSegmentSchematic(road, reason);
      return { roadId: road.id, status: 'fallback', error: reason };
    }

    const cacheKey = roadSegmentCacheKey(road);
    const memoryCached = roadSegmentGeometryCache.get(cacheKey);
    if (memoryCached && applyRoadSegmentGeometry(road, memoryCached.points, memoryCached.source, memoryCached.updatedAt)) {
      return { roadId: road.id, status: 'aligned', source: memoryCached.source, cached: true, points: memoryCached.points };
    }

    const stored = getStoredRoadGeometryCache();
    const storedCached = stored.records[cacheKey];
    if (storedCached && applyRoadSegmentGeometry(road, storedCached.points, storedCached.source, storedCached.updatedAt)) {
      roadSegmentGeometryCache.set(cacheKey, storedCached);
      return { roadId: road.id, status: 'aligned', source: storedCached.source, cached: true, points: storedCached.points };
    }

    const timeoutMs = options.timeoutMs || 8000;
    const locations = samples.map(([lat, lon]) => ({ lat, lon }));
    let valhallaError = null;

    try {
      const data = await fetchJsonWithTimeout(VALHALLA_ROUTE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations,
          costing: 'auto',
          directions_options: { units: 'kilometers', directions_type: 'none' }
        })
      }, timeoutMs);

      const legs = data && data.trip && Array.isArray(data.trip.legs) ? data.trip.legs : [];
      const routedPoints = legs.flatMap(leg => leg && leg.shape ? decodePolyline(leg.shape, 6) : []);
      const points = mergeRoutePoints(routedPoints);
      if (points.length < 2) throw new Error('Valhalla response did not include road segment geometry.');

      const source = 'OpenStreetMap roads via Valhalla';
      const record = { points, source, updatedAt: new Date().toISOString() };
      roadSegmentGeometryCache.set(cacheKey, record);
      stored.records[cacheKey] = record;
      persistRoadGeometryCache();
      applyRoadSegmentGeometry(road, points, source, record.updatedAt);
      return { roadId: road.id, status: 'aligned', source, cached: false, points };
    } catch (error) {
      valhallaError = error;
    }

    try {
      const coordinates = samples.map(([lat, lon]) => `${lon},${lat}`).join(';');
      const url = `${OSRM_ROUTE_ENDPOINT}/${coordinates}?overview=full&geometries=geojson`;
      const data = await fetchJsonWithTimeout(url, { method: 'GET' }, timeoutMs);
      const route = data && data.routes && data.routes[0];
      if (!route || !route.geometry || !Array.isArray(route.geometry.coordinates)) {
        throw new Error('OSRM response did not include road segment geometry.');
      }

      const points = mergeRoutePoints(route.geometry.coordinates.map(([lon, lat]) => [lat, lon]));
      if (points.length < 2) throw new Error('OSRM response contained too few road segment points.');

      const source = 'OpenStreetMap roads via OSRM (fallback)';
      const record = { points, source, updatedAt: new Date().toISOString() };
      roadSegmentGeometryCache.set(cacheKey, record);
      stored.records[cacheKey] = record;
      persistRoadGeometryCache();
      applyRoadSegmentGeometry(road, points, source, record.updatedAt);
      return { roadId: road.id, status: 'aligned', source, cached: false, points };
    } catch (osrmError) {
      const reason = `${valhallaError.message}; ${osrmError.message}`;
      markRoadSegmentSchematic(road, reason);
      return { roadId: road.id, status: 'fallback', error: reason };
    }
  }

  async function fetchAllRoadGeometries(roads, options = {}) {
    const list = Array.isArray(roads) ? roads.filter(road => road && Array.isArray(road.coordinates)) : [];
    const concurrency = Math.max(1, Math.min(4, Number(options.concurrency) || 2));
    const results = [];
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < list.length) {
        const road = list[nextIndex++];
        try {
          results.push(await fetchRoadSegmentGeometry(road, options));
        } catch (error) {
          markRoadSegmentSchematic(road, error.message);
          results.push({ roadId: road.id, status: road.roadGeometryStatus === 'aligned' ? 'aligned' : 'fallback', error: error.message });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()));
    return {
      total: list.length,
      aligned: results.filter(result => result.status === 'aligned').length,
      fallback: results.filter(result => result.status === 'fallback').length,
      cached: results.filter(result => result.cached).length,
      results
    };
  }

  async function fetchRoadFollowingRoute(result, roads, options = {}) {
    if (!result || !result.routeFound || !result.originCoords || !result.destinationCoords) {
      return result;
    }
    if (result.originId && result.destinationId && result.originId === result.destinationId) {
      return result;
    }

    const startedAt = (global.performance && typeof global.performance.now === 'function')
      ? global.performance.now()
      : Date.now();
    const closedRoads = (Array.isArray(roads) ? roads : []).filter(road => road.status === 'closed');
    const cacheKey = [
      result.originId,
      result.destinationId,
      closedRoads.map(road => road.id).sort().join(','),
      (result.activeRoadIds || []).slice().sort().join(','),
      result.hazardSegmentsUsed || 0
    ].join('|');

    const cached = roadGeometryCache.get(cacheKey);
    if (cached) {
      return applyRoadGeometry(result, cached.points, cached.source, 0);
    }

    const timeoutMs = options.timeoutMs || 8000;
    const origin = result.originCoords;
    const destination = result.destinationCoords;
    const excludeLocations = closedRoads.flatMap(road => (road.schematicCoordinates || road.coordinates || []).map(([lat, lon]) => ({ lat, lon })));

    try {
      const payload = {
        locations: [
          { lat: origin[0], lon: origin[1] },
          { lat: destination[0], lon: destination[1] }
        ],
        costing: 'auto',
        directions_options: { units: 'kilometers', directions_type: 'none' }
      };
      if (excludeLocations.length > 0) payload.exclude_locations = excludeLocations;

      const data = await fetchJsonWithTimeout(VALHALLA_ROUTE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, timeoutMs);

      const leg = data && data.trip && data.trip.legs && data.trip.legs[0];
      if (!leg || !leg.shape) throw new Error('Valhalla response did not include route geometry.');

      const routedPoints = decodePolyline(leg.shape, 6);
      const points = mergeRoutePoints([origin, ...routedPoints, destination]);
      const source = 'OpenStreetMap roads via Valhalla';
      roadGeometryCache.set(cacheKey, { points, source });
      if (roadGeometryCache.size > 40) {
        roadGeometryCache.delete(roadGeometryCache.keys().next().value);
      }

      return applyRoadGeometry(result, points, source, round(
        ((global.performance && typeof global.performance.now === 'function') ? global.performance.now() : Date.now()) - startedAt,
        0
      ));
    } catch (valhallaError) {
      try {
        const url = `${OSRM_ROUTE_ENDPOINT}/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
        const data = await fetchJsonWithTimeout(url, { method: 'GET' }, timeoutMs);
        const route = data && data.routes && data.routes[0];
        if (!route || !route.geometry || !Array.isArray(route.geometry.coordinates)) {
          throw new Error('OSRM response did not include route geometry.');
        }

        const routedPoints = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        const points = mergeRoutePoints([origin, ...routedPoints, destination]);
        const source = 'OpenStreetMap roads via OSRM (fallback)';
        roadGeometryCache.set(cacheKey, { points, source });
        return applyRoadGeometry(result, points, source, round(
          ((global.performance && typeof global.performance.now === 'function') ? global.performance.now() : Date.now()) - startedAt,
          0
        ));
      } catch (osrmError) {
        return markSchematicGeometry(
          result,
          `${valhallaError.message}; ${osrmError.message}`
        );
      }
    }
  }

  global.NADITOWN_ROUTING = {
    version: '1.2.1',
    GRAPH_NODES,
    GRAPH_EDGES,
    CONNECTORS,
    ACCESS_NODE_BY_LOCATION,
    accessNodeFor,
    distanceKm,
    decodePolyline,
    findRoute,
    fetchRoadFollowingRoute,
    fetchRoadSegmentGeometry,
    fetchAllRoadGeometries
  };
})(typeof window !== 'undefined' ? window : globalThis);
