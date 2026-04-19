package com.example.traffic.simulation;

import com.example.traffic.config.ScenarioDefinition;
import com.example.traffic.domain.RoadSegment;
import com.example.traffic.domain.SimulationStatus;
import com.example.traffic.domain.TrafficReading;
import com.example.traffic.service.TrafficNetworkService;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TrafficSimulationService {
  private static final double MIN_BASE_SPEED_FACTOR = 0.35d;
  private static final double BASE_SPEED_OFFSET = 1.20d;
  private static final double DEMAND_SPEED_PENALTY = 0.55d;
  private static final double INCIDENT_SPEED_FACTOR_MIN = 0.25d;
  private static final double INCIDENT_SPEED_FACTOR_MAX = 0.55d;
  private static final double MIN_INCIDENT_CHANCE_FACTOR = 0.30d;
  private static final double MIN_RANDOM_VEHICLE_OFFSET = -5.0d;
  private static final double MAX_RANDOM_VEHICLE_OFFSET = 8.0d;
  private static final long POLL_TIMEOUT_MILLIS = 250L;

  private static final Logger LOGGER = LoggerFactory.getLogger(TrafficSimulationService.class);

  private final TrafficNetworkService trafficNetworkService;
  private final int workerCount;
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicReference<Instant> simulationTime =
      new AtomicReference<>(Instant.now().truncatedTo(ChronoUnit.HOURS));
  private final Map<String, ActiveIncident> activeIncidents =
      new java.util.concurrent.ConcurrentHashMap<>();
  private volatile Random random = new Random();
  private volatile ScenarioDefinition scenarioDefinition;
  private volatile BlockingQueue<TrafficReading> ingestQueue = new LinkedBlockingQueue<>();
  private volatile ScheduledExecutorService scheduler;
  private volatile ScheduledExecutorService workers;

  public TrafficSimulationService(
      TrafficNetworkService trafficNetworkService,
      @Value("${traffic.simulation.worker-count:4}") int workerCount) {
    this.trafficNetworkService = trafficNetworkService;
    this.workerCount = workerCount;
  }

  public void configureScenario(ScenarioDefinition scenarioDefinition) {
    this.scenarioDefinition = scenarioDefinition;
    this.random = new Random(scenarioDefinition.randomSeed());
    this.simulationTime.set(Instant.now().truncatedTo(ChronoUnit.HOURS));
  }

  public synchronized SimulationStatus start() {
    if (running.get()) {
      return status();
    }
    if (scenarioDefinition == null) {
      throw new IllegalStateException("Scenario has not been loaded.");
    }

    ingestQueue = new LinkedBlockingQueue<>();
    scheduler = Executors.newSingleThreadScheduledExecutor();
    workers = Executors.newScheduledThreadPool(workerCount);
    running.set(true);
    LOGGER.info("Starting traffic simulation with {} workers.", workerCount);

    for (int index = 0; index < workerCount; index++) {
      workers.submit(this::consumeLoop);
    }

    scheduler.scheduleAtFixedRate(
        this::generateReadings,
        0L,
        Math.max(scenarioDefinition.updateIntervalSeconds(), 1),
        TimeUnit.SECONDS);
    return status();
  }

  public synchronized SimulationStatus stop() {
    running.set(false);
    shutdownExecutor(scheduler);
    shutdownExecutor(workers);
    activeIncidents.clear();
    LOGGER.info("Stopped traffic simulation.");
    return status();
  }

  public boolean isRunning() {
    return running.get();
  }

  public Instant simulationTime() {
    return simulationTime.get();
  }

  public SimulationStatus status() {
    return new SimulationStatus(
        running.get(),
        simulationTime.get(),
        ingestQueue.size(),
        trafficNetworkService.totalReadings());
  }

  private void generateReadings() {
    if (!running.get()) {
      return;
    }
    Instant timestamp = simulationTime.getAndUpdate(value -> value.plus(1L, ChronoUnit.MINUTES));
    expireIncidents(timestamp);

    for (RoadSegment segment : trafficNetworkService.segments()) {
      ingestQueue.offer(createReading(segment, timestamp));
    }
  }

  private TrafficReading createReading(RoadSegment segment, Instant timestamp) {
    double demandMultiplier =
        scenarioDefinition.multiplierForHour(timestamp.atZone(ZoneOffset.UTC).getHour());
    double baseSpeed =
        segment.speedLimitKph()
            * Math.max(
                MIN_BASE_SPEED_FACTOR,
                BASE_SPEED_OFFSET - (demandMultiplier * DEMAND_SPEED_PENALTY));
    double noise =
        nextDouble(-scenarioDefinition.speedNoiseKph(), scenarioDefinition.speedNoiseKph());

    ActiveIncident incident =
        activeIncidents.compute(
            segment.id(),
            (segmentId, existingIncident) ->
                nextIncident(timestamp, existingIncident, demandMultiplier));
    double incidentFactor = incident == null ? 1.0d : incident.speedFactor();
    double adjustedSpeed =
        Math.max(
            segment.speedLimitKph() * scenarioDefinition.minSpeedFactor(),
            Math.min(segment.speedLimitKph(), baseSpeed + noise) * incidentFactor);
    int vehicleCount =
        (int)
            Math.max(
                0,
                Math.round(
                    ((segment.capacityVehiclesPerHour() * demandMultiplier) / 60.0d)
                        + nextDouble(MIN_RANDOM_VEHICLE_OFFSET, MAX_RANDOM_VEHICLE_OFFSET)));

    return new TrafficReading(
        segment.id(), timestamp, round(adjustedSpeed), vehicleCount, incident != null);
  }

  private ActiveIncident nextIncident(
      Instant timestamp, ActiveIncident existingIncident, double demandMultiplier) {
    if (existingIncident != null && existingIncident.endsAt().isAfter(timestamp)) {
      return existingIncident;
    }
    double chance =
        scenarioDefinition.incidentProbability()
            * Math.max(MIN_INCIDENT_CHANCE_FACTOR, demandMultiplier);
    if (nextDouble(0.0d, 1.0d) >= chance) {
      return null;
    }
    int durationMinutes =
        nextIntInclusive(
            scenarioDefinition.minIncidentDurationMinutes(),
            scenarioDefinition.maxIncidentDurationMinutes());
    double speedFactor = nextDouble(INCIDENT_SPEED_FACTOR_MIN, INCIDENT_SPEED_FACTOR_MAX);
    return new ActiveIncident(timestamp.plus(durationMinutes, ChronoUnit.MINUTES), speedFactor);
  }

  private void expireIncidents(Instant timestamp) {
    activeIncidents.entrySet().removeIf(entry -> !entry.getValue().endsAt().isAfter(timestamp));
  }

  private void consumeLoop() {
    while (running.get() || !ingestQueue.isEmpty()) {
      try {
        TrafficReading reading = ingestQueue.poll(POLL_TIMEOUT_MILLIS, TimeUnit.MILLISECONDS);
        if (reading != null) {
          trafficNetworkService.ingest(reading);
        }
      } catch (InterruptedException interruptedException) {
        Thread.currentThread().interrupt();
        return;
      }
    }
  }

  private void shutdownExecutor(ScheduledExecutorService executorService) {
    if (executorService == null) {
      return;
    }
    executorService.shutdownNow();
  }

  private double round(double value) {
    return Math.round(value * 100.0d) / 100.0d;
  }

  private synchronized double nextDouble(double min, double max) {
    return min + ((max - min) * random.nextDouble());
  }

  private synchronized int nextIntInclusive(int min, int max) {
    return min + random.nextInt((max - min) + 1);
  }

  @PreDestroy
  public void destroy() {
    stop();
  }

  private record ActiveIncident(Instant endsAt, double speedFactor) {}
}
