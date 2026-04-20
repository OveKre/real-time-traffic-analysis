package com.example.traffic.api;

import com.example.traffic.domain.SimulationScenario;
import com.example.traffic.domain.SimulationStatus;
import com.example.traffic.simulation.TrafficSimulationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

  @GetMapping("/scenarios")
  public List<SimulationScenario> scenarios() {
    return trafficSimulationService.scenarios();
  }

  @PostMapping("/scenarios/{scenarioId}/activate")
  public SimulationStatus activateScenario(@PathVariable String scenarioId) {
    return trafficSimulationService.activateScenario(scenarioId);
  }

  @GetMapping("/status")
  public SimulationStatus status() {
    return trafficSimulationService.status();
  }
}
