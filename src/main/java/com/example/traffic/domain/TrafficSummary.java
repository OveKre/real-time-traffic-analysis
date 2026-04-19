package com.example.traffic.domain;

import java.time.Instant;
import java.util.List;

public record TrafficSummary(
    boolean simulationRunning,
    Instant simulationTime,
    int intersections,
    int trackedSegments,
    long totalReadings,
    long activeIncidents,
    double networkAverageSpeedKph,
    List<BottleneckAlert> topBottlenecks) {}
