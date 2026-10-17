// The developer prompt (V-22): the integration pack's instruction (integrations/measure/CLAUDE_CODE_INTEGRATION.md)
// made specific to one application. Copied, or downloaded as .md, and sent to the developer or to Claude Code.
import { slug } from "./format";

export interface PromptInput {
  app: string;
  org: string;
  unitSingular: string;
  unitPlural: string;
  objective: string;
  devLink: string;
  timeZone: string;
}

export function devPrompt(p: PromptInput): string {
  const nk = p.unitPlural.replace(/\s+/g, "_").toLowerCase(), unit = p.unitSingular.replace(/\s+/g, "_").toLowerCase();
  const id = slug(`${p.org} ${p.app}`);
  return `# Add a Measurement Link to ${p.app}

You are adding a small, read-only measurement interface to ${p.app}, an application REKA built and runs for ${p.org}. One piece of its work is a ${p.unitSingular}.${p.objective ? ` What it is for: "${p.objective}"` : ""} REKA's Outcomes console will call it every night to collect daily totals, so ${p.org} can see what the application changed. Nothing Outcomes calls may change the application.

Get the integration pack from the developer link (${p.devLink}). It holds the contract (openapi.json), worked examples, a TypeScript kit, a Python signer, test vectors and the contract test. Read its CLAUDE_CODE_INTEGRATION.md first: this prompt is that instruction, made specific to ${p.app}.

## Ground rules
- Read-only: GET routes under /internal/measure/v1 only.
- Do not change the application's data model, its API or its behaviour. Read from what it already records.
- Aggregates only. Never expose document text, file contents, credentials, names, email addresses, phone numbers, identity card or account numbers, or anything about one person.
- Stop and ask before anything that costs real time or money: new tables, new logging on hot paths, background jobs.

## 1. Inspect, then propose (stop here for approval)
Find where ${p.app} already records ${p.unitPlural}, reviews and errors. Reply with a table for a person to approve: key, type, unit, description, dimensions, and the table or log each number comes from. A starting catalog:

| Key | Type | Unit | Means |
|---|---|---|---|
| ${nk}.processed | counter | x.${unit} | ${p.unitPlural} the application finished in the day |
| ${nk}.returned_for_correction | counter | x.${unit} | ${p.unitPlural} a person sent back to be fixed |
| ${nk}.processing_duration | duration (mean; send count and sum) | second | Machine time per ${p.unitSingular} |
| reviewers.active | distinct (identity: operator) | person | People who reviewed at least one ${p.unitSingular}, each counted once |
| runs.failed | counter | run | Runs that failed and needed a person |

Use only what ${p.app} really records. If a figure can't be worked out from existing data, say so; don't invent it. Keys are two to four lower-case words joined by dots. If the unit is one of item, document, page, request, run, message, task or person, use it instead of x.${unit}.

## 2. Build the endpoints
Every answer is JSON with Cache-Control: no-store and X-Request-Id: req_…
- GET /manifest: solution_id "${id}", solution_name "${p.app}", environment, time_zone "${p.timeZone}", metric_catalog_version (a date), capabilities, and every metric.
- GET /metrics, GET /observations?from=&to=&metric= (daily, oldest first, at most 92 days a call, paged), GET /health, GET /openapi.json.
- GET /baselines only if ${p.app} already holds "before" figures with evidence.
Unknown query parameters: 422 invalid_request. Any other path: 404 not_found.

TypeScript: use measureLink(adapter, { key, nextKey }) from the kit and write only the adapter (describe, observations, health). Other languages: follow openapi.json and examples/, and check signatures as reference/python/measure_sign.py does.

## 3. Daily figures, done right
- One observation per metric per finished day in ${p.timeZone}, with the day's UTC bounds.
- Always the day's total with dimensions {}, plus one per dimension value (at most 5 dimensions, 20 short lower-case values each).
- Never serve today. A day with no figures is left out: never send zero for a day that wasn't counted.

## 4. Signing
Every call carries AntaraX-Service: measure, AntaraX-Timestamp and AntaraX-Service-Signature: v1=<hex HMAC-SHA256>, keyed with AX_MEASURE_KEY (ax_msr_…, given to you once by REKA). During a rotation also accept AX_MEASURE_KEY_NEXT. Refuse anything else with one plain 401 invalid_signature. While no key is set, answer 404 everywhere. Never log the key. Keep it in the application's secret store.

## 5. Test
Run the contract test against the running interface until there is no FAIL:
  AX_MEASURE_KEY=… node contract-test/cli.mjs --base <url>/internal/measure/v1
Then paste the base address into the developer link. Outcomes runs the same checks and connects.

## Optional: a capacity summary
Only if ${p.app} has a capacity.json and its capacity check already writes snapshots: add GET /capacity as docs/14 §14.5a says. Never send a cost. Otherwise skip it.

## Hand over
A short note in the pull request: each metric and where it comes from; what you chose not to share and why; any trustworthy "before" figure you found (how long a ${p.unitSingular} took by hand, with evidence) or that none exists; the contract test output.

## Done means
- The contract test passes with no FAIL on staging, then on production.
- ${p.app}'s behaviour, API and data model are unchanged, apart from the new read-only routes.
- No personal data leaves ${p.app}.
`;
}
