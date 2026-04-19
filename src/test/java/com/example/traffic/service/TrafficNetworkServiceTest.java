package com.example.traffic.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.example.traffic.config.NetworkDefinition;
import com.example.traffic.domain.Intersection;
import com.example.traffic.domain.RoadSegment;
import com.example.traffic.domain.SegmentStats;
import com.example.traffic.domain.TrafficReading;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TrafficNetworkServiceTest {
  private static final Instant BASE_TIME = Instant.parse("2026-04-20T10:00:00Z");

  private TrafficNetworkService trafficNetworkService;

  @BeforeEach
  void setUp() {
    trafficNetworkService = new TrafficNetworkService();
    trafficNetworkService.initialize(
        new NetworkDefinition(
            List.of(new Intersection("A", "Alpha"), new Intersection("B", "Bravo")),
            List.of(new RoadSegment("AB", "A", "B", 1.5d, 60.0d, 600))));
  }

  @Test
  void ingestUpdatesStatsAndLiveState() {
    trafficNetworkService.ingest(new TrafficReading("AB", BASE_TIME, 45.0d, 10, false));
    trafficNetworkService.ingest(
        new TrafficReading("AB", BASE_TIME.plusSeconds(30), 30.0d, 12, true));

    SegmentStats stats =
        trafficNetworkService.getSegmentStats(
            "AB", BASE_TIME.minusSeconds(60), BASE_TIME.plusSeconds(60));

    assertEquals(37.5d, stats.averageSpeedKph(), 0.001d);
    assertEquals(30.0d, stats.minSpeedKph(), 0.001d);
    assertEquals(45.0d, stats.maxSpeedKph(), 0.001d);
    assertEquals(22L, stats.totalVehicles());
    assertEquals(2L, stats.sampleCount());
    assertEquals(1L, trafficNetworkService.activeIncidentCount());
  }

  @Test
  void rejectsReverseTimeRange() {
    assertThrows(
        IllegalArgumentException.class,
        () -> trafficNetworkService.getSegmentStats("AB", BASE_TIME.plusSeconds(60), BASE_TIME));
  }
}
