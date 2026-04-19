package com.example.traffic.api;

import com.example.traffic.domain.Intersection;
import com.example.traffic.domain.RoadSegment;
import com.example.traffic.domain.SegmentStats;
import com.example.traffic.service.TrafficNetworkService;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api")
public class NetworkController {
  private final TrafficNetworkService trafficNetworkService;

  public NetworkController(TrafficNetworkService trafficNetworkService) {
    this.trafficNetworkService = trafficNetworkService;
  }

  @GetMapping("/network")
  public NetworkResponse network() {
    return new NetworkResponse(
        trafficNetworkService.intersections(), trafficNetworkService.segments());
  }

  @GetMapping("/segments/{segmentId}/stats")
  public SegmentStats segmentStats(
      @PathVariable @NotBlank String segmentId,
      @RequestParam @NotBlank String from,
      @RequestParam @NotBlank String to) {
    return trafficNetworkService.getSegmentStats(segmentId, Instant.parse(from), Instant.parse(to));
  }

  public record NetworkResponse(List<Intersection> intersections, List<RoadSegment> segments) {}
}
