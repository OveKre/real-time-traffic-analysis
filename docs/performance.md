# Performance Notes

These notes define both performance targets and the repeatable benchmark workflow used to measure them.

## Targets

* Segment statistics query under normal local load should stay below `50 ms`.
* Fastest-route queries on the sample network should stay below `200 ms`.
* Continuous simulation should ingest readings without queue growth on the default sample network.

## Current approach

* Historical data is bucketed by minute and queried with a segment tree.
* The graph is sparse and represented as adjacency lists.
* Route search uses a priority queue and live travel-time weights.
* Simulation uses a producer-consumer split so ingest work does not block the scheduler.

## Benchmark workflow

```bash
./scripts/run-benchmarks.sh
```

The benchmark runner:

* loads the committed sample road network
* seeds a deterministic synthetic history using a fixed random seed
* warms up the core services
* measures repeated `segment stats` and `fastest route` operations
* writes JSON and Markdown reports under `target/benchmarks/`

## Output files

* `target/benchmarks/traffic-benchmark-report.json`
* `target/benchmarks/traffic-benchmark-report.md`

The Markdown report is the easiest artifact to include in project documentation or screenshots. The JSON report is intended for machine-readable archival or future CI comparisons.

## CI / GitHub workflow

The repository includes a manual GitHub Actions workflow named `Benchmarks`. It runs the same benchmark runner and uploads the generated report directory as an artifact.

## Measurement scope

Current benchmark measurements capture:

* segment statistics query timings
* fastest route query timings
* average, P50, P95, P99, min, and max latency for each operation
