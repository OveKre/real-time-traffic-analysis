package com.example.traffic.config;

import java.util.Optional;
import org.slf4j.MDC;

public final class TraceIdContext {
  public static final String HEADER_NAME = "X-Trace-Id";
  public static final String MDC_KEY = "trace_id";

  private TraceIdContext() {}

  public static Optional<String> currentTraceId() {
    return Optional.ofNullable(MDC.get(MDC_KEY));
  }
}
