(function () {
  'use strict';

  const data = window.NADITOWN_FALLBACK_DATA;
  if (!data) {
    console.warn('NADITOWN coordination fallback data was not loaded.');
    return;
  }

  const clone = value => JSON.parse(JSON.stringify(value));
  const statusStyles = {
    pending: { label: 'PENDING', color: '#f59e0b' },
    matched: { label: 'MATCHED', color: '#33bfd6' },
    dispatched: { label: 'DISPATCHED', color: '#1fa9b8' },
    resolved: { label: 'RESOLVED', color: '#33bfd6' },
    insufficient: { label: 'INSUFFICIENT', color: '#ef4444' },
    unmatched: { label: 'UNMATCHED', color: '#ef4444' }
  };
  const categoryLabels = {
    medical_evacuation: 'Medical evacuation',
    medical_support: 'Medical support',
    water_rescue: 'Water rescue',
    food_supply: 'Food supply',
    shelter_supplies: 'Shelter supplies',
    shelter_capacity: 'Shelter capacity',
    power_supply: 'Power supply',
    evacuation_transport: 'Evacuation transport',
    logistics: 'Logistics',
    aerial_medical: 'Aerial medical'
  };

  function formatCategory(category) {
    return categoryLabels[category] || String(category || 'Uncategorised').replace(/_/g, ' ');
  }

  function statusStyle(status) {
    return statusStyles[status] || { label: String(status || 'UNKNOWN').toUpperCase(), color: '#93aab2' };
  }

  function getResourceAvailable(resource) {
    if (!resource) return 0;
    return Math.max(
      0,
      (Number(resource.quantityTotal) || 0) -
      (Number(resource.quantityAllocated) || 0) -
      (Number(resource.quantityUnavailable) || 0)
    );
  }

  function syncResourceStatus(resource) {
    if (!resource) return null;
    const available = getResourceAvailable(resource);
    if (resource.availability !== 'unavailable' && resource.availability !== 'maintenance') {
      if (available <= 0) resource.availability = 'depleted';
      else if (resource.availability === 'depleted') resource.availability = 'available';
    }
    if (Number(resource.quantityAllocated) <= 0) resource.allocationStatus = 'unallocated';
    else if (available <= 0) resource.allocationStatus = 'fully_allocated';
    else resource.allocationStatus = 'partially_allocated';
    return resource;
  }

  function defaultResourceTypeForCategory(category) {
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

  function defaultUnitForCategory(category) {
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

  function inferCategoryForResource(text) {
    const value = String(text || '').toLowerCase();
    if (value.includes('boat') || value.includes('water rescue')) return 'water_rescue';
    if (value.includes('ambulance') || value.includes('medic')) return 'medical_evacuation';
    if (value.includes('generator') || value.includes('power')) return 'power_supply';
    if (value.includes('mattress') || value.includes('hygiene') || value.includes('shelter kit')) return 'shelter_supplies';
    if (value.includes('4x4') || value.includes('evacuation')) return 'evacuation_transport';
    if (value.includes('truck') || value.includes('logistics') || value.includes('food')) return 'food_supply';
    return 'logistics';
  }

  function facilityRemaining(facility) {
    if (!facility) return 0;
    return Math.max(0, Number(facility.capacity || 0) - Number(facility.currentOccupants || 0));
  }

  function facilityAvailable(facility) {
    if (!facility) return false;
    const availability = facility.availabilityStatus || 'available';
    return availability !== 'unavailable' && !['closed', 'unavailable'].includes(facility.status);
  }

  function syncSummary(store) {
    const resources = store.state.resources || (store.state.resources = {});
    const find = id => store.state.declaredResources.find(resource => resource.id === id);
    const set = (key, values) => { resources[key] = Object.assign({}, resources[key] || {}, values); };
    const food = find('res-food-01');
    const boats = find('res-boat-01');
    const vehicles = find('res-4x4-01');
    const teams = find('res-med-team-01');
    const generators = find('res-gen-01');

    if (food) set('foodPacks', { total: food.quantityTotal, distributed: food.quantityAllocated, stockRemaining: getResourceAvailable(food) });
    if (boats) set('rescueBoats', { total: boats.quantityTotal, deployed: boats.quantityAllocated, standby: getResourceAvailable(boats) });
    if (vehicles) set('fourByFourVehicles', { total: vehicles.quantityTotal, deployed: vehicles.quantityAllocated, standby: getResourceAvailable(vehicles) });
    if (teams) set('medicalTeams', { total: teams.quantityTotal, deployed: teams.quantityAllocated, standby: getResourceAvailable(teams) });
    if (generators) set('emergencyGenerators', { total: generators.quantityTotal, operational: getResourceAvailable(generators), underMaintenance: generators.quantityUnavailable });

    const shelters = store.state.facilities.filter(facility => facility.shelterApproved);
    resources.totalPPSCapacity = shelters.reduce((sum, facility) => sum + Number(facility.capacity || 0), 0);
    resources.currentPPSOccupancy = shelters.reduce((sum, facility) => sum + Number(facility.currentOccupants || 0), 0);
    resources.availableBeds = Math.max(0, resources.totalPPSCapacity - resources.currentPPSOccupancy);
  }

  function metrics(store) {
    const facilities = store.state.facilities;
    const resources = store.state.declaredResources;
    const requests = store.state.requests;
    const shelters = facilities.filter(facility => facility.shelterApproved);
    return {
      availableFacilities: facilities.filter(facility => facilityAvailable(facility)).length,
      unavailableFacilities: facilities.filter(facility => !facilityAvailable(facility)).length,
      approvedShelters: shelters.length,
      availableShelterBeds: shelters.reduce((sum, facility) => sum + (facility.acceptingIntake ? facilityRemaining(facility) : 0), 0),
      availableUnits: resources.reduce((sum, resource) => sum + getResourceAvailable(resource), 0),
      allocatedUnits: resources.reduce((sum, resource) => sum + Number(resource.quantityAllocated || 0), 0),
      allocatedResourceCount: resources.filter(resource => Number(resource.quantityAllocated || 0) > 0).length,
      attentionRequests: requests.filter(request => ['pending', 'insufficient', 'unmatched'].includes(request.status)).length,
      unmatchedRequests: requests.filter(request => request.status === 'unmatched').length,
      insufficientRequests: requests.filter(request => request.status === 'insufficient').length,
      matchedRequests: requests.filter(request => ['matched', 'dispatched', 'resolved'].includes(request.status)).length
    };
  }

  function evaluateRequest(store, request) {
    const quantity = Math.max(1, Number(request.quantity) || 1);
    const category = request.category || inferCategoryForResource(request.requiredResource);
    const requestedType = String(request.requestedResourceType || '').toLowerCase();
    const candidates = store.state.declaredResources.map(resource => {
      const facility = store.state.facilities.find(item => item.id === resource.facilityId);
      const categories = Array.isArray(resource.compatibleCategories) ? resource.compatibleCategories : [resource.category];
      const compatible = categories.includes(category);
      const typeMatch = !!requestedType && (
        resource.resourceType === requestedType ||
        resource.resourceType.includes(requestedType) ||
        requestedType.includes(resource.resourceType)
      );
      return {
        resource,
        facility,
        available: getResourceAvailable(resource),
        compatible,
        typeMatch,
        facilityAvailable: facilityAvailable(facility)
      };
    }).filter(candidate => candidate.compatible || candidate.typeMatch);

    if (candidates.length === 0) {
      return { status: 'unmatched', code: 'no_compatible_resource', category, quantity, note: `No declared compatible resource for category "${category}".` };
    }

    const dispatchable = candidates.filter(candidate => candidate.facilityAvailable && !['unavailable', 'maintenance'].includes(candidate.resource.availability));
    const withStock = dispatchable.filter(candidate => candidate.available > 0);

    if (withStock.length > 0) {
      const sufficient = withStock.filter(candidate => candidate.available >= quantity);
      if (sufficient.length > 0) {
        sufficient.sort((a, b) => {
          if (a.typeMatch !== b.typeMatch) return a.typeMatch ? -1 : 1;
          if (a.available !== b.available) return b.available - a.available;
          return a.resource.id.localeCompare(b.resource.id);
        });
        const best = sufficient[0];
        return {
          status: 'matched',
          code: 'matched',
          category,
          quantity,
          available: best.available,
          resource: best.resource,
          facility: best.facility,
          note: `${quantity} ${best.resource.unit} available at ${best.resource.name}.`
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

    const unavailable = candidates.find(candidate => !candidate.facilityAvailable);
    if (unavailable) {
      return {
        status: 'unmatched',
        code: 'facility_unavailable',
        category,
        quantity,
        resource: unavailable.resource,
        facility: unavailable.facility,
        note: `Compatible resource "${unavailable.resource.name}" is at an unavailable facility.`
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

  const storeMethods = {
    normalizeDeclaredResources() {
      this.state.declaredResources.forEach(resource => {
        resource.quantityTotal = Math.max(0, Number(resource.quantityTotal) || 0);
        resource.quantityAllocated = Math.min(resource.quantityTotal, Math.max(0, Number(resource.quantityAllocated) || 0));
        resource.quantityUnavailable = Math.min(resource.quantityTotal - resource.quantityAllocated, Math.max(0, Number(resource.quantityUnavailable) || 0));
        syncResourceStatus(resource);
      });
    },
    getResourceAvailable(resource) {
      return getResourceAvailable(resource);
    },
    syncResourceStatus(resource) {
      return syncResourceStatus(resource);
    },
    syncSummaryFromResources() {
      syncSummary(this);
    },
    getFacilityRemainingCapacity(facility) {
      return facilityRemaining(facility);
    },
    isFacilityAvailable(facility) {
      return facilityAvailable(facility);
    },
    getCoordinationMetrics() {
      return metrics(this);
    },
    inferCategoryForResource(text) {
      return inferCategoryForResource(text);
    },
    defaultResourceTypeForCategory(category) {
      return defaultResourceTypeForCategory(category);
    },
    defaultUnitForCategory(category) {
      return defaultUnitForCategory(category);
    },
    evaluateRequest(request) {
      return evaluateRequest(this, request);
    },
    matchRequest(requestId) {
      const request = this.state.requests.find(item => item.id === requestId);
      if (!request) return { ok: false, code: 'not_found', message: 'Request not found.' };
      if (!['pending', 'insufficient', 'unmatched'].includes(request.status)) {
        return { ok: false, code: 'already_processed', message: `${request.id} is already ${request.status}. Release the allocation before re-matching.` };
      }
      const evaluation = evaluateRequest(this, request);
      if (evaluation.status !== 'matched') {
        request.status = evaluation.status;
        request.matchedResource = null;
        request.matchedResourceId = null;
        request.allocatedQuantity = 0;
        request.shortfall = evaluation.shortfall || 0;
        request.matchNote = evaluation.note;
        request.eta = '--';
        this.addLog('RESOURCE_MATCH', `${evaluation.status === 'insufficient' ? 'RESOURCE SHORTFALL' : 'UNMATCHED REQUEST'} [${request.id}]: ${evaluation.note}`, 'NADITOWN Coordination Engine');
        this.emit('request_updated', request);
        this.emit('coordination_updated', metrics(this));
        return { ok: false, code: evaluation.code, message: evaluation.note, request, evaluation };
      }
      const resource = evaluation.resource;
      const quantity = evaluation.quantity;
      if (getResourceAvailable(resource) < quantity) {
        return { ok: false, code: 'over_allocation_blocked', message: `Allocation blocked: ${resource.name} no longer has ${quantity} ${resource.unit} available.`, request };
      }
      resource.quantityAllocated += quantity;
      resource.lastUpdated = 'Just now';
      syncResourceStatus(resource);
      syncSummary(this);
      request.status = 'matched';
      request.matchedResourceId = resource.id;
      request.matchedResource = `${resource.name} - ${resource.location}`;
      request.allocatedQuantity = quantity;
      request.shortfall = 0;
      request.matchNote = `${quantity} ${resource.unit} allocated from ${resource.name}.`;
      request.eta = '14 mins';
      this.addLog('RESOURCE_MATCH', `Request [${request.id}] allocated ${quantity} ${resource.unit} from ${resource.name}; ${getResourceAvailable(resource)} remain available.`, 'NADITOWN Coordination Engine');
      this.emit('resource_updated', resource);
      this.emit('resources_updated', this.state.resources);
      this.emit('request_updated', request);
      this.emit('coordination_updated', metrics(this));
      return { ok: true, code: 'matched', message: request.matchNote, request, resource };
    },
    dispatchRequest(requestId) {
      const request = this.state.requests.find(item => item.id === requestId);
      if (!request) return { ok: false, code: 'not_found', message: 'Request not found.' };
      if (request.status !== 'matched') return { ok: false, code: 'not_allocated', message: 'Only matched requests can be dispatched.' };
      request.status = 'dispatched';
      request.eta = 'En Route to Scene';
      this.addLog('DISPATCH', `Allocated asset for [${request.id}] dispatched to ${request.location}.`, 'PKOB Dispatch Desk');
      this.emit('request_updated', request);
      this.emit('coordination_updated', metrics(this));
      return { ok: true, code: 'dispatched', message: 'Allocated resource dispatched.', request };
    },
    releaseRequest(requestId) {
      const request = this.state.requests.find(item => item.id === requestId);
      if (!request) return { ok: false, code: 'not_found', message: 'Request not found.' };
      if (!request.matchedResourceId || !request.allocatedQuantity) return { ok: false, code: 'nothing_to_release', message: 'This request has no allocated resource to release.' };
      const resource = this.state.declaredResources.find(item => item.id === request.matchedResourceId);
      if (resource) {
        resource.quantityAllocated = Math.max(0, resource.quantityAllocated - request.allocatedQuantity);
        resource.lastUpdated = 'Just now';
        syncResourceStatus(resource);
        syncSummary(this);
        this.emit('resource_updated', resource);
        this.emit('resources_updated', this.state.resources);
      }
      const released = request.allocatedQuantity;
      request.status = 'pending';
      request.matchedResource = null;
      request.matchedResourceId = null;
      request.allocatedQuantity = 0;
      request.shortfall = 0;
      request.matchNote = `Released ${released} allocated unit(s); request returned to matching queue.`;
      request.eta = '--';
      this.addLog('RESOURCE_MATCH', `Allocation for [${request.id}] released back to ${resource ? resource.name : 'the resource pool'}.`, 'PKOB Coordination Desk');
      this.emit('request_updated', request);
      this.emit('coordination_updated', metrics(this));
      return { ok: true, code: 'released', message: request.matchNote, request };
    },
    autoMatchAllRequests() {
      const candidates = this.state.requests.filter(request => ['pending', 'insufficient', 'unmatched'].includes(request.status));
      const summary = { attempted: candidates.length, matched: 0, insufficient: 0, unmatched: 0 };
      candidates.forEach(request => {
        const result = this.matchRequest(request.id);
        if (result.ok) summary.matched += 1;
        else if (result.code === 'insufficient_capacity') summary.insufficient += 1;
        else if (['no_compatible_resource', 'fully_allocated', 'facility_unavailable'].includes(result.code)) summary.unmatched += 1;
      });
      return summary;
    },
    addResourceRequest(requestData, options = {}) {
      const nextNumber = this.state.requests.reduce((max, request) => {
        const numeric = parseInt(String(request.id).replace(/\D/g, ''), 10);
        return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
      }, 400) + 1;
      const category = requestData.category || inferCategoryForResource(requestData.requiredResource);
      const quantity = Math.max(1, Number(requestData.quantity) || 1);
      const request = {
        id: `REQ-${nextNumber}`,
        requester: requestData.requester || 'Bandar Elmina Coordination Request',
        location: requestData.location || 'Sector 4, Bandar Elmina',
        coordinates: requestData.coordinates || [3.18, 101.505],
        need: requestData.need || 'Emergency resource support',
        urgency: requestData.urgency || 'high',
        category,
        requestedResourceType: requestData.requestedResourceType || defaultResourceTypeForCategory(category),
        quantity,
        unit: requestData.unit || defaultUnitForCategory(category),
        requiredResource: requestData.requiredResource || `${quantity} ${defaultUnitForCategory(category)}`,
        matchedResource: null,
        matchedResourceId: null,
        allocatedQuantity: 0,
        shortfall: 0,
        matchNote: null,
        status: 'pending',
        timestamp: new Date().toLocaleTimeString('en-GB'),
        eta: '--'
      };
      this.state.requests.unshift(request);
      this.addLog(options.logCategory || 'NEW_REQUEST', `New resource request: ${request.id} (${request.requester}) for ${request.quantity} ${request.unit} at ${request.location}`, options.author || 'PKOB Coordination Desk');
      this.emit('request_added', request);
      this.emit('coordination_updated', metrics(this));
      return request;
    },
    addCitizenRequest(requestData) {
      const category = requestData.category || inferCategoryForResource(requestData.requiredResource || requestData.need);
      return this.addResourceRequest(Object.assign({}, requestData, {
        category,
        requestedResourceType: requestData.requestedResourceType || defaultResourceTypeForCategory(category),
        quantity: requestData.quantity || 1,
        unit: requestData.unit || defaultUnitForCategory(category)
      }), { logCategory: 'CITIZEN_SOS', author: 'PKOB Emergency Hotline' });
    },
    setResourceAvailability(resourceId, availability) {
      const resource = this.state.declaredResources.find(item => item.id === resourceId);
      if (!resource) return { ok: false, code: 'not_found', message: 'Resource not found.' };
      if (!['available', 'limited', 'maintenance', 'unavailable'].includes(availability)) return { ok: false, code: 'invalid_status', message: 'Unsupported availability status.' };
      resource.availability = availability;
      resource.lastUpdated = 'Just now';
      syncResourceStatus(resource);
      this.addLog('RESOURCE_MATCH', `Resource [${resource.name}] availability changed to ${availability.toUpperCase()}.`, 'PKOB Coordination Desk');
      this.emit('resource_updated', resource);
      this.emit('coordination_updated', metrics(this));
      return { ok: true, code: 'updated', resource };
    }
  };

  const dashboardMethods = {
    formatCategory,
    coordinationStatusStyle: statusStyle,
    updateCoordinationIndicators() {
      const m = this.store.getCoordinationMetrics();
      const available = document.getElementById('coord-kpi-available-facilities');
      const unavailable = document.getElementById('coord-kpi-unavailable');
      const allocated = document.getElementById('coord-kpi-allocated');
      const attention = document.getElementById('coord-kpi-attention');
      const availableSub = document.getElementById('coord-kpi-available-sub');
      const attentionSub = document.getElementById('coord-kpi-attention-sub');
      const navBadge = document.getElementById('nav-coordination-badge');
      if (available) available.textContent = m.availableFacilities;
      if (unavailable) unavailable.textContent = m.unavailableFacilities;
      if (allocated) allocated.textContent = m.allocatedUnits;
      if (attention) attention.textContent = m.attentionRequests;
      if (availableSub) availableSub.textContent = `${m.approvedShelters} approved shelters • ${m.availableShelterBeds} intake beds`;
      if (attentionSub) attentionSub.textContent = `${m.unmatchedRequests} unmatched • ${m.insufficientRequests} short`;
      if (navBadge) {
        navBadge.textContent = m.attentionRequests;
        navBadge.style.display = m.attentionRequests > 0 ? '' : 'none';
      }
    },
    initCoordinationPage() {
      this.currentCoordFacFilter = this.currentCoordFacFilter || 'all';
      this.currentCoordReqFilter = this.currentCoordReqFilter || 'all';
      this.renderCoordinationPage();
      document.querySelectorAll('#coord-fac-filter-group .audit-filter-btn').forEach(button => {
        button.onclick = () => {
          document.querySelectorAll('#coord-fac-filter-group .audit-filter-btn').forEach(item => item.classList.remove('active'));
          button.classList.add('active');
          this.currentCoordFacFilter = button.dataset.coordFacFilter;
          this.renderCoordinationFacilities();
        };
      });
      document.querySelectorAll('#coord-request-filter-group .audit-filter-btn').forEach(button => {
        button.onclick = () => {
          document.querySelectorAll('#coord-request-filter-group .audit-filter-btn').forEach(item => item.classList.remove('active'));
          button.classList.add('active');
          this.currentCoordReqFilter = button.dataset.coordReqFilter;
          this.renderCoordinationRequests();
        };
      });
      const autoButton = document.getElementById('coord-auto-match-btn');
      if (autoButton) {
        autoButton.onclick = () => {
          const summary = this.store.autoMatchAllRequests();
          if (summary.matched > 0) this.showToast(`${summary.matched} request(s) matched within declared capacity.`, 'success');
          else if (summary.attempted > 0) this.showToast(`${summary.insufficient} shortfall(s), ${summary.unmatched} unmatched - no stock exceeded.`, 'warning');
          else this.showToast('No requests currently need matching.', 'info');
        };
      }
    },
    renderCoordinationPage() {
      this.updateCoordinationIndicators();
      this.renderCoordinationFacilities();
      this.renderCoordinationResources();
      this.renderCoordinationRequests();
    },
    renderCoordinationFacilities() {
      const container = document.getElementById('coord-facilities-list');
      if (!container) return;
      const count = document.getElementById('coord-facility-count');
      const list = this.store.state.facilities.filter(facility => {
        if (this.currentCoordFacFilter === 'available') return this.store.isFacilityAvailable(facility);
        if (this.currentCoordFacFilter === 'unavailable') return !this.store.isFacilityAvailable(facility);
        if (this.currentCoordFacFilter === 'shelters') return facility.shelterApproved;
        return true;
      });
      if (count) count.textContent = `${list.length} / ${this.store.state.facilities.length}`;
      container.innerHTML = '';
      if (!list.length) {
        container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">No facilities match this filter.</div>';
        return;
      }
      list.forEach(facility => {
        const available = this.store.isFacilityAvailable(facility);
        const remaining = this.store.getFacilityRemainingCapacity(facility);
        const color = !available ? '#ef4444' : (facility.acceptingIntake ? '#33bfd6' : '#f59e0b');
        const label = !available ? 'UNAVAILABLE' : (facility.acceptingIntake ? 'AVAILABLE' : 'LIMITED');
        const resourceCount = this.store.state.declaredResources.filter(resource => resource.facilityId === facility.id).length;
        const card = document.createElement('div');
        card.className = `coord-card ${!available ? 'coord-card-unavailable' : ''}`;
        card.innerHTML = `
          <div class="coord-card-head">
            <div><span class="coord-type-tag">${facility.category}</span><h4 class="coord-card-title">${facility.name}</h4></div>
            <span class="coord-status-tag" style="color:${color};border-color:${color};background:${color}1a;">${label}</span>
          </div>
          <div class="coord-meta-row"><span>📍 ${facility.zone || 'Bandar Elmina'}</span><span>${facility.shelterApproved ? '✓ Approved shelter' : '✕ Not a shelter'}</span></div>
          <div class="coord-capacity-grid">
            <div><span class="coord-mini-label">Declared capacity</span><strong>${facility.capacity} ${facility.capacityUnit}</strong></div>
            <div><span class="coord-mini-label">Remaining</span><strong style="color:${remaining > 0 ? '#33bfd6' : '#ef4444'};">${remaining} ${facility.capacityUnit}</strong></div>
            <div><span class="coord-mini-label">Occupancy</span><strong>${facility.currentOccupants} ${facility.capacityUnit}</strong></div>
          </div>
          <div class="coord-note"><strong>Accessibility:</strong> ${facility.accessibility || 'Not recorded'}<br><strong>Limitations:</strong> ${(facility.limitations || []).join('; ') || 'None recorded'}<br><strong>Approval:</strong> ${facility.approvalReference || 'Not applicable'}</div>
          <div class="coord-footer-row"><span>${resourceCount} declared resource(s)</span><button class="btn-action btn-map-view" data-coord-fac-map="${facility.id}" style="padding:3px 8px;font-size:10px;">📍 Map</button></div>
        `;
        const mapButton = card.querySelector(`[data-coord-fac-map="${facility.id}"]`);
        if (mapButton) {
          mapButton.onclick = () => {
            this.switchPage('page-map');
            if (this.map) this.map.focusLocation(facility.coordinates[0], facility.coordinates[1], 16);
          };
        }
        container.appendChild(card);
      });
    },
    renderCoordinationResources() {
      const container = document.getElementById('coord-resources-list');
      if (!container) return;
      const summary = document.getElementById('coord-resource-summary');
      const m = this.store.getCoordinationMetrics();
      if (summary) summary.textContent = `${m.allocatedResourceCount} allocated • ${m.availableUnits.toLocaleString()} units available`;
      container.innerHTML = '';
      this.store.state.declaredResources.forEach(resource => {
        const available = this.store.getResourceAvailable(resource);
        const allocated = Number(resource.quantityAllocated) || 0;
        const unavailable = Number(resource.quantityUnavailable) || 0;
        const total = Number(resource.quantityTotal) || 0;
        const allocatedPct = total > 0 ? Math.min(100, Math.round((allocated / total) * 100)) : 0;
        const unavailablePct = total > 0 ? Math.min(100, Math.round((unavailable / total) * 100)) : 0;
        const allocationColor = resource.allocationStatus === 'fully_allocated' ? '#ef4444' : (resource.allocationStatus === 'partially_allocated' ? '#f59e0b' : '#33bfd6');
        const availabilityColor = ['unavailable', 'maintenance', 'depleted'].includes(resource.availability) ? '#ef4444' : (resource.availability === 'limited' ? '#f59e0b' : '#33bfd6');
        const card = document.createElement('div');
        card.className = `coord-card ${resource.allocationStatus === 'fully_allocated' ? 'coord-card-unavailable' : ''}`;
        card.innerHTML = `
          <div class="coord-card-head">
            <div><span class="coord-type-tag">${formatCategory(resource.category)}</span><h4 class="coord-card-title">${resource.name}</h4></div>
            <span class="coord-status-tag" style="color:${availabilityColor};border-color:${availabilityColor};background:${availabilityColor}1a;">${resource.availability.toUpperCase()}</span>
          </div>
          <div class="coord-meta-row"><span>📍 ${resource.location}</span><span style="color:${allocationColor};">${resource.allocationStatus.replace('_', ' ').toUpperCase()}</span></div>
          <div class="coord-stock-row">
            <div><span class="coord-mini-label">Available</span><strong style="color:${available > 0 ? '#33bfd6' : '#ef4444'};">${available}</strong></div>
            <div><span class="coord-mini-label">Allocated</span><strong>${allocated}</strong></div>
            <div><span class="coord-mini-label">Unavailable</span><strong>${unavailable}</strong></div>
            <div><span class="coord-mini-label">Declared</span><strong>${total} ${resource.unit}</strong></div>
          </div>
          <div class="coord-stock-bar"><div style="width:${allocatedPct}%;background:${allocationColor};"></div><div style="width:${unavailablePct}%;background:#64748b;"></div></div>
          <div class="coord-note"><strong>Compatible:</strong> ${(resource.compatibleCategories || [resource.category]).map(formatCategory).join(', ')}<br><strong>Access:</strong> ${resource.accessibility}<br><strong>Limitations:</strong> ${(resource.limitations || []).join('; ') || 'None recorded'}</div>
          <div class="coord-footer-row"><span>Last updated: ${resource.lastUpdated || '—'}</span><span>${resource.unit}</span></div>
        `;
        container.appendChild(card);
      });
    },
    renderCoordinationRequests() {
      const container = document.getElementById('coord-requests-list');
      if (!container) return;
      const count = document.getElementById('coord-request-count');
      const list = this.store.state.requests.filter(request => {
        if (this.currentCoordReqFilter === 'attention') return ['pending', 'insufficient', 'unmatched'].includes(request.status);
        if (this.currentCoordReqFilter === 'pending') return request.status === 'pending';
        if (this.currentCoordReqFilter === 'matched') return request.status === 'matched';
        if (this.currentCoordReqFilter === 'dispatched') return ['dispatched', 'resolved'].includes(request.status);
        return true;
      });
      if (count) count.textContent = `${list.length} / ${this.store.state.requests.length}`;
      container.innerHTML = '';
      if (!list.length) {
        container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">No requests match this filter.</div>';
        return;
      }
      list.forEach(request => {
        const style = statusStyle(request.status);
        const card = document.createElement('div');
        card.className = `coord-card coord-request-card ${['insufficient', 'unmatched'].includes(request.status) ? 'coord-card-unavailable' : ''}`;
        const assigned = request.matchedResource ? `<div class="coord-assigned"><span>Assigned resource</span><strong>${request.matchedResource}</strong></div>` : '';
        const shortfall = request.shortfall > 0 ? `<div class="coord-alert">Shortfall: ${request.shortfall} ${request.unit} below requested quantity.</div>` : '';
        card.innerHTML = `
          <div class="coord-card-head">
            <div><span class="coord-type-tag">${formatCategory(request.category || 'logistics')}</span><h4 class="coord-card-title">${request.id} • ${request.quantity} ${request.unit}</h4></div>
            <span class="coord-status-tag" style="color:${style.color};border-color:${style.color};background:${style.color}1a;">${style.label}</span>
          </div>
          <div class="coord-meta-row"><span>${request.requester}</span><span>${request.urgency.toUpperCase()}</span></div>
          <div class="coord-note"><strong>Location:</strong> ${request.location}<br><strong>Requested:</strong> ${request.requiredResource}<br><strong>Status note:</strong> ${request.matchNote || 'Awaiting evaluation against declared resources.'}</div>
          ${assigned}${shortfall}
          <div class="coord-footer-row">
            <span>Logged ${request.timestamp}</span>
            <div style="display:flex;gap:4px;">
              ${['pending', 'insufficient', 'unmatched'].includes(request.status) ? `<button class="btn-action btn-approve" data-coord-match="${request.id}" style="padding:3px 8px;font-size:10px;">Match Resource</button>` : ''}
              ${request.status === 'matched' ? `<button class="btn-action btn-approve" data-coord-dispatch="${request.id}" style="padding:3px 8px;font-size:10px;">Dispatch</button>` : ''}
              ${['matched', 'dispatched'].includes(request.status) && request.matchedResourceId ? `<button class="btn-action btn-dismiss" data-coord-release="${request.id}" style="padding:3px 8px;font-size:10px;">Release</button>` : ''}
            </div>
          </div>
        `;
        const matchButton = card.querySelector(`[data-coord-match="${request.id}"]`);
        if (matchButton) {
          matchButton.onclick = () => {
            const result = this.store.matchRequest(request.id);
            this.showToast(result.message, result.ok ? 'success' : (result.code === 'insufficient_capacity' ? 'warning' : 'danger'));
          };
        }
        const dispatchButton = card.querySelector(`[data-coord-dispatch="${request.id}"]`);
        if (dispatchButton) {
          dispatchButton.onclick = () => {
            const result = this.store.dispatchRequest(request.id);
            this.showToast(result.message, result.ok ? 'success' : 'warning');
          };
        }
        const releaseButton = card.querySelector(`[data-coord-release="${request.id}"]`);
        if (releaseButton) {
          releaseButton.onclick = () => {
            const result = this.store.releaseRequest(request.id);
            this.showToast(result.message, result.ok ? 'info' : 'warning');
          };
        }
        container.appendChild(card);
      });
    },
    renderOutstandingRequests() {
      const container = document.getElementById('requests-list-container');
      if (!container) return;
      document.querySelectorAll('#request-filter-group .audit-filter-btn').forEach(button => {
        button.onclick = () => {
          document.querySelectorAll('#request-filter-group .audit-filter-btn').forEach(item => item.classList.remove('active'));
          button.classList.add('active');
          this.currentReqFilter = button.dataset.reqFilter;
          this.renderOutstandingRequests();
        };
      });
      const list = this.store.state.requests.filter(request => {
        if (this.currentReqFilter === 'attention') return ['pending', 'insufficient', 'unmatched'].includes(request.status);
        if (this.currentReqFilter === 'pending') return request.status === 'pending';
        if (this.currentReqFilter === 'matched') return request.status === 'matched';
        if (this.currentReqFilter === 'dispatched') return ['dispatched', 'resolved'].includes(request.status);
        return true;
      });
      container.innerHTML = '';
      if (!list.length) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">No requests in this view.</div>';
        return;
      }
      list.forEach(request => {
        const style = statusStyle(request.status);
        const urgencyColor = request.urgency === 'critical' ? '#ef4444' : (request.urgency === 'high' ? '#b45309' : '#117c96');
        const actionable = ['pending', 'insufficient', 'unmatched'].includes(request.status);
        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML = `
          <div class="req-header"><span class="req-id">${request.id}</span><span class="req-urgency" style="background:${urgencyColor}22;color:${urgencyColor};border:1px solid ${urgencyColor};">${request.urgency.toUpperCase()}</span></div>
          <div><div class="req-requester">${request.requester}</div><div class="req-location">📍 ${request.location} • ${request.timestamp}</div></div>
          <div class="req-need"><strong>Request:</strong> ${request.quantity} ${request.unit} • ${formatCategory(request.category)}<br><small style="color:var(--text-brown);">Required: <strong>${request.requiredResource}</strong></small></div>
          <div class="req-match-box ${actionable ? 'match-pending' : (request.status === 'matched' ? 'match-assigned' : 'match-dispatched')}"><span style="display:flex;justify-content:space-between;gap:8px;"><span>${request.matchNote || (request.matchedResource ? request.matchedResource : 'Awaiting compatible resource.')}</span><strong style="color:${style.color};white-space:nowrap;">${style.label}</strong></span></div>
          <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:4px;">
            <button class="btn-action btn-map-view" data-req-locate="${request.id}" style="padding:4px 8px;font-size:10px;">📍 Location</button>
            ${actionable ? `<button class="btn-action btn-approve" data-req-match="${request.id}" style="padding:4px 8px;font-size:10px;">⚡ Match Asset</button>` : ''}
            ${request.status === 'matched' ? `<button class="btn-action btn-approve" data-req-dispatch="${request.id}" style="padding:4px 8px;font-size:10px;background:#117c96;">🚀 Dispatch Asset</button>` : ''}
            ${['matched', 'dispatched'].includes(request.status) && request.matchedResourceId ? `<button class="btn-action btn-dismiss" data-req-release="${request.id}" style="padding:4px 8px;font-size:10px;">Release</button>` : ''}
          </div>
        `;
        const locate = card.querySelector(`[data-req-locate="${request.id}"]`);
        if (locate) locate.onclick = () => {
          this.switchPage('page-map');
          if (this.map && request.coordinates) this.map.focusLocation(request.coordinates[0], request.coordinates[1], 16);
        };
        const matchButton = card.querySelector(`[data-req-match="${request.id}"]`);
        if (matchButton) matchButton.onclick = () => {
          const result = this.store.matchRequest(request.id);
          this.showToast(result.message, result.ok ? 'success' : (result.code === 'insufficient_capacity' ? 'warning' : 'danger'));
        };
        const dispatchButton = card.querySelector(`[data-req-dispatch="${request.id}"]`);
        if (dispatchButton) dispatchButton.onclick = () => {
          const result = this.store.dispatchRequest(request.id);
          this.showToast(result.message, result.ok ? 'success' : 'warning');
        };
        const releaseButton = card.querySelector(`[data-req-release="${request.id}"]`);
        if (releaseButton) releaseButton.onclick = () => {
          const result = this.store.releaseRequest(request.id);
          this.showToast(result.message, result.ok ? 'info' : 'warning');
        };
        container.appendChild(card);
      });
    },
    renderCommunityRequestsBoard() {
      const container = document.getElementById('community-requests-board');
      if (!container) return;
      const list = this.store.state.requests.filter(request => {
        if (this.currentCommFilter === 'attention') return ['pending', 'insufficient', 'unmatched'].includes(request.status);
        if (this.currentCommFilter === 'pending') return request.status === 'pending';
        if (this.currentCommFilter === 'matched') return request.status === 'matched';
        if (this.currentCommFilter === 'dispatched') return ['dispatched', 'resolved'].includes(request.status);
        return true;
      });
      container.innerHTML = '';
      if (!list.length) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:12px;">No community requests found under this status.</div>';
        return;
      }
      list.forEach(request => {
        const style = statusStyle(request.status);
        const actionable = ['pending', 'insufficient', 'unmatched'].includes(request.status);
        const card = document.createElement('div');
        card.className = 'community-request-tile';
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
            <div><span style="font-family:monospace;font-weight:800;color:var(--green-bright);font-size:12px;">${request.id}</span><span style="font-size:10px;color:var(--text-brown);margin-left:6px;">${request.timestamp}</span></div>
            <span class="badge-status-hazard" style="color:${style.color};border-color:${style.color};">${style.label}</span>
          </div>
          <h4 style="font-size:13px;font-weight:700;color:var(--text-white);margin-bottom:4px;">${request.requester}</h4>
          <div style="font-size:11px;color:var(--text-brown);margin-bottom:6px;">📍 ${request.location}</div>
          <div style="background:var(--brown-surface);padding:8px;border-radius:6px;font-size:11px;margin-bottom:8px;border-left:3px solid ${style.color};">
            <strong>Need:</strong> ${request.need}<br>
            <small style="color:var(--text-muted);">Category: <strong>${formatCategory(request.category)}</strong> • Requested: <strong>${request.quantity} ${request.unit}</strong></small>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;">
            <span style="color:var(--text-muted);">${request.matchedResource ? `Assigned: <strong style="color:var(--text-white);">${request.matchedResource}</strong>` : 'Awaiting allocation'}</span>
            ${actionable ? `<button class="btn-action btn-approve" data-comm-match="${request.id}" style="padding:4px 8px;font-size:10px;">⚡ Match Resource</button>` : `<span style="color:#33bfd6;font-weight:700;font-size:10px;">ETA: ${request.eta}</span>`}
          </div>
        `;
        const matchButton = card.querySelector(`[data-comm-match="${request.id}"]`);
        if (matchButton) matchButton.onclick = () => {
          const result = this.store.matchRequest(request.id);
          this.showToast(result.message, result.ok ? 'success' : (result.code === 'insufficient_capacity' ? 'warning' : 'danger'));
        };
        container.appendChild(card);
      });
    }
  };

  function attach(store, dashboard) {
    store.state.facilities = clone(data.facilities);
    store.state.declaredResources = clone(data.declaredResources);
    store.state.requests = clone(data.initialRequests);
    if (data.resourcesSummary) store.state.resources = clone(data.resourcesSummary);

    Object.assign(store, storeMethods);
    store.normalizeDeclaredResources();
    store.syncSummaryFromResources();

    const originalApproveDecision = store.approveDecision.bind(store);
    store.approveDecision = function (id) {
      const decision = this.state.decisions.find(item => item.id === id);
      const wasApproved = decision && decision.status === 'approved';
      originalApproveDecision(id);
      if (!decision || wasApproved) return;
      if (decision.actionType === 'activate_pps_denai' || decision.id === 'REC-102') {
        const facility = this.state.facilities.find(item => item.id === 'pps-03');
        if (facility) {
          facility.availabilityStatus = 'available';
          facility.acceptingIntake = true;
          facility.status = 'active';
          syncSummary(this);
          this.emit('facility_updated', facility);
          this.emit('coordination_updated', metrics(this));
        }
      }
      if (decision.actionType === 'dispatch_boats' || decision.id === 'REC-103') {
        const boats = this.state.declaredResources.find(item => item.id === 'res-boat-01');
        if (boats) {
          const maximum = Math.max(0, boats.quantityTotal - boats.quantityUnavailable);
          boats.quantityAllocated = Math.min(maximum, Number(boats.quantityAllocated || 0) + 2);
          boats.lastUpdated = 'Just now';
          syncResourceStatus(boats);
          syncSummary(this);
          this.emit('resource_updated', boats);
          this.emit('resources_updated', this.state.resources);
          this.emit('coordination_updated', metrics(this));
        }
      }
    };

    Object.assign(dashboard, dashboardMethods);
    dashboard.currentCoordFacFilter = 'all';
    dashboard.currentCoordReqFilter = 'all';
    dashboard.initCoordinationPage();
    dashboard.updateCoordinationIndicators();
    dashboard.updateKPIs();
    dashboard.renderShelterDetailCards();
    dashboard.renderRequestsSummaryCard();
    dashboard.renderFacilitiesList();
    dashboard.renderAuditPanel();
    dashboard.renderOutstandingRequests();
    dashboard.renderCommunityRequestsBoard();

    const autoMatchButton = document.getElementById('btn-auto-match-all');
    if (autoMatchButton) {
      autoMatchButton.onclick = () => {
        const summary = store.autoMatchAllRequests();
        if (summary.matched > 0) dashboard.showToast(`${summary.matched} request(s) matched within declared capacity.`, 'success');
        else if (summary.attempted > 0) dashboard.showToast(`${summary.insufficient} shortfall(s), ${summary.unmatched} unmatched - no stock exceeded.`, 'warning');
        else dashboard.showToast('No requests currently need matching.', 'info');
      };
    }

    ['facility_updated', 'resource_updated', 'resources_updated', 'request_updated', 'request_added', 'coordination_updated'].forEach(eventName => {
      store.subscribe(eventName, () => {
        dashboard.updateCoordinationIndicators();
        dashboard.renderCoordinationFacilities();
        dashboard.renderCoordinationResources();
        dashboard.renderCoordinationRequests();
        dashboard.updateKPIs();
        dashboard.renderOutstandingRequests();
        dashboard.renderCommunityRequestsBoard();
      });
    });

    function updateRoadGeometryLegend(summary) {
      const note = document.getElementById('road-geometry-legend-note');
      if (!note) return;
      if (!summary) {
        note.textContent = 'Road status overlay: loading OSM alignment...';
        note.style.color = '#93aab2';
      } else if (summary.aligned === summary.total && summary.total > 0) {
        note.textContent = `Road status overlay: ${summary.aligned}/${summary.total} OSM-aligned${summary.cached ? ' (cached)' : ''}`;
        note.style.color = '#33bfd6';
      } else if (summary.aligned > 0) {
        note.textContent = `Road status overlay: ${summary.aligned}/${summary.total} OSM-aligned, ${summary.fallback} schematic`;
        note.style.color = '#f59e0b';
      } else {
        note.textContent = 'Road status overlay: schematic fallback';
        note.style.color = '#f59e0b';
      }
    }

    async function snapFallbackRoadGeometries() {
      const roads = Array.isArray(store.state.roads) ? store.state.roads : [];
      const routing = window.NADITOWN_ROUTING;
      if (!routing || typeof routing.fetchAllRoadGeometries !== 'function' || roads.length === 0) {
        updateRoadGeometryLegend({ total: roads.length, aligned: 0, fallback: roads.length, cached: 0 });
        return;
      }

      updateRoadGeometryLegend(null);
      try {
        const summary = await routing.fetchAllRoadGeometries(roads, { timeoutMs: 8000, concurrency: 2 });
        if (dashboard.map && typeof dashboard.map.renderRoads === 'function') dashboard.map.renderRoads();
        updateRoadGeometryLegend(summary);
      } catch (error) {
        console.warn('NADITOWN: fallback road alignment failed; keeping schematic corridors.', error);
        updateRoadGeometryLegend({ total: roads.length, aligned: 0, fallback: roads.length, cached: 0 });
      }
    }

    snapFallbackRoadGeometries();
  }

  window.NADITOWN_COORDINATION_FALLBACK = { attach };
})();
