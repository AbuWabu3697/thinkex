# Security Policy

## Reporting a Vulnerability

Please do not report security vulnerabilities in public GitHub issues, pull requests,
or Discord channels.

To report a vulnerability, email [hello@thinkex.app](mailto:hello@thinkex.app) with
the subject line `Security report: ThinkEx`.

Include the following when possible:

- A description of the issue and affected area.
- Steps to reproduce or a proof of concept.
- The impact you believe the issue has.
- Any relevant logs, screenshots, request examples, or affected URLs.
- Whether you have shared the report with anyone else.

Please avoid accessing, modifying, deleting, or exfiltrating data that does not belong
to you. If you find sensitive data while investigating, stop and include the minimum
detail needed for maintainers to verify the issue.

## Response Expectations

We aim to acknowledge security reports within 3 business days. After triage, we will
share what we can about severity, expected remediation timing, and whether we need
more information.

Resolution time depends on severity and complexity. We may delay public details until
users have had time to receive a fix.

## Supported Versions

ThinkEx is developed from the `main` branch. Security fixes target the current hosted
service and the latest source on `main`.

## Disclosure

Coordinate public disclosure with the maintainers. Please do not publish details of
an unpatched vulnerability until we have investigated and, when needed, released a fix.

## Out of Scope

The following are usually out of scope unless they demonstrate a concrete, exploitable
security impact:

- Reports from automated scanners without a verified exploit path.
- Missing security headers that do not create a practical vulnerability.
- Rate-limit or denial-of-service reports without realistic impact.
- Social engineering, phishing, or physical attacks.
- Vulnerabilities in unsupported local development setups that do not affect production.
