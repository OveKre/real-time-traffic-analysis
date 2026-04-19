# Tests

## Strategy

The project uses three test layers:

* Unit tests for `SegmentTreeAggregator`, `ShortestPathService`, and `AnomalyDetector`
* Service-level tests for ingest and aggregate behavior in `TrafficNetworkService`
* Integration tests for API flows through the full Spring application using `MockMvc`

## Coverage policy

* Business logic packages `com.example.traffic.algorithm` and `com.example.traffic.service` must reach at least `80%` line coverage.
* Tests avoid mocking internal business logic. The integration suite uses the real Spring context and test fixtures from `src/test/resources/fixtures`.

## Core scenarios

* Segment-tree range queries return correct aggregates and safe empty-state values.
* Fastest-route calculation prefers lower-cost paths and fails clearly when no path exists.
* Bottleneck detection flags only statistical outliers.
* Traffic ingest updates statistics, live state, and incident counts.
* API flows expose network data, route queries, summary queries, and request validation errors.
