package com.example.traffic.domain;

import java.time.Instant;

public record SimulationStatus(
    boolean running, Instant simulationTime, int queuedEvents, long totalProcessedReadings) {}
