# Going live: lean version 1

**Draft, 17 Oct 2026, rewritten the same day as the lean version 1 at the owner's request.** The code needed to put Outcomes (Performance Intelligence, working name) in front of two pilot organisations, and no more. Code only: pilot selection, data agreements, legal review and training are left out, except where an open decision blocks code (section 2).

## Status, 17 Oct 2026

**Built and tested in this repository:** V-01 and V-03 to V-30. The registry entry (V-04) is in `antarax-api`. Tests: 19 unit, 27 database (separation, sign-in links and the full loop), 7 browser end to end (desktop and 390px, axe clean). The backup and restore drill passed against a local database. How to deploy: `docs/DEPLOY.md`.

**Not done, because it needs something outside the code:**

- **V-02 environments.** Needs the Vercel and Supabase accounts; the steps are in `docs/DEPLOY.md`.
- **V-31, V-32 the pilots' Measurement Links.** Need D9 and the pilots' repositories.
- **Collecting from a real pilot.** The `ax_msr_` key stays proposed until D3 and D4 are signed.

**Different from the plan:** sign-in is built here (an e-mailed link, then an authenticator code, as PRD §4.3 asks), not Supabase Auth, so the console needs only Postgres and Resend. There is no hosted CI (V-03): no GitHub Actions, by the owner's choice. The checks run locally before pushing, and each Vercel deployment runs the typecheck and unit tests first. The PRD's worked example low figure is corrected to 593 h.

## 1 What version 1 is

**One loop, done properly:** connect an application, collect its daily figures, work out a few KPIs against a baseline, have a second person approve them, show them, and produce a monthly report.

Everything else in the PRD and the mock waits until a pilot shows it is needed (section 7). The mock and the PRD stay as the roadmap.

**Kept, even though lean**, because without them the numbers can't be trusted or the product can't be sold:

- **Separation between organisations**, enforced in the database and tested. One client seeing another's figures ends the product.
- **Signed, read-only connections.** Already built: the Measurement Link kit and contract test in `antarax-api`.
- **A second person approves baselines and reports**, because "hours saved" is a claim made to a client.
- **Never a false zero.** A missing day is a gap; a link that stops answering says so.

**Effort.** About **24 engineer-weeks** for sections 4.1 to 4.8: roughly **12 to 13 weeks with two engineers**, including the overhead of working in parallel. Each pilot's own Measurement Link (4.9) is about a week of its developer's time, in its own repository. Sizes: **S** half a week, **M** a week, **L** two weeks, for one engineer. These are planning estimates, not commitments.

For comparison, the full plan this replaces came to about 80 engineer-weeks. Its 13-week timeline assumed more people than it said.

## 2 Decisions that block code

| Decision (PRD §20) | Blocks | Default if not decided by then |
|---|---|---|
| D9 the two pilots | Their KPIs and baselines (V-16, V-17), the end-to-end test (V-30), V-31 and V-32 | None: version 1 needs two named pilot applications |
| D1 product id | The registry entry (V-04), id prefixes | `outcomes` |
| D3, D4 Measurement Link sign-off (decision 0013) | Collecting from a real pilot (V-12) | Build and test against 1.1.0; switch on when signed |
| D7 hosting | Environments (V-02) | Vercel `sin1`, Supabase Singapore (§15.2) |

## 3 Shape of the code

One Next.js application, not a set of services. Scheduled work runs as cron routes in the same deployment.

```
app/                Pages and route handlers (AXLE shell, six pages, cron routes for collection and health)
domain/             Pure logic, no I/O: KPI formulas, baselines, hours saved, validation
db/                 SQL migrations, row-level policies, typed queries
vendor/lapisan/     Tagged copy of @lapisan/core: measure kit, service signing
integrations/       The developer pack (exists)
mocks/              The specification and the roadmap (exists)
```

House rules carried over from `antarax-api`: TypeScript, Web Crypto only, zod at every boundary, times stored in UTC, money as strings with a currency, vitest and Playwright.

## 4 The tasks

### 4.1 Foundations

| Id | Task | Size |
|---|---|---|
| V-01 | Scaffold as section 3: Next.js, TypeScript, lint, format, vitest, Playwright, `npm run check`; vendor the measure kit | M |
| V-02 | Staging and production in Singapore (Vercel `sin1`, Supabase); secrets in the platform store; preview deploys | S |
| V-03 | CI: typecheck, lint, unit tests, database tests on real Postgres, the end-to-end test (V-30), axe on the six pages | S |
| V-04 | Registry pull request to `antarax-api`: product id, id prefixes, the `ax_msr_` key kind made active once D3 and D4 are signed | S |

### 4.2 Data

| Id | Task | Size |
|---|---|---|
| V-05 | Schema: organisation, application, integration, metric (with its catalog version), observation, KPI and version, baseline and version, approval, report and version, staff, audit. Observations as one indexed table (partition when NFR-2 needs it) | M |
| V-06 | Row-level security on `organisation_id` for every table; isolation tests in CI (one organisation's scope cannot read another's) | M |
| V-07 | Audit, append-only: who, what, when, reason, before and after | S |

No fees, contracts or running costs are stored in version 1, so there is nothing commercial to protect yet.

### 4.3 Sign-in and roles

| Id | Task | Size |
|---|---|---|
| V-08 | Staff sign-in with two-step verification; three roles enforced on the server: **viewer** (reads), **operator** (connects, proposes, drafts), **approver** (approves) | M |
| V-09 | Separation of duties: whoever proposed or edited an item cannot approve it | S |

### 4.4 Collection

| Id | Task | Size |
|---|---|---|
| V-10 | Integrations and keys: create an `ax_msr_` key, show it once, store it sealed; rotate with the next key; revoke | M |
| V-11 | Connection test: manifest, metrics, health and seven days of observations through the kit's own checks, with the result in words | S |
| V-12 | Nightly collection (cron route): each integration on its own, so one failure never stops the rest; the last seven days re-read; history filled in on first connection; retries that honour `Retry-After` | M |
| V-13 | Health check every hour; states on time, late, not answering, not connected; a missing day is a gap, never a zero | S |
| V-14 | A changed metric catalog: new or changed metrics are held and flagged for an operator, never silently counted | S |
| V-15 | Spreadsheet source: the CSV template, upload, the same validation. The path that needs no developer, so a pilot can start with it | M |

### 4.5 KPIs

| Id | Task | Size |
|---|---|---|
| V-16 | KPI engine for three standard KPIs per application (work handled, share needing correction, hours saved), plus one or two per pilot set as configuration from the same operations (sum, ratio, per). Ratios recomputed from their parts, durations re-weighted, distinct counts never added | M |
| V-17 | Baselines with method, evidence and range; hours saved with its likely range, labelled an estimate; machine time never counted as a person's; a change makes a new version | M |
| V-18 | Organisation totals: hours added across its applications. Version 1 assumes applications don't overlap, and the PRD's overlap groups come later | S |
| V-19 | Golden tests: the mock's worked example (§10.3) reproduced to the unit | S |

### 4.6 Approvals

| Id | Task | Size |
|---|---|---|
| V-20 | Approvals for an application's KPI set, its baseline and each report: a reason required, approve, ask for changes or decline; an approved KPI starts counting; all in the audit | M |

### 4.7 Console

Six pages, rebuilt from the mock's look on the AXLE tokens. Scoping is one organisation filter.

| Id | Task | Size |
|---|---|---|
| V-21 | Shell: the AXLE top bar and sidebar with only version 1's pages; `tokens.css`; dropdowns and fields from an accessible headless library (React Aria or Radix) styled with the tokens, never the browser's own | M |
| V-22 | **Applications**, and adding one: organisation (or a new one, with its data agreement confirmed), the application's name and kind of work, the developer prompt (copy and `.md`), the connection test or a spreadsheet, the KPIs, the baseline, sent for approval | L |
| V-23 | **Application page**: KPI cards, a trend with a table view, its state and last collection, the baseline behind hours saved | M |
| V-24 | **Organisations** and one organisation's **results**: its applications, total hours saved, what needs a person | M |
| V-25 | **Approvals**: the queue, filtered by organisation | S |
| V-26 | **Reports**: a monthly report per application drafted from the computed figures, edited and approved by a person (no AI); the approved version frozen as HTML with a hash and printed to PDF from the browser | M |

### 4.8 Running it

| Id | Task | Size |
|---|---|---|
| V-27 | An e-mail (Resend) when a link stops answering or figures are late | S |
| V-28 | Backups and one restore drill; security headers; a rate limit on the developer link page | S |
| V-29 | A simple **Jobs** page for staff: last collection per integration, failures, run again | S |
| V-30 | End-to-end test of the loop against the pack's example server: add an organisation and an application, connect, collect, approve KPIs and baseline, see the figures, approve a report | M |

### 4.9 Pilots (in their own repositories)

| Id | Task | Size |
|---|---|---|
| V-31 | Pilot application 1: Measurement Link from the pack (adapter only); contract test passing on staging, then production. Or the spreadsheet route | M |
| V-32 | Pilot application 2, a different kind of work: the same | M |

## 5 Order

Two engineers; rows that overlap run in parallel.

| Weeks | What | Tasks |
|---|---|---|
| 1 to 3 | Foundations, schema, separation, sign-in | V-01 to V-09 |
| 3 to 6 | Collection and the spreadsheet source | V-10 to V-15 |
| 3 to 9 | Console, starting with the shell and adding an application | V-21 to V-25 |
| 5 to 8 | KPIs, baselines, approvals | V-16 to V-20 |
| 8 to 11 | Reports, alerts, jobs, backups, the end-to-end test | V-26 to V-30 |
| 6 to 11 | Pilots connect (their developers) | V-31, V-32 |
| 11 to 13 | Fixes from the pilots, then the gate (section 6) | |

## 6 Done means

On production, with both pilots connected:

| # | Check (from PRD §18.1) | In version 1 |
|---|---|---|
| A1 | Two different applications connected without changing their data model | Yes |
| A2 | Each shares at least three useful figures, collected and checked nightly | Yes |
| A3 | A KPI approved with its baseline's evidence; measured and estimated parts shown apart | Yes |
| A4 | Both pilots shown by the same pages, by configuration alone | Yes |
| A5 | Separation between organisations; no double counting | Separation yes; overlap groups later (V-18) |
| A6 | A monthly report with changes, evidence, caveats and next steps | Yes, written by a person |
| A7 | A stopped link shows as stopped, never as a zero | Yes |
| A8 | Contract and authorisation tests pass; no secret or raw data in outputs | Yes |

Also: the end-to-end test (V-30) green on production, axe clean on the six pages, every page usable at 390px, and the restore drill done.

## 7 Later, when a pilot needs it

Each comes back from the roadmap (the PRD and the mock) when it earns its place, in roughly this order.

| What | Bring it back when |
|---|---|
| Scheduled report e-mail; PDF rendered on the server | Reports go out every month to several people |
| KPI suggestions and report narratives by AI, with the number check | Drafting by hand takes too long |
| Measure library and your own measures | A pilot asks for a figure the standard KPIs don't cover, twice |
| Overlap groups in rollups | Two applications at one organisation handle the same work |
| Analytics; scoping on every page; Find | More than about five organisations |
| Ask and Explore | Staff keep asking questions the pages don't answer |
| Client context, with attachments and voice notes | Account managers start keeping notes elsewhere |
| Demo workspaces, the simulator, Demo studio, the guided demo | Selling to new organisations, not just running pilots |
| Fees, contracts and running costs (the Commercial right) | Margin needs tracking per organisation |
| The R8 pages and Outcomes' own capacity file | Outcomes joins AXLE Central, or collection outgrows the Jobs page |
| Capacity summary, blueprint, several applications being set up at once | Applications arrive faster than one at a time |
| Retention jobs (§16) | Before the first period ends: collector run logs at 90 days, observations at 25 months |
| AXLE Link adapter; Outcomes' own AXLE Link | An AntaraX product is measured, or Central exists |
