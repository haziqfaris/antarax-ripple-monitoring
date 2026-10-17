# Going live: the engineering work

**Draft, 17 Oct 2026.** The code needed to take Outcomes (Performance Intelligence, working name) from the clickable mock to the Phase 1 internal MVP in [PRD §18](PRD.md#18-release-plan), and to pass the MVP acceptance in §18.1. Code only: pilot selection, data agreements, legal review and training are left out, except where an open decision blocks code (section 2).

Each task has an id (`E-…`) so it can become a ticket, the PRD requirements it delivers, and a rough size: **S** up to 3 days, **M** about a week, **L** two weeks or more, for one engineer. Sizes are estimates for planning, not commitments.

## 1 Where it stands

| What | State | Use it as |
|---|---|---|
| `mocks/` (about 4,000 lines of plain JavaScript, simulated data) | Every screen and flow, tested at 1440px and 390px by 23 Playwright scripts | **The specification**, not code to ship. Rebuild each page from it; port the scripts as end-to-end tests |
| `docs/PRD.md` v0.8 | Requirements, data model (§7), contract (§9), stack (§15.2), retention (§16) | The source of every task below |
| Measurement Link 1.1.0 (`antarax-api`: docs/14, `packages/lapisan-core/src/measure`) | Written and tested: kit, signing, checks, OpenAPI, contract test, optional `/capacity` | Vendor it; never rewrite it (antarax-api AGENTS rule 15) |
| `integrations/measure/` | The pack a developer gets: contract test CLI, examples, Claude Code instruction | Ship as is; the console links to it |
| AXLE standard v1.0 (`AntaraX-Dashboard-kit`) | HTML mocks, `tokens.css`, SPEC §19 release checks; **no React components yet** | Copy `tokens.css`; build the shell components here, then offer them back to the kit |
| `antarax-api` (`@lapisan/core`, `@lapisan/postgres`, `apps/console`) | Next.js 16 and React 19 conventions, door, service signing, AXLE Link, Postgres migrations | Match its stack, tooling and conventions |
| Production code for Outcomes | **None** | Everything in section 4 |

## 2 Decisions that block code

These need the owner before the code that depends on them is merged. Everything else can start now.

| Decision (PRD §20) | Blocks | Default if not decided by then |
|---|---|---|
| D1 product id | The registry entry (E-002), every id prefix | `outcomes`, as the PRD proposes |
| D3, D4 sign-off of Measurement Link (decision 0013) | Turning on real collection (E-030) | Keep it proposed; build against 1.1.0 |
| D5 residency and retention periods | Retention jobs (E-016) | §16 periods, Singapore |
| D7 hosting and AI provider | Infrastructure (E-003) | §15.2: Vercel `sin1`, Supabase Singapore, Anthropic |
| D16 Ask logging and retention | Ask logs (E-074) | 90 days, staff only |
| D20 who reads client context | Row-level policy on context (E-012, E-091) | All staff with the Support rung |
| D21 speech to text | Voice-note transcripts (E-093) | Attach and play only, no transcript |
| D2 place in AXLE Central | Outcomes' own AXLE Link (E-125) | Its own host; Link built in Phase 2 |

## 3 Shape of the code

One TypeScript repository (this one), following `antarax-api`:

```
apps/console        Next.js (App Router, server components), the AXLE shell and every page
apps/worker         Scheduled and queued work: collector, compute, reports, AI jobs, retention
packages/domain     Pure logic, no I/O: KPI formulas, rollups, measures, kinds of work, validation rules
packages/db         SQL migrations, row-level policies, typed queries, seed data
packages/ui         AXLE shell and components built on tokens.css
vendor/lapisan      Tagged copy of @lapisan/core (measure kit, service signing, AXLE Link)
integrations/       The developer pack (exists)
mocks/              The specification (exists, kept until the console replaces it)
```

Rules carried over: Web Crypto only; zod at every boundary; money as strings with a currency; times stored in UTC; vitest for units; Playwright for end to end.

## 4 Workstreams

### 4.1 Foundations

| Id | Task | PRD | Size |
|---|---|---|---|
| E-001 | Repository scaffold as section 3: workspaces, TypeScript project references, lint, format, vitest, Playwright, `npm run check` | §15.2 | M |
| E-002 | Registry pull request to `antarax-api`: product id, id prefixes (§7.3), the `ax_msr_` key kind from proposed to active once D3 and D4 are signed | §15.3 | S |
| E-003 | Environments: development, staging, production. Vercel project in `sin1`; Supabase in Singapore; secrets in the platform store; preview deploys on pull requests | §15.2, §14 | M |
| E-004 | CI: typecheck, lint, unit, database tests against a real Postgres, end to end on the preview, axe on every page, secret scanning, dependency audit | NFR-5, A8 | M |
| E-005 | Error, list and time conventions from antarax-api 03: one error shape, the list shape with `next`, UTC storage with zone shown | NFR-7 | S |
| E-006 | Structured logging, error tracking, request ids; nothing logs a key, a signature or a context attachment's text | §14, NFR-8 | S |

### 4.2 Data model and database

| Id | Task | PRD | Size |
|---|---|---|---|
| E-010 | Migrations for the domain model: tenant, workspace (real or demo), organisation, project, solution, environment, integration, metric definition (versioned with the catalog), observation (partitioned by month), KPI and KPI version, baseline (with provenance and range), approval, report and report version, custom measure, client context and attachment, staff and rights, audit | §7, NFR-2 | L |
| E-011 | Commercial data (fees, contract, run cost) in its own tables, readable only with the Commercial right | §14 | S |
| E-012 | Row-level security on `tenant_id` and `organisation_id` for every table; service roles for the worker only | §14 | M |
| E-013 | Audit as append-only: insert-only grants, before and after values, reason, actor; export | §14, FR-APR | M |
| E-014 | Isolation tests in CI: one organisation's scope cannot read another's, the client audience never reads commercial or context tables, a demo workspace never reads a real one | A5, §14 | M |
| E-015 | Seed: the five example organisations from `mocks/data.js` as a demo workspace, labelled example | §8.16 | S |
| E-016 | Retention jobs per §16: observations reduced to monthly totals after 25 months, logs and AI outputs after 90 days, voice recordings, demo workspaces; deletion of an organisation under the two-person rule | §16, §14 | M |

### 4.3 Staff, sign-in and rights

| Id | Task | PRD | Size |
|---|---|---|---|
| E-020 | Staff sign-in with two-step verification (Supabase Auth or the shared AntaraX staff identity if one exists by then); session timeout; sign-out everywhere | §4 | M |
| E-021 | The AXLE rung ladder plus the Measurement, Approve and Commercial rights, enforced on the server for every read and action; disabled controls say what they need | §4.2, D12 | M |
| E-022 | Separation of duties: whoever proposed or edited an item cannot approve it; the two-person rule for deleting data and for personal-data metrics | FR-APR, §14 | S |
| E-023 | Organisation view (client audience) enforced on the server: fees, notes, client context, unapproved items and capacity never reach the response | §12, FR-CTX-3 | M |

### 4.4 Integrations and collection

The heart of the product. Built on the vendored measure kit; nothing re-implements signing, paging or checks.

| Id | Task | PRD | Size |
|---|---|---|---|
| E-030 | Integration records and keys: mint `ax_msr_` keys, show once, store sealed in the secret store; rotation with `AX_MEASURE_KEY_NEXT`; revocation | §9.5 | M |
| E-031 | Connection test (the wizard's "Test it now"): manifest, metrics, health and seven days of observations through the kit's checks; results in words, as the mock shows | FR-ONB, §9.7 | M |
| E-032 | Scheduler and queue: `pg_cron` enqueues; a worker takes one job per integration so a slow source never delays others; checkpoints so an outage catches up without loss; retries back off and honour `Retry-After`; pause and resume with a reason | FR-COL-1, 3, 4, 8, NFR-3, NFR-4 | L |
| E-033 | Nightly collection: the last seven days re-read, new days added, at most 92 days a call, corrected days replace earlier values, backfill on request in windows | §9, FR-COL-2, 6, 7 | M |
| E-034 | Health every 15 minutes; states on time, late, not answering, not connected; a missing day is a gap, never a zero | FR-COL-5, A7 | M |
| E-035 | Validator: units, dimensions (20 values, no personal data), the contract's rules; a changed `metric_catalog_version` opens a mapping review in Approvals instead of changing figures | §9.3, FR-BP-5 | M |
| E-036 | Nightly contract test per link, its result on Measurement links (R8) | §9.7 | S |
| E-037 | Spreadsheet source: the CSV template from the wizard, upload, validation, same observations | FR-ONB-9 | M |
| E-038 | Simulator source for demo workspaces: per kind-of-work profiles, events, a clock per workspace, through the same validator | §15.1a | M |
| E-039 | Optional capacity summary: read `/capacity` when the manifest lists it, show it read-only on the Capacity tab, raise nothing | §8.20 | S |
| E-040 | AXLE Link adapter for AntaraX products (usage, health), reading, never re-measuring | FR-INT-8 | M (Phase 2) |

### 4.5 Compute

Deterministic, versioned, reproducible. Every published number comes from here, never from AI.

| Id | Task | PRD | Size |
|---|---|---|---|
| E-050 | KPI engine in `packages/domain`: counters summed, ratios recomputed from their parts, durations re-weighted from sum and count, distinct counts never added, money per currency; formulas from a closed set of operations, previewed before approval | §9.4, FR-KPI-3, 4 | L |
| E-051 | Baselines and hours saved: the formula, machine time never counted as a person's, the likely range from the baseline's spread, estimates labelled; a change to an approved KPI or baseline is a new version | §10.2, §10.3, FR-KPI-5, 7 | M |
| E-052 | Rollups to project, organisation and portfolio without counting the same work twice (overlap groups) | A5, §10.4 | M |
| E-053 | The measure library and its catalog version; your own measures (sum, ratio, per, value) with preview and approval | §10.6, §8.13 | M |
| E-054 | Kinds of work, departments and units as versioned configuration, not code | §10.5a, FR-KIND | S |
| E-055 | Precomputed values per day and period so dashboards read, never calculate (2 s on a 4G phone) | NFR-1 | M |
| E-056 | Reproducibility: store the inputs, formula version and baseline version behind every published figure; recompute when a day is recomputed | NFR-9 | M |
| E-057 | Golden tests: the mock's example figures (for example Contoh Logistik's hours saved) reproduced to the unit | A3 | S |

### 4.6 Approvals and audit

| Id | Task | PRD | Size |
|---|---|---|---|
| E-060 | Approval objects for KPIs, baselines, mapping changes, measures, requested figures, client visibility and reports; one state machine (waiting, blocked, approved, changes asked, declined); reason required; undo within the toast window | FR-APR | M |
| E-061 | Approval effects: a KPI starts counting, a baseline applies from its date, a report freezes, a measure goes live; each in the audit with before and after | FR-APR, §14 | M |
| E-062 | Scoped queue: per organisation, waiting first, the next waiting item in the same organisation after a decision | FR-APR-6 | S |

### 4.7 The console

Rebuild each page from `mocks/`, as server components reading precomputed data. The organisation scope is one value in the address (`?org=`) and a cookie, read by every page (AXLE §19 "Links").

| Id | Task | PRD | Size |
|---|---|---|---|
| E-070 | `packages/ui`: the shell (dark top bar with the AXLE tag, the 240px sidebar with the Outcomes-only box grouped Track, Report, Understand; the Dashboard and R8 switch; folding groups; the phone drawer) on `tokens.css` | §12.1, §12.2 | L |
| E-071 | Components: drawn dropdowns and calendar on an accessible headless library (React Aria or Radix) styled with tokens, never the browser's own; fields; lists with search, filter, sort, group, bulk action and export; state pills; the "never a false zero" dash with its reason | FR-ONB-9g, AXLE §9 | L |
| E-072 | Charts with a table view for each, gaps shown as gaps, estimates hatched | NFR-5 | M |
| E-073 | Pages, each with the scope picker where the mock has one: Overview (all and scoped), Applications, Approvals, Results (organisation, project, application with the Outcomes, Measures, Explore, Blueprint, Usage, Health, Data and Capacity tabs), Reports, Analytics, Client context, Ask, Organisations and the account page, Settings, Demo, Audit, Staff | §12.4 | L (several) |
| E-074 | Track an application: the six-step wizard and "Sent for approval", several at once, each resuming where it was; state saved on the server, not the browser | FR-ONB-9 to 9j | L |
| E-075 | The developer prompt generated per application (from the integration instruction, kinds of work and department), copy and `.md` download; the developer link page | FR-ONB-9c, 9e | M |
| E-076 | The blueprint: data model and topology drawn from the manifest and what Outcomes keeps, `.md` with Mermaid | §8.19 | M |
| E-077 | R8 pages: Overview, Incidents, Troubleshoot, Jobs, Providers, Services, Configuration, Operations audit, Measurement links, Capacity | AXLE §10 | L |
| E-078 | Find (⌘K) across organisations, applications, reports and pages, respecting rights | AXLE §6 | M |
| E-079 | Port the 23 mock Playwright scripts into end-to-end tests against the console: the tour, wizard, exit and resume, blueprint, kinds of work, scoping on every page, dropdowns, Ask, client context, capacity | A-all | L |

### 4.8 AI

Anthropic API, structured outputs, every call logged with count, latency and cost. AI proposes and explains; it never produces a published number.

| Id | Task | PRD | Size |
|---|---|---|---|
| E-080 | AI service wrapper: model and key from configuration, structured outputs, timeouts, cost per call, an off switch (Settings), demo workspaces included | §11, NFR-8 | M |
| E-081 | KPI proposals from a manifest and the application's kind of work; "Suggest" from one sentence in the wizard (replaces the mock's word matching) | §11.1, FR-KIND | M |
| E-082 | Report narratives with a number check: every number in the text must match a computed value or the draft is blocked | §11.2, FR-RPT-2 | M |
| E-083 | Explore: ideas ranked from the catalog and the organisation's client context, quoting context by role and date, never inventing figures | §8.17, FR-CTX-10 | M |
| E-084 | Ask: tool calls into the compute service, scoped to one organisation or application, answers cite their sources, never claim a cause; questions logged per D16 | §8.14, §11.4, FR-ASK-1 to 9 | L |
| E-085 | Untrusted text as data: project names, manifests and client context passed in delimited blocks, never as instructions; tests with injection strings | §11.3 | S |
| E-086 | Evaluation sets for proposals, narratives, Explore and Ask, run in CI on a schedule, with pass thresholds | §17 | M |

### 4.9 Reports

| Id | Task | PRD | Size |
|---|---|---|---|
| E-090 | Report templates per project (month or quarter), drafted at period end from computed values and the narrative; review, edit and approve | FR-RPT-1 to 3 | M |
| E-091 | Frozen PDF from the same components (server-side Chromium), hashed and stored; the light AntaraX layout, "Run by REKA as part of Managed AI." | FR-RPT-3, 4 | M |
| E-092 | Evidence footnotes for every figure, estimates labelled, caveats and next steps | FR-RPT-5 | S |
| E-093 | Reports page scoped per organisation, ready to review first | FR-RPT-10 | S |
| E-094 | Delivery by e-mail (Resend) to the agreed audience, switched off in demo workspaces at the service layer | FR-RPT-6 | S (Phase 2) |

### 4.10 Client context

| Id | Task | PRD | Size |
|---|---|---|---|
| E-100 | Entries per organisation: kind, source, role (never a name), date, what it is about, tags, AI use; scoped page and the results tab | §8.18 | M |
| E-101 | Attachments in private Singapore storage: signed links that expire in minutes, a malware scan on upload, size and count limits | FR-CTX-12, §15.2 | M |
| E-102 | Reading attachments with Claude (documents, photos); personal details hidden in what was read; the read text stored with the entry | FR-CTX-13 | M |
| E-103 | Voice notes: recording and upload; transcripts once D21 picks a provider | FR-CTX-13 | S, then M |
| E-104 | REKA only, enforced: never in organisation view, reports, exports or the client audience's AI inputs | FR-CTX-3 | S |

### 4.11 Demo workspaces

| Id | Task | PRD | Size |
|---|---|---|---|
| E-110 | Demo workspaces in the data model with the same isolation; every outbound channel (e-mail, delivery, share links) off in the service layer | §8.16, §14 | M |
| E-111 | Demo studio: simulated clock, events, the guided demo | §8.16 | M |

### 4.12 Running Outcomes itself

Outcomes is a product too: it gets its own R8 and capacity, like every AntaraX product.

| Id | Task | PRD | Size |
|---|---|---|---|
| E-120 | Collection health and §17 measures: coverage, freshness, time to connect, approval latency, report cycle, AI acceptance | §17 | M |
| E-121 | Alerts: a link not answering, late figures, a failed job, a blocked narrative; Needs a person, the bell, e-mail | §8.10 | M |
| E-122 | `capacity.json` for Outcomes, the nightly snapshot, the outside availability check, R8 → Capacity | AXLE §10.13 | M |
| E-123 | Backups to R2 and a tested restore | §15.2 | S |
| E-124 | Security headers and content security policy, rate limits on the console and the developer link page, dependency updates | §14 | S |
| E-125 | Outcomes' own AXLE Link (tenants, usage, health) for AXLE Central | D2 | M (Phase 2) |

### 4.13 Pilot integrations (in the pilots' own repositories)

| Id | Task | PRD | Size |
|---|---|---|---|
| E-130 | Measurement Link in pilot application 1, from the pack: adapter only, the contract test passing on staging then production | A1, A2 | M |
| E-131 | The same in pilot application 2, of a different kind of work | A1, A2 | M |

## 5 Order

Rough sequence for two to three engineers. Weeks overlap; the console work runs alongside from week 3.

| Weeks | Milestone | Tasks |
|---|---|---|
| 1 to 3 | **Foundations**: the repository, environments, schema, isolation, sign-in and rights | E-001 to E-006, E-010 to E-016, E-020 to E-023 |
| 3 to 6 | **Collection**: keys, connection test, scheduler, nightly collection, health, validator, spreadsheet, simulator | E-030 to E-039 |
| 4 to 8 | **Compute and approvals**: the KPI engine, baselines, rollups, measures, precomputed values, approvals | E-050 to E-062 |
| 3 to 11 | **Console**: shell and components first, then pages in the order of the tour: wizard, applications, approvals, results, reports, the rest | E-070 to E-079 |
| 7 to 11 | **AI, reports, client context, demo** | E-080 to E-111 |
| 10 to 12 | **Running it**: health, alerts, capacity, backups, hardening | E-120 to E-124 |
| 8 to 13 | **Pilots connect**, then acceptance | E-130, E-131 |

## 6 Done means (go-live gate)

Every check passes on production, with both pilots connected:

- **MVP acceptance A1 to A8** (PRD §18.1), each with the evidence named there.
- **AXLE §19 checks that apply to Outcomes**: Real numbers, Organisation life, Lists, Audit, Rights, Links, Phone, Collapsed groups, R8 switch, R8 jobs, R8 providers, R8 capacity, R8 AI flow, R8 troubleshoot, R8 safety, Backend exists, Look. (Invitation, Tickets and Support session apply once organisations sign in, Phase 3.)
- **Isolation and commercial separation tests** green (E-014, E-023).
- **No browser-default control** on any page; axe clean on every page; every page usable at 390px.
- **End-to-end suite** (E-079) green on staging and production.
- **AI evaluation sets** at their thresholds; a narrative with a wrong number is blocked.
- **Restore drill** done from backup.
- **Nothing in the console invents data**: every example figure is gone from real workspaces, and demo workspaces say they are simulated.

## 7 Not in the MVP

Phase 2 and later, from §18: AXLE Link adapter (E-040), scheduled report e-mail (E-094), Outcomes' own AXLE Link (E-125), anomaly alerts, third-party adapters, share links, read-only API and embed, Bahasa Malaysia reports, organisation sign-in, tenant self-service and billing.
