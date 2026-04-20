package com.example.traffic.api;

import static org.hamcrest.Matchers.blankOrNullString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class TrafficApiIntegrationTest {

  @Autowired private MockMvc mockMvc;

  @AfterEach
  void stopSimulation() throws Exception {
    mockMvc.perform(post("/api/simulation/stop")).andReturn();
  }

  @Test
  void exposesNetworkAndRoutingEndpoints() throws Exception {
    mockMvc
        .perform(get("/api/network"))
        .andExpect(status().isOk())
        .andExpect(header().string("X-Trace-Id", not(blankOrNullString())))
        .andExpect(jsonPath("$.intersections", hasSize(3)))
        .andExpect(jsonPath("$.segments", hasSize(4)));

    mockMvc
        .perform(get("/api/routes/fastest").param("fromNode", "A").param("toNode", "C"))
        .andExpect(status().isOk())
        .andExpect(header().string("X-Trace-Id", not(blankOrNullString())))
        .andExpect(jsonPath("$.nodePath[0]", is("A")))
        .andExpect(jsonPath("$.nodePath[2]", is("C")));
  }

  @Test
  void simulationProducesQueryableTrafficData() throws Exception {
    mockMvc.perform(post("/api/simulation/start")).andExpect(status().isOk());
    Thread.sleep(1400L);

    mockMvc
        .perform(get("/api/analysis/summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.simulationRunning", is(true)))
        .andExpect(jsonPath("$.totalReadings").value(org.hamcrest.Matchers.greaterThan(0)));

    mockMvc
        .perform(
            get("/api/segments/AB/measurements")
                .param("from", "2026-04-20T10:00:00Z")
                .param("to", "2026-04-20T10:20:00Z"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray());
  }

  @Test
  void rejectsInvalidAnalysisRequest() throws Exception {
    mockMvc
        .perform(get("/api/analysis/bottlenecks").param("limit", "0"))
        .andExpect(status().isBadRequest())
        .andExpect(header().string("X-Trace-Id", not(blankOrNullString())))
        .andExpect(jsonPath("$.traceId", not(blankOrNullString())));
  }

  @Test
  void rejectsBlankRouteNodeInput() throws Exception {
    mockMvc
        .perform(get("/api/routes/fastest").param("fromNode", " ").param("toNode", "C"))
        .andExpect(status().isBadRequest())
        .andExpect(header().string("X-Trace-Id", not(blankOrNullString())))
        .andExpect(jsonPath("$.message", org.hamcrest.Matchers.containsString("fromNode")));
  }

  @Test
  void rejectsMalformedStatsTimestamp() throws Exception {
    mockMvc
        .perform(
            get("/api/segments/AB/stats")
                .param("from", "not-a-timestamp")
                .param("to", "2026-04-20T10:00:00Z"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.traceId", not(blankOrNullString())));
  }

  @Test
  void rejectsUnknownSegmentLookup() throws Exception {
    mockMvc
        .perform(
            get("/api/segments/UNKNOWN/stats")
                .param("from", "2026-04-20T09:00:00Z")
                .param("to", "2026-04-20T10:00:00Z"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message", org.hamcrest.Matchers.containsString("Unknown segment")));
  }

  @Test
  void propagatesIncomingTraceIdHeader() throws Exception {
    mockMvc
        .perform(get("/actuator/health").header("X-Trace-Id", "trace-from-client"))
        .andExpect(status().isOk())
        .andExpect(header().string("X-Trace-Id", "trace-from-client"));
  }
}
