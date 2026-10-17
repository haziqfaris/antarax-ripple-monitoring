// The KPI engine (V-16 to V-18): pure functions over an application's daily totals. Every number the console,
// a report or an e-mail shows comes from here. Nothing here guesses: a day without figures is a gap, never a zero.

export type Formula =
  | { op: "sum"; metric: string }
  | { op: "ratio"; numerator: string; denominator: string }
  | { op: "per"; a: string; b: string }
  | { op: "mean_duration"; metric: string }
  | { op: "daily_average"; metric: string }
  | { op: "hours_saved"; volume: string; machine?: string | null };

export interface DayFigure { value: number | null; count?: number | null; sum?: number | null }
/** Day (YYYY-MM-DD) → metric key → that day's total (dimensions {}). */
export type Days = Map<string, Map<string, DayFigure>>;

export interface BaselineFigures {
  low: number; mid: number; high: number;
  reviewLow: number; reviewMid: number; reviewHigh: number;
  appliesFrom: string;
}

export type Quality = "measured" | "derived" | "estimated" | "unavailable";

export interface Result {
  value: number | null;
  low?: number | null;
  high?: number | null;
  quality: Quality;
  /** Days in the window the application was expected to report. */
  expected: number;
  withData: number;
  missing: number;
  why?: string;
  parts?: { volume: number; machineMinutes: number | null; baseline?: BaselineFigures };
}

export const METRIC_TYPES_FOR: Record<Formula["op"], readonly string[]> = {
  sum: ["counter"],
  ratio: ["counter"],
  per: ["counter", "gauge"],
  mean_duration: ["duration"],
  daily_average: ["distinct", "gauge"],
  hours_saved: ["counter"],
};

export function metricsOf(f: Formula): string[] {
  switch (f.op) {
    case "sum": case "mean_duration": case "daily_average": return [f.metric];
    case "ratio": return [f.numerator, f.denominator];
    case "per": return [f.a, f.b];
    case "hours_saved": return f.machine ? [f.volume, f.machine] : [f.volume];
  }
}

/** Every local day from `from` to `to`, both included. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

const num = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);
const get = (days: Days, d: string, m: string): DayFigure | undefined => days.get(d)?.get(m);

/** The machine's minutes per item on one day: re-weighted from sum and count when the link sends them. */
function machineMinutes(fig: DayFigure | undefined): number | null {
  if (!fig) return null;
  if (num(fig.sum) && num(fig.count) && fig.count > 0) return fig.sum / fig.count / 60;
  return num(fig.value) ? fig.value / 60 : null;
}

export interface ComputeOptions {
  /** The first day the application has figures for; days before it are not expected. */
  since?: string | null;
  baseline?: BaselineFigures | null;
}

export function compute(f: Formula, window: string[], days: Days, o: ComputeOptions = {}): Result {
  const expectedDays = window.filter((d) => !o.since || d >= o.since);
  const expected = expectedDays.length;
  const need = f.op === "hours_saved" ? [f.volume] : metricsOf(f);
  const withDataDays = expectedDays.filter((d) => need.every((m) => num(get(days, d, m)?.value)));
  const withData = withDataDays.length;
  const base = { expected, withData, missing: expected - withData };
  const none = (why: string): Result => ({ value: null, quality: "unavailable", why, ...base });
  if (!expected) return none("Before this application's first figures");
  if (!withData) return none("No figures for this period");

  switch (f.op) {
    case "sum": {
      return { value: withDataDays.reduce((a, d) => a + get(days, d, f.metric)!.value!, 0), quality: "measured", ...base };
    }
    case "ratio": {
      let n = 0, dn = 0;
      for (const d of withDataDays) { n += get(days, d, f.numerator)!.value!; dn += get(days, d, f.denominator)!.value!; }
      return dn > 0 ? { value: (100 * n) / dn, quality: "derived", ...base } : none("Nothing to divide by in this period");
    }
    case "per": {
      let a = 0, b = 0;
      for (const d of withDataDays) { a += get(days, d, f.a)!.value!; b += get(days, d, f.b)!.value!; }
      return b > 0 ? { value: a / b, quality: "derived", ...base } : none("Nothing to divide by in this period");
    }
    case "mean_duration": {
      const figs = withDataDays.map((d) => get(days, d, f.metric)!);
      if (figs.every((x) => num(x.sum) && num(x.count))) {
        const c = figs.reduce((a, x) => a + x.count!, 0);
        if (c > 0) return { value: figs.reduce((a, x) => a + x.sum!, 0) / c, quality: "derived", ...base };
      }
      return { value: figs.reduce((a, x) => a + x.value!, 0) / withData, quality: "derived", ...base, why: "Averaged by day: the link doesn't send a count for every day to weight by" };
    }
    case "daily_average": {
      return { value: withDataDays.reduce((a, d) => a + get(days, d, f.metric)!.value!, 0) / withData, quality: "derived", ...base, why: "An average a day; counted once a day, never added across days" };
    }
    case "hours_saved": {
      const b = o.baseline;
      if (!b) return none("Needs an approved baseline");
      const counted = withDataDays.filter((d) => d >= b.appliesFrom);
      if (!counted.length) return none(`The baseline applies from ${b.appliesFrom}`);
      // A day without a machine figure uses the period's re-weighted mean, never zero (zero would inflate hours).
      let ms = 0, mc = 0;
      for (const d of counted) {
        const fig = f.machine ? get(days, d, f.machine) : undefined;
        const m = machineMinutes(fig), v = get(days, d, f.volume)!.value!;
        if (m !== null) { ms += m * v; mc += v; }
      }
      const periodMachine = mc > 0 ? ms / mc : 0;
      let mid = 0, low = 0, high = 0, vol = 0;
      for (const d of counted) {
        const v = get(days, d, f.volume)!.value!;
        const m = (f.machine ? machineMinutes(get(days, d, f.machine)) : 0) ?? periodMachine;
        vol += v;
        mid += Math.max(0, (v * (b.mid - m - b.reviewMid)) / 60);
        low += Math.max(0, (v * (b.low - m - b.reviewHigh)) / 60);
        high += Math.max(0, (v * (b.high - m - b.reviewLow)) / 60);
      }
      const notCounted = withData - counted.length;
      return {
        value: mid, low, high, quality: "estimated", ...base,
        why: notCounted ? `${notCounted} day${notCounted === 1 ? "" : "s"} before the baseline applies are not counted` : undefined,
        parts: { volume: vol, machineMinutes: f.machine ? (mc > 0 ? ms / mc : null) : null, baseline: b },
      };
    }
  }
}

/** One metric by day, for a trend: a gap is null, never zero; days before the first figures are marked. */
export function series(metric: string, window: string[], days: Days, since?: string | null): { day: string; value: number | null; before: boolean }[] {
  return window.map((d) => {
    const v = get(days, d, metric)?.value;
    return { day: d, value: num(v) ? v : null, before: !!since && d < since };
  });
}

// ---------------------------------------------------------------- the standard set (V-16)
export interface Mapping { volume: string; corrections?: string | null; machine?: string | null; unitPlural: string }
export interface KpiDraft { code: string; name: string; formula: Formula; unit: string; better: "up" | "down" }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function standardKpis(m: Mapping): KpiDraft[] {
  const out: KpiDraft[] = [{ code: "volume", name: `${cap(m.unitPlural)} handled`, formula: { op: "sum", metric: m.volume }, unit: "", better: "up" }];
  if (m.corrections) out.push({ code: "quality", name: `Share of ${m.unitPlural} needing correction`, formula: { op: "ratio", numerator: m.corrections, denominator: m.volume }, unit: "%", better: "down" });
  out.push({ code: "hours", name: "Hours saved", formula: { op: "hours_saved", volume: m.volume, machine: m.machine ?? null }, unit: "h", better: "up" });
  return out;
}

/** Check a formula against the application's catalog: every metric exists and is a type the operation allows. */
export function checkFormula(f: Formula, catalog: Map<string, { type: string }>): string[] {
  // Each figure in its role: for hours saved the volume is a counter and the machine time a duration.
  const roles: [string, readonly string[]][] = f.op === "hours_saved"
    ? [[f.volume, ["counter"]], ...(f.machine ? [[f.machine, ["duration"]] as [string, readonly string[]]] : [])]
    : metricsOf(f).map((k) => [k, METRIC_TYPES_FOR[f.op]]);
  const problems: string[] = [];
  for (const [key, allowed] of roles) {
    const m = catalog.get(key);
    if (!m) problems.push(`${key} is not a figure this application shares`);
    else if (!allowed.includes(m.type)) problems.push(`${key} is a ${m.type}, which ${f.op.replace("_", " ")} can't use there`);
  }
  return problems;
}

// ---------------------------------------------------------------- organisation totals (V-18)
export interface AppHours { application: string; result: Result | null }

/** Hours add across an organisation's applications. Version 1 assumes they don't overlap (PRD §10.4 overlap groups come later). */
export function organisationHours(apps: AppHours[]): { value: number | null; low: number; high: number; included: number; of: number; left: string[] } {
  const ok = apps.filter((a) => a.result && a.result.value !== null);
  const left = apps.filter((a) => !a.result || a.result.value === null).map((a) => a.application);
  if (!ok.length) return { value: null, low: 0, high: 0, included: 0, of: apps.length, left };
  return {
    value: ok.reduce((s, a) => s + a.result!.value!, 0),
    low: ok.reduce((s, a) => s + (a.result!.low ?? a.result!.value!), 0),
    high: ok.reduce((s, a) => s + (a.result!.high ?? a.result!.value!), 0),
    included: ok.length, of: apps.length, left,
  };
}
