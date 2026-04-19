package com.example.traffic.domain;

public record RoadSegment(
    String id,
    String fromNode,
    String toNode,
    double lengthKm,
    double speedLimitKph,
    int capacityVehiclesPerHour) {}
