package com.example.traffic.api;

import com.example.traffic.domain.BottleneckAlert;
import com.example.traffic.domain.TrafficSummary;
import com.example.traffic.service.TrafficAnalysisService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/analysis")
public class AnalysisController {
  private final TrafficAnalysisService trafficAnalysisService;

  public AnalysisController(TrafficAnalysisService trafficAnalysisService) {
    this.trafficAnalysisService = trafficAnalysisService;
  }

  @GetMapping("/bottlenecks")
  public List<BottleneckAlert> bottlenecks(
      @RequestParam(defaultValue = "5") @Min(1) @Max(20) int limit) {
    return trafficAnalysisService.bottlenecks(limit);
  }

  @GetMapping("/summary")
  public TrafficSummary summary() {
    return trafficAnalysisService.summary();
  }
}
