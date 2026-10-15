# REKA → AntaraX Performance Intelligence
## Master Product Brief & Engineering Integration Standard
**Version:** 0.1 — Architecture proposal | **Date:** 15 October 2026
**Status:** Working specification; proposed implementation details require validation.

## 1. Executive summary
Build a central, AI-assisted platform that measures the health, adoption, operational performance, business impact, and (where relevant) commercial outcomes of customized client solutions. REKA is the first internal operator; the platform is designed with a credible path to become an AntaraX product for REKA-built and third-party solutions.

**Core promise:** Demonstrate measurable client outcomes over time without building a bespoke analytics system for every engagement.

**Design constraint:** Client applications remain free to use their own stack, database, domain models, UI and workflows. Only their observability/measurement interface must conform to a lightweight contract.

## 2. Confirmed decisions versus proposals
### Confirmed in discussion
- Internal REKA operations and existing client projects come first; future external AntaraX commercialization matters, but must not delay the MVP.
- Prefer **central scheduled API pulls** over continuous client-side pushes.
- Use **both** development-time measurement manifest generation and runtime API discovery/validation.
- Track technical health, usage, operational performance, business impact, and optional commercial performance.
- AI proposes project-specific KPIs, dashboard configurations, narratives and improvements; humans approve measurement definitions and assumptions.
- Reuse configurable dashboard components rather than generating separate dashboard code per project.
- Support solution, project, client organization, and REKA portfolio views.
- Client-facing insights can initially be reports or data embedded in the existing client dashboard; no second login is required.
- AntaraX Frame may supply infrastructure monitoring; avoid duplicating existing monitoring capability.
- Create reusable Markdown integration instructions to attach to future Claude Code/Codex briefs.

### Proposed engineering defaults (not yet decided)
- REST/JSON over HTTPS, versioned under `/reka-observe/v1` (working name only).
- A JSON measurement manifest plus OpenAPI 3.1 document, with OAuth2 client credentials or scoped service tokens.
- Scheduled pull cadence configurable by endpoint; hourly as an initial example, not a requirement.
- PostgreSQL for configuration and metric aggregates; optional time-series storage as scale demands.
- Multi-tenant data isolation in the schema from day one; defer external billing, marketplace, self-service onboarding.

## 3. Product boundaries
**In scope:** connect integrations; verify endpoints; collect and normalize metrics; maintain baselines; measure impact; build dashboard layouts; generate evidence-backed reports; alert on deteriorating outcomes; suggest improvements; portfolio oversight.

**Out of scope for MVP:** replacing client operational dashboards, full observability/APM stack, unrestricted extraction of client data, autonomous KPI publication without approval, customer-facing billing and subscriptions, general-purpose BI authoring.

## 4. Five measurement domains
| Domain | Examples | Key cautions |
|---|---|---|
| Technical health | uptime, latency, failures, queue depth, job success | Prefer Frame/Grafana integrations when available |
| Usage/adoption | active operators, runs, feature utilization, completed tasks | Avoid equating activity with business value |
| Operational performance | processing time, throughput, rework, exception rate, SLA | Normalize units and periods; control for volume |
| Business impact | hours saved, error reduction, turnaround, avoided costs, service quality | Require baseline, evidence, assumptions and confidence |
| Commercial (optional) | contract value, service cost, margin, renewal risk, client ROI | REKA-only financial data must never leak into client views |

## 5. Entity and tenancy hierarchy
**Tenant** (REKA initially; future AntaraX customer) → **Client organization** → **Project** → **Solution/deployment** → **Integration/endpoint** → **Metric definition** → **Observation**.

Additional entities: baseline, measurement plan, KPI, aggregation rule, report, recommendation, approval, audit event, credential reference, access policy, and report audience.

A project may contain multiple solutions; one organization may have multiple projects. Support separate environments and versions for a solution. Rollups must declare deduplication rules and avoid summing overlapping time-savings or distinct user counts.

## 6. Architecture: six layers
### L1. Development instrumentation
Claude Code/Codex reads a reusable integration brief. It identifies measurable business workflows, proposes metrics, adds lightweight counters/timers or derived read models, and generates a measurement manifest. Instrument only what is necessary; avoid expensive logging of raw user content.

### L2. Standard API contract
Expose a stable, versioned, read-only interface for discovery, metric definitions, aggregated observations and service status. Keep the existing app API untouched. Endpoint names below are **illustrative**.

### L3. Canonical measurement data model
Standardize the **envelope** of a metric (identity, unit, timestamp, dimensions, quality, lineage), not every project's business schema. Permit namespaced custom metrics and dimensions with controlled cardinality.

### L4. Integration and collection
Central connector authenticates, checks capabilities, pulls incremental windows, validates responses, handles pagination/retries/rate limits, normalizes records, stores checkpoints, and records collection health. Offer an adapter for third-party systems that cannot implement the native API.

### L5. Intelligence and impact engine
AI reconciles declared metrics against discovered endpoints, proposes a measurement plan, identifies baseline gaps, suggests formulas and dashboard composition. Deterministic code computes approved KPIs; AI explains findings, uncertainty and possible next actions.

### L6. Presentation and delivery
Config-driven widgets and views for solution, project, organization and REKA portfolio. Publish PDF summaries, shareable restricted reports, and optionally a read-only API or embeddable module inside client dashboards.

## 7. Illustrative API contract
Base path: `/reka-observe/v1` (placeholder; rename during design review).

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/manifest` | Version, solution identity, capabilities, metric catalog URL, available reporting windows |
| GET | `/metrics` | Metric definitions, units, types, supported dimensions, privacy classification |
| GET | `/observations?from=&to=&cursor=` | Aggregated time-bucket observations, cursor pagination |
| GET | `/health` | Monitoring adapter health and freshness (not necessarily full app health) |
| GET | `/baselines` | Optional baseline records with provenance; may instead be managed centrally |

**Sample manifest:**
```json
{
  "schema_version": "1.0.0",
  "solution_id": "client-a-document-workflow",
  "environment": "production",
  "capabilities": ["metrics", "observations", "health"],
  "metric_catalog_version": "2026-10-15",
  "data_policy": {"aggregation": "daily", "contains_personal_data": false},
  "metrics": [
    {"key": "documents.generated", "type": "counter", "unit": "document", "dimensions": ["document_type"]},
    {"key": "documents.generation_duration", "type": "duration", "unit": "second", "aggregation": "mean"}
  ]
}
```

**Sample observation:**
```json
{
  "metric_key": "documents.generated",
  "period_start": "2026-10-14T00:00:00+08:00",
  "period_end": "2026-10-15T00:00:00+08:00",
  "value": 240,
  "unit": "document",
  "dimensions": {"document_type": "invoice"},
  "quality": "measured",
  "source": "application_aggregate"
}
```

**Rules:** TLS required; least-privilege read-only access; secrets in a secret manager; tenant-scoped credentials; explicit retention; consistent time zones (store UTC, preserve local reporting zone); metric catalog versioning; idempotent collection by source/metric/dimension/time window; robust backfill; no customer documents or personal data unless explicitly authorized and needed.

## 8. Measurement plan and impact methodology
Each approved KPI stores: name, business question, formula, unit, data source, baseline period and method, reporting window, owner, target, quality classification, exclusions, aggregation policy and audience.

**Example: document automation**
- Baseline: median manual minutes per document, sampled and approved by client owner.
- Current: measured automated processing time plus estimated human review/correction time.
- Estimated gross hours saved = completed document count × (baseline manual minutes − current total minutes) / 60.
- Report separately: measured document volume; observed machine time; sampled human handling time; modeled savings; assumption range.
- If document complexity or mix changes, segment by document type and complexity instead of applying one flat average.
- Never equate elapsed machine time with human time saved without validation.

**Confidence model:** `measured`, `derived`, `estimated`, `unavailable`; additionally display data freshness, sample size and source provenance. Do not invent a numeric confidence percentage without calibration.

**Impact rollups:** sum only additive, non-overlapping outcomes. For ratios and averages, recompute from weighted numerators/denominators; for unique counts, deduplicate by agreed identity; for financial impact, distinguish savings, avoidance and realized revenue.

## 9. AI workflow with approval gates
1. Developer generates manifest and instrumentation in the client solution.
2. Operator creates organization/project/solution in REKA console.
3. Connector validates credentials and discovers manifest + endpoints.
4. Schema validator checks availability, units, privacy flags and sample records.
5. AI compares declared capabilities with actual observations and suggests KPIs, baselines, visualizations and gaps.
6. REKA PM/analyst approves metric mappings, baselines, formulas, rollup rules and client visibility.
7. Deterministic scheduled computation populates dashboards and drafts periodic reports.
8. AI narrates changes, identifies caveats and recommends next improvements, with citations to source metrics.
9. Human reviews client-facing report before delivery (at least during MVP).
10. Version and audit every approved change.

AI must not silently rewrite approved KPI formulas or claim causal attribution from correlation. Expose missing data clearly.

## 10. UX and dashboard hierarchy
**REKA portfolio:** client/project coverage, data freshness, health, outcome trends, renewal opportunities, unresolved instrumentation gaps, internal service costs where permitted.

**Organization:** cross-project outcomes, strategic KPI summary, period-over-period progress, deduplicated total impact, executive narrative.

**Project:** outcome objectives, contributing solutions, baseline comparison, exceptions, improvement backlog.

**Solution:** usage, technical health, operational KPIs, metric catalog, collector diagnostics, trend detail.

**Administration:** tenants, clients, integrations, service accounts, secrets references, schedules, access policies, report templates, approval queue, audit trail.

**Client delivery:** PDF first; later a secure read-only API and embed SDK to show selected widgets inside an existing client dashboard. No separate client login required for initial deployment.

## 11. Security and governance
- Explicit client agreement/authorization to collect and process performance data; data ownership and residency documented.
- Tenant-level isolation enforced in queries and authorization, not only UI filtering.
- Project-scoped tokens; rotation, revocation, rate limiting, signed audit logs where appropriate.
- Restrict collection to aggregated and minimized operational data; redact sensitive dimensions and secrets.
- RBAC: platform admin, REKA operations, project manager, analyst, client viewer; enforce audience-level metric visibility.
- Encrypt in transit and at rest; track retention/deletion and incident response procedures.
- Protect against prompt injection in manifests, labels and third-party responses; treat all external content as untrusted.
- Separate REKA internal profitability from client-visible ROI.

## 12. Suggested repository documentation layout
```text
/docs/performance-intelligence/
  MASTER_BRIEF.md
  ARCHITECTURE.md
  DATA_MODEL.md
  API_CONTRACT.md
  MEASUREMENT_METHODS.md
  SECURITY_AND_GOVERNANCE.md
  AI_AND_APPROVALS.md
  DASHBOARD_SPEC.md
  IMPLEMENTATION_ROADMAP.md
/integrations/reka-observe/
  CLAUDE_CODE_INTEGRATION.md
  measurement-manifest.schema.json
  openapi.yaml
  example-manifest.json
  test-contract.md
```
The integration pack is the reusable artifact attached to **every new client project brief**. The master brief is primarily for the central platform team.

## 13. Reusable Claude Code / Codex project instruction
> Implement the REKA Performance Intelligence integration as a lightweight, read-only, versioned measurement interface. Do not change the application's domain architecture to fit the monitoring schema. First inspect existing workflows and propose measurable technical, usage, operational and business metrics. Generate a machine-readable manifest with units, descriptions, provenance, privacy classification and supported reporting periods. Implement aggregated metrics endpoints and health/discovery endpoints according to the approved API contract. Do not expose raw client documents, credentials or personal data. Include automated contract tests, sample responses, permissions, data-freshness checks and documentation. If a baseline is not available, declare it missing rather than guessing. Ask for approval before adding expensive instrumentation or changing existing application behavior.

## 14. Phased roadmap
**Phase 0 — Design and pilot selection (1–2 weeks indicative):** choose two dissimilar REKA projects; interview process owners; document baseline availability; lock API/schema v1; establish legal/data access requirements.

**Phase 1 — Internal MVP:** organization/project/solution registry; manifest ingestion; pull connector; normalized observations; approval-based KPI builder; four-tier dashboard; one PDF impact report; audit log and minimal RBAC. Test one document automation and one different workflow.

**Phase 2 — Reliability and automation:** incremental sync/backfill; contract testing SDK; AI KPI discovery; baseline quality; anomaly alerts; report scheduling; Frame health integration.

**Phase 3 — Client experience:** scoped client reports; embeddable widgets/read-only API; organization-level outcome rollups; report feedback loop.

**Phase 4 — AntaraX commercialization:** third-party adapters, tenant self-service, product packaging, billing, usage quotas, integrations catalog, support model.

## 15. MVP acceptance criteria
- Two materially different client applications integrate without changing their primary data model.
- Each app exposes a valid manifest and at least three useful metrics; central service pulls and normalizes both.
- Operator can approve a KPI with baseline provenance and see observed versus estimated impact distinctly.
- The same widget library renders both projects via configuration alone.
- Organization and portfolio views enforce access isolation and avoid double counting.
- A monthly/quarterly client report shows changes, source evidence, caveats and recommended next actions.
- A disconnected or stale API displays an explicit freshness/error state rather than fabricated zeros.
- Contract and authorization tests pass; no secrets or unauthorized raw data appear in outputs.

## 16. Open decisions for next workshop
1. Product name and relationship to AntaraX Frame/AXLE.
2. First two pilot projects, their process owners, and available baseline evidence.
3. Authentication standard, network reachability for privately hosted solutions, and allowable pull schedules.
4. Data residency, contractual permissions, retention and client-facing publication approval.
5. Exact v1 schema, aggregation grain, metric cardinality limits and SDK languages.
6. Whether Frame is authoritative for infrastructure signals or simply a linked provider.
7. Hosting stack and AI model/provider strategy; estimated costs after pilot data volumes are known.
8. Initial report format, branded presentation and client delivery cadence.

## 17. Non-negotiable principles
**Standardize the interface, not the client application. Measure outcomes, not just activity. Compute numbers deterministically; use AI for interpretation. Keep estimates labeled. Require approval before publishing claims. Minimize client instrumentation. Make REKA useful first, AntaraX portable next.**
