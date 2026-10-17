// Server-rendered pieces shared by every page: the top bar, page heads, states in words, figures, needs, notices.
import Link from "next/link";
import { STATE_TONE, STATE_WORD, type LinkState } from "@/domain/link-state";
import { fmt, nf, dayLabel } from "@/domain/format";
import type { Result } from "@/domain/kpi";
import type { Need } from "@/lib/services/needs";

export function TopBar({ title }: { title: string }) {
  return (
    <header className="topbar">
      <label htmlFor="menu-toggle" className="menu-btn" aria-label="Menu" role="button" tabIndex={0}>☰</label>
      <span className="axle-tag">AXLE</span>
      <h1>{title}</h1>
    </header>
  );
}

export function PageHead(p: { title: string; lead?: React.ReactNode; state?: React.ReactNode; actions?: React.ReactNode; crumbs?: React.ReactNode; topTitle?: string }) {
  return (
    <>
      <TopBar title={p.topTitle ?? p.title} />
      <div className="page-head">
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          {p.crumbs ? <nav className="crumbs" aria-label="Breadcrumbs">{p.crumbs}</nav> : null}
          {p.topTitle ? <h2 style={{ fontSize: 22 }}>{p.title}</h2> : null}
          {p.lead ? <p className="lead">{p.lead}</p> : null}
          {p.state ? <p className="state-line">{p.state}</p> : null}
        </div>
        {p.actions ? <div className="actions">{p.actions}</div> : null}
      </div>
    </>
  );
}

export function Notice({ e, ok }: { e?: string | string[]; ok?: string | string[] }) {
  const err = Array.isArray(e) ? e[0] : e, good = Array.isArray(ok) ? ok[0] : ok;
  if (err) return <div className="callout fault" role="alert"><span className="grow">{err}</span></div>;
  if (good) return <div className="callout ok" role="status"><span className="grow">{good}</span></div>;
  return null;
}

export function StatePill({ state }: { state: LinkState }) {
  return <span className={`pill ${STATE_TONE[state] === "idle" ? "" : STATE_TONE[state]}`}><span className="dot" />{STATE_WORD[state]}</span>;
}

const STAGE: Record<string, [string, string]> = { set_up: ["warn", "Being set up"], waiting: ["info", "Waiting for approval"], collecting: ["ok", "Collecting"], paused: ["", "Paused"] };
export function StagePill({ stage, step }: { stage: string; step?: number }) {
  const [tone, word] = STAGE[stage] ?? ["", stage];
  return <span className={`pill ${tone}`}><span className="dot" />{word}{stage === "set_up" && step ? ` · step ${Math.max(1, step - 2)} of 5` : ""}</span>;
}

const QUALITY: Record<string, [string, string]> = { measured: ["ok", "Measured"], derived: ["info", "Worked out"], estimated: ["warn", "Estimate"], unavailable: ["", "Not available"] };
export function Quality({ q }: { q: string }) {
  const [tone, word] = QUALITY[q] ?? ["", q];
  return <span className={`pill ${tone}`}>{word}</span>;
}

export function fmtKpi(v: number | null | undefined, unit: string): string {
  if (v === null || v === undefined) return "–";
  return unit === "%" ? nf(v, 1) : unit === "h" ? nf(v) : nf(v, v % 1 ? 1 : 0);
}

export function KpiCard(p: { name: string; unit: string; result: Result; approved: boolean; prev?: number | null; better?: "up" | "down" }) {
  const r = p.result;
  const change = r.value !== null && p.prev ? (100 * (r.value - p.prev)) / Math.abs(p.prev) : null;
  return (
    <article className="card kpi">
      <div className="row" style={{ justifyContent: "space-between" }}><span className="label">{p.name}</span><Quality q={r.quality} /></div>
      <div className="value">{r.value === null ? <span className="dashv">–</span> : fmtKpi(r.value, p.unit)}{r.value !== null && p.unit ? <small>{p.unit}</small> : null}</div>
      {r.low !== undefined && r.low !== null && r.high !== undefined && r.high !== null && r.value !== null ? <span className="why">Likely {fmtKpi(r.low, p.unit)} to {fmtKpi(r.high, p.unit)} {p.unit}</span> : null}
      {change !== null ? <span className="why">{change >= 0 ? "Up" : "Down"} {nf(Math.abs(change), 0)}% on the period before{p.better ? ((change >= 0) === (p.better === "up") ? ", better" : ", worse") : ""}</span> : null}
      {r.why ? <span className="why">{r.why}</span> : null}
      {r.missing > 0 ? <span className="why">{r.missing} of {r.expected} days missing, not counted</span> : null}
      {!p.approved ? <span className="pill info" style={{ justifySelf: "start" }}>Not approved yet: a preview</span> : null}
    </article>
  );
}

/** Columns by day; a missing day is a dashed outline, never a bar at zero. Every chart has its table (NFR-5). */
export function Trend(p: { points: { day: string; value: number | null; before: boolean }[]; label: string }) {
  const pts = p.points, w = 720, h = 180, padL = 40, padB = 22, inner = w - padL - 6;
  const max = Math.max(1, ...pts.map((x) => x.value ?? 0));
  const bw = inner / Math.max(1, pts.length);
  const y = (v: number) => h - padB - ((h - padB - 8) * v) / max;
  const gaps = pts.filter((x) => !x.before && x.value === null).length;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${p.label}, by day${gaps ? `, ${gaps} days missing` : ""}`}>
        {[0, 0.5, 1].map((f) => <g key={f}><line className="grid" x1={padL} x2={w} y1={y(max * f)} y2={y(max * f)} /><text className="axis" x={padL - 6} y={y(max * f) + 3} textAnchor="end">{nf(max * f)}</text></g>)}
        {pts.map((x, i) => x.before ? null : x.value === null
          ? <rect key={x.day} className="gap" x={padL + i * bw + 1} y={y(max) } width={Math.max(1, bw - 2)} height={h - padB - y(max)}><title>{dayLabel(x.day)}: no figures, not counted</title></rect>
          : <rect key={x.day} className="bar" x={padL + i * bw + 1} y={y(x.value)} width={Math.max(1, bw - 2)} height={h - padB - y(x.value)} rx={2}><title>{dayLabel(x.day)}: {nf(x.value)}</title></rect>)}
        {pts.length ? <><text className="axis" x={padL} y={h - 6}>{dayLabel(pts[0]!.day, false)}</text><text className="axis" x={w - 4} y={h - 6} textAnchor="end">{dayLabel(pts[pts.length - 1]!.day, false)}</text></> : null}
      </svg>
      <div className="legend"><span><i style={{ background: "var(--axle-chart-1)" }} />Measured</span><span><i style={{ border: "1.5px dashed var(--axle-warn)" }} />No figures, not zero</span></div>
      <details><summary>See the figures as a table</summary>
        <div className="table-wrap"><table><thead><tr><th>Day</th><th className="num">{p.label}</th></tr></thead>
          <tbody>{pts.filter((x) => !x.before).map((x) => <tr key={x.day}><td>{dayLabel(x.day)}</td><td className="num mono">{x.value === null ? "No figures" : nf(x.value)}</td></tr>)}</tbody></table></div>
      </details>
    </div>
  );
}

export function NeedsList({ needs, empty }: { needs: Need[]; empty: string }) {
  if (!needs.length) return <p className="muted">{empty}</p>;
  const word = { fault: "Urgent", warn: "Soon", info: "To do" };
  return (
    <ul className="needs">
      {needs.map((n, i) => <li key={i}><span className={`lvl ${n.tone}`}>{word[n.tone]}</span><span className="w"><b className="name">{n.title}</b><small>{n.detail}</small></span><Link className="btn sm" href={n.href}>{n.action}</Link></li>)}
    </ul>
  );
}

export const sp = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? undefined;
export { fmt };
