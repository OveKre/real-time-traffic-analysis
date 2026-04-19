# Architecture

## Overview

The system is a layered Spring Boot backend:

* `config` loads the road network and scenario fixtures.
* `simulation` generates a continuous stream of traffic readings and pushes them into a queue.
* `service` owns ingest, live state, analysis coordination, and API-facing orchestration.
* `algorithm` contains the reusable business algorithms.
* `api` exposes REST endpoints and input/error handling.

## Data flow

1. Startup loads `network.json` and `scenario.json`.
2. `TrafficSimulationService` starts a scheduler and worker pool.
3. The scheduler creates one reading per road segment per simulation tick.
4. Workers ingest readings into `TrafficNetworkService`.
5. The ingest layer updates segment-tree aggregates and current live state.
6. Controllers call analysis services for route, stats, and bottleneck responses.

## Key decisions

* The road network is stored as an adjacency list because the graph is sparse and routing lookups are per-node.
* Historical traffic statistics use minute buckets because they match dashboard-style operational analysis and keep memory predictable.
* The simulation uses a deterministic `Random` seeded from configuration so tests and demos remain reproducible.
* Business algorithms are isolated from controllers to keep them directly unit-testable.

## Quality controls

* Formatting and linting are enforced with Spotless and Checkstyle.
* Health checks and OpenAPI documentation are exposed automatically.
* CI fails on formatting, lint, test, or coverage regressions.
