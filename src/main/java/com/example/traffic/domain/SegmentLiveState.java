package com.example.traffic.domain;

import java.time.Instant;

public record SegmentLiveState(
    double averageSpeedKph,
    int vehicleCount,
    Instant timestamp,
    boolean incident,
    double estimatedTravelTimeMinutes) {}
