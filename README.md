# Real-Time Traffic Analysis

Spring Boot backend for a course project that simulates live traffic updates, computes time-window statistics with a segment tree, finds fastest routes with Dijkstra's algorithm, and detects congestion bottlenecks with an IQR-based rule.

## Problem and goals

Traffic managers and planners need a way to evaluate road-network congestion and routing choices under continuously changing conditions. This project provides a controlled traffic simulation and an analysis API that can be used to inspect segment performance, monitor bottlenecks, and compare route decisions.

Measured goals:

* Start the service locally with one command.
* Process continuous simulated traffic readings and expose near-real-time summaries.
* Answer time-window statistics queries efficiently with `O(log n)` segment tree operations.
* Compute fastest routes on a directed road graph with a priority queue based shortest-path algorithm.
* Detect abnormal congestion using a deterministic statistical rule.
* Enforce formatting, linting, tests, and coverage in CI.

## Tech stack

* Java 21
* Spring Boot 3
* Maven wrapper with local project cache
* Spotless + Checkstyle
* JUnit 5 + Spring Boot Test + JaCoCo
* springdoc OpenAPI

## Run

```bash
./mvnw spring-boot:run
```

Application endpoints:

* Health: `GET /actuator/health`
* OpenAPI JSON: `GET /api-docs`
* Swagger UI: `GET /swagger-ui.html`
* Start simulation: `POST /api/simulation/start`
* Stop simulation: `POST /api/simulation/stop`
* Network: `GET /api/network`
* Segment stats: `GET /api/segments/{id}/stats?from=2026-04-20T10:00:00Z&to=2026-04-20T10:10:00Z`
* Fastest route: `GET /api/routes/fastest?fromNode=N1&toNode=N6`
* Bottlenecks: `GET /api/analysis/bottlenecks?limit=5`
* Summary: `GET /api/analysis/summary`

## Build and test

```bash
./mvnw verify
```

The CI pipeline runs formatting, Checkstyle, unit tests, integration tests, end-to-end tests, coverage checks, and packaging. Business-logic coverage is enforced at `80%` for the algorithm and service packages.

To run only the end-to-end suite against the Spring Boot app started by the test harness:

```bash
./mvnw -Dtest=none -DfailIfNoTests=false -Dit.test=TrafficWorkflowIT failsafe:integration-test failsafe:verify
```

## Security checks

The repository includes an automated dependency vulnerability scan in CI using OWASP Dependency-Check. Builds fail when the scan detects dependencies at or above the configured CVSS threshold.

Local command:

```bash
./mvnw -B org.owasp:dependency-check-maven:check -Dformat=HTML -DfailBuildOnCVSS=7
```

See [SECURITY.md](SECURITY.md) for the repository secret-handling and validation policy.

## Repository structure

* `src/main/java/com/example/traffic` application code
* `src/main/resources/data` sample network and scenario fixtures
* `src/test` unit and integration tests with separate test fixtures
* `docs` architecture, ADR, testing, API, memo, performance, and demo material

## Algorithmic core

* `SegmentTreeAggregator` keeps minute-bucket traffic aggregates and answers range queries in `O(log n)`.
* `ShortestPathService` uses Dijkstra's algorithm and a priority queue to find the fastest route using live travel-time weights.
* `AnomalyDetector` computes `Q1`, `Q3`, `IQR`, and flags bottlenecks above `Q3 + 1.5 * IQR`.
* The simulation uses deterministic pseudo-random generation with configurable demand multipliers and incident windows.

See [ARCHITECTURE.md](ARCHITECTURE.md), [TESTS.md](TESTS.md), and [docs/api.md](docs/api.md) for details.
