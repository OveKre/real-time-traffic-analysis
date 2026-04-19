package com.example.traffic.domain;

public record BottleneckAlert(
    String segmentId,
    double congestionScore,
    double lowerQuartile,
    double upperQuartile,
    double threshold,
    boolean incident,
    String reason) {}
