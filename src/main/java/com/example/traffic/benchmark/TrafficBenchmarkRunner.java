package com.example.traffic.benchmark;

import com.example.traffic.algorithm.AnomalyDetector;
import com.example.traffic.algorithm.CongestionScorer;
import com.example.traffic.algorithm.ShortestPathService;
import com.example.traffic.config.NetworkDefinition;
import com.example.traffic.domain.RoadSegment;
import com.example.traffic.domain.RouteResult;
import com.example.traffic.domain.SegmentStats;
import com.example.traffic.domain.TrafficReading;
import com.example.traffic.service.TrafficAnalysisService;
import com.example.traffic.service.TrafficNetworkService;
import com.example.traffic.simulation.TrafficSimulationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.UUID;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

public final class TrafficBenchmarkRunner {
  private static final int HISTORICAL_MINUTES = 720;
  private static final int SEGMENT_QUERY_ITERATIONS = 400;
  private static final int ROUTE_QUERY_ITERATIONS = 300;
  private static final int WARMUP_ITERATIONS = 50;
  private static final Path OUTPUT_DIR = Path.of("target", "benchmarks");
  private static final Path JSON_REPORT = OUTPUT_DIR.resolve("traffic-benchmark-report.json");
  private static final Path MARKDOWN_REPORT = OUTPUT_DIR.resolve("traffic-benchmark-report.md");
  private static final Instant BASE_TIME = Instant.parse("2026-04-20T00:00:00Z");

  private TrafficBenchmarkRunner() {}

  public static void main(String[] args) throws Exception {
    ObjectMapper objectMapper = new ObjectMapper();
    TrafficNetworkService networkService = new TrafficNetworkService();
    NetworkDefinition networkDefinition = readNetworkDefinition(objectMapper);
    networkService.initialize(networkDefinition);
    seedHistoricalData(networkService, networkDefinition.segments());

    TrafficAnalysisService analysisService =
        new TrafficAnalysisService(
            networkService,
            new ShortestPathService(),
            new CongestionScorer(),
            new AnomalyDetector(),
            new TrafficSimulationService(networkService, 1));

    warmUp(networkService, analysisService);
    BenchmarkReport benchmarkReport =
        runBenchmarks(networkService, analysisService, networkDefinition);
    writeReports(objectMapper, benchmarkReport);
  }

  private static NetworkDefinition readNetworkDefinition(ObjectMapper objectMapper)
      throws IOException {
    Resource resource = new ClassPathResource("data/network.json");
    try (InputStream inputStream = resource.getInputStream()) {
      return objectMapper.readValue(inputStream, NetworkDefinition.class);
    }
  }

  private static void seedHistoricalData(
      TrafficNetworkService networkService, List<RoadSegment> segments) {
    Random random = new Random(42L);
    for (int minuteOffset = 0; minuteOffset < HISTORICAL_MINUTES; minuteOffset++) {
      Instant timestamp = BASE_TIME.plusSeconds(minuteOffset * 60L);
      for (RoadSegment segment : segments) {
        double speedFloor = Math.max(segment.speedLimitKph() * 0.35d, 10.0d);
        double speed = speedFloor + (random.nextDouble() * (segment.speedLimitKph() - speedFloor));
        int vehicles = 4 + random.nextInt(30);
        boolean incident = random.nextDouble() < 0.04d;
        networkService.ingest(
            new TrafficReading(segment.id(), timestamp, round(speed), vehicles, incident));
      }
    }
  }

  private static void warmUp(
      TrafficNetworkService networkService, TrafficAnalysisService analysisService) {
    List<RoadSegment> segments = networkService.segments();
    List<String> nodes =
        networkService.intersections().stream().map(intersection -> intersection.id()).toList();

    for (int index = 0; index < WARMUP_ITERATIONS; index++) {
      RoadSegment segment = segments.get(index % segments.size());
      Instant to = BASE_TIME.plusSeconds((HISTORICAL_MINUTES - 1L) * 60L);
      Instant from = to.minusSeconds((15L + (index % 30)) * 60L);
      networkService.getSegmentStats(segment.id(), from, to);
      String fromNode = nodes.get(index % nodes.size());
      String toNode = nodes.get((index + 2) % nodes.size());
      if (!fromNode.equals(toNode)) {
        analysisService.fastestRoute(fromNode, toNode);
      }
    }
  }

  private static BenchmarkReport runBenchmarks(
      TrafficNetworkService networkService,
      TrafficAnalysisService analysisService,
      NetworkDefinition networkDefinition) {
    List<Long> segmentDurations = new ArrayList<>();
    List<Long> routeDurations = new ArrayList<>();
    List<RoadSegment> segments = networkService.segments();
    List<String> nodes =
        networkService.intersections().stream().map(intersection -> intersection.id()).toList();
    Instant queryEnd = BASE_TIME.plusSeconds((HISTORICAL_MINUTES - 1L) * 60L);

    for (int index = 0; index < SEGMENT_QUERY_ITERATIONS; index++) {
      RoadSegment segment = segments.get(index % segments.size());
      Instant queryStart = queryEnd.minusSeconds((10L + (index % 90)) * 60L);
      long startedAt = System.nanoTime();
      SegmentStats ignored = networkService.getSegmentStats(segment.id(), queryStart, queryEnd);
      segmentDurations.add(System.nanoTime() - startedAt);
    }

    for (int index = 0; index < ROUTE_QUERY_ITERATIONS; index++) {
      String fromNode = nodes.get(index % nodes.size());
      String toNode = nodes.get((index + 2) % nodes.size());
      long startedAt = System.nanoTime();
      RouteResult ignored = analysisService.fastestRoute(fromNode, toNode);
      routeDurations.add(System.nanoTime() - startedAt);
    }

    return new BenchmarkReport(
        "real-time-traffic-analysis",
        UUID.randomUUID().toString(),
        Instant.now().toString(),
        HISTORICAL_MINUTES,
        networkDefinition.intersections().size(),
        networkDefinition.segments().size(),
        SEGMENT_QUERY_ITERATIONS,
        ROUTE_QUERY_ITERATIONS,
        summarize("segment_stats", segmentDurations),
        summarize("fastest_route", routeDurations));
  }

  private static MeasurementSummary summarize(String operation, List<Long> durationsNanos) {
    List<Long> sortedDurations = durationsNanos.stream().sorted().toList();
    return new MeasurementSummary(
        operation,
        sortedDurations.size(),
        nanosToMillis(average(sortedDurations)),
        nanosToMillis(percentile(sortedDurations, 0.50d)),
        nanosToMillis(percentile(sortedDurations, 0.95d)),
        nanosToMillis(percentile(sortedDurations, 0.99d)),
        nanosToMillis(sortedDurations.getFirst()),
        nanosToMillis(sortedDurations.getLast()));
  }

  private static double average(List<Long> values) {
    return values.stream().mapToLong(Long::longValue).average().orElse(0.0d);
  }

  private static double percentile(List<Long> values, double percentile) {
    if (values.size() == 1) {
      return values.getFirst();
    }
    double position = percentile * (values.size() - 1);
    int lowerIndex = (int) Math.floor(position);
    int upperIndex = (int) Math.ceil(position);
    double lowerValue = values.get(lowerIndex);
    double upperValue = values.get(upperIndex);
    double weight = position - lowerIndex;
    return lowerValue + ((upperValue - lowerValue) * weight);
  }

  private static double nanosToMillis(double nanos) {
    return round(nanos / 1_000_000.0d);
  }

  private static void writeReports(ObjectMapper objectMapper, BenchmarkReport benchmarkReport)
      throws IOException {
    Files.createDirectories(OUTPUT_DIR);
    objectMapper.writerWithDefaultPrettyPrinter().writeValue(JSON_REPORT.toFile(), benchmarkReport);
    Files.writeString(MARKDOWN_REPORT, renderMarkdown(benchmarkReport));
    System.out.printf(
        Locale.ROOT, "Benchmark report written to %s and %s%n", JSON_REPORT, MARKDOWN_REPORT);
  }

  private static String renderMarkdown(BenchmarkReport benchmarkReport) {
    return """
        # Traffic Benchmark Report

        * Generated at: %s
        * Benchmark run id: `%s`
        * Historical minutes seeded: `%d`
        * Intersections: `%d`
        * Segments: `%d`

        ## Segment stats

        * Iterations: `%d`
        * Avg ms: `%.3f`
        * P50 ms: `%.3f`
        * P95 ms: `%.3f`
        * P99 ms: `%.3f`
        * Min ms: `%.3f`
        * Max ms: `%.3f`

        ## Fastest route

        * Iterations: `%d`
        * Avg ms: `%.3f`
        * P50 ms: `%.3f`
        * P95 ms: `%.3f`
        * P99 ms: `%.3f`
        * Min ms: `%.3f`
        * Max ms: `%.3f`
        """
        .formatted(
            benchmarkReport.generatedAt(),
            benchmarkReport.benchmarkRunId(),
            benchmarkReport.historicalMinutesSeeded(),
            benchmarkReport.intersections(),
            benchmarkReport.segments(),
            benchmarkReport.segmentStats().iterations(),
            benchmarkReport.segmentStats().averageMillis(),
            benchmarkReport.segmentStats().p50Millis(),
            benchmarkReport.segmentStats().p95Millis(),
            benchmarkReport.segmentStats().p99Millis(),
            benchmarkReport.segmentStats().minMillis(),
            benchmarkReport.segmentStats().maxMillis(),
            benchmarkReport.fastestRoute().iterations(),
            benchmarkReport.fastestRoute().averageMillis(),
            benchmarkReport.fastestRoute().p50Millis(),
            benchmarkReport.fastestRoute().p95Millis(),
            benchmarkReport.fastestRoute().p99Millis(),
            benchmarkReport.fastestRoute().minMillis(),
            benchmarkReport.fastestRoute().maxMillis());
  }

  private static double round(double value) {
    return Math.round(value * 1_000.0d) / 1_000.0d;
  }

  public record BenchmarkReport(
      String application,
      String benchmarkRunId,
      String generatedAt,
      int historicalMinutesSeeded,
      int intersections,
      int segments,
      int segmentStatsIterations,
      int routeIterations,
      MeasurementSummary segmentStats,
      MeasurementSummary fastestRoute) {}

  public record MeasurementSummary(
      String operation,
      int iterations,
      double averageMillis,
      double p50Millis,
      double p95Millis,
      double p99Millis,
      double minMillis,
      double maxMillis) {}
}
