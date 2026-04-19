package com.example.traffic.api;

import com.example.traffic.domain.RouteResult;
import com.example.traffic.service.TrafficAnalysisService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/routes")
public class RoutingController {
  private final TrafficAnalysisService trafficAnalysisService;

  public RoutingController(TrafficAnalysisService trafficAnalysisService) {
    this.trafficAnalysisService = trafficAnalysisService;
  }

  @GetMapping("/fastest")
  public RouteResult fastestRoute(
      @RequestParam("fromNode") @NotBlank String fromNode,
      @RequestParam("toNode") @NotBlank String toNode) {
    return trafficAnalysisService.fastestRoute(fromNode, toNode);
  }
}
