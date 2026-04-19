package com.example.traffic.algorithm;

import com.example.traffic.domain.RoadSegment;
import com.example.traffic.domain.RouteResult;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.function.ToDoubleFunction;
import org.springframework.stereotype.Service;

@Service
public class ShortestPathService {

  public RouteResult findFastestRoute(
      String startNode,
      String endNode,
      Map<String, List<RoadSegment>> graph,
      ToDoubleFunction<RoadSegment> weightFunction) {
    Map<String, Double> distances = new HashMap<>();
    Map<String, String> previousNode = new HashMap<>();
    Map<String, RoadSegment> previousSegment = new HashMap<>();
    PriorityQueue<PathNode> queue = new PriorityQueue<>(Comparator.comparingDouble(PathNode::cost));

    distances.put(startNode, 0.0d);
    queue.offer(new PathNode(startNode, 0.0d));

    while (!queue.isEmpty()) {
      PathNode current = queue.poll();
      if (current.cost() > distances.getOrDefault(current.nodeId(), Double.POSITIVE_INFINITY)) {
        continue;
      }
      if (current.nodeId().equals(endNode)) {
        return buildRoute(
            startNode, endNode, distances, previousNode, previousSegment, weightFunction);
      }

      for (RoadSegment segment : graph.getOrDefault(current.nodeId(), List.of())) {
        double candidateCost = current.cost() + weightFunction.applyAsDouble(segment);
        if (candidateCost < distances.getOrDefault(segment.toNode(), Double.POSITIVE_INFINITY)) {
          distances.put(segment.toNode(), candidateCost);
          previousNode.put(segment.toNode(), current.nodeId());
          previousSegment.put(segment.toNode(), segment);
          queue.offer(new PathNode(segment.toNode(), candidateCost));
        }
      }
    }

    throw new IllegalArgumentException(
        "No route is available between nodes " + startNode + " and " + endNode + ".");
  }

  private RouteResult buildRoute(
      String startNode,
      String endNode,
      Map<String, Double> distances,
      Map<String, String> previousNode,
      Map<String, RoadSegment> previousSegment,
      ToDoubleFunction<RoadSegment> weightFunction) {
    ArrayDeque<String> nodeStack = new ArrayDeque<>();
    ArrayDeque<String> segmentStack = new ArrayDeque<>();
    double distanceKm = 0.0d;
    double travelMinutes = 0.0d;
    double congestionAccumulator = 0.0d;
    int segmentCount = 0;
    String cursor = endNode;

    nodeStack.push(cursor);
    while (!cursor.equals(startNode)) {
      RoadSegment segment = previousSegment.get(cursor);
      if (segment == null) {
        throw new IllegalArgumentException("Failed to reconstruct the fastest route.");
      }
      segmentStack.push(segment.id());
      cursor = previousNode.get(cursor);
      nodeStack.push(cursor);
      distanceKm += segment.lengthKm();
      travelMinutes += weightFunction.applyAsDouble(segment);
      double freeFlowMinutes = (segment.lengthKm() / segment.speedLimitKph()) * 60.0d;
      congestionAccumulator +=
          freeFlowMinutes == 0.0d ? 1.0d : weightFunction.applyAsDouble(segment) / freeFlowMinutes;
      segmentCount++;
    }

    return new RouteResult(
        new ArrayList<>(nodeStack),
        new ArrayList<>(segmentStack),
        distanceKm,
        distances.getOrDefault(endNode, travelMinutes),
        segmentCount == 0 ? 1.0d : congestionAccumulator / segmentCount);
  }

  private record PathNode(String nodeId, double cost) {}
}
