# Instruction: add a Measurement Link to this solution

For Claude Code, Codex or a developer. It is the master brief's §13 instruction, made specific to the contract as written (antarax-api docs/14, proposed).

## The job

Add a lightweight, read-only, versioned measurement interface so REKA's Outcomes can collect this solution's daily figures. **Do not change the application's domain model, its API, or its behaviour to fit the measurement schema.** Read from what the app already records.

## Steps

1. **Inspect first.** Read the app's main workflows and where it already records events, jobs, documents, runs or reviews. Propose, in a short list for a person to approve, the metrics you would share, in four groups: health (failed runs, latency), usage (people using it, each counted once), operations (items handled, time per item, items sent back for a person to fix), and business impact (the counts the client's outcome depends on). For each: key, type, unit, plain-words description, dimensions, and where the number comes from. **Stop and ask before** adding instrumentation that costs real time or money (new tables, new logging on hot paths, background jobs).
2. **Write the catalog.** Keys are two to four lower-case words joined by dots (`documents.generated`). Types: `counter`, `gauge` (say `last` or `mean`), `duration` (say `mean`, `median` or `p90`; send `count` and `sum` too), `ratio` (name its `numerator` and `denominator` counters), `distinct` (name its `identity`, such as `operator`), `money` (unit is the currency code, value a string). Units: `item`, `document`, `page`, `request`, `run`, `message`, `task`, `person`, `second`, `minute`, `hour`, `day`, `percent`, `byte`, or `x.<name>`. At most five dimensions per metric and 20 values per dimension; dimension values are short lower-case codes (`invoice`), never free text.
3. **Build the endpoints** under `/internal/measure/v1`: `manifest`, `metrics`, `observations`, `health`, `openapi.json` (and `baselines` only if the app already holds "before" figures with evidence, and `capacity` only if it has a `capacity.json`, step 9).
   - TypeScript: use the kit (`measureLink` from antarax-api `packages/lapisan-core/src/measure`, see README). You write the adapter only.
   - Otherwise: follow `openapi.json` and `examples/`, and check signatures as `reference/python/measure_sign.py` does.
4. **Daily figures, done right.**
   - One observation per metric per **finished** local day, in the client's time zone, with the day's UTC bounds.
   - Always the day's total (`dimensions: {}`), plus one per dimension value.
   - **A day with no figures is left out, never sent as zero.**
   - Use aggregate queries over the app's own records; never move raw rows out.
5. **Never expose** document text, file contents, credentials, names, email addresses, phone numbers, identity card numbers, account numbers or anything about one person. `privacy` is always `aggregate`; `contains_personal_data` is always `false`.
6. **Signing.** Every call carries `AntaraX-Service: measure`, `AntaraX-Timestamp` and `AntaraX-Service-Signature`. Check it against `AX_MEASURE_KEY` (and `AX_MEASURE_KEY_NEXT` during a rotation). Answer any failure with one plain 401 `invalid_signature`, and answer 404 everywhere while no key is set. Never log the key or the signature header.
7. **Errors** are `{ "error": { "code", "message", "request_id" } }` with `invalid_request` (422), `invalid_cursor` (400), `invalid_signature` (401), `not_found` (404), `rate_limited` (429), `unavailable` (503) or `internal` (500). Every answer has `Cache-Control: no-store` and `X-Request-Id: req_…`. Unknown query parameters are refused.
8. **Freshness.** `/health` gives each metric's last complete day. Say `degraded` with a named problem (`aggregates_late`) rather than serving a partial day.
9. **Baselines.** If there is no trustworthy "before" figure, say so in your handover. **Do not guess one.**
   **Capacity, optional.** Only if the app has a `capacity.json` and its nightly capacity check already writes snapshots; otherwise skip this and say so in the handover. Add `GET /capacity` (with the kit, the adapter's `capacity(now)`), read-only from the latest snapshots: each resource's `id`, `class` and `how` exactly as `capacity.json` has them, `used`, `limit`, `per` (`none`, `day` or `month`), `percent`, `runway_days`, `measured_at`, and `why_not` when `how` is `none`; plus the outside check's summary, or `null`. Measure nothing new for it. **Never** include a cost, price, plan name, provider account or credential: costs live in AX Frame. The app's own AXLE watches capacity in full; this only explains Outcomes' results. Shape: `examples/capacity.json`.
10. **Test.** Add the app's own unit tests for the adapter's queries. Then run the contract test against the running interface until there is no FAIL:
    `AX_MEASURE_KEY=… node contract-test/cli.mjs --base <url>/internal/measure/v1`
11. **Hand over** a short note: the metrics and where each comes from, what you chose not to share and why, any baseline you found (with evidence) or that none exists, whether capacity is shared, the contract test's output, and how to rotate the key.

## Done means

- The contract test passes with no FAIL against staging, and against production once the key is set there.
- The app's own behaviour, API and data model are unchanged, apart from the new read-only routes and any approved instrumentation.
- No personal data leaves the app.
