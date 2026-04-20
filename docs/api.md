# API Notes

OpenAPI is generated automatically by springdoc.

## Interactive docs

* Swagger UI: `/swagger-ui.html`
* OpenAPI JSON: `/api-docs`

## Main endpoints

* `POST /api/simulation/start`
* `POST /api/simulation/stop`
* `GET /api/simulation/status`
* `GET /api/simulation/scenarios`
* `POST /api/simulation/scenarios/{scenarioId}/activate`
* `GET /api/network`
* `GET /api/segments/{segmentId}/stats`
* `GET /api/routes/fastest`
* `GET /api/analysis/bottlenecks`
* `GET /api/analysis/summary`

## Example

```bash
curl -X POST http://localhost:8080/api/simulation/start
curl http://localhost:8080/api/simulation/scenarios
curl -X POST http://localhost:8080/api/simulation/scenarios/coastal-weekend/activate
curl "http://localhost:8080/api/routes/fastest?fromNode=TARTU&toNode=TALLINN"
curl "http://localhost:8080/api/segments/TLL-TTU/stats?from=2026-04-20T10:00:00Z&to=2026-04-20T10:05:00Z"
```
