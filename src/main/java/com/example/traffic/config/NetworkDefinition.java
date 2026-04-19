package com.example.traffic.config;

import com.example.traffic.domain.Intersection;
import com.example.traffic.domain.RoadSegment;
import java.util.List;

public record NetworkDefinition(List<Intersection> intersections, List<RoadSegment> segments) {}
