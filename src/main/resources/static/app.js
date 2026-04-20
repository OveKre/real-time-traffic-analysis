const state = {
  network: null,
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
  clearSegmentSelection: document.getElementById("clear-segment-selection"),
  clearRouteSelection: document.getElementById("clear-route-selection"),
  statusDot: document.getElementById("status-dot"),
  statusLabel: document.getElementById("status-label"),
  simulationTime: document.getElementById("simulation-time"),
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
    await loadNetwork();
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
      return `
        <g class="map-road-group ${selectedSegmentId === segment.id ? "selected" : ""}" data-segment-id="${escapeHtml(segment.id)}" role="button" tabindex="0">
          <path class="map-road-casing" d="${geometry.path}"></path>
          <path class="map-road-fill" d="${geometry.path}"></path>
          <path class="map-road-center" d="${geometry.path}"></path>
          ${bottleneckIds.has(segment.id) ? `<path class="map-road-alert" d="${geometry.path}"></path>` : ""}
          ${routeSegmentIds.has(segment.id) ? `<path class="map-road-route" d="${geometry.path}"></path>` : ""}
          ${selectedSegmentId === segment.id ? `<path class="map-road-selected" d="${geometry.path}"></path>` : ""}
          <text class="map-road-label" x="${geometry.labelX}" y="${geometry.labelY}">${escapeHtml(corridorShortLabel(segment.id))}</text>
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
    TALLINN: { x: 248, y: 125 },
    PARNU: { x: 262, y: 344 },
    VILJANDI: { x: 398, y: 322 },
    TARTU: { x: 555, y: 336 },
    NARVA: { x: 754, y: 176 },
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
      <path class="map-gridline" d="M 0 110 H 900"></path>
      <path class="map-gridline" d="M 0 220 H 900"></path>
      <path class="map-gridline" d="M 0 330 H 900"></path>
      <path class="map-gridline" d="M 0 440 H 900"></path>
      <path class="map-gridline" d="M 180 0 V 520"></path>
      <path class="map-gridline" d="M 360 0 V 520"></path>
      <path class="map-gridline" d="M 540 0 V 520"></path>
      <path class="map-gridline" d="M 720 0 V 520"></path>
    </g>
    <g class="map-geography">
      <path class="map-water" d="M 0 0 H 900 V 520 H 0 Z"></path>
      <path class="map-country" d="M 162 132 C 210 84, 310 70, 402 88 C 470 100, 520 122, 578 142 C 650 168, 728 166, 788 198 C 828 220, 842 258, 818 292 C 788 334, 726 356, 650 384 C 578 410, 504 438, 426 436 C 350 434, 272 416, 218 382 C 176 356, 152 314, 146 270 C 138 214, 132 168, 162 132 Z"></path>
      <path class="map-island" d="M 108 224 C 130 206, 168 208, 188 230 C 204 246, 198 274, 172 288 C 142 304, 108 294, 96 270 C 88 252, 92 236, 108 224 Z"></path>
      <path class="map-island" d="M 94 302 C 120 282, 162 286, 184 308 C 202 326, 196 352, 168 366 C 136 382, 98 376, 82 348 C 72 330, 76 314, 94 302 Z"></path>
      <path class="map-lake" d="M 506 286 C 530 274, 566 278, 582 298 C 594 314, 590 336, 566 346 C 536 358, 504 350, 492 330 C 484 316, 488 296, 506 286 Z"></path>
      <path class="map-lake" d="M 664 236 C 694 220, 734 226, 752 250 C 764 268, 756 292, 724 302 C 688 314, 650 300, 642 274 C 636 256, 644 244, 664 236 Z"></path>
      <path class="map-district" d="M 182 108 H 348 A 32 32 0 0 1 380 140 V 206 A 32 32 0 0 1 348 238 H 194 A 32 32 0 0 1 162 206 V 140 A 32 32 0 0 1 182 108 Z"></path>
      <path class="map-district" d="M 446 270 H 626 A 30 30 0 0 1 656 300 V 372 A 30 30 0 0 1 626 402 H 458 A 30 30 0 0 1 428 372 V 300 A 30 30 0 0 1 446 270 Z"></path>
      <text class="map-district-label" x="266" y="174">Harju County</text>
      <text class="map-district-label" x="542" y="338">South Estonia</text>
      <text class="map-district-label water" x="408" y="54">Gulf of Finland</text>
      <text class="map-district-label" x="120" y="198">Hiiumaa</text>
      <text class="map-district-label" x="122" y="282">Saaremaa</text>
    </g>
  `;
}

function renderMapHud() {
  return `
    <g class="map-hud">
      <rect class="map-hud-card" x="676" y="20" width="188" height="66" rx="16"></rect>
      <text class="map-hud-kicker" x="698" y="44">ESTONIA 2D VIEW</text>
      <text class="map-hud-title" x="698" y="66">Live intercity route overlay</text>
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
    "TLL-TTU": { shift: -12, bend: 18, drift: 8 },
    "TTU-TLL": { shift: 12, bend: -18, drift: -8 },
    "TLL-NRV": { shift: -11, bend: -22, drift: 10 },
    "NRV-TLL": { shift: 11, bend: 18, drift: -10 },
    "TTU-NRV": { shift: -9, bend: -20, drift: 2 },
    "NRV-TTU": { shift: 9, bend: 20, drift: -2 },
    "TTU-VLJ": { shift: -8, bend: 10, drift: -5 },
    "VLJ-TTU": { shift: 8, bend: -10, drift: 5 },
    "VLJ-PRN": { shift: -8, bend: 12, drift: -4 },
    "PRN-VLJ": { shift: 8, bend: -12, drift: 4 },
    "TLL-PRN": { shift: -10, bend: 22, drift: -6 },
    "PRN-TLL": { shift: 10, bend: -22, drift: 6 },
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
    TARTU: "Trt",
    NARVA: "Nrv",
    VILJANDI: "Vlj",
    PARNU: "Prn",
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
