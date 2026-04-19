package com.example.traffic.domain;

import java.time.Instant;

public record SegmentStats(
    String segmentId,
    Instant from,
    Instant to,
    double averageSpeedKph,
    double minSpeedKph,
    double maxSpeedKph,
    long totalVehicles,
    double averageTravelTimeMinutes,
    long sampleCount) {}
