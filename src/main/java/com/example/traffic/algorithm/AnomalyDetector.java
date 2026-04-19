package com.example.traffic.algorithm;

import com.example.traffic.domain.BottleneckAlert;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class AnomalyDetector {

  public List<BottleneckAlert> detect(List<SegmentSnapshot> snapshots) {
    if (snapshots.isEmpty()) {
      return List.of();
    }

    List<Double> sortedScores =
        snapshots.stream().map(SegmentSnapshot::congestionScore).sorted().toList();

    double q1 = percentile(sortedScores, 0.25d);
    double q3 = percentile(sortedScores, 0.75d);
    double iqr = Math.max(q3 - q1, 0.0d);
    double threshold = q3 + (1.5d * iqr);

    List<BottleneckAlert> results = new ArrayList<>();
    for (SegmentSnapshot snapshot : snapshots) {
      boolean isAnomaly = snapshot.congestionScore() > threshold;
      boolean severeIncident = snapshot.incident() && snapshot.congestionScore() > q3;
      if (isAnomaly || severeIncident) {
        results.add(
            new BottleneckAlert(
                snapshot.segmentId(),
                round(snapshot.congestionScore()),
                round(q1),
                round(q3),
                round(threshold),
                snapshot.incident(),
                severeIncident ? "Incident-backed congestion spike." : "IQR threshold exceeded."));
      }
    }

    results.sort(Comparator.comparingDouble(BottleneckAlert::congestionScore).reversed());
    return results;
  }

  private double percentile(List<Double> sortedValues, double percentile) {
    if (sortedValues.size() == 1) {
      return sortedValues.getFirst();
    }
    double position = percentile * (sortedValues.size() - 1);
    int lowerIndex = (int) Math.floor(position);
    int upperIndex = (int) Math.ceil(position);
    double lowerValue = sortedValues.get(lowerIndex);
    double upperValue = sortedValues.get(upperIndex);
    double weight = position - lowerIndex;
    return lowerValue + ((upperValue - lowerValue) * weight);
  }

  private double round(double value) {
    return Math.round(value * 100.0d) / 100.0d;
  }

  public record SegmentSnapshot(String segmentId, double congestionScore, boolean incident) {}
}
