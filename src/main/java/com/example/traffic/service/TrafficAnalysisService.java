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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class TrafficAnalysisService {
  private static final Logger LOGGER = LoggerFactory.getLogger(TrafficAnalysisService.class);

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
    RouteResult routeResult =
        shortestPathService.findFastestRoute(
            fromNode,
            toNode,
            trafficNetworkService.graphView(),
            trafficNetworkService::currentTravelTimeMinutes);
    LOGGER.info(
        "Calculated fastest route from={} to={} segments={} eta_minutes={}",
        fromNode,
        toNode,
        routeResult.segmentPath().size(),
        routeResult.estimatedTravelTimeMinutes());
    return routeResult;
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
    List<BottleneckAlert> bottlenecks =
        anomalyDetector.detect(snapshots).stream().limit(limit).toList();
    LOGGER.info("Calculated bottlenecks limit={} returned={}", limit, bottlenecks.size());
    return bottlenecks;
  }

  public TrafficSummary summary() {
    TrafficSummary summary =
        new TrafficSummary(
            trafficSimulationService.isRunning(),
            trafficSimulationService.simulationTime(),
            trafficNetworkService.intersections().size(),
            trafficNetworkService.segments().size(),
            trafficNetworkService.totalReadings(),
            trafficNetworkService.activeIncidentCount(),
            trafficNetworkService.networkAverageSpeedKph(),
            bottlenecks(5));
    LOGGER.info(
        "Built traffic summary simulationRunning={} totalReadings={} activeIncidents={}",
        summary.simulationRunning(),
        summary.totalReadings(),
        summary.activeIncidents());
    return summary;
  }
}
