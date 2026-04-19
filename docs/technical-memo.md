# Technical Memo

## Problem and requirements

The project needs a non-trivial traffic-analysis backend that demonstrates mathematical and logical processing, measurable quality controls, and production-like engineering discipline. The implementation must support live updates, route analysis, statistics queries, and testable acceptance criteria.

## Compared design variants

### Variant 1

Adjacency matrix + Floyd-Warshall + linear scans over historical readings.

Pros:

* Simple all-pairs query model after precomputation

Cons:

* Expensive `O(V^3)` preprocessing
* Poor fit for dynamic weights and real-time range queries

### Variant 2

Adjacency list + Dijkstra + segment tree.

Pros:

* Efficient for sparse road networks
* Good fit for dynamic edge weights
* Range queries stay `O(log n)`

Cons:

* Slightly more implementation complexity

### Variant 3

Adjacency list + A* + rolling aggregates.

Pros:

* Potentially faster route search with a strong heuristic

Cons:

* Requires coordinate heuristics not present in the task
* Weakens the historical query story compared to a segment tree

## Selected design

Variant 2 was selected because it satisfies both core requirements: fast route computation on a sparse graph and efficient time-window traffic statistics.

## Complexity

* Segment-tree update: `O(log n)`
* Segment-tree query: `O(log n)`
* Dijkstra route search: `O((V + E) log V)`
* Bottleneck scan: `O(s log s)` due to congestion-score sorting across `s` segments

## Risks

* Random simulation behavior can make demos inconsistent without deterministic seeding.
* Overly small tests could miss concurrency or endpoint integration faults.
* External dependency resolution must be stable in CI and local wrapper execution.
