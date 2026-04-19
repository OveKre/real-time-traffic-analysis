package com.example.traffic.service;

import com.example.traffic.algorithm.AnomalyDetector;
import com.example.traffic.algorithm.AnomalyDetector.SegmentSnapshot;
import com.example.traffic.algorithm.CongestionScorer;
import com.example.traffic.algorithm.ShortestPathService;
import com.example.traffic.domain.BottleneckAlert;
import com.example.traffic.domain.RouteResult;
import com.example.traffic.domain.SegmentLiveState;
import com.example.traffic.domain.TrafficSummary;
import com.example.traffic.simulation.TrafficSimulationService;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TrafficAnalysisService {
  private final TrafficNetworkService trafficNetworkService;
  private final ShortestPathService shortestPathService;
  private final CongestionScorer congestionScorer;
  private final AnomalyDetector anomalyDetector;
  private final TrafficSimulationService trafficSimulationService;

  public TrafficAnalysisService(
      TrafficNetworkService trafficNetworkService,
      ShortestPathService shortestPathService,
      CongestionScorer congestionScorer,
      AnomalyDetector anomalyDetector,
      TrafficSimulationService trafficSimulationService) {
    this.trafficNetworkService = trafficNetworkService;
    this.shortestPathService = shortestPathService;
    this.congestionScorer = congestionScorer;
    this.anomalyDetector = anomalyDetector;
    this.trafficSimulationService = trafficSimulationService;
  }

  public RouteResult fastestRoute(String fromNode, String toNode) {
    trafficNetworkService.requireIntersection(fromNode);
    trafficNetworkService.requireIntersection(toNode);
    return shortestPathService.findFastestRoute(
        fromNode,
        toNode,
        trafficNetworkService.graphView(),
        trafficNetworkService::currentTravelTimeMinutes);
  }

  public List<BottleneckAlert> bottlenecks(int limit) {
    List<SegmentSnapshot> snapshots =
        trafficNetworkService.segments().stream()
            .map(
                segment -> {
                  SegmentLiveState liveState = trafficNetworkService.liveState(segment.id());
                  return new SegmentSnapshot(
                      segment.id(),
                      congestionScorer.score(segment, liveState),
                      liveState != null && liveState.incident());
                })
            .toList();
    return anomalyDetector.detect(snapshots).stream().limit(limit).toList();
  }

  public TrafficSummary summary() {
    return new TrafficSummary(
        trafficSimulationService.isRunning(),
        trafficSimulationService.simulationTime(),
        trafficNetworkService.intersections().size(),
        trafficNetworkService.segments().size(),
        trafficNetworkService.totalReadings(),
        trafficNetworkService.activeIncidentCount(),
        trafficNetworkService.networkAverageSpeedKph(),
        bottlenecks(5));
  }
}
