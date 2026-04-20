const state = {
  network: null,
  scenarios: [],
  summary: null,
  status: null,
  route: null,
  selectedSegmentId: null,
  pendingRouteStartNode: null,
  refreshTimer: null,
};

const elements = {
  startButton: document.getElementById("start-simulation"),
  stopButton: document.getElementById("stop-simulation"),
  applyScenarioButton: document.getElementById("apply-scenario"),
  clearSegmentSelection: document.getElementById("clear-segment-selection"),
  clearRouteSelection: document.getElementById("clear-route-selection"),
  statusDot: document.getElementById("status-dot"),
  statusLabel: document.getElementById("status-label"),
  simulationTime: document.getElementById("simulation-time"),
  scenarioSelect: document.getElementById("scenario-select"),
  activeScenarioName: document.getElementById("active-scenario-name"),
  scenarioDescription: document.getElementById("scenario-description"),
  selectedSegmentState: document.getElementById("selected-segment-state"),
  routeStartState: document.getElementById("route-start-state"),
  trackedSegments: document.getElementById("tracked-segments"),
  activeIncidents: document.getElementById("active-incidents"),
  averageSpeed: document.getElementById("average-speed"),
  processedReadings: document.getElementById("processed-readings"),
  routeForm: document.getElementById("route-form"),
  routeFrom: document.getElementById("route-from"),
  routeTo: document.getElementById("route-to"),
  routeResult: document.getElementById("route-result"),
  bottleneckList: document.getElementById("bottleneck-list"),
  segmentForm: document.getElementById("segment-form"),
  segmentId: document.getElementById("segment-id"),
  segmentWindow: document.getElementById("segment-window"),
  segmentResult: document.getElementById("segment-result"),
  networkMap: document.getElementById("network-map"),
  bottleneckTemplate: document.getElementById("bottleneck-template"),
};

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  await initialize();
});

function bindEvents() {
  elements.startButton.addEventListener("click", async () => {
    await postJson("/api/simulation/start");
    await refreshAll();
  });

  elements.stopButton.addEventListener("click", async () => {
    await postJson("/api/simulation/stop");
    await refreshAll();
  });

  elements.applyScenarioButton.addEventListener("click", async () => {
    await applyScenario();
  });

  elements.clearSegmentSelection.addEventListener("click", () => {
    clearSegmentSelection();
  });

  elements.clearRouteSelection.addEventListener("click", () => {
    clearRouteSelection();
  });

  elements.routeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadRoute();
  });

  elements.segmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadSegmentStats();
  });

  elements.networkMap.addEventListener("click", async (event) => {
    await handleMapClick(event);
  });
}

async function initialize() {
  try {
    await Promise.all([loadNetwork(), loadScenarios()]);
    await refreshAll();
    state.refreshTimer = window.setInterval(refreshAll, 4000);
  } catch (error) {
    renderError(elements.routeResult, error.message);
    renderError(elements.segmentResult, error.message);
    elements.bottleneckList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function refreshAll() {
  const [summary, status] = await Promise.all([
    fetchJson("/api/analysis/summary"),
    fetchJson("/api/simulation/status"),
  ]);

  state.summary = summary;
  state.status = status;

  renderStatus();
  renderScenarioState();
  renderSelectionState();
  renderSummary();
  renderBottlenecks(summary.topBottlenecks || []);
  renderNetworkMap();

  if (state.route) {
    renderRoute(state.route);
  }
}

async function loadNetwork() {
  const network = await fetchJson("/api/network");
  state.network = network;

  const intersectionOptions = (network.intersections || [])
    .map(
      (intersection) =>
        `<option value="${escapeHtml(intersection.id)}">${escapeHtml(intersection.name)}</option>`,
    )
    .join("");
  elements.routeFrom.innerHTML = intersectionOptions;
  elements.routeTo.innerHTML = intersectionOptions;

  if (network.intersections.length > 1) {
    elements.routeFrom.value = network.intersections[0].id;
    elements.routeTo.value = network.intersections[1].id;
  }

  const segmentOptions = (network.segments || [])
    .map(
      (segment) =>
        `<option value="${escapeHtml(segment.id)}">${escapeHtml(segmentLabel(segment.id))}</option>`,
    )
    .join("");
  elements.segmentId.innerHTML = segmentOptions;
}

async function loadScenarios() {
  const scenarios = await fetchJson("/api/simulation/scenarios");
  state.scenarios = scenarios;
  elements.scenarioSelect.innerHTML = scenarios
    .map(
      (scenario) =>
        `<option value="${escapeHtml(scenario.id)}">${escapeHtml(scenario.name)}</option>`,
    )
    .join("");
  renderScenarioState();
}

async function applyScenario() {
  const scenarioId = elements.scenarioSelect.value;
  if (!scenarioId) {
    return;
  }
  state.status = await postJson(`/api/simulation/scenarios/${encodeURIComponent(scenarioId)}/activate`);
  await loadScenarios();
  await refreshAll();
}

async function loadRoute() {
  const fromNode = elements.routeFrom.value;
  const toNode = elements.routeTo.value;

  if (!fromNode || !toNode || fromNode === toNode) {
    renderError(elements.routeResult, "Choose two different cities.");
    return;
  }

  const route = await fetchJson(
    `/api/routes/fastest?fromNode=${encodeURIComponent(fromNode)}&toNode=${encodeURIComponent(toNode)}`,
  );
  state.pendingRouteStartNode = null;
  state.route = route;
  renderRoute(route);
  renderNetworkMap();
}

async function loadSegmentStats() {
  const segmentId = elements.segmentId.value;
  const windowMinutes = Number(elements.segmentWindow.value);
  const anchor = state.status?.simulationTime || state.summary?.simulationTime;

  if (!segmentId) {
    renderError(elements.segmentResult, "Choose a segment first.");
    return;
  }

  state.selectedSegmentId = segmentId;
  renderNetworkMap();

  if (!anchor) {
    renderError(
      elements.segmentResult,
      "No simulation time available yet. Start the simulation and try again.",
    );
    return;
  }

  const to = new Date(anchor);
  const from = new Date(to.getTime() - windowMinutes * 60_000);

  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const [stats, measurements] = await Promise.all([
    fetchJson(
      `/api/segments/${encodeURIComponent(segmentId)}/stats?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
    ),
    fetchJson(
      `/api/segments/${encodeURIComponent(segmentId)}/measurements?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
    ),
  ]);
  renderSegmentStats(stats, measurements, windowMinutes);
}

async function handleMapClick(event) {
  const roadGroup = event.target.closest?.(".map-road-group[data-segment-id]");
  if (roadGroup) {
    const segmentId = roadGroup.dataset.segmentId;
    if (segmentId) {
      elements.segmentId.value = segmentId;
      state.selectedSegmentId = segmentId;
      renderNetworkMap();
      await loadSegmentStats();
    }
    return;
  }

  const locationGroup = event.target.closest?.(".map-location-group[data-node-id]");
  if (locationGroup) {
    const nodeId = locationGroup.dataset.nodeId;
    if (nodeId) {
      await handleMapNodeSelection(nodeId);
    }
  }
}

async function handleMapNodeSelection(nodeId) {
  const currentStart = state.pendingRouteStartNode;
  if (!currentStart || currentStart === nodeId) {
    state.pendingRouteStartNode = nodeId;
    state.route = null;
    elements.routeFrom.value = nodeId;
    renderRouteSelectionHint(nodeId);
    renderNetworkMap();
    return;
  }

  elements.routeFrom.value = currentStart;
  elements.routeTo.value = nodeId;
  await loadRoute();
}

function renderRouteSelectionHint(nodeId) {
  elements.routeResult.classList.remove("empty-state");
  elements.routeResult.innerHTML = `
    <div class="route-topline">
      <strong>Start city selected: ${escapeHtml(intersectionName(nodeId))}</strong>
      <span class="metric-chip">Choose destination on map</span>
    </div>
    <div class="route-path">
      <div><strong>Start city:</strong> ${escapeHtml(intersectionName(nodeId))}</div>
      <div><strong>Next step:</strong> click another city to calculate a route.</div>
    </div>
  `;
  renderSelectionState();
}

function renderStatus() {
  const running = Boolean(state.status?.running);
  elements.statusDot.className = `status-dot ${running ? "running" : "stopped"}`;
  elements.statusLabel.textContent = running ? "Simulation running" : "Simulation stopped";
  elements.simulationTime.textContent = `Simulation time: ${formatDateTime(state.status?.simulationTime)}`;
  elements.startButton.disabled = running;
  elements.stopButton.disabled = !running;
}

function renderScenarioState() {
  const activeScenario =
      state.scenarios.find((scenario) => scenario.id === state.status?.activeScenarioId)
      || state.scenarios.find((scenario) => scenario.active)
      || null;
  elements.activeScenarioName.textContent = activeScenario?.name || state.status?.activeScenarioName || "None";
  elements.scenarioDescription.textContent =
    activeScenario?.description || "Select a scenario profile to change future simulated traffic behavior.";
  if (activeScenario?.id) {
    elements.scenarioSelect.value = activeScenario.id;
  }
  elements.applyScenarioButton.disabled = !elements.scenarioSelect.value;
}

function renderSelectionState() {
  elements.selectedSegmentState.textContent = state.selectedSegmentId
    ? segmentLabel(state.selectedSegmentId)
    : "None";
  elements.routeStartState.textContent = state.pendingRouteStartNode
    ? intersectionName(state.pendingRouteStartNode)
    : "None";
  elements.clearSegmentSelection.disabled = !state.selectedSegmentId;
  elements.clearRouteSelection.disabled = !state.pendingRouteStartNode && !state.route;
}

function renderSummary() {
  const summary = state.summary || {};
  elements.trackedSegments.textContent = formatInteger(summary.trackedSegments);
  elements.activeIncidents.textContent = formatInteger(summary.activeIncidents);
  elements.averageSpeed.textContent = `${formatNumber(summary.networkAverageSpeedKph)} km/h`;
  elements.processedReadings.textContent = formatInteger(state.status?.totalProcessedReadings);
}

function renderBottlenecks(bottlenecks) {
  if (!bottlenecks.length) {
    elements.bottleneckList.innerHTML =
      '<div class="empty-state">No active bottlenecks right now.</div>';
    return;
  }

  elements.bottleneckList.innerHTML = "";
  for (const bottleneck of bottlenecks) {
    const fragment = elements.bottleneckTemplate.content.cloneNode(true);
    fragment.querySelector(".alert-segment").textContent = segmentLabel(bottleneck.segmentId);
    fragment.querySelector(".alert-badge").textContent = bottleneck.incident
      ? "Incident-backed"
      : "Statistical spike";
    fragment.querySelector(".alert-reason").textContent = bottleneck.reason;
    fragment.querySelector(".alert-metrics").innerHTML = `
      <div class="metric-chip-row">
        <span class="metric-chip">Score ${formatNumber(bottleneck.congestionScore)}</span>
        <span class="metric-chip">Q3 ${formatNumber(bottleneck.upperQuartile)}</span>
        <span class="metric-chip">Threshold ${formatNumber(bottleneck.threshold)}</span>
      </div>
    `;
    elements.bottleneckList.appendChild(fragment);
  }
}

function renderRoute(route) {
  if (!route?.nodePath?.length) {
    renderError(elements.routeResult, "No route available for the chosen city pair.");
    return;
  }

  const routeCities = route.nodePath.map((nodeId) => intersectionName(nodeId));
  const routeSegments = route.segmentPath.map((segmentId) => segmentLabel(segmentId));

  elements.routeResult.classList.remove("empty-state");
  elements.routeResult.innerHTML = `
    <div class="route-topline">
      <strong>${escapeHtml(routeCities.join(" → "))}</strong>
      <span class="metric-chip">Congestion ${formatNumber(route.congestionScore)}</span>
    </div>
    <div class="metric-chip-row">
      <span class="metric-chip">Distance ${formatNumber(route.totalDistanceKm)} km</span>
      <span class="metric-chip">ETA ${formatNumber(route.estimatedTravelTimeMinutes)} min</span>
    </div>
    <div class="route-path">
      <div><strong>Cities:</strong> ${escapeHtml(routeCities.join(" → "))}</div>
      <div><strong>Corridors:</strong> ${escapeHtml(routeSegments.join(", "))}</div>
    </div>
  `;
  renderSelectionState();
}

function clearSegmentSelection() {
  state.selectedSegmentId = null;
  elements.segmentId.selectedIndex = 0;
  elements.segmentResult.classList.add("empty-state");
  elements.segmentResult.innerHTML =
    "Start the simulation and load a segment window to inspect its aggregated statistics.";
  renderSelectionState();
  renderNetworkMap();
}

function clearRouteSelection() {
  state.pendingRouteStartNode = null;
  state.route = null;
  if (state.network?.intersections?.length > 1) {
    elements.routeFrom.value = state.network.intersections[0].id;
    elements.routeTo.value = state.network.intersections[1].id;
  }
  elements.routeResult.classList.add("empty-state");
  elements.routeResult.innerHTML =
    "Choose start and end cities to calculate the current fastest route.";
  renderSelectionState();
  renderNetworkMap();
}

function renderSegmentStats(stats, measurements, windowMinutes) {
  elements.segmentResult.classList.remove("empty-state");
  elements.segmentResult.innerHTML = `
    <div class="segment-topline">
      <strong>${escapeHtml(segmentLabel(stats.segmentId))} over last ${windowMinutes} minutes</strong>
      <span class="metric-chip">${formatInteger(stats.sampleCount)} samples</span>
    </div>
    <div class="segment-grid">
      <div class="stat-box">
        <span>Average speed</span>
        <strong>${formatNumber(stats.averageSpeedKph)} km/h</strong>
      </div>
      <div class="stat-box">
        <span>Travel time</span>
        <strong>${formatNumber(stats.averageTravelTimeMinutes)} min</strong>
      </div>
      <div class="stat-box">
        <span>Minimum speed</span>
        <strong>${formatNumber(stats.minSpeedKph)} km/h</strong>
      </div>
      <div class="stat-box">
        <span>Maximum speed</span>
        <strong>${formatNumber(stats.maxSpeedKph)} km/h</strong>
      </div>
      <div class="stat-box">
        <span>Total vehicles</span>
        <strong>${formatInteger(stats.totalVehicles)}</strong>
      </div>
      <div class="stat-box">
        <span>Window</span>
        <strong>${formatDateTime(stats.from)} to ${formatDateTime(stats.to)}</strong>
      </div>
    </div>
    ${renderMeasurementChart(measurements)}
  `;
}

function renderMeasurementChart(measurements) {
  if (!measurements?.length) {
    return '<div class="empty-state">No minute-level measurements are available for this window yet.</div>';
  }

  const width = 820;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 34, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxSpeed = Math.max(...measurements.map((point) => point.averageSpeedKph), 1);
  const maxVehicles = Math.max(...measurements.map((point) => point.totalVehicles), 1);

  const speedPoints = measurements.map((point, index) => {
    const x = padding.left + (index / Math.max(measurements.length - 1, 1)) * innerWidth;
    const y = padding.top + (1 - point.averageSpeedKph / maxSpeed) * innerHeight;
    return { x, y, label: shortTime(point.timestamp), value: point.averageSpeedKph };
  });

  const vehiclePoints = measurements.map((point, index) => {
    const x = padding.left + (index / Math.max(measurements.length - 1, 1)) * innerWidth;
    const y = padding.top + (1 - point.totalVehicles / maxVehicles) * innerHeight;
    return { x, y, label: shortTime(point.timestamp), value: point.totalVehicles };
  });

  const speedPath = buildLinePath(speedPoints);
  const vehiclePath = buildLinePath(vehiclePoints);
  const axisLabels = buildAxisLabels(measurements, padding, innerWidth, height);

  return `
    <section class="chart-panel">
      <div class="chart-header">
        <strong>Minute-level measurement graph</strong>
        <div class="chart-legend">
          <span><i class="legend-line chart-speed"></i> Average speed</span>
          <span><i class="legend-line chart-vehicles"></i> Vehicles</span>
        </div>
      </div>
      <svg class="measurement-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Segment measurement graph">
        <g class="chart-grid">
          <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + innerHeight}" />
          <line x1="${padding.left}" y1="${padding.top + innerHeight}" x2="${padding.left + innerWidth}" y2="${padding.top + innerHeight}" />
          <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left + innerWidth}" y2="${padding.top}" />
        </g>
        <path class="chart-line speed" d="${speedPath}"></path>
        <path class="chart-line vehicles" d="${vehiclePath}"></path>
        ${speedPoints
          .map(
            (point) =>
              `<circle class="chart-point speed" cx="${point.x}" cy="${point.y}" r="3.5"><title>${escapeHtml(point.label)} · ${formatNumber(point.value)} km/h</title></circle>`,
          )
          .join("")}
        ${vehiclePoints
          .map(
            (point) =>
              `<circle class="chart-point vehicles" cx="${point.x}" cy="${point.y}" r="3.5"><title>${escapeHtml(point.label)} · ${formatInteger(point.value)} vehicles</title></circle>`,
          )
          .join("")}
        <text class="chart-axis-label" x="${padding.left}" y="14">Speed max ${formatNumber(maxSpeed)} km/h</text>
        <text class="chart-axis-label" x="${width - padding.right - 160}" y="14">Vehicles max ${formatInteger(maxVehicles)}</text>
        ${axisLabels}
      </svg>
    </section>
  `;
}

function buildLinePath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function buildAxisLabels(measurements, padding, innerWidth, height) {
  const labelIndexes = new Set([
    0,
    Math.floor((measurements.length - 1) / 2),
    Math.max(measurements.length - 1, 0),
  ]);

  return Array.from(labelIndexes)
    .sort((left, right) => left - right)
    .map((index) => {
      const x = padding.left + (index / Math.max(measurements.length - 1, 1)) * innerWidth;
      return `<text class="chart-axis-label" x="${x}" y="${height - 8}" text-anchor="middle">${escapeHtml(shortTime(measurements[index].timestamp))}</text>`;
    })
    .join("");
}

function renderNetworkMap() {
  if (!state.network?.intersections?.length) {
    elements.networkMap.innerHTML = "";
    return;
  }

  const layout = buildLayout(state.network.intersections);
  const bottleneckIds = new Set((state.summary?.topBottlenecks || []).map((entry) => entry.segmentId));
  const routeSegmentIds = new Set(state.route?.segmentPath || []);
  const selectedSegmentId = state.selectedSegmentId;

  const roads = (state.network.segments || [])
    .map((segment) => {
      const geometry = buildRoadGeometry(segment, layout);
      const highlighted =
        bottleneckIds.has(segment.id)
        || routeSegmentIds.has(segment.id)
        || selectedSegmentId === segment.id;
      return `
        <g class="map-road-group ${selectedSegmentId === segment.id ? "selected" : ""}" data-segment-id="${escapeHtml(segment.id)}" role="button" tabindex="0">
          <path class="map-road-casing" d="${geometry.path}"></path>
          <path class="map-road-fill" d="${geometry.path}"></path>
          <path class="map-road-center" d="${geometry.path}"></path>
          ${bottleneckIds.has(segment.id) ? `<path class="map-road-alert" d="${geometry.path}"></path>` : ""}
          ${routeSegmentIds.has(segment.id) ? `<path class="map-road-route" d="${geometry.path}"></path>` : ""}
          ${selectedSegmentId === segment.id ? `<path class="map-road-selected" d="${geometry.path}"></path>` : ""}
          ${highlighted ? `<text class="map-road-label" x="${geometry.labelX}" y="${geometry.labelY}">${escapeHtml(corridorShortLabel(segment.id))}</text>` : ""}
          <title>${escapeHtml(segmentLabel(segment.id))}</title>
        </g>
      `;
    })
    .join("");

  const routeNodes = new Set(state.route?.nodePath || []);
  const nodes = state.network.intersections
    .map((intersection) => {
      const point = layout[intersection.id];
      const routeClass = routeNodes.has(intersection.id) ? "route" : "";
      const pendingClass = state.pendingRouteStartNode === intersection.id ? "pending" : "";
      const labelWidth = Math.max(92, intersection.name.length * 8.5);
      return `
        <g class="map-location-group ${routeClass} ${pendingClass}" data-node-id="${escapeHtml(intersection.id)}" role="button" tabindex="0">
          <circle class="map-location-halo ${routeClass} ${pendingClass}" cx="${point.x}" cy="${point.y}" r="17"></circle>
          <circle class="map-location-pin ${routeClass} ${pendingClass}" cx="${point.x}" cy="${point.y}" r="8"></circle>
          <rect class="map-chip ${routeClass} ${pendingClass}" x="${point.x - labelWidth / 2}" y="${point.y + 18}" width="${labelWidth}" height="24" rx="12"></rect>
          <text class="map-chip-label ${routeClass} ${pendingClass}" x="${point.x}" y="${point.y - 18}">${escapeHtml(intersection.id)}</text>
          <text class="map-chip-name" x="${point.x}" y="${point.y + 34}">${escapeHtml(intersection.name)}</text>
          <title>${escapeHtml(intersection.id)} · ${escapeHtml(intersection.name)}</title>
        </g>
      `;
    })
    .join("");

  elements.networkMap.innerHTML = `
    ${renderMapBackdrop()}
    ${roads}
    ${nodes}
    ${renderMapHud()}
  `;
}

function buildLayout(intersections) {
  const preferred = {
    KURESSAARE: { x: 108, y: 304 },
    HAAPSALU: { x: 190, y: 164 },
    TALLINN: { x: 264, y: 106 },
    PARNU: { x: 260, y: 344 },
    PAIDE: { x: 370, y: 224 },
    VILJANDI: { x: 410, y: 316 },
    TORVA: { x: 474, y: 396 },
    TARTU: { x: 590, y: 318 },
    RAKVERE: { x: 482, y: 126 },
    NARVA: { x: 744, y: 154 },
  };

  const fallbackCenterX = 450;
  const fallbackCenterY = 250;
  const radius = 180;
  const layout = {};

  intersections.forEach((intersection, index) => {
    if (preferred[intersection.id]) {
      layout[intersection.id] = preferred[intersection.id];
      return;
    }
    const angle = (Math.PI * 2 * index) / intersections.length - Math.PI / 2;
    layout[intersection.id] = {
      x: fallbackCenterX + Math.cos(angle) * radius,
      y: fallbackCenterY + Math.sin(angle) * radius,
    };
  });

  return layout;
}

function renderMapBackdrop() {
  return `
    <rect class="map-surface" x="0" y="0" width="900" height="520" rx="28"></rect>
    <g class="map-grid">
      <path class="map-gridline" d="M 0 100 H 900"></path>
      <path class="map-gridline" d="M 0 200 H 900"></path>
      <path class="map-gridline" d="M 0 300 H 900"></path>
      <path class="map-gridline" d="M 0 400 H 900"></path>
      <path class="map-gridline" d="M 0 500 H 900"></path>
      <path class="map-gridline" d="M 100 0 V 520"></path>
      <path class="map-gridline" d="M 200 0 V 520"></path>
      <path class="map-gridline" d="M 300 0 V 520"></path>
      <path class="map-gridline" d="M 400 0 V 520"></path>
      <path class="map-gridline" d="M 500 0 V 520"></path>
      <path class="map-gridline" d="M 600 0 V 520"></path>
      <path class="map-gridline" d="M 700 0 V 520"></path>
      <path class="map-gridline" d="M 800 0 V 520"></path>
    </g>
    <g class="map-geography">
      <path class="map-water" d="M 0 0 H 900 V 520 H 0 Z"></path>
      <path class="map-country" d="M 184 120 C 234 86, 316 72, 408 82 C 476 90, 538 108, 604 134 C 668 158, 728 154, 780 186 C 816 208, 838 246, 830 284 C 820 330, 778 360, 714 382 C 648 404, 590 436, 518 438 C 430 440, 344 420, 270 400 C 214 386, 168 346, 156 292 C 142 230, 148 156, 184 120 Z"></path>
      <path class="map-island" d="M 80 258 C 112 230, 170 230, 204 256 C 232 278, 226 320, 190 344 C 144 374, 86 364, 62 326 C 44 298, 50 278, 80 258 Z"></path>
      <path class="map-island" d="M 156 170 C 180 152, 218 152, 238 172 C 254 188, 252 214, 230 226 C 202 242, 164 236, 148 214 C 138 200, 140 182, 156 170 Z"></path>
      <path class="map-lake" d="M 654 224 C 690 206, 730 212, 746 236 C 758 254, 754 286, 726 300 C 694 316, 652 306, 638 280 C 628 262, 630 236, 654 224 Z"></path>
      <path class="map-lake" d="M 522 318 C 544 304, 572 306, 590 324 C 602 338, 600 360, 582 372 C 558 388, 528 384, 512 366 C 498 350, 502 330, 522 318 Z"></path>
      <path class="map-county county-west" d="M 190 126 C 234 102, 286 94, 320 108 C 334 126, 332 158, 308 182 C 286 202, 242 212, 206 206 C 186 184, 180 152, 190 126 Z"></path>
      <path class="map-county county-harju" d="M 300 98 C 352 88, 406 92, 446 110 C 462 136, 450 178, 416 196 C 370 206, 320 198, 286 176 C 274 148, 274 118, 300 98 Z"></path>
      <path class="map-county county-north" d="M 444 108 C 520 106, 598 118, 656 144 C 664 174, 650 198, 612 214 C 556 218, 504 206, 462 188 C 440 164, 432 136, 444 108 Z"></path>
      <path class="map-county county-east" d="M 652 146 C 708 150, 768 164, 800 196 C 804 228, 794 256, 760 270 C 716 274, 678 260, 648 234 C 636 204, 636 176, 652 146 Z"></path>
      <path class="map-county county-central" d="M 270 212 C 336 196, 404 202, 458 224 C 476 250, 470 290, 440 312 C 380 324, 322 320, 278 300 C 252 270, 248 238, 270 212 Z"></path>
      <path class="map-county county-southwest" d="M 194 292 C 258 286, 326 294, 382 316 C 398 344, 392 382, 356 402 C 290 408, 234 394, 190 364 C 176 336, 178 310, 194 292 Z"></path>
      <path class="map-county county-south" d="M 382 310 C 446 294, 520 298, 580 320 C 602 348, 600 390, 564 412 C 502 424, 438 420, 392 400 C 370 374, 366 338, 382 310 Z"></path>
      <path class="map-county county-southeast" d="M 582 320 C 642 302, 716 304, 776 326 C 786 356, 778 392, 744 412 C 680 428, 628 422, 580 400 C 562 372, 562 344, 582 320 Z"></path>
      <path class="map-boundary" d="M 286 176 C 316 202, 370 206, 416 196"></path>
      <path class="map-boundary" d="M 462 188 C 504 206, 556 218, 612 214"></path>
      <path class="map-boundary" d="M 278 300 C 320 320, 380 324, 440 312"></path>
      <path class="map-boundary" d="M 392 400 C 438 420, 502 424, 564 412"></path>
      <path class="map-boundary" d="M 648 234 C 678 260, 716 274, 760 270"></path>
      <path class="map-boundary" d="M 356 402 C 392 400, 438 420, 564 412"></path>
      <text class="map-district-label water" x="404" y="48">Gulf of Finland</text>
      <text class="map-district-label water" x="106" y="240">Väinameri</text>
      <text class="map-district-label" x="348" y="144">Harju</text>
      <text class="map-district-label" x="234" y="166">Lääne</text>
      <text class="map-district-label" x="546" y="164">Lääne-Viru</text>
      <text class="map-district-label" x="724" y="210">Ida-Viru</text>
      <text class="map-district-label" x="352" y="256">Järva</text>
      <text class="map-district-label" x="252" y="346">Pärnu</text>
      <text class="map-district-label" x="454" y="356">Viljandi</text>
      <text class="map-district-label" x="670" y="362">Tartu</text>
      <text class="map-district-label" x="116" y="304">Saaremaa</text>
    </g>
  `;
}

function renderMapHud() {
  return `
    <g class="map-hud">
      <rect class="map-hud-card" x="650" y="20" width="214" height="74" rx="16"></rect>
      <text class="map-hud-kicker" x="672" y="46">EESTI TEEVÕRK</text>
      <text class="map-hud-title" x="672" y="68">Intercity corridor overlay</text>
      <text class="map-hud-subtitle" x="672" y="86">Tallinn, Tartu, Narva, Pärnu and beyond</text>
    </g>
  `;
}

function buildRoadGeometry(segment, layout) {
  const from = layout[segment.fromNode];
  const to = layout[segment.toNode];
  const profile = roadProfile(segment.id);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const tangentX = dx / distance;
  const tangentY = dy / distance;
  const startX = from.x + normalX * profile.shift;
  const startY = from.y + normalY * profile.shift;
  const endX = to.x + normalX * profile.shift;
  const endY = to.y + normalY * profile.shift;
  const midpointX = (startX + endX) / 2;
  const midpointY = (startY + endY) / 2;
  const controlX = midpointX + normalX * profile.bend + tangentX * profile.drift;
  const controlY = midpointY + normalY * profile.bend + tangentY * profile.drift;
  const labelPoint = quadraticPoint(startX, startY, controlX, controlY, endX, endY, 0.5);

  return {
    path: `M ${startX.toFixed(2)} ${startY.toFixed(2)} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`,
    labelX: (labelPoint.x + normalX * 14).toFixed(2),
    labelY: (labelPoint.y + normalY * 14).toFixed(2),
  };
}

function quadraticPoint(x1, y1, cx, cy, x2, y2, t) {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * x1 + 2 * inverse * t * cx + t * t * x2,
    y: inverse * inverse * y1 + 2 * inverse * t * cy + t * t * y2,
  };
}

function roadProfile(segmentId) {
  const profiles = {
    "TLL-HPS": { shift: -7, bend: -18, drift: -2 },
    "HPS-TLL": { shift: 7, bend: 18, drift: 2 },
    "TLL-RKV": { shift: -9, bend: -14, drift: 4 },
    "RKV-TLL": { shift: 9, bend: 14, drift: -4 },
    "TLL-NRV": { shift: -11, bend: -24, drift: 10 },
    "NRV-TLL": { shift: 11, bend: 24, drift: -10 },
    "TLL-PDE": { shift: -8, bend: 10, drift: 4 },
    "PDE-TLL": { shift: 8, bend: -10, drift: -4 },
    "TLL-PRN": { shift: -10, bend: 28, drift: -6 },
    "PRN-TLL": { shift: 10, bend: -28, drift: 6 },
    "TLL-VLJ": { shift: -8, bend: 18, drift: 2 },
    "VLJ-TLL": { shift: 8, bend: -18, drift: -2 },
    "TLL-TTU": { shift: -12, bend: 10, drift: 8 },
    "TTU-TLL": { shift: 12, bend: -10, drift: -8 },
    "TLL-TRV": { shift: -8, bend: 12, drift: 10 },
    "TRV-TLL": { shift: 8, bend: -12, drift: -10 },
    "HPS-PRN": { shift: -7, bend: -10, drift: 0 },
    "PRN-HPS": { shift: 7, bend: 10, drift: 0 },
    "HPS-KRS": { shift: -9, bend: 22, drift: -4 },
    "KRS-HPS": { shift: 9, bend: -22, drift: 4 },
    "RKV-NRV": { shift: -8, bend: -8, drift: 4 },
    "NRV-RKV": { shift: 8, bend: 8, drift: -4 },
    "RKV-TTU": { shift: -7, bend: 18, drift: 4 },
    "TTU-RKV": { shift: 7, bend: -18, drift: -4 },
    "RKV-PDE": { shift: -6, bend: 8, drift: 2 },
    "PDE-RKV": { shift: 6, bend: -8, drift: -2 },
    "NRV-TTU": { shift: -9, bend: -18, drift: 3 },
    "TTU-NRV": { shift: 9, bend: 18, drift: -3 },
    "NRV-VLJ": { shift: -8, bend: -16, drift: -5 },
    "VLJ-NRV": { shift: 8, bend: 16, drift: 5 },
    "NRV-PRN": { shift: -7, bend: 34, drift: -12 },
    "PRN-NRV": { shift: 7, bend: -34, drift: 12 },
    "PDE-VLJ": { shift: -6, bend: 9, drift: -2 },
    "VLJ-PDE": { shift: 6, bend: -9, drift: 2 },
    "PDE-TTU": { shift: -7, bend: 10, drift: 4 },
    "TTU-PDE": { shift: 7, bend: -10, drift: -4 },
    "PRN-VLJ": { shift: -7, bend: 10, drift: 0 },
    "VLJ-PRN": { shift: 7, bend: -10, drift: 0 },
    "PRN-TTU": { shift: -8, bend: 18, drift: 6 },
    "TTU-PRN": { shift: 8, bend: -18, drift: -6 },
    "PRN-TRV": { shift: -7, bend: 8, drift: 6 },
    "TRV-PRN": { shift: 7, bend: -8, drift: -6 },
    "VLJ-TTU": { shift: -7, bend: 10, drift: -2 },
    "TTU-VLJ": { shift: 7, bend: -10, drift: 2 },
    "VLJ-TRV": { shift: -6, bend: 8, drift: -2 },
    "TRV-VLJ": { shift: 6, bend: -8, drift: 2 },
    "TTU-TRV": { shift: -6, bend: 12, drift: 2 },
    "TRV-TTU": { shift: 6, bend: -12, drift: -2 },
    "PRN-KRS": { shift: -8, bend: 30, drift: -16 },
    "KRS-PRN": { shift: 8, bend: -30, drift: 16 },
  };
  return profiles[segmentId] || { shift: 0, bend: 0, drift: 0 };
}

function intersectionName(nodeId) {
  return state.network?.intersections?.find((intersection) => intersection.id === nodeId)?.name || nodeId;
}

function segmentLabel(segmentId) {
  const segment = state.network?.segments?.find((entry) => entry.id === segmentId);
  if (!segment) {
    return segmentId;
  }
  return `${intersectionName(segment.fromNode)} → ${intersectionName(segment.toNode)} (${segment.id})`;
}

function corridorShortLabel(segmentId) {
  const segment = state.network?.segments?.find((entry) => entry.id === segmentId);
  if (!segment) {
    return segmentId;
  }
  return `${intersectionShortLabel(segment.fromNode)}-${intersectionShortLabel(segment.toNode)}`;
}

function intersectionShortLabel(nodeId) {
  const labels = {
    TALLINN: "Tln",
    HAAPSALU: "Hps",
    RAKVERE: "Rkv",
    PAIDE: "Pde",
    TARTU: "Trt",
    NARVA: "Nrv",
    VILJANDI: "Vlj",
    PARNU: "Prn",
    TORVA: "Trv",
    KURESSAARE: "Krs",
  };
  return labels[nodeId] || nodeId;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    ...options,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (payload?.message) {
        message = payload.message;
      }
    } catch (error) {
      // Ignore non-JSON bodies and keep the HTTP status message.
    }
    throw new Error(message);
  }

  return response.json();
}

function postJson(url) {
  return fetchJson(url, { method: "POST" });
}

function renderError(container, message) {
  container.classList.add("empty-state");
  container.innerHTML = escapeHtml(message);
}

function formatNumber(value) {
  return Number(value ?? 0).toFixed(2);
}

function formatInteger(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Europe/Tallinn",
  }).format(new Date(value));
}

function shortTime(value) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
