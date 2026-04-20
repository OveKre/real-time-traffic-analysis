package com.example.traffic.api;

import com.example.traffic.config.TraceIdContext;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger LOGGER = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String, Object>> handleIllegalArgument(
      IllegalArgumentException exception) {
    LOGGER.warn("Request failed with illegal argument: {}", exception.getMessage(), exception);
    return buildResponse(HttpStatus.BAD_REQUEST, exception.getMessage());
  }

  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException exception) {
    LOGGER.warn("Request failed with illegal state: {}", exception.getMessage(), exception);
    return buildResponse(HttpStatus.CONFLICT, exception.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, Object>> handleValidation(
      MethodArgumentNotValidException exception) {
    LOGGER.warn("Request failed validation: {}", exception.getMessage(), exception);
    return buildResponse(HttpStatus.BAD_REQUEST, exception.getMessage());
  }

  @ExceptionHandler({ConstraintViolationException.class, DateTimeParseException.class})
  public ResponseEntity<Map<String, Object>> handleConstraintViolation(Exception exception) {
    LOGGER.warn("Request failed constraint validation: {}", exception.getMessage(), exception);
    return buildResponse(HttpStatus.BAD_REQUEST, exception.getMessage());
  }

  private ResponseEntity<Map<String, Object>> buildResponse(HttpStatus status, String message) {
    String traceId = TraceIdContext.currentTraceId().orElse("unavailable");
    return ResponseEntity.status(status)
        .header(TraceIdContext.HEADER_NAME, traceId)
        .body(
            Map.of(
                "timestamp",
                Instant.now().toString(),
                "status",
                status.value(),
                "traceId",
                traceId,
                "message",
                message));
  }
}
