package com.example.traffic.config;

import com.example.traffic.service.TrafficNetworkService;
import com.example.traffic.simulation.TrafficSimulationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

@Component
public class TrafficDataLoader {
  private final ObjectMapper objectMapper;
  private final TrafficNetworkService trafficNetworkService;
  private final TrafficSimulationService trafficSimulationService;
  private final Resource networkFile;
  private final Resource scenarioFile;

  public TrafficDataLoader(
      ObjectMapper objectMapper,
      TrafficNetworkService trafficNetworkService,
      TrafficSimulationService trafficSimulationService,
      @Value("${traffic.data.network-file}") Resource networkFile,
      @Value("${traffic.data.scenario-file}") Resource scenarioFile)
      throws IOException {
    this.objectMapper = objectMapper;
    this.trafficNetworkService = trafficNetworkService;
    this.trafficSimulationService = trafficSimulationService;
    this.networkFile = networkFile;
    this.scenarioFile = scenarioFile;
    loadData();
  }

  private void loadData() throws IOException {
    NetworkDefinition networkDefinition =
        objectMapper.readValue(networkFile.getInputStream(), NetworkDefinition.class);
    ScenarioDefinition scenarioDefinition =
        objectMapper.readValue(scenarioFile.getInputStream(), ScenarioDefinition.class);
    trafficNetworkService.initialize(networkDefinition);
    trafficSimulationService.configureScenario(scenarioDefinition);
  }
}
