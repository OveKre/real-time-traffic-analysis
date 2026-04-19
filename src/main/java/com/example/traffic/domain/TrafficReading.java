package com.example.traffic.domain;

import java.time.Instant;

public record TrafficReading(
    String segmentId,
    Instant timestamp,
    double averageSpeedKph,
    int vehicleCount,
    boolean incident) {}
