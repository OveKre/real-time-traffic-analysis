package com.example.traffic.service;

import com.example.traffic.algorithm.SegmentTreeAggregator;
import com.example.traffic.config.NetworkDefinition;
import com.example.traffic.domain.Intersection;
import com.example.traffic.domain.RoadSegment;
import com.example.traffic.domain.SegmentLiveState;
import com.example.traffic.domain.SegmentStats;
import com.example.traffic.domain.TrafficReading;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class TrafficNetworkService {
  private static final Logger LOGGER = LoggerFactory.getLogger(TrafficNetworkService.class);

  private final ConcurrentMap<String, Intersection> intersections = new ConcurrentHashMap<>();
  private final ConcurrentMap<String, RoadSegment> segments = new ConcurrentHashMap<>();
  private final ConcurrentMap<String, List<RoadSegment>> outgoingGraph = new ConcurrentHashMap<>();
  private final ConcurrentMap<String, SegmentTreeAggregator> aggregators =
      new ConcurrentHashMap<>();
  private final ConcurrentMap<String, SegmentLiveState> liveStates = new ConcurrentHashMap<>();
  private final AtomicLong totalReadings = new AtomicLong();

  public void initialize(NetworkDefinition definition) {
    intersections.clear();
    segments.clear();
    outgoingGraph.clear();
    aggregators.clear();
    liveStates.clear();
    totalReadings.set(0L);

    definition
        .intersections()
        .forEach(intersection -> intersections.put(intersection.id(), intersection));
    definition.segments().forEach(segment -> segments.put(segment.id(), segment));

    for (RoadSegment segment : definition.segments()) {
      outgoingGraph.computeIfAbsent(segment.fromNode(), unused -> new ArrayList<>()).add(segment);
      aggregators.putIfAbsent(segment.id(), new SegmentTreeAggregator());
    }
    outgoingGraph.values().forEach(list -> list.sort(Comparator.comparing(RoadSegment::id)));
  }

  public void ingest(TrafficReading reading) {
    RoadSegment segment = requireSegment(reading.segmentId());
    SegmentTreeAggregator aggregator =
        aggregators.computeIfAbsent(segment.id(), unused -> new SegmentTreeAggregator());
    int minute = toMinute(reading.timestamp());
    aggregator.update(minute, reading.averageSpeedKph(), reading.vehicleCount());

    double safeSpeed = Math.max(reading.averageSpeedKph(), 5.0d);
    double travelMinutes = (segment.lengthKm() / safeSpeed) * 60.0d;
    liveStates.put(
        segment.id(),
        new SegmentLiveState(
            reading.averageSpeedKph(),
            reading.vehicleCount(),
            reading.timestamp(),
            reading.incident(),
            travelMinutes));
    totalReadings.incrementAndGet();
  }

  public SegmentStats getSegmentStats(String segmentId, Instant from, Instant to) {
    if (from.isAfter(to)) {
      throw new IllegalArgumentException("Query start must be before query end.");
    }
    RoadSegment segment = requireSegment(segmentId);
    SegmentTreeAggregator.Aggregate aggregate =
        aggregators
            .computeIfAbsent(segmentId, unused -> new SegmentTreeAggregator())
            .query(toMinute(from), toMinute(to));
    double averageSpeed = aggregate.averageSpeedKph();
    double averageTravelTimeMinutes =
        averageSpeed == 0.0d ? 0.0d : round(((segment.lengthKm() / averageSpeed) * 60.0d));
    SegmentStats segmentStats =
        new SegmentStats(
            segmentId,
            from.truncatedTo(ChronoUnit.MINUTES),
            to.truncatedTo(ChronoUnit.MINUTES),
            round(averageSpeed),
            round(aggregate.safeMinSpeed()),
            round(aggregate.safeMaxSpeed()),
            aggregate.totalVehicles(),
            averageTravelTimeMinutes,
            aggregate.samples());
    LOGGER.info(
        "Calculated segment stats segmentId={} samples={} averageSpeedKph={}",
        segmentId,
        segmentStats.sampleCount(),
        segmentStats.averageSpeedKph());
    return segmentStats;
  }

  public RoadSegment requireSegment(String segmentId) {
    RoadSegment segment = segments.get(segmentId);
    if (segment == null) {
      throw new IllegalArgumentException("Unknown segment: " + segmentId);
    }
    return segment;
  }

  public Intersection requireIntersection(String intersectionId) {
    Intersection intersection = intersections.get(intersectionId);
    if (intersection == null) {
      throw new IllegalArgumentException("Unknown node: " + intersectionId);
    }
    return intersection;
  }

  public Map<String, List<RoadSegment>> graphView() {
    return Map.copyOf(outgoingGraph);
  }

  public List<Intersection> intersections() {
    return intersections.values().stream().sorted(Comparator.comparing(Intersection::id)).toList();
  }

  public List<RoadSegment> segments() {
    return segments.values().stream().sorted(Comparator.comparing(RoadSegment::id)).toList();
  }

  public SegmentLiveState liveState(String segmentId) {
    return liveStates.get(segmentId);
  }

  public List<SegmentLiveState> liveStates() {
    return List.copyOf(liveStates.values());
  }

  public long totalReadings() {
    return totalReadings.get();
  }

  public long activeIncidentCount() {
    return liveStates.values().stream().filter(SegmentLiveState::incident).count();
  }

  public double networkAverageSpeedKph() {
    return round(
        liveStates.values().stream()
            .mapToDouble(SegmentLiveState::averageSpeedKph)
            .average()
            .orElse(0.0d));
  }

  public double currentTravelTimeMinutes(RoadSegment segment) {
    SegmentLiveState state = liveStates.get(segment.id());
    if (state != null) {
      return state.estimatedTravelTimeMinutes();
    }
    return (segment.lengthKm() / segment.speedLimitKph()) * 60.0d;
  }

  private int toMinute(Instant instant) {
    long epochMinute = instant.getEpochSecond() / 60L;
    if (epochMinute < 0 || epochMinute > 1_000_000_000L) {
      throw new IllegalArgumentException("Timestamp is outside the supported range.");
    }
    return Math.toIntExact(epochMinute);
  }

  private double round(double value) {
    return Math.round(value * 100.0d) / 100.0d;
  }
}
