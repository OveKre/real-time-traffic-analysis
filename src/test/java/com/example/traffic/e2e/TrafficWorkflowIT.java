package com.example.traffic.e2e;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TrafficWorkflowIT {
  private static final Duration WAIT_TIMEOUT = Duration.ofSeconds(5);
  private static final Duration POLL_INTERVAL = Duration.ofMillis(250);

  @LocalServerPort private int port;

  @Autowired private TestRestTemplate testRestTemplate;

  @AfterEach
  void stopSimulation() {
    testRestTemplate.postForEntity(url("/api/simulation/stop"), null, Map.class);
  }

  @Test
  void completesMainTrafficAnalysisWorkflow() throws Exception {
    ResponseEntity<Map> startResponse =
        testRestTemplate.postForEntity(url("/api/simulation/start"), null, Map.class);
    assertEquals(HttpStatus.OK, startResponse.getStatusCode());

    Map<String, Object> summary = waitForSummaryWithReadings();
    assertEquals(Boolean.TRUE, summary.get("simulationRunning"));
    assertTrue(((Number) summary.get("totalReadings")).longValue() > 0L);

    ResponseEntity<Map> routeResponse =
        testRestTemplate.getForEntity(url("/api/routes/fastest?fromNode=A&toNode=C"), Map.class);
    assertEquals(HttpStatus.OK, routeResponse.getStatusCode());
    assertEquals(List.of("A", "B", "C"), routeResponse.getBody().get("nodePath"));

    ResponseEntity<List> bottleneckResponse =
        testRestTemplate.getForEntity(url("/api/analysis/bottlenecks?limit=5"), List.class);
    assertEquals(HttpStatus.OK, bottleneckResponse.getStatusCode());
    assertTrue(bottleneckResponse.getBody() != null);
  }

  @Test
  void returnsObservableValidationErrorForInvalidWorkflowStep() {
    ResponseEntity<Map> invalidResponse =
        testRestTemplate.getForEntity(url("/api/analysis/bottlenecks?limit=0"), Map.class);

    assertEquals(HttpStatus.BAD_REQUEST, invalidResponse.getStatusCode());
    assertTrue(
        String.valueOf(invalidResponse.getBody().get("message")).contains("bottlenecks.limit"));
  }

  private Map<String, Object> waitForSummaryWithReadings() throws InterruptedException {
    long deadline = System.nanoTime() + WAIT_TIMEOUT.toNanos();
    while (System.nanoTime() < deadline) {
      ResponseEntity<Map> response =
          testRestTemplate.getForEntity(url("/api/analysis/summary"), Map.class);
      if (response.getStatusCode() == HttpStatus.OK
          && ((Number) response.getBody().get("totalReadings")).longValue() > 0L) {
        return response.getBody();
      }
      Thread.sleep(POLL_INTERVAL.toMillis());
    }
    throw new AssertionError("Timed out waiting for traffic readings to appear.");
  }

  private String url(String path) {
    return "http://localhost:" + port + path;
  }
}
