# ADR-001: Adjacency List + Dijkstra + Segment Tree

## Status

Accepted

## Context

The project needs both dynamic route computation and efficient historical statistics over time windows.

## Decision

Use:

* adjacency-list graph storage for the road network
* Dijkstra's algorithm with a priority queue for fastest-route queries
* a segment tree for minute-bucket traffic aggregates

## Consequences

* Sparse-graph performance is strong for this problem shape.
* Dynamic weights can be recalculated from live traffic state without rebuilding all-pairs results.
* Historical queries stay efficient even as the number of readings grows.
