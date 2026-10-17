# Performance Intelligence (working name)

REKA's console for measuring what its client AI solutions actually deliver: whether each is healthy and used, how it performs, and what business outcome it produces against an agreed baseline. It starts inside REKA, supporting the Managed AI service's "we watch it, we improve it" promise, and is built so it can graduate to an AntaraX product later.

> **Status, 17 Oct 2026:** lean version 1 is built (docs/GO_LIVE_ENGINEERING.md): connect an application, collect its daily figures, three KPIs against an approved baseline, approvals by a second person, six pages, a monthly report frozen with its hash. Tested end to end against the kit's example application. Not deployed yet: see docs/DEPLOY.md. The clickable mock (`mocks/`) remains the roadmap; every client, person and figure in it is invented.

## What is here

| Path | What it is |
|---|---|
| [docs/PRD.md](docs/PRD.md) | The product requirements: goals, roles, domain model, numbered requirements, the measurement interface, methodology, AI and approval gates, screens, security, stack, release plan, risks and open decisions |
| [docs/MASTER_BRIEF.md](docs/MASTER_BRIEF.md) | The master brief the PRD is built from (version 0.1, 15 Oct 2026), unchanged |
| [mocks/](mocks/README.md) | A clickable product mock: sign-in, first-run setup, connecting a first project, and an established workspace with example data |
| [integrations/measure/](integrations/measure/README.md) | The Measurement Link integration pack for a solution's developer: the agent instruction, the contract test, OpenAPI, examples, signature test vectors and a Python signer. Generated parts come from antarax-api |
| [docs/workshop/PHASE_0_DECISIONS.md](docs/workshop/PHASE_0_DECISIONS.md) | The fifteen open decisions for the design workshop, each with a recommendation, what backs it and what it blocks |
| [docs/research/USABILITY_TEST_PLAN.md](docs/research/USABILITY_TEST_PLAN.md) | Five moderated sessions with REKA project managers on the mock: questions, tasks, script and analysis |

## Run it

```bash
npm install
npm run db:local          # Postgres 16 on :54329; prints the two URLs for .env.local (see .env.example)
STAFF_PASSWORD="a long password" npm run staff:add -- --email you@reka.example --name "Your Name" --role approver
npm run dev               # http://localhost:3200
AX_MEASURE_KEY=<the key the console shows> npm run example-link   # a stand-in application on :4010
```

| Check | Command |
|---|---|
| Typecheck, unit, separation and the whole loop against real Postgres | `npm run check` |
| The loop in a browser, phones and accessibility | `bash scripts/e2e.sh` |

| Code | What it is |
|---|---|
| `app/` | The console (Next.js): sign-in with two-step, Applications and tracking one, an application's page, Results, Approvals, Reports, Jobs, the developer link, the scheduled jobs |
| `domain/` | Pure logic: the KPI engine, link states, the spreadsheet parser, the developer prompt |
| `lib/` | Database access inside a scope, sealing, audit, sign-in, and the services the pages call |
| `db/migrations/` | The schema, row-level security and the append-only audit |
| `vendor/lapisan/` | The Measurement Link kit, copied from antarax-api; never edited here |

## Read in this order

1. The PRD's [§1 Summary](docs/PRD.md#1-summary) and [§5 Principles](docs/PRD.md#5-principles).
2. Open the mock: `mocks/index.html` in a browser (no build step), or `python3 -m http.server -d mocks` and visit `http://localhost:8000`.
3. The PRD's [§20 Open decisions](docs/PRD.md#20-open-decisions): what the owner needs to settle before Phase 1.

## How it lines up with the other repositories

| Repository | What this product takes from it |
|---|---|
| `haziqfaris/AntaraX-brand-kit` | Names, claims rules, type, colour, the AI sparkle, report conventions. The kit wins where they disagree |
| `haziqfaris/AntaraX-Dashboard-kit` | The AXLE standard (`axle/SPEC.md`): shell, roles, "never a false zero", attention first, audit |
| `haziqfaris/antarax-api` | The API contract (paths, names, lists, errors, money, time), AXLE Link signing and the registry |
| `haziqfaris/antarax-ai` | Positioning: Managed AI, the REKA and AntaraX boundary, the claims rules for anything public |

## Name

"Performance Intelligence" is the brief's working name. The brand kit does not allow a family name (Ripple) as a product name, so this repository's name is not a product name. The PRD proposes "Outcomes" as the area inside AXLE for now; see [PRD §6.2](docs/PRD.md#62-name).

Private. Owned by REKA Inisiatif Sdn Bhd.
