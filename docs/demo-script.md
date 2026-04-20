# Demo Script

1. Start the application with `./mvnw spring-boot:run`.
2. Open `/swagger-ui.html` to show the generated API contract.
3. Call `POST /api/simulation/start`.
4. Call `GET /api/analysis/summary` and show increasing reading counts.
5. Call `GET /api/routes/fastest?fromNode=TARTU&toNode=TALLINN`.
6. Call `GET /api/analysis/bottlenecks?limit=5`.
7. Call `GET /api/segments/TLL-TTU/stats?...` with a recent time window.
8. Stop the simulation with `POST /api/simulation/stop`.
