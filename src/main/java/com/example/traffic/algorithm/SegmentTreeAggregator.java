package com.example.traffic.algorithm;

import java.util.Objects;

public class SegmentTreeAggregator {
  private static final int MIN_MINUTE = 0;
  private static final int MAX_MINUTE = 1_000_000_000;

  private Node root;

  public synchronized void update(int minute, double averageSpeedKph, long vehicleCount) {
    validateMinute(minute);
    root = update(root, MIN_MINUTE, MAX_MINUTE, minute, averageSpeedKph, vehicleCount);
  }

  public synchronized Aggregate query(int startMinute, int endMinute) {
    validateMinute(startMinute);
    validateMinute(endMinute);
    if (startMinute > endMinute) {
      throw new IllegalArgumentException("Start minute must be before end minute.");
    }
    return query(root, MIN_MINUTE, MAX_MINUTE, startMinute, endMinute);
  }

  private Node update(
      Node node,
      int rangeStart,
      int rangeEnd,
      int targetMinute,
      double averageSpeedKph,
      long vehicleCount) {
    Node current = node == null ? new Node() : node;
    if (rangeStart == rangeEnd) {
      current.sumSpeed += averageSpeedKph;
      current.samples += 1;
      current.minSpeed = Math.min(current.minSpeed, averageSpeedKph);
      current.maxSpeed = Math.max(current.maxSpeed, averageSpeedKph);
      current.totalVehicles += vehicleCount;
      return current;
    }

    int midpoint = rangeStart + ((rangeEnd - rangeStart) / 2);
    if (targetMinute <= midpoint) {
      current.left =
          update(current.left, rangeStart, midpoint, targetMinute, averageSpeedKph, vehicleCount);
    } else {
      current.right =
          update(
              current.right, midpoint + 1, rangeEnd, targetMinute, averageSpeedKph, vehicleCount);
    }
    current.recomputeFromChildren();
    return current;
  }

  private Aggregate query(Node node, int rangeStart, int rangeEnd, int queryStart, int queryEnd) {
    if (node == null || queryStart > rangeEnd || queryEnd < rangeStart) {
      return Aggregate.empty();
    }
    if (queryStart <= rangeStart && rangeEnd <= queryEnd) {
      return node.asAggregate();
    }

    int midpoint = rangeStart + ((rangeEnd - rangeStart) / 2);
    Aggregate leftAggregate = query(node.left, rangeStart, midpoint, queryStart, queryEnd);
    Aggregate rightAggregate = query(node.right, midpoint + 1, rangeEnd, queryStart, queryEnd);
    return leftAggregate.merge(rightAggregate);
  }

  private void validateMinute(int minute) {
    if (minute < MIN_MINUTE || minute > MAX_MINUTE) {
      throw new IllegalArgumentException("Minute is outside the supported range.");
    }
  }

  private static final class Node {
    private Node left;
    private Node right;
    private double sumSpeed;
    private long samples;
    private double minSpeed = Double.POSITIVE_INFINITY;
    private double maxSpeed = Double.NEGATIVE_INFINITY;
    private long totalVehicles;

    private void recomputeFromChildren() {
      Aggregate merged =
          Objects.requireNonNullElse(Aggregate.fromNode(left), Aggregate.empty())
              .merge(Objects.requireNonNullElse(Aggregate.fromNode(right), Aggregate.empty()));
      this.sumSpeed = merged.sumSpeed();
      this.samples = merged.samples();
      this.minSpeed = merged.minSpeed();
      this.maxSpeed = merged.maxSpeed();
      this.totalVehicles = merged.totalVehicles();
    }

    private Aggregate asAggregate() {
      return new Aggregate(sumSpeed, samples, minSpeed, maxSpeed, totalVehicles);
    }
  }

  public record Aggregate(
      double sumSpeed, long samples, double minSpeed, double maxSpeed, long totalVehicles) {
    public static Aggregate empty() {
      return new Aggregate(0.0d, 0L, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, 0L);
    }

    public static Aggregate fromNode(Node node) {
      if (node == null) {
        return empty();
      }
      return node.asAggregate();
    }

    public Aggregate merge(Aggregate other) {
      return new Aggregate(
          sumSpeed + other.sumSpeed,
          samples + other.samples,
          Math.min(minSpeed, other.minSpeed),
          Math.max(maxSpeed, other.maxSpeed),
          totalVehicles + other.totalVehicles);
    }

    public double averageSpeedKph() {
      if (samples == 0) {
        return 0.0d;
      }
      return sumSpeed / samples;
    }

    public double safeMinSpeed() {
      return samples == 0 ? 0.0d : minSpeed;
    }

    public double safeMaxSpeed() {
      return samples == 0 ? 0.0d : maxSpeed;
    }
  }
}
