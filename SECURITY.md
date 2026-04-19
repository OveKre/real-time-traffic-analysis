# Security

## Repository policy

* Secrets, tokens, private keys, and environment-specific credentials must not be committed.
* Common secret-bearing file patterns such as `.env`, `.env.*`, `*.key`, and `*.pem` are ignored by Git.
* API input validation is enforced server-side through Spring validation and tested through integration and end-to-end coverage.

## Dependency scanning

CI runs OWASP Dependency-Check and fails the pipeline when a dependency vulnerability reaches the configured CVSS threshold.

Local command:

```bash
./mvnw -B org.owasp:dependency-check-maven:check -Dformat=HTML -DfailBuildOnCVSS=7
```

Generated reports are written under `target/`.

## Validation coverage

Critical request paths currently validate:

* route query parameters
* bottleneck query limits
* timestamp parsing for segment statistics
* unknown resource identifiers for segment lookups

## Reporting

If a vulnerability or secret leak is found, rotate the affected credential immediately, remove the secret from history if necessary, and open a dedicated bug issue with a reproducible scope and remediation steps.
