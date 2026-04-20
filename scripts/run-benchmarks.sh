#!/usr/bin/env bash
set -euo pipefail

./mvnw -q -DskipTests compile exec:java -Dexec.mainClass=com.example.traffic.benchmark.TrafficBenchmarkRunner

echo "Reports:"
echo "  target/benchmarks/traffic-benchmark-report.json"
echo "  target/benchmarks/traffic-benchmark-report.md"
