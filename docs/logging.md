# Logging

## Overview

The service writes structured JSON logs to standard output through Logback and `logstash-logback-encoder`.

Each request gets a trace identifier:

* if the client sends `X-Trace-Id`, the service reuses it
* otherwise the service generates a new UUID

The trace identifier is:

* added to the response header as `X-Trace-Id`
* stored in MDC as `trace_id`
* emitted in request and application logs
* returned in error responses as `traceId`

## Example flow

```bash
curl -H "X-Trace-Id: demo-trace-123" http://localhost:8080/actuator/health -i
```

Use `demo-trace-123` to locate the corresponding request logs.

## Log format

Console output is JSON and includes:

* timestamp
* level
* logger
* message
* application
* `trace_id` from MDC when present
