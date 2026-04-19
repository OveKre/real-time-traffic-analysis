package com.example.traffic.algorithm;

import com.example.traffic.domain.RoadSegment;
import com.example.traffic.domain.SegmentLiveState;
import org.springframework.stereotype.Component;

@Component
public class CongestionScorer {

  public double score(RoadSegment segment, SegmentLiveState liveState) {
    double freeFlowMinutes = freeFlowTravelTimeMinutes(segment);
    double actualMinutes =
        liveState == null
            ? freeFlowMinutes
            : Math.max(liveState.estimatedTravelTimeMinutes(), 0.1d);
    if (freeFlowMinutes == 0.0d) {
      return 1.0d;
    }
    return actualMinutes / freeFlowMinutes;
  }

  public double freeFlowTravelTimeMinutes(RoadSegment segment) {
    if (segment.speedLimitKph() <= 0.0d) {
      return 0.0d;
    }
    return (segment.lengthKm() / segment.speedLimitKph()) * 60.0d;
  }
}
