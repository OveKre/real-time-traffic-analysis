package com.example.traffic.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class TraceIdFilter extends OncePerRequestFilter {
  private static final Logger LOGGER = LoggerFactory.getLogger(TraceIdFilter.class);

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String traceId = resolveTraceId(request);
    response.setHeader(TraceIdContext.HEADER_NAME, traceId);
    MDC.put(TraceIdContext.MDC_KEY, traceId);
    long startedAtNanos = System.nanoTime();

    try {
      LOGGER.info(
          "Incoming request method={} path={} remote={} userAgent={}",
          request.getMethod(),
          request.getRequestURI(),
          request.getRemoteAddr(),
          request.getHeader("User-Agent"));
      filterChain.doFilter(request, response);
    } finally {
      long durationMillis = (System.nanoTime() - startedAtNanos) / 1_000_000L;
      LOGGER.info(
          "Completed request method={} path={} status={} duration_ms={}",
          request.getMethod(),
          request.getRequestURI(),
          response.getStatus(),
          durationMillis);
      MDC.remove(TraceIdContext.MDC_KEY);
    }
  }

  private String resolveTraceId(HttpServletRequest request) {
    String incomingTraceId = request.getHeader(TraceIdContext.HEADER_NAME);
    if (incomingTraceId == null || incomingTraceId.isBlank()) {
      return UUID.randomUUID().toString();
    }
    return incomingTraceId.strip();
  }
}
