package com.example.traffic.domain;

import java.time.Instant;

public record SegmentMeasurementPoint(
    Instant timestamp,
    double averageSpeedKph,
    long totalVehicles,
    long sampleCount,
    double averageTravelTimeMinutes) {}
