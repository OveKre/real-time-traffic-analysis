package com.example.traffic.algorithm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.example.traffic.domain.RoadSegment;
import com.example.traffic.domain.RouteResult;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ShortestPathServiceTest {

  private final ShortestPathService shortestPathService = new ShortestPathService();

  @Test
  void findsFastestRouteUsingPriorityQueueAndDynamicWeights() {
    Map<String, List<RoadSegment>> graph =
        Map.of(
            "A",
            List.of(
                new RoadSegment("AB", "A", "B", 1.0d, 60.0d, 600),
                new RoadSegment("AC", "A", "C", 3.0d, 60.0d, 600)),
            "B",
            List.of(new RoadSegment("BC", "B", "C", 1.0d, 60.0d, 600)));

    RouteResult result =
        shortestPathService.findFastestRoute(
            "A",
            "C",
            graph,
            segment ->
                switch (segment.id()) {
                  case "AB" -> 1.0d;
                  case "BC" -> 1.0d;
                  default -> 5.0d;
                });

    assertEquals(List.of("A", "B", "C"), result.nodePath());
    assertEquals(List.of("AB", "BC"), result.segmentPath());
    assertEquals(2.0d, result.estimatedTravelTimeMinutes(), 0.001d);
    assertEquals(2.0d, result.totalDistanceKm(), 0.001d);
  }

  @Test
  void throwsWhenNoRouteExists() {
    Map<String, List<RoadSegment>> graph = Map.of("A", List.of(), "B", List.of());

    assertThrows(
        IllegalArgumentException.class,
        () -> shortestPathService.findFastestRoute("A", "B", graph, segment -> 1.0d));
  }
}
