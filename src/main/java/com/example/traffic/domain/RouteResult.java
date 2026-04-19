package com.example.traffic.domain;

import java.util.List;

public record RouteResult(
    List<String> nodePath,
    List<String> segmentPath,
    double totalDistanceKm,
    double estimatedTravelTimeMinutes,
    double congestionScore) {}
