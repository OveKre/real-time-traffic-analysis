package com.example.traffic.algorithm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.traffic.algorithm.AnomalyDetector.SegmentSnapshot;
import com.example.traffic.domain.BottleneckAlert;
import java.util.List;
import org.junit.jupiter.api.Test;

class AnomalyDetectorTest {

  private final AnomalyDetector anomalyDetector = new AnomalyDetector();

  @Test
  void detectReturnsOnlyOutlierSegments() {
    List<BottleneckAlert> alerts =
        anomalyDetector.detect(
            List.of(
                new SegmentSnapshot("S1", 1.0d, false),
                new SegmentSnapshot("S2", 1.1d, false),
                new SegmentSnapshot("S3", 1.2d, false),
                new SegmentSnapshot("S4", 4.8d, true)));

    assertEquals(1, alerts.size());
    assertEquals("S4", alerts.getFirst().segmentId());
    assertTrue(alerts.getFirst().congestionScore() > 4.0d);
  }

  @Test
  void detectReturnsEmptyListWhenInputIsEmpty() {
    assertTrue(anomalyDetector.detect(List.of()).isEmpty());
  }
}
