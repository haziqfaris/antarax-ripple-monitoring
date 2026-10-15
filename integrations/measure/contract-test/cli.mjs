#!/usr/bin/env node
// Measurement Link contract test. Generated into the integration pack by
// antarax-api's scripts/build-measure-pack.mjs; do not edit the copy.
//
//   AX_MEASURE_KEY=ax_msr_... node cli.mjs --base https://your-app.example/internal/measure/v1
//   node cli.mjs --example            the invented example solution, in memory
//   options: --days 7 (1 to 92), --json (the report as JSON)
//
// Node 20 or later. No dependencies. Exits 1 when a check fails.

import { checkMeasureLink, exampleAdapter, formatCheckReport, measureLink, newMeasureKey } from "./lib/measure/index.js";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (flag("help") || (!flag("example") && !value("base"))) {
  console.log("Usage: AX_MEASURE_KEY=ax_msr_... node cli.mjs --base <https://host/internal/measure/v1> [--days 7] [--json]\n       node cli.mjs --example");
  process.exit(flag("help") ? 0 : 2);
}

const days = Number(value("days") ?? 7);
let options;
if (flag("example")) {
  const key = newMeasureKey();
  const link = measureLink(exampleAdapter(), { key, onRefused: () => {} });
  options = { base: "https://example.invalid/internal/measure/v1", key, fetch: (r) => link(r), days };
} else {
  const key = process.env.AX_MEASURE_KEY ?? "";
  if (!/^ax_msr_[A-Za-z0-9]{32}$/.test(key.trim())) {
    console.error("Set AX_MEASURE_KEY to the integration's measurement key (ax_msr_ and 32 characters). Outcomes shows it once, when the integration is made.");
    process.exit(2);
  }
  options = { base: value("base"), key: key.trim(), days };
}

try {
  const report = await checkMeasureLink(options);
  console.log(flag("json") ? JSON.stringify(report, null, 2) : formatCheckReport(report));
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(`Could not finish the check: ${error instanceof Error ? error.message : error}`);
  console.error("Is the address right, and can this machine reach it?");
  process.exit(2);
}
