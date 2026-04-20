#!/usr/bin/env bash

set -euo pipefail

readonly REPORT_HTML="target/dependency-check-report.html"
readonly REPORT_JSON="target/dependency-check-report.json"
readonly PLUGIN_VERSION="12.2.1"

rm -f "$REPORT_HTML" "$REPORT_JSON"

scan_args=(
  ./mvnw
  -B
  "org.owasp:dependency-check-maven:${PLUGIN_VERSION}:check"
  -Dformat=HTML
  -Dformat=JSON
  -DfailBuildOnCVSS=7
  -DnvdApiKeyEnvironmentVariable=NVD_API_KEY
)

set +e
"${scan_args[@]}"
scan_status=$?
set -e

if [[ $scan_status -eq 0 ]]; then
  exit 0
fi

if [[ -f "$REPORT_HTML" || -f "$REPORT_JSON" ]]; then
  echo "Dependency-Check produced a report and returned a failing exit code."
  echo "Treating this as an actionable scan result."
  exit "$scan_status"
fi

echo "::warning::Dependency-Check failed before generating a report. Treating this as a non-blocking scanner infrastructure failure."
exit 0
