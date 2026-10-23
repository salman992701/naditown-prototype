/**
 * NADITOWN - Multi-Page Dashboard & Operations Module (Ahli 2: Ana)
 * Supports 4 Distinct Pages:
 * 1. Dashboard (Road Network, Shelter Capacity & Resources, Incident Requests, Routing Benchmark)
 * 2. Map & Simulation (Interactive Leaflet Map, Hydrology Sliders, Facilities Directory)
 * 3. Reports & Operations (Decision Support, Outstanding Requests Queue, Verification & Audit Trail)
 * 4. Community Requests (Citizen SOS Intake Form, Live Community Assistance Tracker)
 */

import { store } from './store.js';

export class Dashboard {
  constructor(mapEngine = null) {
    this.mapEngine = mapEngine;
    this.currentReqFilter = 'all';
    this.currentLogFilter = 'ALL';
    this.currentCommFilter = 'all';
    this.currentFacFilter = 'all';
    this.currentCoordFacFilter = 'all';
    this.currentCoordReqFilter = 'all';
    this.demoSteps = [];
    this.demoStepIndex = 0;
    this._guideTarget = null;
  }

  init(mapEngineInstance = null) {
    if (mapEngineInstance) this.mapEngine = mapEngineInstance;

    this.initClock();
    this.initNavigation();
    this.initDemoTools();
    this.initDemoGuide();
    this.initDashboardPage();
    this.initMapPage();
    this.initReportsPage();
    this.initCommunityPage();
    this.initCoordinationPage();
    this.setupSubscriptions();
    this.applyRoleUI();
    store.importResidentQueue();

    // Check URL hash for direct page loading (e.g. #map, #reports, #coordination)
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'map', 'reports', 'community', 'coordination'].includes(hash)) {
      this.switchPage(`page-${hash}`);
    } else {
      this.switchPage('page-dashboard');
    }

    console.log("NADITOWN: Multi-Page Operations System initialized.");
  }

  setMapEngine(mapEngine) {
    this.mapEngine = mapEngine;
  }

  // ==========================================
  // 1. TOP BAR CLOCK & NAVIGATION
  // ==========================================
  initClock() {
    const el = document.getElementById('live-clock');
    const tick = () => {
      const now = new Date();
      if (el) el.textContent = now.toLocaleTimeString('en-GB') + ' UTC+8';
    };
    tick();
    setInterval(tick, 1000);
  }

  initNavigation() {
    const navBtns = document.querySelectorAll('.nav-page-btn');
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPage = btn.dataset.page;
        this.switchPage(targetPage);
      });
    });

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '');
      if (h && ['dashboard', 'map', 'reports', 'community', 'coordination'].includes(h)) {
        this.switchPage(`page-${h}`, false);
      }
    });
  }

  initDemoTools() {
    const menu = document.getElementById('demo-tools-menu');
    const toggle = document.getElementById('btn-demo-menu');
    const close = document.getElementById('btn-demo-menu-close');
    const roleSelect = document.getElementById('role-select');

    const setMenuOpen = open => {
      if (!menu || !toggle) return;
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };

    if (toggle) toggle.onclick = () => setMenuOpen(menu.hidden);
    if (close) close.onclick = () => setMenuOpen(false);
    document.addEventListener('click', event => {
      if (!menu || menu.hidden) return;
      if (menu.contains(event.target) || toggle.contains(event.target)) return;
      setMenuOpen(false);
    });

    document.querySelectorAll('[data-close-modal]').forEach(button => {
      button.onclick = () => {
        const modal = document.getElementById(button.dataset.closeModal);
        if (modal) modal.hidden = true;
      };
    });

    const pilotOpenResident = document.getElementById('pilot-open-resident');
    if (pilotOpenResident) pilotOpenResident.onclick = () => window.open('resident.html', '_blank', 'noopener');

    document.querySelectorAll('[data-demo-action]').forEach(button => {
      button.onclick = () => {
        setMenuOpen(false);
        this.handleDemoAction(button.dataset.demoAction);
      };
    });

    const guidedBtn = document.getElementById('btn-guided-demo');
    if (guidedBtn) guidedBtn.onclick = () => this.openDemoGuide();

    if (roleSelect) {
      roleSelect.value = store.state.role;
      roleSelect.onchange = () => {
        store.setRole(roleSelect.value);
        this.applyRoleUI();
        this.showToast(`Viewing as ${roleSelect.value.toUpperCase()}.`, 'info');
      };
    }
  }

  handleDemoAction(action) {
    if (action === 'guide') this.openDemoGuide();
    else if (action === 'sitrep') this.exportSituationReport();
    else if (action === 'pilot') {
      const modal = document.getElementById('pilot-modal');
      if (modal) modal.hidden = false;
    } else if (action === 'verify') {
      this.verifyAuditChain(true);
    } else if (action === 'reset') {
      if (window.confirm('Reset all demo data, audit logs and resident SOS queue in this browser?')) store.resetDemo();
    }
  }

  applyRoleUI() {
    const role = store.state.role;
    document.body.dataset.role = role;
    const roleSelect = document.getElementById('role-select');
    if (roleSelect) roleSelect.value = role;
    this.renderDecisions();
    this.renderOutstandingRequests();
    this.renderCommunityRequestsBoard();
    this.renderCoordinationRequests();
    const opr = document.getElementById('role-indicator');
    if (opr) opr.textContent = role.toUpperCase();
  }

  async confirmAction(title, message, confirmLabel = 'Authorize') {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return true;
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (ok) ok.textContent = confirmLabel;
    modal.hidden = false;
    return new Promise(resolve => {
      const finish = value => {
        modal.hidden = true;
        resolve(value);
      };
      ok.onclick = () => finish(true);
      cancel.onclick = () => finish(false);
    });
  }

  initDemoGuide() {
    this.demoSteps = [
      {
        page: 'page-dashboard',
        title: '1. One township common operating picture',
        body: 'Road status, shelter capacity, resident requests and route latency are on one screen. Point out the disclaimer: this is a simulation, not a field-verified safety assessment.',
        selector: '#page-dashboard .kpi-grid'
      },
      {
        page: 'page-map',
        title: '2. Test a flood closure',
        body: 'Switch to the tactical map. Road corridors are OSM-aligned. Use the route planner and choose Fastest versus Safest to show hazard exposure changing the recommendation.',
        selector: '.route-planner-card'
      },
      {
        page: 'page-reports',
        title: '3. Commander authorization',
        body: 'Open Reports. High-impact actions require individual confirmation and a Commander role. Switch to Auditor in Demo tools to show the read-only control.',
        selector: '#decisions-list-container'
      },
      {
        page: 'page-reports',
        title: '4. Route-aware dispatch',
        body: 'Auto-match the queue. Each match now explains distance, ETA, hazard exposure and closures avoided. Dispatch keeps the planned route and ETA instead of a hardcoded value.',
        selector: '#requests-list-container'
      },
      {
        page: 'page-community',
        title: '5. Resident SOS and offline queue',
        body: 'Open Resident SOS on a phone. A resident can submit in Bahasa Melayu or English, use sector fallback if GPS is denied, and keep the request offline. It syncs through the local demo queue.',
        selector: '.community-form-pane'
      },
      {
        page: 'page-reports',
        title: '6. Verify and export',
        body: 'Verify the SHA-256 audit chain, export the JSON audit pack and generate a print-ready situation report for the commander.',
        selector: '#page-reports .vrf-summary-box'
      }
    ];

    const panel = document.getElementById('demo-guide-panel');
    const close = document.getElementById('demo-guide-close');
    const prev = document.getElementById('demo-guide-prev');
    const next = document.getElementById('demo-guide-next');
    if (close) close.onclick = () => this.closeDemoGuide();
    if (prev) prev.onclick = () => {
      this.demoStepIndex = Math.max(0, this.demoStepIndex - 1);
      this.renderDemoStep();
    };
    if (next) next.onclick = () => {
      if (this.demoStepIndex >= this.demoSteps.length - 1) {
        this.closeDemoGuide();
        return;
      }
      this.demoStepIndex += 1;
      this.renderDemoStep();
    };
    if (panel) panel.hidden = true;
  }

  openDemoGuide() {
    this.demoStepIndex = 0;
    const panel = document.getElementById('demo-guide-panel');
    if (panel) panel.hidden = false;
    this.renderDemoStep();
  }

  closeDemoGuide() {
    const panel = document.getElementById('demo-guide-panel');
    if (panel) panel.hidden = true;
    document.querySelectorAll('.guided-highlight').forEach(element => element.classList.remove('guided-highlight'));
    this._guideTarget = null;
  }

  renderDemoStep() {
    const step = this.demoSteps[this.demoStepIndex];
    if (!step) return;
    this.switchPage(step.page);
    document.querySelectorAll('.guided-highlight').forEach(element => element.classList.remove('guided-highlight'));
    const target = document.querySelector(step.selector);
    if (target) {
      target.classList.add('guided-highlight');
      this._guideTarget = target;
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
    }
    const label = document.getElementById('demo-guide-step-label');
    const title = document.getElementById('demo-guide-title');
    const body = document.getElementById('demo-guide-body');
    const prev = document.getElementById('demo-guide-prev');
    const next = document.getElementById('demo-guide-next');
    if (label) label.textContent = `Step ${this.demoStepIndex + 1} of ${this.demoSteps.length}`;
    if (title) title.textContent = step.title;
    if (body) body.textContent = step.body;
    if (prev) prev.disabled = this.demoStepIndex === 0;
    if (next) next.textContent = this.demoStepIndex === this.demoSteps.length - 1 ? 'Finish' : 'Next step';
  }

  verifyAuditChain(showToast = false) {
    const result = store.verifyAuditChain();
    if (showToast) {
      this.showToast(
        result.valid
          ? `Audit chain valid: ${result.checked} entries, head ${result.headHash.slice(0, 18)}...`
          : `Audit chain broken at ${result.brokenAt}. Export blocked for investigation.`,
        result.valid ? 'success' : 'danger'
      );
    }
    this.renderAuditLogs();
    return result;
  }

  exportSituationReport() {
    const report = store.buildSituationReport();
    const html = this.buildSituationReportHtml(report);
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 250);
    } else {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `NADITOWN_SITREP_${Date.now()}.html`;
      link.click();
      URL.revokeObjectURL(url);
      this.showToast('Popup blocked; SITREP downloaded instead.', 'info');
    }
  }

  buildSituationReportHtml(report) {
    const escape = value => this.escapeHtml(value == null ? '—' : value);
    const requestRows = report.requestsDetail.map(request => `
      <tr>
        <td>${escape(request.id)}</td>
        <td>${escape(request.requester)}<br><small>${escape(request.location)}</small></td>
        <td>${escape(request.need)}</td>
        <td>${escape(request.urgency)}</td>
        <td>${escape(request.status)}</td>
        <td>${escape(request.resource)}</td>
        <td>${escape(request.eta)}</td>
      </tr>
    `).join('');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>NADITOWN SITREP</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;color:#172326;margin:32px;line-height:1.45}
h1{font-size:24px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.05em}
.meta{color:#5d747b;font-size:12px}.banner{border-left:4px solid #117c96;padding:8px 12px;background:#eef7f9;margin:14px 0}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.box{border:1px solid #c7d8dd;padding:8px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #c7d8dd;padding:5px;text-align:left;vertical-align:top}
th{background:#eef7f9}.note{font-size:10px;color:#5d747b;margin-top:8px}
</style></head><body>
<h1>NADITOWN Situation Report</h1>
<div class="meta">${escape(report.township)} · ${escape(report.district)} · generated ${escape(report.generatedAt)} · role ${escape(report.role)}</div>
<div class="banner"><strong>${escape(report.incident)}</strong> · Emergency level ${escape(report.emergencyLevel)} · Simulation only - not a field-verified safety assessment.</div>
<div class="grid">
  <div class="box"><strong>Route</strong><br>${escape(report.route.origin)} to ${escape(report.route.destination)}<br>${escape(report.route.distanceKm)} km · ${escape(report.route.etaMin)} min · ${escape(report.route.preference)}<br>${escape(report.route.hazards)} hazards · ${escape(report.route.closuresAvoided)} closures avoided</div>
  <div class="box"><strong>Requests</strong><br>${escape(report.requests.covered)} / ${escape(report.requests.total)} covered (${escape(report.requests.coveragePct)}%)<br>${escape(report.requests.pending)} pending · ${escape(report.requests.insufficient)} shortfall · ${escape(report.requests.unmatched)} unmatched</div>
  <div class="box"><strong>Resources</strong><br>${escape(report.resources.availableUnits)} units available<br>${escape(report.resources.availableShelterBeds)} shelter beds available<br>${escape(report.resources.overAllocationsBlocked)} over-allocations blocked</div>
</div>
<h2>Road network</h2>
<div class="box">${escape(report.roads.clear)} clear &middot; ${escape(report.roads.hazard)} hazard &middot; ${escape(report.roads.closed)} closed<br>Closed: ${escape((report.roads.closedNames || []).join(' ; ') || 'none')}</div>
<h2>Request queue</h2>
<table><thead><tr><th>ID</th><th>Requester / location</th><th>Need</th><th>Urgency</th><th>Status</th><th>Resource</th><th>ETA</th></tr></thead><tbody>${requestRows}</tbody></table>
<h2>Audit integrity</h2>
<div class="box">SHA-256 chain ${report.audit.chainValid ? 'VALID' : 'INVALID'} · ${escape(report.audit.entries)} entries · head ${escape(report.audit.headHash)}<br>Last verified: ${escape(report.audit.lastVerifiedAt || '—')}</div>
<p class="note">NADITOWN prototype. Demonstration data only. Not a substitute for PKOB field verification, official warnings or emergency services.</p>
</body></html>`;
  }

  switchPage(pageId, updateHash = true) {
    const pagePanes = document.querySelectorAll('.page-view-container');
    const navBtns = document.querySelectorAll('.nav-page-btn');

    pagePanes.forEach(p => p.classList.remove('active'));
    navBtns.forEach(b => b.classList.remove('active'));

    const targetEl = document.getElementById(pageId);
    if (targetEl) targetEl.classList.add('active');

    const activeNavBtn = document.querySelector(`.nav-page-btn[data-page="${pageId}"]`);
    if (activeNavBtn) activeNavBtn.classList.add('active');

    const cleanHash = pageId.replace('page-', '');
    if (updateHash) {
      window.location.hash = cleanHash;
    }

    store.setActivePage(cleanHash);

    // If switching to Map, invalidate Leaflet container size to re-render tiles
    if (pageId === 'page-map' && this.mapEngine && this.mapEngine.map) {
      setTimeout(() => {
        this.mapEngine.map.invalidateSize();
      }, 150);
    }
  }

  // ==========================================
  // 2. PAGE 1: DASHBOARD
  // ==========================================
  initDashboardPage() {
    this.updateKPIs();
    this.renderRoadsDetailTable();
    this.renderShelterDetailCards();
    this.renderRequestsSummaryCard();
    this.renderRouteBenchmarkCard();
  }

  updateKPIs() {
    this.updateRoadKPIs();
    this.updateShelterKPIs();
    this.updateRequestsKPIs();
    this.updateRoutingKPIs();
    this.updateCoordinationIndicators();
  }

  updateRoadKPIs() {
    const roads = store.state.roads;
    const total = roads.length;
    const openCount = roads.filter(r => r.status === 'clear').length;
    const hazardCount = roads.filter(r => r.status === 'hazard').length;
    const closedCount = roads.filter(r => r.status === 'closed').length;
    const passablePct = Math.round(((openCount + hazardCount * 0.5) / total) * 100);

    const valEl = document.getElementById('kpi-open-roads');
    const badgeEl = document.getElementById('kpi-road-badge');
    const subtextEl = document.getElementById('kpi-road-subtext');
    const pctEl = document.getElementById('kpi-road-pct');
    const barEl = document.getElementById('kpi-road-bar');

    if (valEl) valEl.textContent = openCount;
    if (badgeEl) {
      if (closedCount > 0) {
        badgeEl.textContent = `${closedCount} Closed`;
        badgeEl.style.color = '#ef4444';
        badgeEl.style.borderColor = '#ef4444';
        badgeEl.style.background = 'rgba(239, 68, 68, 0.15)';
      } else if (hazardCount > 0) {
        badgeEl.textContent = `${hazardCount} Hazard`;
        badgeEl.style.color = '#b45309';
        badgeEl.style.borderColor = '#b45309';
        badgeEl.style.background = 'rgba(180, 83, 9, 0.15)';
      } else {
        badgeEl.textContent = `All Clear`;
        badgeEl.style.color = '#33bfd6';
        badgeEl.style.borderColor = '#117c96';
        badgeEl.style.background = 'rgba(51, 191, 214, 0.15)';
      }
    }
    if (subtextEl) subtextEl.textContent = `${openCount} Clear | ${hazardCount} Hazard | ${closedCount} Closed`;
    if (pctEl) pctEl.textContent = `${passablePct}% Passable`;
    if (barEl) {
      barEl.style.width = `${passablePct}%`;
      barEl.style.background = passablePct > 70 ? '#33bfd6' : (passablePct > 40 ? '#b45309' : '#ef4444');
    }
  }

  updateShelterKPIs() {
    const facs = store.state.facilities.filter(f => f.shelterApproved);
    const activePPS = facs.filter(f => f.acceptingIntake && f.status !== 'closed');
    const totalCap = facs.reduce((sum, f) => sum + f.capacity, 0);
    const currentOcc = facs.reduce((sum, f) => sum + f.currentOccupants, 0);
    const pct = totalCap > 0 ? ((currentOcc / totalCap) * 100).toFixed(1) : 0;

    const pctEl = document.getElementById('kpi-shelter-pct');
    const countsEl = document.getElementById('kpi-shelter-counts');
    const activeBadge = document.getElementById('kpi-shelter-active');
    const barEl = document.getElementById('kpi-shelter-bar');

    if (pctEl) pctEl.textContent = `${pct}%`;
    if (countsEl) countsEl.textContent = `(${currentOcc.toLocaleString()} / ${totalCap.toLocaleString()} Evacuees)`;
    if (activeBadge) activeBadge.textContent = `${activePPS.length} Active Shelters`;
    if (barEl) {
      barEl.style.width = `${Math.min(pct, 100)}%`;
      barEl.style.background = pct > 85 ? '#ef4444' : (pct > 65 ? '#b45309' : '#33bfd6');
    }

    const food = store.state.declaredResources.find(resource => resource.id === 'res-food-01');
    const boats = store.state.declaredResources.find(resource => resource.id === 'res-boat-01');
    const vehicles = store.state.declaredResources.find(resource => resource.id === 'res-4x4-01');
    const foodEl = document.getElementById('badge-food');
    const boatsEl = document.getElementById('badge-boats');
    const fourEl = document.getElementById('badge-4x4');
    if (foodEl) foodEl.textContent = `🍱 MRE: ${store.getResourceAvailable(food).toLocaleString()}`;
    if (boatsEl) boatsEl.textContent = `🚤 Boats: ${store.getResourceAvailable(boats)} Ready`;
    if (fourEl) fourEl.textContent = `🚙 4x4: ${store.getResourceAvailable(vehicles)} Ready`;
  }

  updateCoordinationIndicators() {
    const metrics = store.getCoordinationMetrics();
    const availableEl = document.getElementById('coord-kpi-available-facilities');
    const unavailableEl = document.getElementById('coord-kpi-unavailable');
    const allocatedEl = document.getElementById('coord-kpi-allocated');
    const attentionEl = document.getElementById('coord-kpi-attention');
    const availableSub = document.getElementById('coord-kpi-available-sub');
    const attentionSub = document.getElementById('coord-kpi-attention-sub');
    const navBadge = document.getElementById('nav-coordination-badge');

    if (availableEl) availableEl.textContent = metrics.availableFacilities;
    if (unavailableEl) unavailableEl.textContent = metrics.unavailableFacilities;
    if (allocatedEl) allocatedEl.textContent = metrics.allocatedUnits;
    if (attentionEl) attentionEl.textContent = metrics.attentionRequests;
    if (availableSub) availableSub.textContent = `${metrics.approvedShelters} approved shelters • ${metrics.availableShelterBeds} intake beds`;
    if (attentionSub) attentionSub.textContent = `${metrics.unmatchedRequests} unmatched • ${metrics.insufficientRequests} short`;
    if (navBadge) {
      navBadge.textContent = metrics.attentionRequests;
      navBadge.style.display = metrics.attentionRequests > 0 ? '' : 'none';
    }
  }

  updateRequestsKPIs() {
    const reqs = store.state.requests;
    const total = reqs.length;
    const pending = reqs.filter(r => r.status === 'pending').length;
    const matched = reqs.filter(r => r.status === 'matched').length;
    const dispatched = reqs.filter(r => r.status === 'dispatched' || r.status === 'resolved').length;
    const insufficient = reqs.filter(r => r.status === 'insufficient').length;
    const unmatched = reqs.filter(r => r.status === 'unmatched').length;
    const attention = pending + insufficient + unmatched;
    const covered = matched + dispatched;
    const matchRate = total > 0 ? ((covered / total) * 100).toFixed(1) : 0;

    const totalEl = document.getElementById('kpi-total-requests');
    const badgeEl = document.getElementById('kpi-req-badge');
    const breakdownEl = document.getElementById('kpi-requests-breakdown');
    const rateEl = document.getElementById('kpi-match-rate');
    const barEl = document.getElementById('kpi-requests-bar');

    if (totalEl) totalEl.textContent = total;
    if (badgeEl) {
      badgeEl.textContent = attention > 0 ? `${attention} Need Attention` : 'All Assigned';
      badgeEl.style.color = attention > 0 ? '#f59e0b' : '#33bfd6';
      badgeEl.style.borderColor = attention > 0 ? '#b45309' : '#117c96';
    }
    if (breakdownEl) breakdownEl.textContent = `${pending} Pending • ${matched + dispatched} Assigned • ${insufficient + unmatched} Short/Unmatched`;
    if (rateEl) rateEl.textContent = `${matchRate}% Covered`;
    if (barEl) {
      barEl.style.width = `${matchRate}%`;
      barEl.style.background = attention > 0 ? '#b45309' : '#4f8b9b';
    }

    // Top navigation badge updates
    const navCommBadge = document.getElementById('nav-community-badge');
    if (navCommBadge) navCommBadge.textContent = pending + insufficient + unmatched;
  }

  updateRoutingKPIs() {
    const routing = store.state.routing;
    const logs = store.state.eventLogs;

    const timeEl = document.getElementById('kpi-recalc-time');
    const hazardEl = document.getElementById('kpi-route-hazard-count');
    const verifiedEl = document.getElementById('kpi-verified-count');

    if (timeEl) timeEl.textContent = routing.recalcTimeMs;
    if (hazardEl) {
      hazardEl.textContent = routing.routeFound
        ? `${routing.hazardSegmentsUsed} Hazard Segment${routing.hazardSegmentsUsed === 1 ? '' : 's'} on Route`
        : 'No Route Found';
    }
    if (verifiedEl) verifiedEl.textContent = `${logs.length} Triggers Verified`;

    const bannerTag = document.getElementById('banner-route-tag');
    const bannerText = document.getElementById('banner-route-text');
    const bannerStat = document.getElementById('banner-recalc-stat');

    if (bannerTag) {
      if (!routing.routeFound) {
        bannerTag.textContent = "NO ROUTE FOUND";
        bannerTag.style.background = "rgba(239, 68, 68, 0.2)";
        bannerTag.style.color = "#ef4444";
        bannerTag.style.borderColor = "#ef4444";
      } else if (routing.hazardSegmentsUsed > 0) {
        bannerTag.textContent = "SIMULATED ROUTE - HAZARD";
        bannerTag.style.background = "rgba(180, 83, 9, 0.2)";
        bannerTag.style.color = "#f59e0b";
        bannerTag.style.borderColor = "#b45309";
      } else {
        bannerTag.textContent = "SIMULATED ROUTE FOUND";
        bannerTag.style.background = "rgba(51, 191, 214, 0.2)";
        bannerTag.style.color = "#33bfd6";
        bannerTag.style.borderColor = "#117c96";
      }
    }
    if (bannerText) {
      bannerText.textContent = routing.routeFound
        ? `${routing.originName} ➔ ${routing.destinationName}`
        : `No simulated route from ${routing.originName} to ${routing.destinationName}`;
    }
    if (bannerStat) {
      bannerStat.textContent = routing.routeFound
        ? `Dijkstra: ${routing.recalcTimeMs} ms | ${routing.pathDistanceKm} km | ETA ~${routing.estimatedTimeMin} min | ${routing.closedRoadsExcluded} closed excluded`
        : `Dijkstra: ${routing.recalcTimeMs} ms | ${routing.closedRoadsExcluded} closed segment(s) excluded`;
    }

    const vrfCalcTime = document.getElementById('vrf-calc-time');
    if (vrfCalcTime) vrfCalcTime.textContent = `${routing.recalcTimeMs} ms (Dijkstra)`;
  }

  renderRoadsDetailTable() {
    const container = document.getElementById('dash-roads-table-body');
    if (!container) return;
    container.innerHTML = '';

    store.state.roads.forEach(road => {
      const tr = document.createElement('tr');
      const isClosed = road.status === 'closed';
      const isHazard = road.status === 'hazard';

      let statusBadge = isClosed 
        ? `<span class="badge-status-closed">🔴 Closed</span>`
        : (isHazard ? `<span class="badge-status-hazard">⚠️ Hazard</span>` : `<span class="badge-status-clear">🟢 Clear</span>`);

      tr.innerHTML = `
        <td><strong style="color:var(--text-white);">${this.escapeHtml(road.name)}</strong></td>
        <td>${statusBadge}</td>
        <td><span style="font-family:monospace; color:var(--text-white); font-weight:700;">${this.escapeHtml(road.surfaceWater)}</span></td>
        <td style="color:var(--text-brown);">${this.escapeHtml(road.passableFor)}</td>
        <td><span class="risk-tag risk-${this.escapeHtml(String(road.riskLevel).toLowerCase())}">${this.escapeHtml(road.riskLevel)}</span></td>
        <td>
          <button class="btn-action ${isClosed ? 'btn-approve' : 'btn-dismiss'}" data-toggle-road="${this.escapeHtml(road.id)}" ${store.canEdit() ? '' : 'disabled'} style="padding:4px 8px; font-size:10px;">
            ${isClosed ? 'Reopen' : 'Close road'}
          </button>
        </td>
      `;

      const btn = tr.querySelector(`[data-toggle-road="${road.id}"]`);
      if (btn) {
        btn.onclick = async () => {
          if (!store.canEdit()) {
            this.showToast('Auditors are read-only.', 'warning');
            return;
          }
          const confirmed = await this.confirmAction(
            isClosed ? 'Reopen road corridor' : 'Close road corridor',
            `${isClosed ? 'Reopen' : 'Close'} ${road.name}? This changes the route graph and is written to the audit chain.`,
            isClosed ? 'Reopen' : 'Close road'
          );
          if (!confirmed) return;
          store.setRoadStatus(road.id, isClosed ? 'clear' : 'closed');
          this.showToast(`Updated ${road.name} to ${isClosed ? 'CLEAR' : 'CLOSED'}.`, 'info');
        };
      }

      container.appendChild(tr);
    });
  }

  renderShelterDetailCards() {
    const container = document.getElementById('dash-shelter-cards');
    if (!container) return;
    container.innerHTML = '';

    const ppsList = store.state.facilities.filter(f => f.shelterApproved);
    ppsList.forEach(fac => {
      const card = document.createElement('div');
      card.className = 'detail-stat-card';
      const occPct = fac.capacity > 0 ? Math.round((fac.currentOccupants / fac.capacity) * 100) : 0;
      const barColor = occPct >= 90 ? '#ef4444' : (occPct >= 70 ? '#b45309' : '#33bfd6');
      const remaining = store.getFacilityRemainingCapacity(fac);
      const availability = fac.acceptingIntake ? 'ACCEPTING' : 'NOT ACCEPTING';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
          <h4 style="font-size:13px; font-weight:700; color:var(--text-white);">${fac.name}</h4>
          <span style="font-size:10px; font-weight:700; color:${fac.acceptingIntake ? '#33bfd6' : '#f59e0b'};">
            ● ${availability}
          </span>
        </div>
        <div style="font-size:11px; color:var(--text-brown); margin-bottom:4px;">
          Declared: <strong>${fac.currentOccupants} / ${fac.capacity} ${fac.capacityUnit} (${occPct}%)</strong>
        </div>
        <div style="font-size:10px; color:var(--text-muted); margin-bottom:6px;">
          Remaining capacity: <strong style="color:${remaining > 0 ? '#33bfd6' : '#ef4444'};">${remaining} ${fac.capacityUnit}</strong>
        </div>
        <div class="mini-progress-track" style="margin-bottom:8px;">
          <div class="mini-progress-fill" style="width:${Math.min(occPct, 100)}%; background:${barColor};"></div>
        </div>
        <div style="font-size:10px; color:var(--text-muted); line-height:1.4;">
          <strong>Accessibility:</strong> ${fac.accessibility}<br>
          <strong>Limitation:</strong> ${fac.limitations[0] || 'None recorded'}
        </div>
      `;
      container.appendChild(card);
    });
  }

  renderRequestsSummaryCard() {
    const container = document.getElementById('dash-requests-summary');
    if (!container) return;

    const reqs = store.state.requests;
    const critical = reqs.filter(r => r.urgency === 'critical').length;
    const high = reqs.filter(r => r.urgency === 'high').length;
    const medium = reqs.filter(r => r.urgency === 'medium').length;

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:10px;">
        <div class="summary-metric-tile">
          <span class="tile-label">Critical SOS</span>
          <span class="tile-val" style="color:#ef4444;">${critical}</span>
        </div>
        <div class="summary-metric-tile">
          <span class="tile-label">High Priority</span>
          <span class="tile-val" style="color:#f59e0b;">${high}</span>
        </div>
        <div class="summary-metric-tile">
          <span class="tile-label">Moderate</span>
          <span class="tile-val" style="color:#33bfd6;">${medium}</span>
        </div>
      </div>
      <div style="font-size:11px; color:var(--text-brown);">
        Latest request: <strong style="color:var(--text-white);">${this.escapeHtml(reqs[0]?.requester || 'None')}</strong> (${this.escapeHtml(reqs[0]?.need || '--')})
      </div>
    `;
  }

  renderRouteBenchmarkCard() {
    const container = document.getElementById('dash-route-benchmark');
    if (!container) return;

    const routing = store.state.routing;
    const found = routing.routeFound;
    const statusColor = found ? (routing.hazardSegmentsUsed > 0 ? '#f59e0b' : '#33bfd6') : '#ef4444';
    const statusLabel = found
      ? (routing.hazardSegmentsUsed > 0 ? 'ROUTE FOUND - HAZARD' : 'ROUTE FOUND')
      : 'NO ROUTE FOUND';

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div>
          <div style="font-size:10px; color:var(--text-brown); text-transform:uppercase; font-weight:700;">Dijkstra Route Calculation Latency</div>
          <div style="font-size:24px; font-weight:800; color:#33bfd6;">${routing.recalcTimeMs} ms</div>
        </div>
        <span class="route-status-tag" style="padding:4px 8px; font-size:11px; color:${statusColor}; border-color:${statusColor}; background:${statusColor}22;">${statusLabel}</span>
      </div>
      <div style="font-size:11px; color:var(--text-muted); background:var(--card-inner); padding:8px; border-radius:6px; border:1px solid var(--border);">
        <div><strong>Origin:</strong> ${routing.originName}</div>
        <div><strong>Destination:</strong> ${routing.destinationName}</div>
        <div><strong>Path Status:</strong> ${routing.pathStatus}</div>
        ${found ? `
          <div><strong>Distance:</strong> ${routing.pathDistanceKm} km | <strong>ETA:</strong> ~${routing.estimatedTimeMin} mins</div>
          <div><strong>Priority:</strong> ${routing.routePreference === 'fastest' ? 'Fastest' : 'Safest'} | <strong>Hazards:</strong> ${routing.hazardSegmentsUsed} | <strong>Closed excluded:</strong> ${routing.closedRoadsExcluded}</div>
        ` : ''}
        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:8px;">
          <span class="resource-badge">Coverage ${store.getImpactMetrics().coveragePct}%</span>
          <span class="resource-badge">Avg match ETA ${store.getImpactMetrics().averageEtaMin == null ? 'n/a' : store.getImpactMetrics().averageEtaMin + ' min'}</span>
          <span class="resource-badge">Audit ${store.state.verification.chainValid ? 'chain valid' : 'chain invalid'}</span>
          <span class="resource-badge">Over-allocation blocks ${store.getImpactMetrics().overAllocationsBlocked}</span>
        </div>
        <div style="margin-top:6px; color:#93aab2;">Simulation only - not a real-world safety assessment.</div>
      </div>
    `;
  }

  // ==========================================
  // 3. PAGE 2: MAP & SIMULATION
  // ==========================================
  initMapPage() {
    this.initMapControls();
    this.initSimulationControls();
    this.initRoutePlanner();
    this.renderFacilitiesList();
  }

  initMapControls() {
    const keys = ['floodZones', 'roads', 'pps', 'sensors', 'route'];
    keys.forEach(k => {
      const btn = document.getElementById(`layer-btn-${k}`);
      if (btn) {
        btn.onclick = () => {
          const active = btn.classList.toggle('active');
          if (this.mapEngine && this.mapEngine.layerGroups[k]) {
            if (active) this.mapEngine.map.addLayer(this.mapEngine.layerGroups[k]);
            else this.mapEngine.map.removeLayer(this.mapEngine.layerGroups[k]);
          }
        };
      }
    });

    const styleBtn = document.getElementById('map-style-toggle');
    const styles = ['satellite', 'street', 'dark'];
    let sIdx = 0;
    if (styleBtn) {
      styleBtn.onclick = () => {
        sIdx = (sIdx + 1) % styles.length;
        const next = styles[sIdx];
        if (this.mapEngine) this.mapEngine.switchBaseLayer(next);
        styleBtn.textContent = next === 'satellite' ? '🛰️ Satellite' : (next === 'street' ? '🗺️ Street' : '🌙 Dark');
        this.showToast(`Map style changed to: ${next.toUpperCase()}`, 'info');
      };
    }

    const resetBtn = document.getElementById('map-reset-btn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (this.mapEngine) this.mapEngine.resetView();
        this.showToast("Map view reset to Bandar Elmina central.", 'info');
      };
    }
  }

  initSimulationControls() {
    const sRain = document.getElementById('slider-rainfall');
    const sSurge = document.getElementById('slider-surge');
    const sRisk = document.getElementById('slider-risk');
    const vRain = document.getElementById('val-rainfall');
    const vSurge = document.getElementById('val-surge');
    const vRisk = document.getElementById('val-risk');

    if (sRain) {
      sRain.oninput = (e) => {
        const val = e.target.value;
        let label = val > 100 ? "Monsoon Deluge" : (val > 60 ? "Heavy Downpour" : (val > 30 ? "Moderate" : "Light Drizzle"));
        if (vRain) vRain.textContent = `${val} mm/h (${label})`;
        store.setSimulationValue('rainfall', val);
        this.clearPresets();
      };
    }
    if (sSurge) {
      sSurge.oninput = (e) => {
        const val = parseFloat(e.target.value).toFixed(2);
        if (vSurge) vSurge.textContent = `+${val} m ${val > 1.2 ? '(Critical Breach)' : '(Surge Rise)'}`;
        store.setSimulationValue('waterSurge', val);
        this.clearPresets();
      };
    }
    if (sRisk) {
      sRisk.oninput = (e) => {
        const val = parseFloat(e.target.value).toFixed(1);
        if (vRisk) vRisk.textContent = `${val}x (${val > 1.8 ? 'High Alert' : 'Standard'})`;
        store.setSimulationValue('riskMultiplier', val);
        this.clearPresets();
      };
    }

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        store.applyScenarioPreset(btn.dataset.preset);
        this.syncSliders();
        this.showToast(`Simulation Scenario: ${btn.textContent}`, 'warning');
      };
    });
  }

  clearPresets() {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  }

  initRoutePlanner() {
    const originSelect = document.getElementById('route-origin-select');
    const destinationSelect = document.getElementById('route-destination-select');
    const preferenceSelect = document.getElementById('route-preference');
    const calculateBtn = document.getElementById('route-calculate-btn');
    if (!originSelect || !destinationSelect) return;

    const options = store.state.facilities.map(facility =>
      `<option value="${facility.id}">${this.escapeHtml(facility.name)}</option>`
    ).join('');
    originSelect.innerHTML = options;
    destinationSelect.innerHTML = options;
    originSelect.value = store.state.routing.originId;
    destinationSelect.value = store.state.routing.destinationId;
    if (preferenceSelect) preferenceSelect.value = store.state.routing.routePreference || 'safest';

    const applyRoute = async (notify) => {
      const originId = originSelect.value;
      const destinationId = destinationSelect.value;
      if (originId === destinationId) {
        this.showToast('Choose a different origin and destination.', 'warning');
        this.renderRoutePlannerResult();
        return;
      }

      const routing = await store.setRouteEndpoints(originId, destinationId, true);
      this.renderRoutePlannerResult();
      if (notify && routing) {
        this.showToast(
          routing.routeFound
            ? `Road-following route: ${routing.pathDistanceKm} km | ${routing.hazardSegmentsUsed} hazard segment(s).`
            : 'No simulated route found with the current road closures.',
          routing.routeFound ? 'success' : 'danger'
        );
      }
    };

    originSelect.onchange = () => applyRoute(true);
    destinationSelect.onchange = () => applyRoute(true);
    if (calculateBtn) calculateBtn.onclick = () => applyRoute(true);
    if (preferenceSelect) {
      preferenceSelect.onchange = async () => {
        await store.setRoutePreference(preferenceSelect.value, true);
        this.renderRoutePlannerResult();
        const routing = store.state.routing;
        this.showToast(
          `${preferenceSelect.value === 'fastest' ? 'Fastest' : 'Safest'} route: ${routing.pathDistanceKm} km, ~${routing.estimatedTimeMin} min, ${routing.hazardSegmentsUsed} hazard segment(s).`,
          routing.hazardSegmentsUsed > 0 ? 'warning' : 'success'
        );
      };
    }

    this.renderRoutePlannerResult();
  }

  renderRoutePlannerResult() {
    const container = document.getElementById('route-planner-result');
    if (!container) return;

    const routing = store.state.routing;
    const originSelect = document.getElementById('route-origin-select');
    const destinationSelect = document.getElementById('route-destination-select');
    if (originSelect && document.activeElement !== originSelect && routing.originId) {
      originSelect.value = routing.originId;
    }
    if (destinationSelect && document.activeElement !== destinationSelect && routing.destinationId) {
      destinationSelect.value = routing.destinationId;
    }

    if (routing.routeFound) {
      const hazardColor = routing.hazardSegmentsUsed > 0 ? '#f59e0b' : '#33bfd6';
      const hazardLabel = routing.hazardSegmentsUsed > 0
        ? `ROUTE FOUND - ${routing.hazardSegmentsUsed} HAZARD`
        : 'ROUTE FOUND';
      const hazardNames = routing.hazardSegments.map(segment => this.escapeHtml(segment.name)).join(' · ');
      const connectorCount = routing.linksUsed ? routing.linksUsed.length : 0;
      const alternatives = routing.alternatives || {};
      const fastest = alternatives.fastest;
      const safest = alternatives.safest;
      const preferenceLabel = routing.routePreference === 'fastest' ? 'Fastest' : 'Safest';
      const fastestIsSlower = Boolean(fastest && safest && fastest.etaMin >= safest.etaMin && routing.roadGeometryStatus === 'aligned');

      container.innerHTML = `
        <div class="route-result-head">
          <span class="route-status-tag" style="color:${hazardColor}; border-color:${hazardColor}; background:${hazardColor}22;">${hazardLabel}</span>
          <span class="route-result-distance">${routing.pathDistanceKm} km</span>
        </div>
        <div class="route-result-line"><span>Priority</span><strong>${preferenceLabel}</strong></div>
        <div class="route-result-line"><span>ETA (simulated)</span><strong>~${routing.estimatedTimeMin} min</strong></div>
        <div class="route-result-line"><span>Road segments used</span><strong>${routing.roadsUsed.length}</strong></div>
        <div class="route-result-line"><span>Hazard segments on route</span><strong style="color:${hazardColor};">${routing.hazardSegmentsUsed}</strong></div>
        <div class="route-result-line"><span>Closed segments excluded</span><strong>${routing.closedRoadsExcluded}</strong></div>
        ${hazardNames ? `<div class="route-result-warning" title="${hazardNames}">Traverses: ${hazardNames}</div>` : ''}
        ${fastest && safest ? `<div class="route-result-note"><strong>Compare:</strong> Fastest ${fastest.distanceKm} km / ${fastest.etaMin} min / ${fastest.hazardSegmentsUsed} hazard vs Safest ${safest.distanceKm} km / ${safest.etaMin} min / ${safest.hazardSegmentsUsed} hazard.${fastestIsSlower ? ' After OSM alignment the hazard-accepting path is not faster; safest is recommended.' : ''}</div>` : ''}
        ${connectorCount > 0 ? `<div class="route-result-note">Dijkstra graph uses ${connectorCount} simulated local connector(s); the drawn route follows OpenStreetMap roads.</div>` : ''}
        ${routing.roadGeometryStatus === 'aligned'
          ? `<div class="route-result-note">Road geometry aligned to OpenStreetMap via ${routing.roadGeometrySource.includes('Valhalla') ? 'Valhalla' : 'OSRM'}.</div>`
          : (routing.roadGeometryStatus === 'fallback'
            ? '<div class="route-result-warning">Road geometry fallback: live road alignment was unavailable.</div>'
            : '')}
        <div class="route-result-disclaimer">Simulation only - not a field-verified route or real-world safety assessment. Graph: ${routing.graph ? routing.graph.nodes : '—'} nodes / ${routing.graph ? routing.graph.activeEdges : '—'} active edges. Computed in ${routing.recalcTimeMs} ms.</div>
      `;
    } else {
      container.innerHTML = `
        <div class="route-result-head">
          <span class="route-status-tag" style="color:#ef4444; border-color:#ef4444; background:rgba(239,68,68,0.18);">NO ROUTE FOUND</span>
        </div>
        <div class="route-result-error">${routing.pathStatus}</div>
        <div class="route-result-note">Reopen a road segment in the simulation controls or choose a different origin/destination.</div>
        <div class="route-result-disclaimer">Simulation only. Graph: ${routing.graph ? routing.graph.nodes : '—'} nodes / ${routing.graph ? routing.graph.activeEdges : '—'} active edges. Computed in ${routing.recalcTimeMs} ms.</div>
      `;
    }
  }

  syncSliders() {
    const sim = store.state.simulation;
    const sRain = document.getElementById('slider-rainfall');
    const sSurge = document.getElementById('slider-surge');
    const sRisk = document.getElementById('slider-risk');
    const vRain = document.getElementById('val-rainfall');
    const vSurge = document.getElementById('val-surge');
    const vRisk = document.getElementById('val-risk');

    if (sRain) sRain.value = sim.rainfall;
    if (sSurge) sSurge.value = sim.waterSurge;
    if (sRisk) sRisk.value = sim.riskMultiplier;
    if (vRain) vRain.textContent = `${sim.rainfall} mm/h`;
    if (vSurge) vSurge.textContent = `+${sim.waterSurge.toFixed(2)} m`;
    if (vRisk) vRisk.textContent = `${sim.riskMultiplier.toFixed(1)}x`;

    const emPill = document.getElementById('emergency-pill');
    const emText = document.getElementById('emergency-level-text');
    if (emText && emPill) {
      const lvl = store.state.emergencyLevel;
      if (lvl === 'RED') {
        emText.textContent = "LEVEL 4: RED DELUGE ALERT";
        emPill.style.color = "#ef4444";
        emPill.style.borderColor = "#ef4444";
        emPill.style.background = "rgba(239, 68, 68, 0.2)";
      } else if (lvl === 'ORANGE') {
        emText.textContent = "LEVEL 3: ORANGE ALERT";
        emPill.style.color = "#f59e0b";
        emPill.style.borderColor = "#b45309";
        emPill.style.background = "rgba(180, 83, 9, 0.15)";
      } else {
        emText.textContent = "LEVEL 1: GREEN NORMAL";
        emPill.style.color = "#33bfd6";
        emPill.style.borderColor = "#117c96";
        emPill.style.background = "rgba(51, 191, 214, 0.15)";
      }
    }
  }

  renderFacilitiesList() {
    const container = document.getElementById('map-facilities-list-body');
    if (!container) return;
    container.innerHTML = '';

    const filterBtns = document.querySelectorAll('#fac-filter-group .audit-filter-btn');
    filterBtns.forEach(btn => {
      btn.onclick = () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFacFilter = btn.dataset.facFilter;
        this.renderFacilitiesList();
      };
    });

    const list = store.state.facilities.filter(f => {
      if (this.currentFacFilter === 'all') return true;
      return f.type === this.currentFacFilter;
    });

    list.forEach(fac => {
      const card = document.createElement('div');
      card.className = 'facility-card-item';
      const occPct = fac.capacity > 0 ? Math.round((fac.currentOccupants / fac.capacity) * 100) : 0;
      const remaining = store.getFacilityRemainingCapacity(fac);
      const isAvailable = store.isFacilityAvailable(fac);
      const availabilityColor = isAvailable ? (fac.acceptingIntake ? '#33bfd6' : '#f59e0b') : '#ef4444';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
          <span style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--green-bright); background:var(--green-pill-bg); padding:2px 6px; border-radius:4px;">
            ${fac.category}
          </span>
          <span style="font-size:10px; font-weight:700; color:${availabilityColor};">
            ● ${isAvailable ? (fac.acceptingIntake ? 'AVAILABLE' : 'LIMITED') : 'UNAVAILABLE'}
          </span>
        </div>
        <h4 style="font-size:13px; font-weight:700; color:var(--text-white); margin-bottom:4px;">${fac.name}</h4>
        <div style="font-size:11px; color:var(--text-brown); margin-bottom:4px;">
          ${fac.capacity > 0 ? `Declared: <strong>${fac.currentOccupants} / ${fac.capacity} ${fac.capacityUnit}</strong> • Remaining: <strong>${remaining}</strong> • ` : ''}
          ${fac.zone}
        </div>
        <div style="font-size:10px; color:${fac.shelterApproved ? '#33bfd6' : '#f59e0b'}; margin-bottom:4px; font-weight:700;">
          ${fac.shelterApproved ? '✓ Operator-approved emergency shelter' : 'Not an emergency shelter'}
        </div>
        <div style="font-size:10px; color:var(--text-muted); margin-bottom:6px;">
          ${fac.accessibility}${fac.limitations.length ? ` • ${fac.limitations[0]}` : ''}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <small style="color:var(--text-muted); font-size:10px;">${fac.amenities.slice(0, 2).join(', ')}</small>
          <button class="btn-action btn-map-view" data-focus-fac="${fac.id}" style="padding:3px 8px; font-size:10px;">
            📍 Focus on Map
          </button>
        </div>
      `;

      const btn = card.querySelector(`[data-focus-fac="${fac.id}"]`);
      if (btn) {
        btn.onclick = () => {
          if (this.mapEngine) {
            this.mapEngine.focusLocation(fac.coordinates[0], fac.coordinates[1], 16);
            this.showToast(`Centered map on: ${fac.name}`, 'info');
          }
        };
      }

      container.appendChild(card);
    });
  }

  // ==========================================
  // 4. PAGE 3: FACILITY & RESOURCE COORDINATION
  // ==========================================
  initCoordinationPage() {
    this.renderCoordinationPage();

    const facilityFilters = document.querySelectorAll('#coord-fac-filter-group .audit-filter-btn');
    facilityFilters.forEach(btn => {
      btn.onclick = () => {
        facilityFilters.forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
        this.currentCoordFacFilter = btn.dataset.coordFacFilter;
        this.renderCoordinationFacilities();
      };
    });

    const requestFilters = document.querySelectorAll('#coord-request-filter-group .audit-filter-btn');
    requestFilters.forEach(btn => {
      btn.onclick = () => {
        requestFilters.forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
        this.currentCoordReqFilter = btn.dataset.coordReqFilter;
        this.renderCoordinationRequests();
      };
    });

    const autoMatchBtn = document.getElementById('coord-auto-match-btn');
    if (autoMatchBtn) {
      autoMatchBtn.onclick = () => {
        if (!store.canEdit()) {
          this.showToast('Auditors are read-only.', 'warning');
          return;
        }
        const summary = store.autoMatchAllRequests();
        if (summary.matched > 0) {
          this.showToast(`${summary.matched} request(s) matched within declared capacity.`, 'success');
        } else if (summary.attempted > 0) {
          this.showToast(`${summary.insufficient} shortfall(s), ${summary.unmatched} unmatched - no allocation exceeded declared stock.`, 'warning');
        } else {
          this.showToast('No requests currently need matching.', 'info');
        }
      };
    }
  }

  renderCoordinationPage() {
    this.updateCoordinationIndicators();
    this.renderCoordinationFacilities();
    this.renderCoordinationResources();
    this.renderCoordinationRequests();
  }

  renderCoordinationFacilities() {
    const container = document.getElementById('coord-facilities-list');
    if (!container) return;
    const countEl = document.getElementById('coord-facility-count');

    const list = store.state.facilities.filter(facility => {
      if (this.currentCoordFacFilter === 'available') return store.isFacilityAvailable(facility);
      if (this.currentCoordFacFilter === 'unavailable') return !store.isFacilityAvailable(facility);
      if (this.currentCoordFacFilter === 'shelters') return facility.shelterApproved;
      return true;
    });

    if (countEl) countEl.textContent = `${list.length} / ${store.state.facilities.length}`;
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">No facilities match this filter.</div>`;
      return;
    }

    list.forEach(facility => {
      const card = document.createElement('div');
      const available = store.isFacilityAvailable(facility);
      const remaining = store.getFacilityRemainingCapacity(facility);
      const statusColor = !available ? '#ef4444' : (facility.acceptingIntake ? '#33bfd6' : '#f59e0b');
      const statusText = !available ? 'UNAVAILABLE' : (facility.acceptingIntake ? 'AVAILABLE' : 'LIMITED');
      const facilityResources = store.state.declaredResources.filter(resource => resource.facilityId === facility.id);
      card.className = `coord-card ${!available ? 'coord-card-unavailable' : ''}`;

      card.innerHTML = `
        <div class="coord-card-head">
          <div>
            <span class="coord-type-tag">${facility.category}</span>
            <h4 class="coord-card-title">${facility.name}</h4>
          </div>
          <span class="coord-status-tag" style="color:${statusColor}; border-color:${statusColor}; background:${statusColor}1a;">${statusText}</span>
        </div>
        <div class="coord-meta-row">
          <span>📍 ${facility.zone || 'Bandar Elmina'}</span>
          <span>${facility.shelterApproved ? '✓ Approved shelter' : '✕ Not a shelter'}</span>
        </div>
        <div class="coord-capacity-grid">
          <div>
            <span class="coord-mini-label">Declared capacity</span>
            <strong>${facility.capacity} ${facility.capacityUnit}</strong>
          </div>
          <div>
            <span class="coord-mini-label">Remaining</span>
            <strong style="color:${remaining > 0 ? '#33bfd6' : '#ef4444'};">${remaining} ${facility.capacityUnit}</strong>
          </div>
          <div>
            <span class="coord-mini-label">Occupancy</span>
            <strong>${facility.currentOccupants} ${facility.capacityUnit}</strong>
          </div>
        </div>
        <div class="coord-note">
          <strong>Accessibility:</strong> ${facility.accessibility || 'Not recorded'}<br>
          <strong>Limitations:</strong> ${(facility.limitations || []).join('; ') || 'None recorded'}<br>
          <strong>Approval:</strong> ${facility.approvalReference || 'Not applicable'}
        </div>
        <div class="coord-footer-row">
          <span>${facilityResources.length} declared resource(s)</span>
          <button class="btn-action btn-map-view" data-coord-fac-map="${facility.id}" style="padding:3px 8px; font-size:10px;">📍 Map</button>
        </div>
      `;

      const mapBtn = card.querySelector(`[data-coord-fac-map="${facility.id}"]`);
      if (mapBtn) {
        mapBtn.onclick = () => {
          this.switchPage('page-map');
          if (this.mapEngine) this.mapEngine.focusLocation(facility.coordinates[0], facility.coordinates[1], 16);
        };
      }

      container.appendChild(card);
    });
  }

  renderCoordinationResources() {
    const container = document.getElementById('coord-resources-list');
    if (!container) return;
    const summaryEl = document.getElementById('coord-resource-summary');
    const metrics = store.getCoordinationMetrics();
    if (summaryEl) summaryEl.textContent = `${metrics.allocatedResourceCount} allocated • ${metrics.availableUnits.toLocaleString()} units available`;
    container.innerHTML = '';

    store.state.declaredResources.forEach(resource => {
      const available = store.getResourceAvailable(resource);
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
          <div>
            <span class="coord-type-tag">${this.formatCategory(resource.category)}</span>
            <h4 class="coord-card-title">${resource.name}</h4>
          </div>
          <span class="coord-status-tag" style="color:${availabilityColor}; border-color:${availabilityColor}; background:${availabilityColor}1a;">${resource.availability.toUpperCase()}</span>
        </div>
        <div class="coord-meta-row">
          <span>📍 ${resource.location}</span>
          <span style="color:${allocationColor};">${resource.allocationStatus.replace('_', ' ').toUpperCase()}</span>
        </div>
        <div class="coord-stock-row">
          <div><span class="coord-mini-label">Available</span><strong style="color:${available > 0 ? '#33bfd6' : '#ef4444'};">${available}</strong></div>
          <div><span class="coord-mini-label">Allocated</span><strong>${allocated}</strong></div>
          <div><span class="coord-mini-label">Unavailable</span><strong>${unavailable}</strong></div>
          <div><span class="coord-mini-label">Declared</span><strong>${total} ${resource.unit}</strong></div>
        </div>
        <div class="coord-stock-bar">
          <div style="width:${allocatedPct}%; background:${allocationColor};"></div>
          <div style="width:${unavailablePct}%; background:#64748b;"></div>
        </div>
        <div class="coord-note">
          <strong>Compatible:</strong> ${(resource.compatibleCategories || [resource.category]).map(item => this.formatCategory(item)).join(', ')}<br>
          <strong>Access:</strong> ${resource.accessibility}<br>
          <strong>Limitations:</strong> ${(resource.limitations || []).join('; ') || 'None recorded'}
        </div>
        <div class="coord-footer-row">
          <span>Last updated: ${resource.lastUpdated || '—'}</span>
          <span>${resource.unit}</span>
        </div>
      `;

      container.appendChild(card);
    });
  }

  renderCoordinationRequests() {
    const container = document.getElementById('coord-requests-list');
    if (!container) return;
    const countEl = document.getElementById('coord-request-count');

    const list = store.state.requests.filter(request => {
      if (this.currentCoordReqFilter === 'attention') return ['pending', 'insufficient', 'unmatched'].includes(request.status);
      if (this.currentCoordReqFilter === 'pending') return request.status === 'pending';
      if (this.currentCoordReqFilter === 'matched') return request.status === 'matched';
      if (this.currentCoordReqFilter === 'dispatched') return ['dispatched', 'resolved'].includes(request.status);
      return true;
    });

    if (countEl) countEl.textContent = `${list.length} / ${store.state.requests.length}`;
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">No requests match this filter.</div>`;
      return;
    }

    list.forEach(request => {
      const statusStyle = this.coordinationStatusStyle(request.status);
      const card = document.createElement('div');
      card.className = `coord-card coord-request-card ${['insufficient', 'unmatched'].includes(request.status) ? 'coord-card-unavailable' : ''}`;

      const assigned = request.matchedResource
        ? `<div class="coord-assigned"><span>Assigned resource</span><strong>${this.escapeHtml(request.matchedResource)}</strong></div>`
        : '';
      const shortfall = request.shortfall > 0
        ? `<div class="coord-alert">Shortfall: ${this.escapeHtml(request.shortfall)} ${this.escapeHtml(request.unit)} below requested quantity.</div>`
        : '';
      const routeInfo = request.matchRoute
        ? `<div class="coord-note"><strong>Route:</strong> ${this.escapeHtml(request.matchRoute.distanceKm)} km / ${this.escapeHtml(request.matchRoute.etaMin)} min / ${this.escapeHtml(request.matchRoute.hazardSegmentsUsed)} hazard / ${this.escapeHtml(request.matchRoute.closedRoadsExcluded)} closure avoided</div>`
        : '';

      card.innerHTML = `
        <div class="coord-card-head">
          <div>
            <span class="coord-type-tag">${this.escapeHtml(this.formatCategory(request.category || 'logistics'))}</span>
            <h4 class="coord-card-title">${this.escapeHtml(request.id)} &bull; ${this.escapeHtml(request.quantity)} ${this.escapeHtml(request.unit)}</h4>
          </div>
          <span class="coord-status-tag" style="color:${statusStyle.color}; border-color:${statusStyle.color}; background:${statusStyle.color}1a;">${statusStyle.label}</span>
        </div>
        <div class="coord-meta-row">
          <span>${this.escapeHtml(request.requester)}</span>
          <span>${this.escapeHtml(request.urgency.toUpperCase())}</span>
        </div>
        <div class="coord-note">
          <strong>Location:</strong> ${this.escapeHtml(request.location)}<br>
          <strong>Requested:</strong> ${this.escapeHtml(request.requiredResource)}<br>
          <strong>Status note:</strong> ${this.escapeHtml(request.matchNote || 'Awaiting evaluation against declared resources.')}
        </div>
        ${routeInfo}
        ${assigned}
        ${shortfall}
        <div class="coord-footer-row">
          <span>Logged ${this.escapeHtml(request.timestamp)}</span>
          <div style="display:flex; gap:4px;">
            ${['pending', 'insufficient', 'unmatched'].includes(request.status) ? `<button class="btn-action btn-approve" data-coord-match="${this.escapeHtml(request.id)}" ${store.canEdit() ? '' : 'disabled'} style="padding:3px 8px; font-size:10px;">Match resource</button>` : ''}
            ${request.status === 'matched' ? `<button class="btn-action btn-approve" data-coord-dispatch="${this.escapeHtml(request.id)}" ${store.canEdit() ? '' : 'disabled'} style="padding:3px 8px; font-size:10px;">Dispatch</button>` : ''}
            ${['matched', 'dispatched'].includes(request.status) && request.matchedResourceId ? `<button class="btn-action btn-dismiss" data-coord-release="${this.escapeHtml(request.id)}" ${store.canApprove() ? '' : 'disabled'} style="padding:3px 8px; font-size:10px;">Release</button>` : ''}
          </div>
        </div>
      `;

      const matchBtn = card.querySelector(`[data-coord-match="${request.id}"]`);
      if (matchBtn) {
        matchBtn.onclick = () => {
          if (!store.canEdit()) {
            this.showToast('Auditors are read-only.', 'warning');
            return;
          }
          const result = store.matchRequest(request.id);
          if (result.ok) this.showToast(`${request.id}: ${result.message}`, 'success');
          else if (result.code === 'insufficient_capacity') this.showToast(`${request.id}: ${result.message}`, 'warning');
          else this.showToast(`${request.id}: ${result.message}`, 'danger');
        };
      }

      const dispatchBtn = card.querySelector(`[data-coord-dispatch="${request.id}"]`);
      if (dispatchBtn) {
        dispatchBtn.onclick = async () => {
          if (!store.canEdit()) {
            this.showToast('Auditors are read-only.', 'warning');
            return;
          }
          const confirmed = await this.confirmAction('Dispatch asset', `Dispatch to ${request.location}? Planned ETA: ${request.eta}.`, 'Dispatch');
          if (!confirmed) return;
          const result = store.dispatchRequest(request.id);
          this.showToast(result.message, result.ok ? 'success' : 'warning');
        };
      }

      const releaseBtn = card.querySelector(`[data-coord-release="${request.id}"]`);
      if (releaseBtn) {
        releaseBtn.onclick = async () => {
          if (!store.canApprove()) {
            this.showToast('Commander role required to release an allocation.', 'warning');
            return;
          }
          const confirmed = await this.confirmAction('Release allocation', `Return allocated units from ${request.id} to the available pool?`, 'Release');
          if (!confirmed) return;
          const result = store.releaseRequest(request.id);
          this.showToast(result.message, result.ok ? 'info' : 'warning');
        };
      }

      container.appendChild(card);
    });
  }

  formatCategory(category) {
    const labels = {
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
    return labels[category] || String(category || 'Uncategorised').replace(/_/g, ' ');
  }

  coordinationStatusStyle(status) {
    const styles = {
      pending: { label: 'PENDING', color: '#f59e0b' },
      matched: { label: 'MATCHED', color: '#33bfd6' },
      dispatched: { label: 'DISPATCHED', color: '#1fa9b8' },
      resolved: { label: 'RESOLVED', color: '#33bfd6' },
      insufficient: { label: 'INSUFFICIENT', color: '#ef4444' },
      unmatched: { label: 'UNMATCHED', color: '#ef4444' }
    };
    return styles[status] || { label: String(status || 'UNKNOWN').toUpperCase(), color: '#93aab2' };
  }

  // ==========================================
  // 5. PAGE 4: REPORTS & OPERATIONS
  // ==========================================
  initReportsPage() {
    this.renderDecisions();
    this.renderOutstandingRequests();
    this.renderVerificationPanel();

    const verifyBtn = document.getElementById('btn-verify-audit');
    if (verifyBtn) verifyBtn.onclick = () => this.verifyAuditChain(true);

    const autoMatchBtn = document.getElementById('btn-auto-match-all');
    if (autoMatchBtn) {
      autoMatchBtn.onclick = () => {
        if (!store.canEdit()) {
          this.showToast('Auditors are read-only.', 'warning');
          return;
        }
        const summary = store.autoMatchAllRequests();
        if (summary.matched > 0) {
          this.showToast(`${summary.matched} request(s) matched within declared capacity.`, 'success');
        } else if (summary.attempted > 0) {
          this.showToast(`${summary.insufficient} insufficient, ${summary.unmatched} unmatched. No stock exceeded.`, 'warning');
        } else {
          this.showToast('No requests currently need matching.', 'info');
        }
      };
    }
  }

  renderDecisions() {
    const container = document.getElementById('decisions-list-container');
    if (!container) return;
    container.innerHTML = '';

    const decs = store.state.decisions;
    const pendingCount = decs.filter(d => d.status === 'pending').length;
    const navReportsBadge = document.getElementById('nav-reports-badge');
    if (navReportsBadge) navReportsBadge.textContent = pendingCount;

    decs.forEach(dec => {
      if (dec.status === 'dismissed') return;
      const isApp = dec.status === 'approved';
      const canApprove = store.canApprove();
      const canEdit = store.canEdit();
      const card = document.createElement('div');
      card.className = `decision-card severity-${dec.severity} ${isApp ? 'status-approved' : ''}`;

      card.innerHTML = `
        <div class="dec-header">
          <div>
            <span style="font-size:10px; color:var(--text-muted); font-weight:700;">${this.escapeHtml(dec.id)} &bull; ${this.escapeHtml(dec.category)}</span>
            <h4 class="dec-title">${this.escapeHtml(dec.title)}</h4>
          </div>
          <span class="dec-badge ${isApp ? 'badge-approved' : `badge-${dec.severity}`}">${isApp ? 'APPROVED' : this.escapeHtml(dec.severity.toUpperCase())}</span>
        </div>
        <p class="dec-desc">${this.escapeHtml(dec.description)}</p>
        <div class="dec-impact">Impact analysis: ${this.escapeHtml(dec.impact)}</div>
        <div class="dec-actions">
          ${!isApp ? `
            <button class="btn-action btn-approve" data-dec-approve="${this.escapeHtml(dec.id)}" ${canApprove ? '' : 'disabled title="Commander role required"'}>${this.escapeHtml(dec.suggestedAction)}</button>
            <button class="btn-action btn-map-view" data-dec-view="${this.escapeHtml(dec.id)}">Map view</button>
            <button class="btn-action btn-dismiss" data-dec-dismiss="${this.escapeHtml(dec.id)}" ${canEdit ? '' : 'disabled title="Auditors are read-only"'}>Dismiss</button>
          ` : `
            <span style="font-size:11px; color:#33bfd6; font-weight:700;">Authorized and enforced by PKOB Command</span>
          `}
        </div>
      `;

      const appBtn = card.querySelector(`[data-dec-approve="${dec.id}"]`);
      if (appBtn) {
        appBtn.onclick = async () => {
          if (!store.canApprove()) {
            this.showToast('Switch to Commander to authorize high-impact actions.', 'warning');
            return;
          }
          const approved = await this.confirmAction(
            'Authorize decision',
            `${dec.title}. ${dec.impact}`,
            'Authorize action'
          );
          if (!approved) return;
          const result = store.approveDecision(dec.id);
          if (result && result.ok === false) this.showToast(result.message || 'Action was not authorized.', 'warning');
          else this.showToast(`Action authorized: ${dec.title}`, 'success');
        };
      }
      const viewBtn = card.querySelector(`[data-dec-view="${dec.id}"]`);
      if (viewBtn) {
        viewBtn.onclick = () => {
          this.switchPage('page-map');
          if (this.mapEngine) {
            if (dec.actionType === 'reroute_guthrie') this.mapEngine.focusLocation(3.1755, 101.5020, 15);
            else if (dec.actionType === 'activate_pps_denai') this.mapEngine.focusLocation(3.1620, 101.5150, 16);
            else this.mapEngine.focusLocation(3.1835, 101.5080, 15);
          }
        };
      }
      const disBtn = card.querySelector(`[data-dec-dismiss="${dec.id}"]`);
      if (disBtn) {
        disBtn.onclick = async () => {
          if (!store.canEdit()) {
            this.showToast('Auditors are read-only.', 'warning');
            return;
          }
          const confirmed = await this.confirmAction(
            'Dismiss recommendation',
            `Dismiss ${dec.id}: ${dec.title}? The dismissal will be recorded in the audit chain.`,
            'Record dismissal'
          );
          if (!confirmed) return;
          const result = store.dismissDecision(dec.id);
          this.showToast(result && result.ok === false ? result.message : `Recommendation ${dec.id} dismissed.`, 'info');
        };
      }
      container.appendChild(card);
    });
  }

  renderOutstandingRequests() {
    const container = document.getElementById('requests-list-container');
    if (!container) return;
    container.innerHTML = '';

    const filterBtns = document.querySelectorAll('#request-filter-group .audit-filter-btn');
    filterBtns.forEach(b => {
      b.onclick = () => {
        filterBtns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.currentReqFilter = b.dataset.reqFilter;
        this.renderOutstandingRequests();
      };
    });

    const list = store.state.requests.filter(r => {
      if (this.currentReqFilter === 'all') return true;
      if (this.currentReqFilter === 'attention') return ['pending', 'insufficient', 'unmatched'].includes(r.status);
      if (this.currentReqFilter === 'pending') return r.status === 'pending';
      if (this.currentReqFilter === 'matched') return r.status === 'matched';
      if (this.currentReqFilter === 'dispatched') return r.status === 'dispatched' || r.status === 'resolved';
      return true;
    });

    if (list.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">No requests found in this category.</div>`;
      return;
    }

    list.forEach(req => {
      const card = document.createElement('div');
      card.className = 'request-card';
      const urgColor = req.urgency === 'critical' ? '#ef4444' : (req.urgency === 'high' ? '#b45309' : '#117c96');
      const actionable = ['pending', 'insufficient', 'unmatched'].includes(req.status);
      const isMatched = req.status === 'matched';
      const statusStyle = this.coordinationStatusStyle(req.status);
      let matchClass = actionable ? 'match-pending' : (isMatched ? 'match-assigned' : 'match-dispatched');
      let matchText = '';

      if (req.status === 'insufficient') {
        matchText = `Insufficient capacity: shortfall ${req.shortfall} ${req.unit}. ${req.matchNote || ''}`;
      } else if (req.status === 'unmatched') {
        matchText = `Unmatched: ${req.matchNote || 'No compatible resource.'}`;
      } else if (isMatched) {
        matchText = `Matched: ${req.matchedResource} (ETA: ${req.eta})`;
      } else if (req.status === 'dispatched' || req.status === 'resolved') {
        matchText = `${req.status === 'resolved' ? 'Resolved' : 'Dispatched'}: ${req.matchedResource}`;
      } else {
        matchText = 'Unassigned (awaiting compatible resource)';
      }
      const routeDetail = req.matchRoute
        ? `<div class="req-route-note">${this.escapeHtml(req.matchRoute.distanceKm)} km / ${this.escapeHtml(req.matchRoute.etaMin)} min / ${this.escapeHtml(req.matchRoute.hazardSegmentsUsed)} hazard / ${this.escapeHtml(req.matchRoute.closedRoadsExcluded)} closure avoided</div>`
        : '';
      const contact = req.contactMasked ? `<div class="req-contact">Contact: ${this.escapeHtml(req.contactMasked)}</div>` : '';
      const canEdit = store.canEdit();
      const canApprove = store.canApprove();

      card.innerHTML = `
        <div class="req-header">
          <span class="req-id">${this.escapeHtml(req.id)}</span>
          <span class="req-urgency" style="background:${urgColor}22; color:${urgColor}; border:1px solid ${urgColor};">${this.escapeHtml(req.urgency.toUpperCase())}</span>
        </div>
        <div>
          <div class="req-requester">${this.escapeHtml(req.requester)}</div>
          <div class="req-location">${this.escapeHtml(req.location)} &bull; Logged: ${this.escapeHtml(req.timestamp)}</div>
          ${contact}
        </div>
        <div class="req-need">
          <strong>Request:</strong> ${this.escapeHtml(req.quantity)} ${this.escapeHtml(req.unit)} &bull; ${this.escapeHtml(this.formatCategory(req.category))}<br>
          <small style="color:var(--text-brown);">Required resource: <strong>${this.escapeHtml(req.requiredResource)}</strong></small>
          ${req.source === 'resident-sos' ? `<div class="req-contact">Source: Resident SOS${req.externalId ? ` &bull; ${this.escapeHtml(req.externalId)}` : ''}</div>` : ''}
        </div>
        <div class="req-match-box ${matchClass}">
          <span style="display:flex; justify-content:space-between; gap:8px;">
            <span>${this.escapeHtml(matchText)}</span>
            <strong style="color:${statusStyle.color}; white-space:nowrap;">${statusStyle.label}</strong>
          </span>
          ${routeDetail}
        </div>
        <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:4px;">
          <button class="btn-action btn-map-view" data-req-locate="${this.escapeHtml(req.id)}" style="padding:4px 8px; font-size:10px;">Location</button>
          ${actionable ? `<button class="btn-action btn-approve" data-req-match="${this.escapeHtml(req.id)}" ${canEdit ? '' : 'disabled'} style="padding:4px 8px; font-size:10px;">Match asset</button>` : ''}
          ${isMatched ? `<button class="btn-action btn-approve" data-req-dispatch="${this.escapeHtml(req.id)}" ${canEdit ? '' : 'disabled'} style="padding:4px 8px; font-size:10px; background:#117c96;">Dispatch asset</button>` : ''}
          ${(isMatched || req.status === 'dispatched') && req.matchedResourceId ? `<button class="btn-action btn-dismiss" data-req-release="${this.escapeHtml(req.id)}" ${canApprove ? '' : 'disabled'} style="padding:4px 8px; font-size:10px;">Release</button>` : ''}
        </div>
      `;

      const locBtn = card.querySelector(`[data-req-locate="${req.id}"]`);
      if (locBtn) {
        locBtn.onclick = () => {
          this.switchPage('page-map');
          if (this.mapEngine && req.coordinates) {
            this.mapEngine.focusLocation(req.coordinates[0], req.coordinates[1], 16);
            this.showToast(`Centered map on resident: ${req.id}`, 'info');
          }
        };
      }
      const matBtn = card.querySelector(`[data-req-match="${req.id}"]`);
      if (matBtn) {
        matBtn.onclick = () => {
          if (!store.canEdit()) {
            this.showToast('Auditors are read-only.', 'warning');
            return;
          }
          const result = store.matchRequest(req.id);
          if (result.ok) this.showToast(`${req.id}: ${result.message}`, 'success');
          else if (result.code === 'insufficient_capacity') this.showToast(`${req.id}: ${result.message}`, 'warning');
          else this.showToast(`${req.id}: ${result.message}`, 'danger');
        };
      }
      const disBtn = card.querySelector(`[data-req-dispatch="${req.id}"]`);
      if (disBtn) {
        disBtn.onclick = async () => {
          if (!store.canEdit()) {
            this.showToast('Auditors are read-only.', 'warning');
            return;
          }
          const confirmed = await this.confirmAction(
            'Dispatch asset',
            `Dispatch ${req.matchedResource || 'the allocated asset'} to ${req.location}? Planned ETA: ${req.eta}.`,
            'Dispatch'
          );
          if (!confirmed) return;
          const result = store.dispatchRequest(req.id);
          this.showToast(result.message, result.ok ? 'success' : 'warning');
        };
      }
      const relBtn = card.querySelector(`[data-req-release="${req.id}"]`);
      if (relBtn) {
        relBtn.onclick = async () => {
          if (!store.canApprove()) {
            this.showToast('Commander role required to release an allocation.', 'warning');
            return;
          }
          const confirmed = await this.confirmAction(
            'Release allocation',
            `Return ${req.allocatedQuantity} ${req.unit} from ${req.id} to the available pool?`,
            'Release'
          );
          if (!confirmed) return;
          const result = store.releaseRequest(req.id);
          this.showToast(result.message, result.ok ? 'info' : 'warning');
        };
      }

      container.appendChild(card);
    });
  }

  renderVerificationPanel() {
    this.renderAuditLogs();

    const filterBtns = document.querySelectorAll('#audit-filter-group .audit-filter-btn');
    filterBtns.forEach(b => {
      b.onclick = () => {
        filterBtns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.currentLogFilter = b.dataset.logFilter;
        this.renderAuditLogs();
      };
    });

    const expBtn = document.getElementById('btn-export-audit');
    if (expBtn) {
      expBtn.onclick = () => {
        const jsonStr = store.exportAuditLogJSON();
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NADITOWN_Audit_Report_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast("Official audit report downloaded (JSON).", 'success');
      };
    }
  }

  renderAuditLogs() {
    const container = document.getElementById('audit-log-stream');
    if (!container) return;
    container.innerHTML = '';

    const vrf = store.state.verification;
    const vrfMatch = document.getElementById('vrf-match-ratio');
    const vrfApp = document.getElementById('vrf-approvals-count');
    const vrfHash = document.getElementById('vrf-hash-val');
    const vrfChain = document.getElementById('vrf-chain-status');
    const bCount = document.getElementById('badge-logs-count');

    if (vrfMatch) {
      const tot = store.state.requests.length;
      const mat = store.state.requests.filter(r => ['matched', 'dispatched', 'resolved'].includes(r.status)).length;
      const pct = tot > 0 ? Math.round((mat / tot) * 100) : 0;
      vrfMatch.textContent = `${mat} / ${tot} Requests (${pct}%)`;
    }
    if (vrfApp) vrfApp.textContent = `${vrf.totalApprovalsCount} Authorized`;
    if (vrfChain) {
      vrfChain.textContent = `${vrf.chainValid ? 'SHA-256 valid' : 'CHAIN INVALID'} - ${vrf.chainLength || store.state.eventLogs.length} entries`;
      vrfChain.style.color = vrf.chainValid ? 'var(--green-emerald)' : '#ef4444';
    }
    if (vrfHash) {
      vrfHash.textContent = String(vrf.systemAuditHash || 'GENESIS').slice(0, 24) + '...';
      vrfHash.title = vrf.systemAuditHash || 'GENESIS';
    }
    if (bCount) bCount.textContent = store.state.eventLogs.length;

    const filtered = store.state.eventLogs.filter(l => this.currentLogFilter === 'ALL' || l.category === this.currentLogFilter);
    filtered.forEach(log => {
      const d = document.createElement('div');
      d.className = 'audit-entry';
      d.innerHTML = `
        <div class="audit-entry-top">
          <span class="audit-cat cat-${this.escapeHtml(log.category || 'INFO')}">${this.escapeHtml(log.category || 'EVENT')}</span>
          <span class="audit-time">${this.escapeHtml(log.timestamp)}</span>
        </div>
        <div style="color:#ffffff; line-height:1.3;">${this.escapeHtml(log.message)}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:2px;">
          <span style="font-size:9px; color:var(--text-muted);">Source: ${this.escapeHtml(log.author || 'System')} &bull; ${this.escapeHtml(log.actorRole || 'system')}</span>
          <span class="audit-hash" title="${this.escapeHtml(log.auditHash || '')}">${this.escapeHtml(String(log.auditHash || 'HASH').slice(0, 16))}...</span>
        </div>
      `;
      container.appendChild(d);
    });
  }

  // ==========================================
  // 6. PAGE 5: COMMUNITY REQUESTS
  // ==========================================
  initCommunityPage() {
    this.renderCommunityRequestsBoard();
    this.initCommunityForm();

    const commFilters = document.querySelectorAll('#comm-filter-group .audit-filter-btn');
    commFilters.forEach(b => {
      b.onclick = () => {
        commFilters.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.currentCommFilter = b.dataset.commFilter;
        this.renderCommunityRequestsBoard();
      };
    });
  }

  initCommunityForm() {
    const submitBtn = document.getElementById('comm-submit-btn');
    if (!submitBtn) return;

    submitBtn.onclick = (e) => {
      e.preventDefault();
      const name = document.getElementById('comm-inp-name')?.value.trim();
      const phone = document.getElementById('comm-inp-phone')?.value.trim();
      const loc = document.getElementById('comm-inp-location')?.value.trim();
      const need = document.getElementById('comm-inp-need')?.value.trim();
      const urg = document.getElementById('comm-inp-urgency')?.value;
      const res = document.getElementById('comm-inp-resource')?.value;

      if (!name || !loc || !need) {
        this.showToast('Complete name, location and assistance needed.', 'warning');
        return;
      }

      const newReq = store.addCitizenRequest({
        requester: name,
        contactMasked: store.maskPhone(phone),
        location: loc,
        need: need,
        urgency: urg,
        requiredResource: res,
        source: 'community-web',
        coordinates: store.sectorCoordinates(loc)
      });

      // Clear form
      document.getElementById('comm-inp-name').value = '';
      document.getElementById('comm-inp-phone').value = '';
      document.getElementById('comm-inp-location').value = '';
      document.getElementById('comm-inp-need').value = '';

      this.renderCommunityRequestsBoard();
      this.showToast(`Emergency Request ${newReq.id} recorded into the live response queue!`, 'success');
    };
  }

  renderCommunityRequestsBoard() {
    const container = document.getElementById('community-requests-board');
    if (!container) return;
    container.innerHTML = '';

    const list = store.state.requests.filter(r => {
      if (this.currentCommFilter === 'all') return true;
      if (this.currentCommFilter === 'attention') return ['pending', 'insufficient', 'unmatched'].includes(r.status);
      if (this.currentCommFilter === 'pending') return r.status === 'pending';
      if (this.currentCommFilter === 'matched') return r.status === 'matched';
      if (this.currentCommFilter === 'dispatched') return r.status === 'dispatched' || r.status === 'resolved';
      return true;
    });

    if (list.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:12px;">No community requests found under this status.</div>`;
      return;
    }

    list.forEach(req => {
      const card = document.createElement('div');
      card.className = 'community-request-tile';
      const actionable = ['pending', 'insufficient', 'unmatched'].includes(req.status);
      const statusStyle = this.coordinationStatusStyle(req.status);

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
          <div>
            <span style="font-family:monospace; font-weight:800; color:var(--green-bright); font-size:12px;">${this.escapeHtml(req.id)}</span>
            <span style="font-size:10px; color:var(--text-brown); margin-left:6px;">${this.escapeHtml(req.timestamp)}</span>
          </div>
          <span class="badge-status-hazard" style="color:${statusStyle.color}; border-color:${statusStyle.color};">${statusStyle.label}</span>
        </div>
        <h4 style="font-size:13px; font-weight:700; color:var(--text-white); margin-bottom:4px;">${this.escapeHtml(req.requester)}</h4>
        <div style="font-size:11px; color:var(--text-brown); margin-bottom:6px;">${this.escapeHtml(req.location)}${req.contactMasked ? ` &bull; ${this.escapeHtml(req.contactMasked)}` : ''}</div>
        <div style="background:var(--brown-surface); padding:8px; border-radius:6px; font-size:11px; margin-bottom:8px; border-left:3px solid ${statusStyle.color};">
          <strong>Need:</strong> ${this.escapeHtml(req.need)}<br>
          <small style="color:var(--text-muted);">Category: <strong>${this.escapeHtml(this.formatCategory(req.category))}</strong> &bull; Requested: <strong>${this.escapeHtml(req.quantity)} ${this.escapeHtml(req.unit)}</strong></small><br>
          <small style="color:var(--text-muted);">Required asset: <strong>${this.escapeHtml(req.requiredResource)}</strong></small>
        </div>
        ${req.matchNote ? `<div style="font-size:10px; color:${actionable ? statusStyle.color : 'var(--text-muted)'}; margin-bottom:6px;">${this.escapeHtml(req.matchNote)}</div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px;">
          <span style="color:var(--text-muted);">${req.matchedResource ? `Assigned: <strong style="color:var(--text-white);">${this.escapeHtml(req.matchedResource)}</strong>` : 'Awaiting allocation'}</span>
          ${actionable ? `
            <button class="btn-action btn-approve" data-comm-match="${this.escapeHtml(req.id)}" ${store.canEdit() ? '' : 'disabled'} style="padding:4px 8px; font-size:10px;">
              Match resource
            </button>
          ` : `
            <span style="color:#33bfd6; font-weight:700; font-size:10px;">ETA: ${this.escapeHtml(req.eta)}</span>
          `}
        </div>
      `;

      const matchBtn = card.querySelector(`[data-comm-match="${req.id}"]`);
      if (matchBtn) {
        matchBtn.onclick = () => {
          if (!store.canEdit()) {
            this.showToast('Auditors are read-only.', 'warning');
            return;
          }
          const result = store.matchRequest(req.id);
          if (result.ok) this.showToast(`${req.id}: ${result.message}`, 'success');
          else if (result.code === 'insufficient_capacity') this.showToast(`${req.id}: ${result.message}`, 'warning');
          else this.showToast(`${req.id}: ${result.message}`, 'danger');
        };
      }

      container.appendChild(card);
    });
  }

  // ==========================================
  // 6. REACTIVE STATE SUBSCRIPTIONS
  // ==========================================
  setupSubscriptions() {
    store.subscribe('roads_updated', () => {
      this.updateRoadKPIs();
      this.updateRoutingKPIs();
      this.renderRoadsDetailTable();
      this.renderDecisions();
    });

    store.subscribe('facility_updated', () => {
      this.updateShelterKPIs();
      this.updateCoordinationIndicators();
      this.renderShelterDetailCards();
      this.renderFacilitiesList();
      this.renderCoordinationResources();
    });

    store.subscribe('resource_updated', () => {
      this.updateCoordinationIndicators();
      this.renderCoordinationResources();
    });

    store.subscribe('resources_updated', () => {
      this.updateShelterKPIs();
      this.updateCoordinationIndicators();
      this.renderCoordinationResources();
      this.renderShelterDetailCards();
    });

    store.subscribe('coordination_updated', () => {
      this.updateShelterKPIs();
      this.updateRequestsKPIs();
      this.updateCoordinationIndicators();
      this.renderFacilitiesList();
      this.renderCoordinationResources();
      this.renderRequestsSummaryCard();
      this.renderOutstandingRequests();
      this.renderCommunityRequestsBoard();
      this.renderRouteBenchmarkCard();
    });

    store.subscribe('request_updated', () => {
      this.updateRequestsKPIs();
      this.renderRequestsSummaryCard();
      this.renderOutstandingRequests();
      this.renderCommunityRequestsBoard();
      this.renderAuditLogs();
    });

    store.subscribe('request_added', () => {
      this.updateRequestsKPIs();
      this.renderRequestsSummaryCard();
      this.renderOutstandingRequests();
      this.renderCommunityRequestsBoard();
      this.renderAuditLogs();
    });

    store.subscribe('decision_updated', () => {
      this.renderDecisions();
      this.renderAuditLogs();
    });

    store.subscribe('route_recalculated', () => {
      this.updateRoutingKPIs();
      this.renderRouteBenchmarkCard();
      const preferenceSelect = document.getElementById('route-preference');
      if (preferenceSelect) preferenceSelect.value = store.state.routing.routePreference || 'safest';
      this.renderRoutePlannerResult();
    });

    store.subscribe('log_added', () => {
      this.renderAuditLogs();
      this.updateRoutingKPIs();
    });

    store.subscribe('verification_updated', () => {
      this.renderAuditLogs();
    });
  }

  // ==========================================
  // 7. TOAST NOTIFICATIONS
  // ==========================================
  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value == null ? '' : value);
    return div.innerHTML;
  }

  showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast';
    if (type === 'success') t.style.borderLeftColor = 'var(--green-bright)';
    else if (type === 'warning') t.style.borderLeftColor = 'var(--brown-amber)';
    else if (type === 'danger') t.style.borderLeftColor = 'var(--accent-red)';
    else t.style.borderLeftColor = 'var(--green-primary)';
    const span = document.createElement('span');
    span.textContent = String(msg);
    t.appendChild(span);
    c.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(50px)';
      setTimeout(() => t.remove(), 400);
    }, 3500);
  }
}
