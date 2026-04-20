const state = {
  network: null,
  summary: null,
  status: null,
  route: null,
  refreshTimer: null,
};

const elements = {
  startButton: document.getElementById("start-simulation"),
  stopButton: document.getElementById("stop-simulation"),
  statusDot: document.getElementById("status-dot"),
  statusLabel: document.getElementById("status-label"),
  simulationTime: document.getElementById("simulation-time"),
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

  elements.routeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadRoute();
  });

  elements.segmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadSegmentStats();
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
        `<option value="${escapeHtml(intersection.id)}">${escapeHtml(intersection.id)} - ${escapeHtml(intersection.name)}</option>`,
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
        `<option value="${escapeHtml(segment.id)}">${escapeHtml(segment.id)} · ${escapeHtml(segment.fromNode)} → ${escapeHtml(segment.toNode)}</option>`,
    )
    .join("");
  elements.segmentId.innerHTML = segmentOptions;
}

async function loadRoute() {
  const fromNode = elements.routeFrom.value;
  const toNode = elements.routeTo.value;

  if (!fromNode || !toNode || fromNode === toNode) {
    renderError(elements.routeResult, "Choose two different intersections.");
    return;
  }

  const route = await fetchJson(
    `/api/routes/fastest?fromNode=${encodeURIComponent(fromNode)}&toNode=${encodeURIComponent(toNode)}`,
  );
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

function renderStatus() {
  const running = Boolean(state.status?.running);
  elements.statusDot.className = `status-dot ${running ? "running" : "stopped"}`;
  elements.statusLabel.textContent = running ? "Simulation running" : "Simulation stopped";
  elements.simulationTime.textContent = `Simulation time: ${formatDateTime(state.status?.simulationTime)}`;
  elements.startButton.disabled = running;
  elements.stopButton.disabled = !running;
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
    fragment.querySelector(".alert-segment").textContent = bottleneck.segmentId;
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
    renderError(elements.routeResult, "No route available for the chosen pair.");
    return;
  }

  elements.routeResult.classList.remove("empty-state");
  elements.routeResult.innerHTML = `
    <div class="route-topline">
      <strong>${escapeHtml(route.nodePath.join(" → "))}</strong>
      <span class="metric-chip">Congestion ${formatNumber(route.congestionScore)}</span>
    </div>
    <div class="metric-chip-row">
      <span class="metric-chip">Distance ${formatNumber(route.totalDistanceKm)} km</span>
      <span class="metric-chip">ETA ${formatNumber(route.estimatedTravelTimeMinutes)} min</span>
    </div>
    <div class="route-path">
      <div><strong>Nodes:</strong> ${escapeHtml(route.nodePath.join(" → "))}</div>
      <div><strong>Segments:</strong> ${escapeHtml(route.segmentPath.join(", "))}</div>
    </div>
  `;
}

function renderSegmentStats(stats, measurements, windowMinutes) {
  elements.segmentResult.classList.remove("empty-state");
  elements.segmentResult.innerHTML = `
    <div class="segment-topline">
      <strong>${escapeHtml(stats.segmentId)} over last ${windowMinutes} minutes</strong>
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

  const edges = (state.network.segments || [])
    .map((segment) => {
      const from = layout[segment.fromNode];
      const to = layout[segment.toNode];
      const edgeClasses = [
        "map-edge",
        bottleneckIds.has(segment.id) ? "alert" : "",
        routeSegmentIds.has(segment.id) ? "route" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const labelX = (from.x + to.x) / 2;
      const labelY = (from.y + to.y) / 2 - 10;
      return `
        <g>
          <line class="${edgeClasses}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>
          <text class="map-label" x="${labelX}" y="${labelY}">${escapeHtml(segment.id)}</text>
        </g>
      `;
    })
    .join("");

  const routeNodes = new Set(state.route?.nodePath || []);
  const nodes = state.network.intersections
    .map((intersection) => {
      const point = layout[intersection.id];
      const nodeClass = routeNodes.has(intersection.id) ? "map-node route" : "map-node";
      return `
        <g>
          <circle class="${nodeClass}" cx="${point.x}" cy="${point.y}" r="22"></circle>
          <text class="map-node-label" x="${point.x}" y="${point.y + 5}">${escapeHtml(intersection.id)}</text>
          <text class="map-node-name" x="${point.x}" y="${point.y + 42}">${escapeHtml(intersection.name)}</text>
        </g>
      `;
    })
    .join("");

  elements.networkMap.innerHTML = `${edges}${nodes}`;
}

function buildLayout(intersections) {
  const preferred = {
    N1: { x: 160, y: 130 },
    N2: { x: 360, y: 120 },
    N3: { x: 550, y: 170 },
    N4: { x: 310, y: 325 },
    N5: { x: 590, y: 340 },
    N6: { x: 770, y: 220 },
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
