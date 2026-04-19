# Performance Notes

These are target-oriented notes for the school project and CI baseline.

## Targets

* Segment statistics query under normal local load should stay below `50 ms`.
* Fastest-route queries on the sample network should stay below `200 ms`.
* Continuous simulation should ingest readings without queue growth on the default sample network.

## Current approach

* Historical data is bucketed by minute and queried with a segment tree.
* The graph is sparse and represented as adjacency lists.
* Route search uses a priority queue and live travel-time weights.
* Simulation uses a producer-consumer split so ingest work does not block the scheduler.

## How to measure

```bash
time curl "http://localhost:8080/api/routes/fastest?fromNode=N1&toNode=N6"
time curl "http://localhost:8080/api/analysis/summary"
```

For formal reporting, record average and percentile latencies over repeated local runs after the simulation has warmed up.
