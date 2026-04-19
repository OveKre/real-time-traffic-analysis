package com.example.traffic.api;

import com.example.traffic.domain.SimulationStatus;
import com.example.traffic.simulation.TrafficSimulationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/simulation")
public class SimulationController {
  private final TrafficSimulationService trafficSimulationService;

  public SimulationController(TrafficSimulationService trafficSimulationService) {
    this.trafficSimulationService = trafficSimulationService;
  }

  @PostMapping("/start")
  public SimulationStatus start() {
    return trafficSimulationService.start();
  }

  @PostMapping("/stop")
  public SimulationStatus stop() {
    return trafficSimulationService.stop();
  }

  @GetMapping("/status")
  public SimulationStatus status() {
    return trafficSimulationService.status();
  }
}
