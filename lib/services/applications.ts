import { newMeasureKey } from "../../vendor/lapisan/measure/index";
import { randomString, sha256Hex } from "../../vendor/lapisan/crypto";
import { inScope, type Tx } from "../db";
import { seal } from "../seal";
import { audit } from "../audit";
import { need, Refused, type StaffActor } from "./actor";
import { inAppScope } from "./scope";
import { plural } from "../../domain/format";

export interface ApplicationRow {
  id: string; organisation_id: string; name: string; project_name: string; objective: string;
  unit_singular: string; unit_plural: string; source: "link" | "sheet";
  stage: "set_up" | "waiting" | "collecting" | "paused"; setup_step: number;
  volume_metric: string | null; corrections_metric: string | null; machine_metric: string | null;
  paused_reason: string | null; created_at: Date;
}
export interface IntegrationRow {
  id: string; application_id: string; base_url: string | null; key_hint: string; next_key_sealed: string | null;
  state: "not_connected" | "on_time" | "late" | "not_answering"; state_since: Date; state_why: string | null;
  solution_id: string | null; time_zone: string | null; catalog_version: string | null;
  last_success_at: Date | null; last_attempt_at: Date | null; last_health_at: Date | null; last_test: unknown;
  dev_token_expires_at: Date | null;
}

const DEV_LINK_DAYS = 14;
export const keyHint = (k: string) => `ax_msr_…${k.slice(-4)}`;

export async function newDevToken(): Promise<{ token: string; hash: string; expires: Date }> {
  const token = randomString(32);
  return { token, hash: await sha256Hex(token), expires: new Date(Date.now() + DEV_LINK_DAYS * 86_400_000) };
}

/** V-22, V-10: an application, its integration and a measurement key. The key and the developer link are returned once. */
export async function createApplication(actor: StaffActor, input: { orgId: string; name: string; project: string; objective?: string; unit: string; source: "link" | "sheet" }) {
  need(actor, "operator");
  const key = newMeasureKey();
  const dev = await newDevToken();
  const unit = input.unit.trim().toLowerCase() || "item";
  return inScope({ org: input.orgId }, async (tx) => {
    const [org] = await tx<{ id: string; agreement_confirmed_at: Date | null }[]>`select id, agreement_confirmed_at from organisations where id = ${input.orgId}`;
    if (!org) throw new Refused("No such organisation", "not_found");
    if (!org.agreement_confirmed_at) throw new Refused("Confirm the organisation's data agreement first. Nothing is collected before it.");
    const [app] = await tx<{ id: string }[]>`insert into applications (organisation_id, name, project_name, objective, unit_singular, unit_plural, source, setup_step, created_by)
      values (${input.orgId}, ${input.name.trim()}, ${input.project.trim()}, ${input.objective?.trim() ?? ""}, ${unit}, ${plural(unit)}, ${input.source}, 3, ${actor.id}) returning id`;
    await tx`insert into integrations (organisation_id, application_id, key_sealed, key_hint, dev_token_hash, dev_token_expires_at)
      values (${input.orgId}, ${app!.id}, ${await seal(key)}, ${keyHint(key)}, ${dev.hash}, ${dev.expires})`;
    if (input.source === "sheet") {
      const { setUpSheet } = await import("./sheet");
      await setUpSheet(tx, input.orgId, app!.id, unit, plural(unit));
    }
    await audit(tx, { actor, org: input.orgId, action: "Started tracking an application", subject: input.name, after: { project: input.project, unit, source: input.source } });
    return { appId: app!.id, key, devToken: dev.token };
  }, actor.id);
}

export async function getApplication(appId: string) {
  return inAppScope(appId, async (tx) => {
    const [app] = await tx<ApplicationRow[]>`select * from applications where id = ${appId}`;
    const [integration] = await tx<IntegrationRow[]>`select id, application_id, base_url, key_hint, next_key_sealed, state, state_since, state_why, solution_id, time_zone, catalog_version, last_success_at, last_attempt_at, last_health_at, last_test, dev_token_expires_at from integrations where application_id = ${appId}`;
    const [org] = await tx<{ id: string; name: string; short_name: string; time_zone: string }[]>`select id, name, short_name, time_zone from organisations where id = ${app!.organisation_id}`;
    const metrics = await tx<{ key: string; type: string; unit: string; label: string | null; description: string; state: string; held_why: string | null; since: string | null; dimensions: string[] }[]>`
      select key, type, unit, label, description, state, held_why, since, dimensions from metrics where application_id = ${appId} order by key`;
    return { app: app!, integration: integration!, org: org!, metrics };
  });
}

export async function listApplications(orgId?: string | null) {
  return inScope(orgId ? { org: orgId } : "all", (tx) => tx<(ApplicationRow & { org_short: string; state: IntegrationRow["state"]; last_success_at: Date | null; base_url: string | null })[]>`
    select a.*, o.short_name as org_short, i.state, i.last_success_at, i.base_url
    from applications a join organisations o on o.id = a.organisation_id join integrations i on i.application_id = a.id
    order by case a.stage when 'set_up' then 0 when 'waiting' then 1 when 'collecting' then 2 else 3 end, a.name`);
}

async function setStep(tx: Tx, appId: string, step: number): Promise<void> {
  await tx`update applications set setup_step = greatest(setup_step, ${step}) where id = ${appId} and stage = 'set_up'`;
}
export { setStep };

/** The figures that feed the standard KPIs (V-16). */
export async function setMapping(actor: StaffActor, appId: string, m: { volume: string; corrections: string | null; machine: string | null }) {
  need(actor, "operator");
  return inAppScope(appId, async (tx, org) => {
    const rows = await tx<{ key: string; type: string }[]>`select key, type from metrics where application_id = ${appId} and state = 'active'`;
    const types = new Map(rows.map((r) => [r.key, r.type]));
    if (types.get(m.volume) !== "counter") throw new Refused("Work handled must be a count the application shares.");
    if (m.corrections && types.get(m.corrections) !== "counter") throw new Refused("Corrections must be a count the application shares.");
    if (m.machine && types.get(m.machine) !== "duration") throw new Refused("Machine time must be a duration the application shares.");
    const [before] = await tx`select volume_metric, corrections_metric, machine_metric from applications where id = ${appId}`;
    await tx`update applications set volume_metric = ${m.volume}, corrections_metric = ${m.corrections}, machine_metric = ${m.machine} where id = ${appId}`;
    await setStep(tx, appId, 5);
    await audit(tx, { actor, org, action: "Chose the figures for the standard KPIs", subject: appId, before, after: m });
  }, actor.id);
}

export async function pauseApplication(actor: StaffActor, appId: string, reason: string, pause: boolean) {
  need(actor, "operator");
  if (reason.trim().length < 3) throw new Refused("Give a reason. It goes in the audit trail.");
  return inAppScope(appId, async (tx, org) => {
    const [a] = await tx<{ stage: string; name: string }[]>`select stage, name from applications where id = ${appId}`;
    if (pause) await tx`update applications set stage = 'paused', paused_reason = ${reason} where id = ${appId}`;
    else {
      const ready = await approvedSetup(tx, appId);
      await tx`update applications set stage = ${ready ? "collecting" : "set_up"}, paused_reason = null where id = ${appId}`;
    }
    await audit(tx, { actor, org, action: pause ? "Paused collection" : "Resumed collection", subject: a!.name, reason });
  }, actor.id);
}

/** Collecting needs an approved KPI set and an approved baseline. */
export async function approvedSetup(tx: Tx, appId: string): Promise<boolean> {
  const [r] = await tx<{ k: number; b: number }[]>`select (select count(*)::int from kpis where application_id = ${appId} and status = 'approved') as k,
    (select count(*)::int from baselines where application_id = ${appId} and status = 'approved') as b`;
  return !!r && r.k > 0 && r.b > 0;
}

export async function newDeveloperLink(actor: StaffActor, appId: string): Promise<string> {
  need(actor, "operator");
  const dev = await newDevToken();
  await inAppScope(appId, async (tx, org) => {
    await tx`update integrations set dev_token_hash = ${dev.hash}, dev_token_expires_at = ${dev.expires} where application_id = ${appId}`;
    await audit(tx, { actor, org, action: "Made a new developer link", subject: appId });
  }, actor.id);
  return dev.token;
}
