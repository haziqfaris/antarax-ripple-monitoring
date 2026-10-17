// The spreadsheet source (V-15): the path that needs no developer. The template's figures are fixed when the
// application is created, so the standard KPIs work at once; uploads go through the same checks and storage.
import type { Tx } from "../db";
import { audit } from "../audit";
import { parseCsv, csvTemplate } from "../../domain/csv";
import { linkState } from "../../domain/link-state";
import { addDays, localDay } from "../../domain/format";
import { need, Refused, type StaffActor } from "./actor";
import { inAppScope } from "./scope";

export const sheetKeys = (unitPlural: string) => {
  const base = unitPlural.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "") || "items";
  return { volume: `${base}.processed`, corrections: `${base}.returned_for_correction`, machine: `${base}.machine_seconds` };
};

/** Called when a spreadsheet application is created: its catalog and mapping, fixed. */
export async function setUpSheet(tx: Tx, org: string, appId: string, unitSingular: string, unitPlural: string): Promise<void> {
  const k = sheetKeys(unitPlural);
  const rows: [string, string, string, string, string][] = [
    [k.volume, "counter", "item", `${unitPlural} handled`, `${unitPlural} the application finished in the day`],
    [k.corrections, "counter", "item", "Returned for correction", `${unitPlural} a person sent back to be fixed`],
    [k.machine, "duration", "second", "Machine time", `Average machine seconds per ${unitSingular}`],
  ];
  for (const [key, type, unit, label, description] of rows)
    await tx`insert into metrics (organisation_id, application_id, key, type, unit, label, description, aggregation) values (${org}, ${appId}, ${key}, ${type}, ${unit}, ${label}, ${description}, ${type === "duration" ? "mean" : null})`;
  await tx`update applications set volume_metric = ${k.volume}, corrections_metric = ${k.corrections}, machine_metric = ${k.machine}, setup_step = 4 where id = ${appId}`;
}

export async function sheetTemplate(appId: string): Promise<string> {
  return inAppScope(appId, async (tx) => {
    const ms = await tx<{ key: string }[]>`select key from metrics where application_id = ${appId} and state = 'active' order by key`;
    return csvTemplate(ms.map((m) => m.key), addDays(localDay(Date.now()), -1));
  });
}

export async function uploadSheet(actor: StaffActor, appId: string, text: string, now = Date.now()) {
  need(actor, "operator");
  if (text.length > 2_000_000) throw new Refused("The file is too large: at most 2 MB.");
  return inAppScope(appId, async (tx, org) => {
    const [app] = await tx<{ source: string; name: string; volume_metric: string | null }[]>`select source, name, volume_metric from applications where id = ${appId}`;
    if (app?.source !== "sheet") throw new Refused("This application shares its figures through its link, not a spreadsheet.");
    const known = new Set((await tx<{ key: string }[]>`select key from metrics where application_id = ${appId} and state = 'active'`).map((r) => r.key));
    const [o] = await tx<{ time_zone: string }[]>`select time_zone from organisations where id = ${org}`;
    const today = localDay(now, o!.time_zone);
    const { rows, problems } = parseCsv(text, known, today);
    const [run] = await tx<{ id: string }[]>`insert into collection_runs (organisation_id, application_id, kind) values (${org}, ${appId}, 'upload') returning id`;
    if (problems.length) {
      await tx`update collection_runs set finished_at = now(), status = 'failed', error = ${problems.slice(0, 3).join(" ")} where id = ${run!.id}`;
      return { stored: 0, problems };
    }
    for (const r of rows)
      await tx`insert into observations (organisation_id, application_id, metric_key, local_period, dim_key, dimensions, value, source)
        values (${org}, ${appId}, ${r.metric}, ${r.day}, '', '{}', ${r.value}, 'spreadsheet_upload')
        on conflict (application_id, metric_key, local_period, dim_key) do update set value = excluded.value, source = excluded.source, collected_at = now()`;
    const [last] = await tx<{ d: string | null }[]>`select max(local_period)::text as d from observations where application_id = ${appId} and metric_key = ${app.volume_metric}`;
    const st = linkState({ connected: true, health: "ok", lastDay: last?.d ?? null, yesterday: addDays(today, -1) });
    await tx`update integrations set state = ${st.state}, state_why = ${st.why}, last_success_at = now(), last_attempt_at = now(), state_since = case when state = ${st.state} then state_since else now() end where application_id = ${appId}`;
    await tx`update collection_runs set finished_at = now(), status = 'ok', days_read = ${new Set(rows.map((r) => r.day)).size}, observations_read = ${rows.length} where id = ${run!.id}`;
    await audit(tx, { actor, org, action: "Uploaded figures from a spreadsheet", subject: app.name, after: { rows: rows.length } });
    return { stored: rows.length, problems: [] as string[] };
  }, actor.id);
}
