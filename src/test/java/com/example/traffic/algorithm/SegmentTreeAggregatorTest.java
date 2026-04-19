package com.example.traffic.algorithm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class SegmentTreeAggregatorTest {

  @Test
  void updateAndQueryReturnsExpectedAggregates() {
    SegmentTreeAggregator aggregator = new SegmentTreeAggregator();

    aggregator.update(10, 40.0d, 5);
    aggregator.update(11, 20.0d, 8);
    aggregator.update(11, 60.0d, 2);

    SegmentTreeAggregator.Aggregate aggregate = aggregator.query(10, 11);

    assertEquals(40.0d, aggregate.averageSpeedKph(), 0.001d);
    assertEquals(20.0d, aggregate.safeMinSpeed(), 0.001d);
    assertEquals(60.0d, aggregate.safeMaxSpeed(), 0.001d);
    assertEquals(15L, aggregate.totalVehicles());
    assertEquals(3L, aggregate.samples());
  }

  @Test
  void queryOnEmptyRangeReturnsZeroSafeValues() {
    SegmentTreeAggregator aggregator = new SegmentTreeAggregator();

    SegmentTreeAggregator.Aggregate aggregate = aggregator.query(100, 105);

    assertEquals(0.0d, aggregate.averageSpeedKph(), 0.001d);
    assertEquals(0.0d, aggregate.safeMinSpeed(), 0.001d);
    assertEquals(0.0d, aggregate.safeMaxSpeed(), 0.001d);
    assertEquals(0L, aggregate.totalVehicles());
    assertEquals(0L, aggregate.samples());
  }

  @Test
  void invalidRangeThrowsException() {
    SegmentTreeAggregator aggregator = new SegmentTreeAggregator();

    assertThrows(IllegalArgumentException.class, () -> aggregator.query(11, 10));
  }
}
