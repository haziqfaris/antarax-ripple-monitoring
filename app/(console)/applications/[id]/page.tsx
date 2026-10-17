import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, readOnce } from "@/lib/auth/session";
import { getApplication } from "@/lib/services/applications";
import { inAppScope } from "@/lib/services/scope";
import { appResults } from "@/lib/services/results";
import { listReports } from "@/lib/services/reports";
import { METHOD_WORDS } from "@/lib/services/kpis";
import { Refused } from "@/lib/services/actor";
import { atLeast } from "@/lib/auth/roles";
import { env } from "@/lib/env";
import { devPrompt } from "@/domain/prompt";
import { standardKpis } from "@/domain/kpi";
import { addDays, dayLabel, localDay, momentLabel, monthLabel, monthStart, nf, prevMonth } from "@/domain/format";
import { SelectField, DateField, Submit, CopyButton } from "../../../_components/controls";
import { KpiCard, Notice, PageHead, StagePill, StatePill, Trend, sp } from "../../../_components/ui";
import * as A from "./actions";

export const metadata = { title: "Application" };

const OPS = [{ id: "sum", label: "Total of a count" }, { id: "ratio", label: "Share: one count out of another (%)" }, { id: "per", label: "One figure per another" }, { id: "mean_duration", label: "Average time" }, { id: "daily_average", label: "Average a day (people, levels)" }];

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const q = await searchParams;
  let data: Awaited<ReturnType<typeof getApplication>>;
  try { data = await getApplication(id); } catch (e) { if (e instanceof Refused) notFound(); throw e; }
  const { app, integration: i, org, metrics } = data;
  const op = atLeast(actor.role, "operator");
  const days = Number(sp(q.w) ?? 30) === 7 ? 7 : Number(sp(q.w)) === 90 ? 90 : 30;
  const to = addDays(localDay(Date.now(), org.time_zone), -1), from = addDays(to, -(days - 1));
  const results = await inAppScope(id, (tx) => appResults(tx, id, from, to));
  const prev = await inAppScope(id, (tx) => appResults(tx, id, addDays(from, -days), addDays(from, -1)));
  const reports = (await listReports(org.id)).filter((r) => r.application_id === id);
  const once = await readOnce<{ appId: string; key?: string; devToken?: string; nextKey?: string }>();
  const shown = once?.appId === id ? once : null;
  const active = metrics.filter((m) => m.state === "active"), held = metrics.filter((m) => m.state === "held");
  const opt = (types: string[]) => active.filter((m) => types.includes(m.type)).map((m) => ({ id: m.key, label: m.label ? `${m.label} (${m.key})` : m.key }));
  const base = env().APP_URL.replace(/\/+$/, "");
  const devLink = shown?.devToken ? `${base}/dev/${shown.devToken}` : null;
  const prompt = devPrompt({ app: app.name, org: org.name, unitSingular: app.unit_singular, unitPlural: app.unit_plural, objective: app.objective, devLink: devLink ?? `${base}/dev/…`, timeZone: org.time_zone });
  const hasKpis = results.kpis.length > 0;
  const steps = [
    ["Connect", metrics.length > 0],
    ["Figures", !!app.volume_metric],
    ["KPIs", results.kpis.some((k) => k.kpi.status === "waiting" || k.kpi.approved)],
    ["Baseline", !!results.baseline && results.baseline.status !== "draft"],
    ["Approved", app.stage === "collecting" || (app.stage === "paused" && results.kpis.some((k) => k.kpi.approved))],
  ] as const;
  const now = steps.findIndex(([, d]) => !d);
  const finishedMonths: string[] = [];
  for (let m = prevMonth(monthStart(localDay(Date.now(), org.time_zone))), n = 0; n < 6; m = prevMonth(m), n++) if (!results.since || m >= monthStart(results.since)) finishedMonths.push(m);
  const linkWord = app.source === "sheet" ? "Spreadsheet" : null;
  // Once it counts, setting up folds away under the results; it opens by itself when a figure needs a decision.
  const settled = app.stage === "collecting" || (app.stage === "paused" && results.kpis.some((k) => k.kpi.approved));
  const setup = (
    <>
      {app.source === "link" ? (
        <section className="card" id="connect" aria-labelledby="c-h">
          <div className="card-head"><div><h2 id="c-h">1. Connect</h2><p className="sub">Why: the application shares its daily totals through a small, signed, read-only link. Nothing Outcomes calls can change it.</p></div></div>
          <details><summary>The prompt for the developer, or Claude Code</summary><div className="code" style={{ marginTop: 10 }} tabIndex={0} role="region" aria-label="The prompt">{prompt}</div></details>
          <div className="row"><CopyButton text={prompt} label="Copy the prompt" /><a className="btn sm" href={`/applications/${id}/prompt.md`}>Download .md</a>
            {op ? <form action={A.devLinkAction}><input type="hidden" name="id" value={id} /><Submit small>Make a new developer link</Submit></form> : null}</div>
          <p className="small muted">Key {i.key_hint}{i.dev_token_expires_at ? ` · developer link works until ${momentLabel(i.dev_token_expires_at)}` : ""}</p>
          {op ? <form action={A.testAction} className="row" style={{ alignItems: "end" }}>
            <input type="hidden" name="id" value={id} />
            <div className="field" style={{ flex: 1, minWidth: 260 }}><label htmlFor="base">The application’s address</label><input className="input mono" id="base" name="base" defaultValue={i.base_url ?? ""} placeholder="https://app.example.com/internal/measure/v1" required /></div>
            <Submit primary={!metrics.length}>Test the connection</Submit>
          </form> : null}
          {i.last_test ? <TestResult t={i.last_test as TestT} /> : null}
        </section>
      ) : (
        <section className="card" id="connect" aria-labelledby="c-h">
          <h2 id="c-h">1. Upload figures</h2>
          <p className="sub">Why: a spreadsheet needs no developer. One row per finished day; an empty cell is a missing day, never a zero.</p>
          <div className="row"><a className="btn sm" href={`/applications/${id}/template.csv`}>Download the template</a></div>
          {op ? <form action={A.uploadAction} className="row" style={{ alignItems: "end" }} encType="multipart/form-data">
            <input type="hidden" name="id" value={id} />
            <div className="field" style={{ flex: 1, minWidth: 260 }}><label htmlFor="file">The filled-in template (.csv)</label><input className="input" id="file" name="file" type="file" accept=".csv,text/csv" required /></div>
            <Submit primary={!results.trend.some((p) => p.value !== null)}>Upload</Submit>
          </form> : null}
        </section>
      )}

      {metrics.length ? (
        <section className="card" id="figures" aria-labelledby="f-h">
          <h2 id="f-h">2. Its figures</h2>
          <p className="sub">Why: the standard KPIs are worked out from these. Only figures in use are counted; a new or changed one waits for a decision.</p>
          {held.length ? held.map((m) => (
            <div key={m.key} className="callout warn"><div className="grow"><b className="mono">{m.key}</b> · {m.held_why} · {m.type}, {m.unit}<br /><span className="small">{m.description}</span>
              {op ? <form action={A.heldAction} className="row" style={{ marginTop: 8 }}><input type="hidden" name="id" value={id} /><input type="hidden" name="key" value={m.key} />
                <input className="input" name="reason" placeholder="Why" required minLength={3} style={{ maxWidth: 280 }} /><Submit small name="decision" value="accept">Count it</Submit><Submit small name="decision" value="drop">Leave it out</Submit></form> : null}</div></div>)) : null}
          <div className="table-wrap"><table><thead><tr><th>Figure</th><th>Kind</th><th>Split by</th><th>State</th></tr></thead>
            <tbody>{metrics.map((m) => <tr key={m.key}><td><span className="name">{m.label ?? m.key}</span><span className="cell-sub mono">{m.key}</span></td><td className="small">{m.type} · {m.unit}</td><td className="small">{m.dimensions.length ? m.dimensions.join(", ").replace(/_/g, " ") : "–"}</td><td><span className={`pill ${m.state === "active" ? "ok" : m.state === "held" ? "warn" : ""}`}>{m.state === "active" ? "Counted" : m.state === "held" ? "Waiting for a decision" : "Not used"}</span></td></tr>)}</tbody></table></div>
          {op && app.source === "link" ? <form action={A.mappingAction} className="form">
            <input type="hidden" name="id" value={id} />
            <div className="fields">
              <SelectField name="volume" label={`Which counts the ${app.unit_plural} handled?`} options={opt(["counter"])} defaultValue={app.volume_metric} required />
              <SelectField name="corrections" label="Which counts those sent back for correction? (optional)" options={[{ id: "none", label: "None" }, ...opt(["counter"])]} defaultValue={app.corrections_metric ?? "none"} />
              <SelectField name="machine" label="Which is the machine’s time per item? (optional)" options={[{ id: "none", label: "None" }, ...opt(["duration"])]} defaultValue={app.machine_metric ?? "none"} hint="Never counted as a person’s time saved." />
            </div>
            <div><Submit primary={!app.volume_metric}>Use these figures</Submit></div>
          </form> : null}
        </section>
      ) : null}

      {app.volume_metric ? (
        <section className="card" id="kpis" aria-labelledby="k-h">
          <h2 id="k-h">3. KPIs</h2>
          <p className="sub">Why: KPIs are what the organisation sees in its report. The three standard ones, and up to two of the application’s own, made from the same operations.</p>
          <ul className="small">{standardKpis({ volume: app.volume_metric, corrections: app.corrections_metric, machine: app.machine_metric, unitPlural: app.unit_plural }).map((k) => <li key={k.code}><b className="strong">{k.name}</b> · {k.formula.op.replace("_", " ")}</li>)}</ul>
          {results.kpis.length ? <p className="small muted">Now: {results.kpis.map((k) => `${k.kpi.name} (${k.kpi.approved ? "approved" : k.kpi.status === "waiting" ? "waiting for approval" : "draft"}, version ${k.kpi.version})`).join(" · ")}</p> : null}
          {op ? <form action={A.kpiAction} className="form">
            <input type="hidden" name="id" value={id} />
            <details><summary>Add the application’s own KPIs (optional, at most two)</summary>
              {[1, 2].map((n) => <fieldset key={n} className="fields" style={{ border: "1px solid var(--axle-card-line)", borderRadius: 14, padding: 14, marginTop: 10 }}>
                <legend className="small strong">Own KPI {n}</legend>
                <div className="field"><label htmlFor={`c${n}_name`}>Name</label><input className="input" id={`c${n}_name`} name={`c${n}_name`} maxLength={80} placeholder="Runs that needed a person" /></div>
                <SelectField name={`c${n}_op`} label="Worked out as" options={OPS} defaultValue="sum" />
                <SelectField name={`c${n}_a`} label="Figure" options={[{ id: "none", label: "Choose" }, ...opt(["counter", "duration", "distinct", "gauge"])]} defaultValue="none" />
                <SelectField name={`c${n}_b`} label="Out of, or per (shares and per only)" options={[{ id: "none", label: "None" }, ...opt(["counter", "gauge"])]} defaultValue="none" />
                <div className="field"><label htmlFor={`c${n}_unit`}>Unit shown</label><input className="input" id={`c${n}_unit`} name={`c${n}_unit`} maxLength={12} placeholder="runs" /></div>
                <SelectField name={`c${n}_better`} label="Better when it goes" options={[{ id: "up", label: "Up" }, { id: "down", label: "Down" }]} defaultValue="up" />
              </fieldset>)}
            </details>
            <div><Submit primary={!results.kpis.length}>Send the KPIs for approval</Submit></div>
          </form> : null}
        </section>
      ) : null}

      {app.volume_metric ? (
        <section className="card" id="baseline" aria-labelledby="b-h">
          <h2 id="b-h">4. Baseline</h2>
          <p className="sub">Why: hours saved is a claim made to the organisation. It needs how long a {app.unit_singular} took by hand before, with evidence, approved by someone else.</p>
          {results.baseline ? <p className="small"><b className="strong">Version {results.baseline.version}, {results.baseline.approved ? "approved" : results.baseline.status === "waiting" ? "waiting for approval" : "draft"}:</b> {nf(results.baseline.minutes_mid, 1)} min by hand ({nf(results.baseline.minutes_low, 1)} to {nf(results.baseline.minutes_high, 1)}), review {nf(results.baseline.review_mid, 1)} min · {METHOD_WORDS[results.baseline.method as keyof typeof METHOD_WORDS]}{results.baseline.sample_size ? `, ${results.baseline.sample_size} items` : ""} · applies from {dayLabel(results.baseline.applies_from)}. {results.baseline.evidence}</p> : null}
          {op ? <form action={A.baselineAction} className="form">
            <input type="hidden" name="id" value={id} />
            <p className="small strong">Minutes by hand per {app.unit_singular}, before</p>
            <div className="fields" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              {([["low", "Fastest"], ["mid", "Usual"], ["high", "Slowest"]] as const).map(([k, l]) => <div key={k} className="field"><label htmlFor={k}>{l}</label><input className="input mono" id={k} name={k} inputMode="decimal" required defaultValue={results.baseline ? String(results.baseline[`minutes_${k}` as const]) : ""} /></div>)}
            </div>
            <p className="small strong">Minutes a person still spends reviewing each one, now</p>
            <div className="fields" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              {([["rlow", "Fastest", "review_low"], ["rmid", "Usual", "review_mid"], ["rhigh", "Slowest", "review_high"]] as const).map(([k, l, f]) => <div key={k} className="field"><label htmlFor={k}>{l}</label><input className="input mono" id={k} name={k} inputMode="decimal" required defaultValue={results.baseline ? String(results.baseline[f]) : "0"} /></div>)}
            </div>
            <div className="fields">
              <SelectField name="method" label="How it was found" options={Object.entries(METHOD_WORDS).map(([id2, label]) => ({ id: id2, label }))} defaultValue={results.baseline?.method ?? "timed_sample"} />
              <div className="field"><label htmlFor="sample">Items timed (a sample)</label><input className="input mono" id="sample" name="sample" inputMode="numeric" defaultValue={results.baseline?.sample_size ?? ""} /></div>
              <DateField name="from" label="Sample’s first day" defaultValue={results.baseline?.measured_from} max="today" />
              <DateField name="to" label="Sample’s last day" defaultValue={results.baseline?.measured_to} max="today" />
              <DateField name="applies" label="Applies from" defaultValue={results.baseline?.applies_from ?? results.since} required hint="Usually the go-live day. Days before it don’t count hours saved." />
              <div className="field full"><label htmlFor="evidence">Evidence, in a sentence or two</label><textarea className="input" id="evidence" name="evidence" required minLength={10} maxLength={2000} defaultValue={results.baseline?.evidence ?? ""} placeholder="40 claims timed by the claims team, 4 to 8 May 2026, before go-live; agreed with the process owner." /></div>
            </div>
            <div><Submit primary={!!results.kpis.length && !results.baseline}>Send the baseline for approval</Submit></div>
          </form> : null}
        </section>
      ) : null}
    </>
  );

  return (
    <>
      <PageHead title={app.name} topTitle={`${app.name} · ${org.short_name}`}
        crumbs={<><Link href="/applications">Applications</Link><span>›</span><Link href={`/organisations/${org.id}`}>{org.short_name}</Link><span>›</span><span>{app.name}</span></>}
        lead={<>{app.project_name}{app.objective ? <> · {app.objective}</> : null}</>}
        state={<><StagePill stage={app.stage} step={app.setup_step} /> {linkWord ? <span className="pill">{linkWord}</span> : <StatePill state={i.state} />} · last figures {momentLabel(i.last_success_at)}{i.state_why && i.state !== "on_time" ? ` · ${i.state_why}` : ""}</>}
        actions={<><Link className="btn sm" href={`/organisations/${org.id}`}>{org.short_name}’s results</Link></>} />
      <Notice e={sp(q.e)} ok={sp(q.ok)} />

      {shown && (shown.key || shown.devToken || shown.nextKey) ? (
        <section className="callout warn" aria-label="Shown once">
          <div className="grow stack" style={{ gap: 10 }}>
            {shown.key ? <><b>The measurement key for {app.name}. It is shown now and never again.</b>
              <div className="code" data-testid="new-key">{shown.key}</div>
              <div className="row"><CopyButton text={shown.key} label="Copy the key" /><span className="small">Give it to the developer as AX_MEASURE_KEY, through your password manager, never by e-mail.</span></div></> : null}
            {shown.nextKey ? <><b>The next key. Shown now and never again.</b><div className="code" data-testid="next-key">{shown.nextKey}</div>
              <div className="row"><CopyButton text={shown.nextKey} label="Copy the next key" /><span className="small">The developer adds it as AX_MEASURE_KEY_NEXT. Then switch to it below.</span></div></> : null}
            {devLink ? <><b>The developer link: the prompt, the pack, and where to paste the address. It works for 14 days.</b>
              <div className="code" data-testid="dev-link">{devLink}</div><div className="row"><CopyButton text={devLink} label="Copy the link" /></div></> : null}
            <form action={A.forgetOnceAction}><button className="btn sm" type="submit">I’ve copied it, hide it</button></form>
          </div>
        </section>
      ) : null}

      <ol className="steps" aria-label="Setting up">
        {steps.map(([label, done], n) => <li key={label} className={done ? "done" : n === now ? "now" : ""} aria-current={n === now ? "step" : undefined}>{done ? "✓ " : `${n + 1}. `}{label}</li>)}
      </ol>

      {hasKpis ? (
        <section className="stack" aria-labelledby="res-h">
          <div className="card-head"><div><h2 id="res-h">What it delivered</h2><p className="sub">{dayLabel(from)} to {dayLabel(to)} · against the {days} days before</p></div>
            <nav className="row" aria-label="Period">{[7, 30, 90].map((d) => <Link key={d} className="btn sm" aria-current={d === days ? "true" : undefined} style={d === days ? { borderColor: "var(--axle-orange)", background: "var(--axle-selected-row)" } : undefined} href={`/applications/${id}?w=${d}`}>{d} days</Link>)}</nav></div>
          <div className="kpis">{results.kpis.map(({ kpi, result }) => <KpiCard key={kpi.id} name={kpi.name} unit={kpi.unit} result={result} approved={kpi.approved} better={kpi.better} prev={prev.kpis.find((p) => p.kpi.code === kpi.code)?.result.value ?? null} />)}</div>
          {results.trend.length ? <section className="card"><h3>{app.unit_plural.charAt(0).toUpperCase() + app.unit_plural.slice(1)} handled, by day</h3><Trend points={results.trend} label={`${app.unit_plural} handled`} /></section> : null}
        </section>
      ) : null}

      {settled ? (
        <details className="card fold" open={held.length > 0}>
          <summary>Connection, figures, KPIs and baseline</summary>
          <div className="stack" style={{ marginTop: 12 }}>{setup}</div>
        </details>
      ) : setup}

      {hasKpis ? (
        <section className="card" id="reports" aria-labelledby="r-h">
          <div className="card-head"><div><h2 id="r-h">Reports</h2><p className="sub">One a month, written by a person from the figures, approved by someone else, then frozen.</p></div></div>
          {reports.length ? <div className="table-wrap"><table><thead><tr><th>Month</th><th>Version</th><th>State</th></tr></thead>
            <tbody>{reports.map((r) => <tr key={r.id}><td><Link href={`/reports/${r.id}`} className="name">{monthLabel(r.month)}</Link></td><td className="mono">{r.version}</td><td><span className={`pill ${r.status === "approved" ? "ok" : r.status === "waiting" ? "warn" : ""}`}>{r.status === "approved" ? "Approved" : r.status === "waiting" ? "Waiting for approval" : "Draft"}</span></td></tr>)}</tbody></table></div>
            : <p className="muted small">No reports yet.</p>}
          {op && finishedMonths.length && app.stage === "collecting" ? <form action={A.draftReportAction} className="row" style={{ alignItems: "end" }}><input type="hidden" name="id" value={id} />
            <div style={{ minWidth: 220 }}><SelectField name="month" label="Draft the report for" options={finishedMonths.map((m) => ({ id: m, label: monthLabel(m) }))} defaultValue={finishedMonths[0]} /></div><Submit>Draft it</Submit></form> : null}
        </section>
      ) : null}

      {op ? (
        <section className="card" id="run" aria-labelledby="o-h">
          <h2 id="o-h">Running it</h2>
          <div className="row">
            {app.source === "link" && i.base_url ? <form action={A.collectNowAction}><input type="hidden" name="id" value={id} /><Submit small>Collect now</Submit></form> : null}
            <Link className="btn sm" href={`/jobs?app=${id}`}>Its collections</Link>
          </div>
          <form action={A.pauseAction} className="row" style={{ alignItems: "end" }}>
            <input type="hidden" name="id" value={id} /><input type="hidden" name="pause" value={app.stage === "paused" ? "0" : "1"} />
            <div className="field" style={{ flex: 1, minWidth: 220 }}><label htmlFor="preason">{app.stage === "paused" ? "Why resume" : "Why pause"}</label><input className="input" id="preason" name="reason" required minLength={3} defaultValue={app.paused_reason ?? ""} /></div>
            <Submit small>{app.stage === "paused" ? "Resume collection" : "Pause collection"}</Submit>
          </form>
          {app.source === "link" ? <div className="row">
            <form action={A.rotateAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="step" value={i.next_key_sealed ? "finish" : "start"} /><Submit small>{i.next_key_sealed ? "Switch to the new key" : "Start a key rotation"}</Submit></form>
            <form action={A.revokeAction} className="row"><input type="hidden" name="id" value={id} /><input className="input" name="reason" placeholder="Why revoke" required minLength={3} style={{ maxWidth: 220 }} /><Submit small>Revoke the key</Submit></form>
          </div> : null}
        </section>
      ) : null}
    </>
  );
}

type TestT = { ok: boolean; at: string; results: { title: string; status: "pass" | "warn" | "fail"; detail: string[] }[] };
function TestResult({ t }: { t: TestT }) {
  return (
    <div className={`callout ${t.ok ? "ok" : "fault"}`} data-testid="test-result">
      <div className="grow stack" style={{ gap: 6 }}>
        <b>{t.ok ? "The connection test passed" : "The connection test found problems"} · {momentLabel(t.at)}</b>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{t.results.map((r, n) => <li key={n}>{r.status === "pass" ? "✓" : r.status === "warn" ? "!" : "✗"} {r.title}{r.status !== "pass" && r.detail.length ? `: ${r.detail.join("; ")}` : ""}</li>)}</ul>
      </div>
    </div>
  );
}
