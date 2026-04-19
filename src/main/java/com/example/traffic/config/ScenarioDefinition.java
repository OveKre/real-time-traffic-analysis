package com.example.traffic.config;

import java.util.Map;

public record ScenarioDefinition(
    long randomSeed,
    int updateIntervalSeconds,
    Map<String, Double> hourlyDemandMultipliers,
    double incidentProbability,
    int minIncidentDurationMinutes,
    int maxIncidentDurationMinutes,
    double minSpeedFactor,
    double speedNoiseKph) {

  public double multiplierForHour(int hour) {
    return hourlyDemandMultipliers.getOrDefault(Integer.toString(hour), 1.0d);
  }
}
