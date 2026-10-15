# Performance Intelligence (working name)

REKA's console for measuring what its client AI solutions actually deliver: whether each is healthy and used, how it performs, and what business outcome it produces against an agreed baseline. It starts inside REKA, supporting the Managed AI service's "we watch it, we improve it" promise, and is built so it can graduate to an AntaraX product later.

> **Status:** product requirements draft 0.1 and a first clickable mock, 15 Oct 2026. Nothing is built yet. Every organisation, person and figure in the mock is invented.

## What is here

| Path | What it is |
|---|---|
| [docs/PRD.md](docs/PRD.md) | The product requirements: goals, roles, domain model, numbered requirements, the measurement interface, methodology, AI and approval gates, screens, security, stack, release plan, risks and open decisions |
| [docs/MASTER_BRIEF.md](docs/MASTER_BRIEF.md) | The master brief the PRD is built from (version 0.1, 15 Oct 2026), unchanged |
| [mocks/](mocks/README.md) | A clickable mock of six screens, built to the AXLE standard, with example data |

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
