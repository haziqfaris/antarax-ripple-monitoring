# Measurement Link integration pack

Everything a developer needs to add a **Measurement Link** to a solution, so Outcomes (Performance Intelligence) can collect its daily figures: what to build, a kit that builds most of it, examples, and the test to run before handing over.

> **Status: proposed.** The contract is written and tested (antarax-api [docs/14](https://github.com/haziqfaris/antarax-api/blob/claude/practical-thompson-qsu01b/docs/14-measurement-link.md), [decision 0013](https://github.com/haziqfaris/antarax-api/blob/claude/practical-thompson-qsu01b/docs/decisions/0013-measurement-link.md)). It waits on the owner's decisions D3 and D4 (PRD §20). Build against it for pilots; the shapes will only change additively.

## What you build

Read-only `GET` endpoints at `/internal/measure/v1` on the solution's own host, separate from its API:

| Path | Answers |
|---|---|
| `/manifest` | The solution, its time zone, and every metric it shares |
| `/metrics` | Every metric definition, as a list |
| `/observations?from=&to=` | Daily figures for finished local days, at most 92 days per call |
| `/health` | `ok`, `degraded` or `down`, and each metric's last complete day |
| `/baselines` | Optional: baselines the solution already holds, with evidence |
| `/capacity` | Optional: a read-only capacity summary, only for an application with a `capacity.json` (below) |
| `/openapi.json` | The interface's OpenAPI document (this pack's `openapi.json`) |

Every call is signed by Outcomes with the integration's key, `ax_msr_…`, which Outcomes shows once when the solution is connected. Keep it as a secret, `AX_MEASURE_KEY`. Daily totals only: never document text, names or anything about one person.

## Capacity, optional

Only for an application that already has a `capacity.json` and a nightly capacity check (AntaraX-Dashboard-kit `capacity/`). Skip it otherwise: nothing else changes.

Outcomes is about outcomes. The application's own AXLE watches capacity in full and raises the warnings; `/capacity` only feeds a short read-only summary beside the results. It serves the latest snapshots the capacity check already takes, measures nothing new, takes no parameters, and never carries a cost, price, plan name, provider account or credential (costs live in AX Frame). With the kit, add `capacity: async (now) => …` to the adapter; the manifest then lists `capacity`. The shape is in `examples/capacity.json` and antarax-api docs/14, 14.5a.

## Start here

1. Give your coding agent [`CLAUDE_CODE_INTEGRATION.md`](CLAUDE_CODE_INTEGRATION.md), or read it yourself. It is the whole job in one page.
2. **TypeScript** (Next.js, Workers, Appwrite, Node): use the kit. Copy `packages/lapisan-core/src/measure/` and `packages/lapisan-core/src/crypto.ts` from `haziqfaris/antarax-api` into your app, keeping `measure/` next to `crypto.ts`. Write one adapter (`describe`, `observations`, `health`) over your own data and mount `measureLink(adapter, { key: () => env.AX_MEASURE_KEY })` on `/internal/measure/v1/*`. The kit does the signing check, paging, time zones, error shapes, and refuses to serve figures that break the contract.
3. **Any other language**: build the endpoints from `openapi.json` and `examples/`, and check signatures as [`reference/python/measure_sign.py`](reference/python/measure_sign.py) does. Prove your signer with `test-vectors.json`.
4. **Run the contract test** against your running interface, and fix every FAIL:

```sh
AX_MEASURE_KEY=ax_msr_... node contract-test/cli.mjs --base https://your-app.example/internal/measure/v1
node contract-test/cli.mjs --example    # what a passing run looks like
```

Node 20 or later, nothing to install. `--days 30` reads more history; `--json` prints the report as JSON. Outcomes runs the same checks when it connects the solution, and every night after.

## What's here

| Path | What it is | Edit? |
|---|---|---|
| `README.md`, `CLAUDE_CODE_INTEGRATION.md` | This guide and the agent instruction | Yes, here |
| `reference/python/measure_sign.py` | The signature in Python, checked against the vectors | Yes, here |
| `contract-test/` | The contract test CLI, and the compiled kit it runs (`lib/`) | No: generated |
| `openapi.json` | OpenAPI 3.1 for the interface | No: generated |
| `examples/` | Real answers from the kit serving an invented example solution | No: generated |
| `test-vectors.json` | Signatures to check a signer against. The key in it is an example | No: generated |
| `PACK.json` | Which antarax-api commit the generated files came from | No: generated |

The generated files come from antarax-api, so they can't drift from the kit. To refresh them, in a checkout of `haziqfaris/antarax-api` next to this repository:

```sh
npm ci && npm run measure:pack -- ../antarax-ripple-monitoring/integrations/measure
```
