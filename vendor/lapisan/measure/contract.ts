/**
 * Measurement Link's contract (docs/14-measurement-link.md): the read-only
 * interface a measured solution exposes so Outcomes can collect its daily
 * figures. The shapes on the wire, their limits, and the pure checks both
 * sides use, so the kit that serves the interface, the contract test that
 * checks one, and the collector that reads one cannot disagree.
 *
 * Proposed (decision 0013). Imports nothing but Web standards, so a
 * solution that is not an AntaraX product can copy this folder as it is.
 */

/** Where the endpoints live on the solution's own host. */
export const MEASURE_BASE = "/internal/measure/v1";

export const MEASURE_PATHS = {
  manifest: `${MEASURE_BASE}/manifest`,
  metrics: `${MEASURE_BASE}/metrics`,
  observations: `${MEASURE_BASE}/observations`,
  health: `${MEASURE_BASE}/health`,
  baselines: `${MEASURE_BASE}/baselines`,
  capacity: `${MEASURE_BASE}/capacity`,
  openapi: `${MEASURE_BASE}/openapi.json`,
} as const;

export const MEASURE_SCHEMA_VERSION = "1.1.0";

/** The longest window one observations read covers, in local days, both ends counted. */
export const MAX_OBSERVATION_DAYS = 92;
/** Page sizes, as every list in the contract (docs/03, 3.6). */
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
/** The most metrics one solution declares (PRD D10). */
export const MAX_METRICS = 200;
/** The most dimensions one metric has, and the most values one dimension takes in a window. */
export const MAX_DIMENSIONS = 5;
export const MAX_DIMENSION_VALUES = 20;

/**
 * The error codes this interface answers with, and their statuses. All are
 * already in registry/registry.json; a test holds the two together, so this
 * folder needs no registry of its own.
 */
export const MEASURE_ERRORS = {
  invalid_request: 422,
  invalid_cursor: 400,
  invalid_signature: 401,
  not_found: 404,
  rate_limited: 429,
  unavailable: 503,
  internal: 500,
} as const;

export type MeasureErrorCode = keyof typeof MEASURE_ERRORS;

// ---------------------------------------------------------------------------
// Shapes on the wire
// ---------------------------------------------------------------------------

export const METRIC_TYPES = ["counter", "gauge", "duration", "ratio", "distinct", "money"] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

/** Units from a fixed list; anything else is namespaced, "x.batch". Money uses an ISO 4217 code instead. */
export const METRIC_UNITS = ["item", "document", "page", "request", "run", "message", "task", "person", "second", "minute", "hour", "day", "percent", "byte"] as const;
const TIME_UNITS = new Set(["second", "minute", "hour", "day"]);

export const AGGREGATIONS: Partial<Record<MetricType, readonly string[]>> = {
  duration: ["mean", "median", "p90"],
  gauge: ["last", "mean"],
};

export const CAPABILITIES = ["metrics", "observations", "health", "baselines", "capacity"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ENVIRONMENTS = ["production", "staging", "development"] as const;

/** One figure the solution shares, defined once. */
export interface MetricDefinition {
  /** Lower-case words joined by dots: "documents.generated". */
  key: string;
  type: MetricType;
  unit: string;
  /** What it counts, in plain words a client could read. */
  description: string;
  /** A short name for screens, "Documents generated". Optional. */
  label?: string;
  /** Duration: mean, median or p90. Gauge: last or mean. */
  aggregation?: string;
  /** Snake_case names of the ways it is split, at most five. */
  dimensions?: string[];
  /** Only "aggregate" in v1: no figure about one person. */
  privacy: "aggregate";
  /** Ratio: the counters it is worked out from. */
  numerator?: string;
  denominator?: string;
  /** Distinct: what is counted once, "operator". */
  identity?: string;
  /** The first local day it has figures for. */
  since?: string;
}

export interface Manifest {
  object: "manifest";
  schema_version: string;
  /** A slug, unique to this solution: "contoh-document-workflow". */
  solution_id: string;
  solution_name: string;
  environment: (typeof ENVIRONMENTS)[number];
  /** The IANA zone its days are counted in. */
  time_zone: string;
  capabilities: Capability[];
  /** Changes whenever a metric is added, changed or dropped. A date is fine. */
  metric_catalog_version: string;
  reporting_periods: ["day"];
  data_policy: { aggregation: "daily"; contains_personal_data: false; retention_days?: number };
  metrics: MetricDefinition[];
}

export type ObservationQuality = "measured" | "derived";

export interface Observation {
  object: "observation";
  metric_key: string;
  /** The local day's start and end, in UTC with Z. */
  period_start: string;
  period_end: string;
  /** The local day, YYYY-MM-DD, in the manifest's time zone. */
  local_period: string;
  /** A number; for money, a string with the currency's decimals. */
  value: number | string;
  unit: string;
  /** Empty for the day's total. */
  dimensions: Record<string, string>;
  /** Duration: how many items the value covers, and their total, so it can be re-weighted. */
  count?: number;
  sum?: number;
  quality: ObservationQuality;
  source: string;
}

export type MeasureHealthStatus = "ok" | "degraded" | "down";

export interface MeasureHealth {
  object: "health";
  status: MeasureHealthStatus;
  checked_at: string;
  /** Short snake_case names; empty when all is well. */
  problems: string[];
  /** For each metric, the last local day with complete figures. */
  freshness: Record<string, string | null>;
}

export const BASELINE_METHODS = ["timed_sample", "historical_records", "client_estimate"] as const;

export interface Baseline {
  object: "baseline";
  metric_key: string;
  value: number;
  unit: string;
  method: (typeof BASELINE_METHODS)[number];
  /** The local days the baseline was measured over. */
  period_from: string;
  period_to: string;
  sample_size: number | null;
  /** Where it came from, in plain words: "Timed sample of 40 invoices, signed by the AP lead". */
  evidence: string;
  recorded_at: string;
}

/**
 * Capacity (docs/14, 14.5a): optional and supplementary. The application's
 * own AXLE watches capacity in full; this only lets Outcomes show a
 * read-only summary beside the results. It serves the latest snapshots the
 * application's capacity check already takes, as its capacity.json describes
 * them (AntaraX-Dashboard-kit capacity/). The classes and the ways of
 * measuring are that kit's, unchanged. Never money, plans or accounts:
 * what a plan costs lives in AX Frame.
 */
export const CAPACITY_CLASSES = ["data", "files", "transfer", "requests", "compute", "connections", "deployables", "jobs", "messages", "ai", "outside-apis", "backups"] as const;
export type CapacityClass = (typeof CAPACITY_CLASSES)[number];
/** capacity.json's measure.how. */
export const CAPACITY_HOW = ["provider-api", "query", "log", "manual", "none"] as const;
export type CapacityHow = (typeof CAPACITY_HOW)[number];
/** What a limit counts over. capacity.json's "billing-cycle" is sent as "month". */
export const CAPACITY_PER = ["none", "day", "month"] as const;
export const MAX_CAPACITY_RESOURCES = 50;
export const MAX_CAPACITY_OUTAGES = 100;

export interface CapacityResource {
  /** The resource's id in capacity.json: "disk", "ai-tokens". */
  id: string;
  class: CapacityClass;
  /** In plain words: "Database size". */
  name: string;
  /** From the metric units, or namespaced: byte, request, message, x.token, x.connection. */
  unit: string;
  /** The latest snapshot, in unit. null when how is none. */
  used: number | null;
  /** The plan's limit, or the budget REKA set itself where the plan has none. null when neither. */
  limit: number | null;
  per: (typeof CAPACITY_PER)[number];
  /** used / limit × 100, rounded; null when either is null. */
  percent: number | null;
  /** Whole days until the limit at the current trend; null when it is not growing or not known. */
  runway_days: number | null;
  /** When the snapshot was taken; null when how is none. */
  measured_at: string | null;
  how: CapacityHow;
  /** Only when how is none: why, in plain words. */
  why_not?: string;
}

export interface CapacityOutage {
  started_at: string;
  /** null while it lasts. */
  ended_at: string | null;
  /** null while it lasts. */
  minutes: number | null;
}

/** The application's outside check (capacity.json's availability), summarised. */
export interface CapacityAvailability {
  every_minutes: number;
  last_checked_at: string;
  last_result: "up" | "down";
  /** Share of checks that passed over the last 90 days, 0 to 1. null before there are enough. */
  up_share_90d: number | null;
  /** The last 90 days' outages, oldest first. */
  outages: CapacityOutage[];
}

export interface Capacity {
  object: "capacity";
  /** When the latest nightly snapshot was taken. */
  snapshot_at: string;
  /** capacity.json's "updated". */
  capacity_updated: string;
  resources: CapacityResource[];
  /** null when the application has no outside check. */
  availability: CapacityAvailability | null;
}

export interface MeasureList<T> {
  object: "list";
  data: T[];
  next: string | null;
}

// ---------------------------------------------------------------------------
// Days and moments
// ---------------------------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day, YYYY-MM-DD. */
export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** A moment as the contract writes it: UTC, whole seconds, with Z. */
export function isMoment(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** A moment from milliseconds, in the contract's form. */
export function momentOf(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Whether the runtime knows this IANA zone. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.includes("/")) return value === "UTC";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const zoneFormats = new Map<string, Intl.DateTimeFormat>();

/** How far the zone's clock is ahead of UTC at a moment, in milliseconds. */
function offsetAt(ms: number, timeZone: string): number {
  let f = zoneFormats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    zoneFormats.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The UTC moment a local day starts, in milliseconds. Correct across daylight saving changes. */
function localMidnight(date: string, timeZone: string): number {
  const naive = Date.parse(`${date}T00:00:00Z`);
  let guess = naive - offsetAt(naive, timeZone);
  guess = naive - offsetAt(guess, timeZone);
  return guess;
}

/** A local day's start and end in UTC, as an observation carries them. */
export function dayBounds(date: string, timeZone: string): { period_start: string; period_end: string } {
  return { period_start: momentOf(localMidnight(date, timeZone)), period_end: momentOf(localMidnight(addLocalDays(date, 1), timeZone)) };
}

/** The local day a moment falls on. */
export function localDate(ms: number, timeZone: string): string {
  return new Date(ms + offsetAt(ms, timeZone)).toISOString().slice(0, 10);
}

export function addLocalDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both counted. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

// ---------------------------------------------------------------------------
// Checks. Each returns problems: where, and what is wrong, in plain words.
// ---------------------------------------------------------------------------

export interface Problem {
  at: string;
  message: string;
}

const METRIC_KEY = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,3}$/;
const SNAKE = /^[a-z][a-z0-9_]{0,39}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/;
const CURRENCY = /^[A-Z]{3}$/;
const MONEY = /^-?\d{1,15}(\.\d{1,3})?$/;
/** Dimension values are short codes, never free text: no spaces, no @, at most 60 characters. */
const DIMENSION_VALUE = /^[a-z0-9][a-z0-9_.-]{0,59}$/;

export const isMetricKey = (v: unknown): v is string => typeof v === "string" && METRIC_KEY.test(v);

/** Units a metric may use: the fixed list, or "x." and a snake_case name. */
export function isUnit(unit: unknown, type?: MetricType): boolean {
  if (typeof unit !== "string") return false;
  if (type === "money") return CURRENCY.test(unit);
  return (METRIC_UNITS as readonly string[]).includes(unit) || /^x\.[a-z][a-z0-9_]{0,30}$/.test(unit);
}

/**
 * Text that looks like it is about one person: an email address, a phone
 * number, a Malaysian identity card number, or ten or more digits in a row
 * (an account or card number). Dimension values and descriptions are checked
 * with it, so an identifier cannot slip in as a "dimension".
 */
export function looksPersonal(text: string): boolean {
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)) return true;
  if (/\b\d{6}-\d{2}-\d{4}\b/.test(text)) return true;
  if (/(\+?6?0)[\s-]?1\d[\s-]?\d{3,4}[\s-]?\d{4}\b/.test(text)) return true;
  if (/\d{10,}/.test(text)) return true;
  return false;
}

const fieldsOf = (o: object) => new Set(Object.keys(o));

function unknownFields(o: Record<string, unknown>, allowed: readonly string[], at: string, out: Problem[]) {
  for (const k of fieldsOf(o)) if (!allowed.includes(k)) out.push({ at: `${at}.${k}`, message: `"${k}" is not a field here.` });
}

const METRIC_FIELDS = ["key", "type", "unit", "description", "label", "aggregation", "dimensions", "privacy", "numerator", "denominator", "identity", "since"] as const;

/** One metric definition, alone. The catalog check adds what needs the others (ratios, repeats). */
export function checkMetric(m: unknown, at = "metric"): Problem[] {
  const out: Problem[] = [];
  if (!m || typeof m !== "object" || Array.isArray(m)) return [{ at, message: "A metric is an object." }];
  const o = m as Record<string, unknown>;
  unknownFields(o, METRIC_FIELDS, at, out);
  if (!isMetricKey(o.key)) out.push({ at: `${at}.key`, message: "key is lower-case words joined by dots, two to four parts: documents.generated." });
  const type = o.type as MetricType;
  if (!METRIC_TYPES.includes(type)) out.push({ at: `${at}.type`, message: `type is one of ${METRIC_TYPES.join(", ")}.` });
  if (!isUnit(o.unit, type)) out.push({ at: `${at}.unit`, message: type === "money" ? "A money metric's unit is its ISO 4217 currency code, MYR." : `unit is one of ${METRIC_UNITS.join(", ")}, or x. and a name.` });
  if (typeof o.description !== "string" || o.description.trim().length < 8) out.push({ at: `${at}.description`, message: "Describe what it counts in plain words." });
  else if (looksPersonal(o.description)) out.push({ at: `${at}.description`, message: "The description seems to hold personal data." });
  if (o.label !== undefined && (typeof o.label !== "string" || !o.label.trim() || o.label.length > 60)) out.push({ at: `${at}.label`, message: "label is a short name, up to 60 characters." });
  if (o.privacy !== "aggregate") out.push({ at: `${at}.privacy`, message: 'privacy is "aggregate": no figure may be about one person.' });
  const aggs = AGGREGATIONS[type];
  if (aggs) {
    if (!aggs.includes(o.aggregation as string)) out.push({ at: `${at}.aggregation`, message: `A ${type} declares its aggregation: ${aggs.join(", ")}.` });
  } else if (o.aggregation !== undefined) out.push({ at: `${at}.aggregation`, message: `Only durations and gauges declare an aggregation.` });
  if (type === "duration" && typeof o.unit === "string" && !TIME_UNITS.has(o.unit)) out.push({ at: `${at}.unit`, message: "A duration is in second, minute, hour or day." });
  if (o.dimensions !== undefined) {
    if (!Array.isArray(o.dimensions) || o.dimensions.some((d) => typeof d !== "string" || !SNAKE.test(d))) out.push({ at: `${at}.dimensions`, message: "dimensions is a list of snake_case names." });
    else if (o.dimensions.length > MAX_DIMENSIONS) out.push({ at: `${at}.dimensions`, message: `At most ${MAX_DIMENSIONS} dimensions.` });
    else if (new Set(o.dimensions).size !== o.dimensions.length) out.push({ at: `${at}.dimensions`, message: "A dimension is listed twice." });
  }
  if (type === "ratio") {
    if (!isMetricKey(o.numerator) || !isMetricKey(o.denominator)) out.push({ at, message: "A ratio names the counters it is worked out from: numerator and denominator." });
  } else if (o.numerator !== undefined || o.denominator !== undefined) out.push({ at, message: "Only ratios have a numerator and denominator." });
  if (type === "distinct") {
    if (typeof o.identity !== "string" || !SNAKE.test(o.identity)) out.push({ at: `${at}.identity`, message: 'A distinct count says what it counts once, "operator".' });
  } else if (o.identity !== undefined) out.push({ at: `${at}.identity`, message: "Only distinct counts have an identity." });
  if (o.since !== undefined && !isDate(o.since)) out.push({ at: `${at}.since`, message: "since is a day, YYYY-MM-DD." });
  return out;
}

/** The whole catalog: each metric, no key twice, ratios built from counters it holds. */
export function checkCatalog(metrics: unknown, at = "metrics"): Problem[] {
  if (!Array.isArray(metrics)) return [{ at, message: "metrics is a list." }];
  const out: Problem[] = [];
  if (!metrics.length) out.push({ at, message: "Share at least one metric." });
  if (metrics.length > MAX_METRICS) out.push({ at, message: `At most ${MAX_METRICS} metrics.` });
  const byKey = new Map<string, Record<string, unknown>>();
  metrics.forEach((m, i) => {
    out.push(...checkMetric(m, `${at}[${i}]`));
    const key = (m as Record<string, unknown>)?.key;
    if (typeof key === "string") {
      if (byKey.has(key)) out.push({ at: `${at}[${i}].key`, message: `"${key}" is listed twice.` });
      byKey.set(key, m as Record<string, unknown>);
    }
  });
  metrics.forEach((m, i) => {
    const o = m as Record<string, unknown>;
    if (o?.type !== "ratio") return;
    for (const part of ["numerator", "denominator"] as const) {
      const ref = byKey.get(o[part] as string);
      if (typeof o[part] === "string" && (!ref || ref.type !== "counter")) out.push({ at: `${at}[${i}].${part}`, message: `${part} "${String(o[part])}" is not a counter in this catalog.` });
    }
  });
  return out;
}

const MANIFEST_FIELDS = ["object", "schema_version", "solution_id", "solution_name", "environment", "time_zone", "capabilities", "metric_catalog_version", "reporting_periods", "data_policy", "metrics"] as const;

export function checkManifest(m: unknown): Problem[] {
  if (!m || typeof m !== "object" || Array.isArray(m)) return [{ at: "manifest", message: "The manifest is an object." }];
  const o = m as Record<string, unknown>;
  const out: Problem[] = [];
  unknownFields(o, MANIFEST_FIELDS, "manifest", out);
  if (o.object !== "manifest") out.push({ at: "manifest.object", message: 'object is "manifest".' });
  if (typeof o.schema_version !== "string" || !/^1\.\d+\.\d+$/.test(o.schema_version)) out.push({ at: "manifest.schema_version", message: `schema_version is ${MEASURE_SCHEMA_VERSION} for this version of the interface.` });
  if (typeof o.solution_id !== "string" || !SLUG.test(o.solution_id)) out.push({ at: "manifest.solution_id", message: "solution_id is a lower-case slug: contoh-document-workflow." });
  if (typeof o.solution_name !== "string" || !o.solution_name.trim()) out.push({ at: "manifest.solution_name", message: "solution_name is the name people know it by." });
  if (!ENVIRONMENTS.includes(o.environment as (typeof ENVIRONMENTS)[number])) out.push({ at: "manifest.environment", message: `environment is one of ${ENVIRONMENTS.join(", ")}.` });
  if (!isTimeZone(o.time_zone)) out.push({ at: "manifest.time_zone", message: "time_zone is an IANA name: Asia/Kuala_Lumpur." });
  const caps = o.capabilities;
  if (!Array.isArray(caps) || caps.some((c) => !CAPABILITIES.includes(c as Capability))) out.push({ at: "manifest.capabilities", message: `capabilities come from ${CAPABILITIES.join(", ")}.` });
  else for (const need of ["metrics", "observations", "health"]) if (!caps.includes(need)) out.push({ at: "manifest.capabilities", message: `"${need}" is required.` });
  if (typeof o.metric_catalog_version !== "string" || !o.metric_catalog_version.trim()) out.push({ at: "manifest.metric_catalog_version", message: "metric_catalog_version changes whenever a metric does; a date is fine." });
  if (!Array.isArray(o.reporting_periods) || o.reporting_periods.length !== 1 || o.reporting_periods[0] !== "day") out.push({ at: "manifest.reporting_periods", message: 'reporting_periods is ["day"] in v1.' });
  const dp = o.data_policy as Record<string, unknown> | undefined;
  if (!dp || typeof dp !== "object") out.push({ at: "manifest.data_policy", message: "data_policy is required." });
  else {
    unknownFields(dp, ["aggregation", "contains_personal_data", "retention_days"], "manifest.data_policy", out);
    if (dp.aggregation !== "daily") out.push({ at: "manifest.data_policy.aggregation", message: 'aggregation is "daily".' });
    if (dp.contains_personal_data !== false) out.push({ at: "manifest.data_policy.contains_personal_data", message: "This interface never carries personal data: contains_personal_data is false." });
    if (dp.retention_days !== undefined && (!Number.isInteger(dp.retention_days) || (dp.retention_days as number) < 1)) out.push({ at: "manifest.data_policy.retention_days", message: "retention_days is a whole number of days." });
  }
  out.push(...checkCatalog(o.metrics, "manifest.metrics"));
  return out;
}

/** What an observation needs from the catalog to be checked. */
export interface ObservationContext {
  metrics: ReadonlyMap<string, MetricDefinition>;
  timeZone: string;
}

const OBSERVATION_FIELDS = ["object", "metric_key", "period_start", "period_end", "local_period", "value", "unit", "dimensions", "count", "sum", "quality", "source"] as const;

export function checkObservation(x: unknown, ctx: ObservationContext, at = "observation"): Problem[] {
  if (!x || typeof x !== "object" || Array.isArray(x)) return [{ at, message: "An observation is an object." }];
  const o = x as Record<string, unknown>;
  const out: Problem[] = [];
  unknownFields(o, OBSERVATION_FIELDS, at, out);
  if (o.object !== "observation") out.push({ at: `${at}.object`, message: 'object is "observation".' });
  const m = ctx.metrics.get(o.metric_key as string);
  if (!m) return [...out, { at: `${at}.metric_key`, message: `"${String(o.metric_key)}" is not in the catalog.` }];
  if (!isDate(o.local_period)) out.push({ at: `${at}.local_period`, message: "local_period is a day, YYYY-MM-DD." });
  else {
    const b = dayBounds(o.local_period, ctx.timeZone);
    if (o.period_start !== b.period_start || o.period_end !== b.period_end) out.push({ at, message: `period_start and period_end are ${o.local_period} in ${ctx.timeZone}: ${b.period_start} to ${b.period_end}.` });
  }
  if (!isMoment(o.period_start) || !isMoment(o.period_end)) out.push({ at, message: "period_start and period_end are UTC moments with Z, in whole seconds." });
  if (o.unit !== m.unit) out.push({ at: `${at}.unit`, message: `unit is "${m.unit}", as the catalog says.` });
  const v = o.value;
  if (m.type === "money") {
    if (typeof v !== "string" || !MONEY.test(v)) out.push({ at: `${at}.value`, message: 'Money is a string with the currency\'s decimals, "784.40", never a number.' });
  } else if (typeof v !== "number" || !Number.isFinite(v)) out.push({ at: `${at}.value`, message: "value is a number." });
  else if ((m.type === "counter" || m.type === "distinct") && (!Number.isInteger(v) || v < 0)) out.push({ at: `${at}.value`, message: `A ${m.type} is a whole number, zero or more.` });
  else if ((m.type === "duration" || m.type === "ratio") && v < 0) out.push({ at: `${at}.value`, message: `A ${m.type} is zero or more.` });
  const dims = o.dimensions;
  if (!dims || typeof dims !== "object" || Array.isArray(dims)) out.push({ at: `${at}.dimensions`, message: "dimensions is an object; {} for the day's total." });
  else
    for (const [k, val] of Object.entries(dims as Record<string, unknown>)) {
      if (!(m.dimensions ?? []).includes(k)) out.push({ at: `${at}.dimensions.${k}`, message: `"${k}" is not a dimension of ${m.key}.` });
      else if (typeof val !== "string" || !DIMENSION_VALUE.test(val)) out.push({ at: `${at}.dimensions.${k}`, message: "A dimension value is a short lower-case code, no spaces: invoice, delivery_order." });
      else if (looksPersonal(val)) out.push({ at: `${at}.dimensions.${k}`, message: "This dimension value looks like personal data." });
    }
  for (const f of ["count", "sum"] as const) {
    if (o[f] === undefined) continue;
    if (m.type !== "duration") out.push({ at: `${at}.${f}`, message: `Only durations carry ${f}.` });
    else if (typeof o[f] !== "number" || (o[f] as number) < 0 || (f === "count" && !Number.isInteger(o[f]))) out.push({ at: `${at}.${f}`, message: `${f} is a number, zero or more${f === "count" ? ", whole" : ""}.` });
  }
  if (o.quality !== "measured" && o.quality !== "derived") out.push({ at: `${at}.quality`, message: 'quality is "measured" or "derived".' });
  if (typeof o.source !== "string" || !SNAKE.test(o.source)) out.push({ at: `${at}.source`, message: "source is a snake_case name: application_aggregate." });
  return out;
}

export function checkHealth(x: unknown, metricKeys?: ReadonlySet<string>): Problem[] {
  if (!x || typeof x !== "object" || Array.isArray(x)) return [{ at: "health", message: "Health is an object." }];
  const o = x as Record<string, unknown>;
  const out: Problem[] = [];
  if (o.object !== "health") out.push({ at: "health.object", message: 'object is "health".' });
  if (!["ok", "degraded", "down"].includes(o.status as string)) out.push({ at: "health.status", message: "status is ok, degraded or down." });
  if (!isMoment(o.checked_at)) out.push({ at: "health.checked_at", message: "checked_at is a UTC moment with Z." });
  if (!Array.isArray(o.problems) || o.problems.some((p) => typeof p !== "string" || !SNAKE.test(p))) out.push({ at: "health.problems", message: "problems is a list of snake_case names; empty when all is well." });
  else if (o.status === "ok" && o.problems.length) out.push({ at: "health.problems", message: "A solution with problems is degraded or down, not ok." });
  const f = o.freshness;
  if (!f || typeof f !== "object" || Array.isArray(f)) out.push({ at: "health.freshness", message: "freshness gives each metric's last complete day." });
  else
    for (const [k, d] of Object.entries(f as Record<string, unknown>)) {
      if (metricKeys && !metricKeys.has(k)) out.push({ at: `health.freshness.${k}`, message: `"${k}" is not in the catalog.` });
      if (d !== null && !isDate(d)) out.push({ at: `health.freshness.${k}`, message: "A day, YYYY-MM-DD, or null before its first figure." });
    }
  return out;
}

export function checkBaseline(x: unknown, metrics: ReadonlyMap<string, MetricDefinition>, at = "baseline"): Problem[] {
  if (!x || typeof x !== "object" || Array.isArray(x)) return [{ at, message: "A baseline is an object." }];
  const o = x as Record<string, unknown>;
  const out: Problem[] = [];
  unknownFields(o, ["object", "metric_key", "value", "unit", "method", "period_from", "period_to", "sample_size", "evidence", "recorded_at"], at, out);
  if (o.object !== "baseline") out.push({ at: `${at}.object`, message: 'object is "baseline".' });
  const m = metrics.get(o.metric_key as string);
  if (!m) out.push({ at: `${at}.metric_key`, message: `"${String(o.metric_key)}" is not in the catalog.` });
  else if (o.unit !== m.unit) out.push({ at: `${at}.unit`, message: `unit is "${m.unit}", as the catalog says.` });
  if (typeof o.value !== "number" || !Number.isFinite(o.value) || o.value < 0) out.push({ at: `${at}.value`, message: "value is a number, zero or more." });
  if (!BASELINE_METHODS.includes(o.method as (typeof BASELINE_METHODS)[number])) out.push({ at: `${at}.method`, message: `method is one of ${BASELINE_METHODS.join(", ")}.` });
  if (!isDate(o.period_from) || !isDate(o.period_to) || (o.period_to as string) < (o.period_from as string)) out.push({ at, message: "period_from and period_to are days, in order." });
  if (o.sample_size !== null && (!Number.isInteger(o.sample_size) || (o.sample_size as number) < 1)) out.push({ at: `${at}.sample_size`, message: "sample_size is a whole number, or null." });
  if (typeof o.evidence !== "string" || o.evidence.trim().length < 8) out.push({ at: `${at}.evidence`, message: "Say where the baseline came from." });
  else if (looksPersonal(o.evidence)) out.push({ at: `${at}.evidence`, message: "The evidence seems to hold personal data." });
  if (!isMoment(o.recorded_at)) out.push({ at: `${at}.recorded_at`, message: "recorded_at is a UTC moment with Z." });
  return out;
}

const CAPACITY_ID = /^[a-z][a-z0-9-]{0,39}$/;
/** Field names that would carry money, a plan, an account or a secret. Refused with their own message. */
const COSTLY_FIELD = /cost|price|fee|amount|currency|money|spend|bill|charge|plan|tier|provider|account|asset|credential|secret|password|token_key|api_key|owner|email/i;
/** Text that names an amount of money: RM450, US$25, $25, 12 USD. */
export function looksLikeMoney(text: string): boolean {
  return /(\bRM\s?\d|\$\s?\d|[€£¥]\s?\d|\b\d[\d,.]*\s?(MYR|USD|SGD|EUR|GBP)\b|\b(MYR|USD|SGD|EUR|GBP)\s?\d)/.test(text);
}
const MONEY_UNIT = /money|cost|price|usd|myr|sgd|eur|gbp|ringgit|dollar|currency/i;

function capacityFields(o: Record<string, unknown>, allowed: readonly string[], at: string, out: Problem[]) {
  for (const k of fieldsOf(o)) {
    if (allowed.includes(k)) continue;
    if (COSTLY_FIELD.test(k)) out.push({ at: `${at}.${k}`, message: `"${k}" is not allowed: capacity never carries money, plans, provider accounts or credentials. Costs live in AX Frame.` });
    else out.push({ at: `${at}.${k}`, message: `"${k}" is not a field here.` });
  }
}

function plainWords(v: unknown, at: string, what: string, out: Problem[]) {
  if (typeof v !== "string" || !v.trim() || v.length > 120) return out.push({ at, message: `${what} is plain words, up to 120 characters.` });
  if (looksPersonal(v)) out.push({ at, message: `${what} seems to hold personal data.` });
  else if (looksLikeMoney(v)) out.push({ at, message: `${what} names an amount of money; capacity never carries costs. They live in AX Frame.` });
}

const RESOURCE_FIELDS = ["id", "class", "name", "unit", "used", "limit", "per", "percent", "runway_days", "measured_at", "how", "why_not"] as const;

export function checkCapacityResource(x: unknown, at = "resource"): Problem[] {
  if (!x || typeof x !== "object" || Array.isArray(x)) return [{ at, message: "A resource is an object." }];
  const o = x as Record<string, unknown>;
  const out: Problem[] = [];
  capacityFields(o, RESOURCE_FIELDS, at, out);
  if (typeof o.id !== "string" || !CAPACITY_ID.test(o.id)) out.push({ at: `${at}.id`, message: "id is a short lower-case code, as in capacity.json: disk, ai-tokens." });
  if (!CAPACITY_CLASSES.includes(o.class as CapacityClass)) out.push({ at: `${at}.class`, message: `class is one of the capacity kit's: ${CAPACITY_CLASSES.join(", ")}.` });
  plainWords(o.name, `${at}.name`, "name", out);
  if (!isUnit(o.unit) || MONEY_UNIT.test(String(o.unit))) out.push({ at: `${at}.unit`, message: `unit is one of ${METRIC_UNITS.join(", ")}, or x. and a name (x.token), and never money.` });
  if (!CAPACITY_PER.includes(o.per as (typeof CAPACITY_PER)[number])) out.push({ at: `${at}.per`, message: `per is one of ${CAPACITY_PER.join(", ")}.` });
  const nonNegative = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (o.limit !== null && (!nonNegative(o.limit) || o.limit === 0)) out.push({ at: `${at}.limit`, message: "limit is a number above zero, in unit, or null when there is none." });
  const how = o.how as CapacityHow;
  if (!CAPACITY_HOW.includes(how)) out.push({ at: `${at}.how`, message: `how is one of ${CAPACITY_HOW.join(", ")}, as capacity.json's measure.how.` });
  if (how === "none") {
    for (const f of ["used", "percent", "runway_days", "measured_at"] as const) if (o[f] !== null) out.push({ at: `${at}.${f}`, message: `A resource that is not measured has ${f} null.` });
    if (o.why_not === undefined) out.push({ at: `${at}.why_not`, message: "A resource that is not measured says why_not." });
    else plainWords(o.why_not, `${at}.why_not`, "why_not", out);
  } else {
    if (!nonNegative(o.used)) out.push({ at: `${at}.used`, message: "used is a number, zero or more, in unit." });
    if (!isMoment(o.measured_at)) out.push({ at: `${at}.measured_at`, message: "measured_at is a UTC moment with Z." });
    if (o.why_not !== undefined) out.push({ at: `${at}.why_not`, message: "why_not is only for a resource whose how is none." });
  }
  if (typeof o.used === "number" && typeof o.limit === "number" && o.limit > 0) {
    const exact = (o.used / o.limit) * 100;
    if (typeof o.percent !== "number" || !Number.isFinite(o.percent) || Math.abs(o.percent - exact) > 0.5 + 1e-9) out.push({ at: `${at}.percent`, message: `percent is used / limit × 100: ${Math.round(exact * 10) / 10}.` });
  } else if (o.percent !== null) out.push({ at: `${at}.percent`, message: "percent is null when used or limit is." });
  if (o.runway_days !== null && (!Number.isInteger(o.runway_days) || (o.runway_days as number) < 0)) out.push({ at: `${at}.runway_days`, message: "runway_days is a whole number of days, or null." });
  return out;
}

export function checkCapacity(x: unknown): Problem[] {
  if (!x || typeof x !== "object" || Array.isArray(x)) return [{ at: "capacity", message: "Capacity is an object." }];
  const o = x as Record<string, unknown>;
  const out: Problem[] = [];
  capacityFields(o, ["object", "snapshot_at", "capacity_updated", "resources", "availability"], "capacity", out);
  if (o.object !== "capacity") out.push({ at: "capacity.object", message: 'object is "capacity".' });
  if (!isMoment(o.snapshot_at)) out.push({ at: "capacity.snapshot_at", message: "snapshot_at is a UTC moment with Z: when the latest nightly snapshot was taken." });
  if (!isDate(o.capacity_updated)) out.push({ at: "capacity.capacity_updated", message: "capacity_updated is capacity.json's updated, YYYY-MM-DD." });
  const rs = o.resources;
  if (!Array.isArray(rs) || !rs.length) out.push({ at: "capacity.resources", message: "resources is a list of at least one, from capacity.json." });
  else {
    if (rs.length > MAX_CAPACITY_RESOURCES) out.push({ at: "capacity.resources", message: `At most ${MAX_CAPACITY_RESOURCES} resources.` });
    const ids = new Set<string>();
    rs.forEach((r, i) => {
      out.push(...checkCapacityResource(r, `capacity.resources[${i}]`));
      const id = (r as Record<string, unknown>)?.id;
      if (typeof id === "string") {
        if (ids.has(id)) out.push({ at: `capacity.resources[${i}].id`, message: `"${id}" is listed twice.` });
        ids.add(id);
      }
    });
  }
  const a = o.availability;
  if (a === undefined) out.push({ at: "capacity.availability", message: "availability is the outside check's summary, or null." });
  else if (a !== null) {
    if (typeof a !== "object" || Array.isArray(a)) out.push({ at: "capacity.availability", message: "availability is an object, or null." });
    else {
      const v = a as Record<string, unknown>;
      capacityFields(v, ["every_minutes", "last_checked_at", "last_result", "up_share_90d", "outages"], "capacity.availability", out);
      if (!Number.isInteger(v.every_minutes) || (v.every_minutes as number) < 1 || (v.every_minutes as number) > 15) out.push({ at: "capacity.availability.every_minutes", message: "every_minutes is a whole number from 1 to 15, as capacity.json says." });
      if (!isMoment(v.last_checked_at)) out.push({ at: "capacity.availability.last_checked_at", message: "last_checked_at is a UTC moment with Z." });
      if (v.last_result !== "up" && v.last_result !== "down") out.push({ at: "capacity.availability.last_result", message: 'last_result is "up" or "down".' });
      if (v.up_share_90d !== null && (typeof v.up_share_90d !== "number" || v.up_share_90d < 0 || v.up_share_90d > 1)) out.push({ at: "capacity.availability.up_share_90d", message: "up_share_90d is a share from 0 to 1, or null." });
      if (!Array.isArray(v.outages)) out.push({ at: "capacity.availability.outages", message: "outages is a list; empty when there were none." });
      else {
        if (v.outages.length > MAX_CAPACITY_OUTAGES) out.push({ at: "capacity.availability.outages", message: `At most ${MAX_CAPACITY_OUTAGES} outages.` });
        v.outages.forEach((g, i) => {
          const at = `capacity.availability.outages[${i}]`;
          if (!g || typeof g !== "object" || Array.isArray(g)) return out.push({ at, message: "An outage is an object." });
          const q = g as Record<string, unknown>;
          capacityFields(q, ["started_at", "ended_at", "minutes"], at, out);
          if (!isMoment(q.started_at)) out.push({ at: `${at}.started_at`, message: "started_at is a UTC moment with Z." });
          if (q.ended_at === null) {
            if (q.minutes !== null) out.push({ at: `${at}.minutes`, message: "minutes is null while the outage lasts." });
          } else if (!isMoment(q.ended_at) || (isMoment(q.started_at) && q.ended_at < q.started_at)) out.push({ at: `${at}.ended_at`, message: "ended_at is a UTC moment with Z, after started_at, or null while it lasts." });
          else if (isMoment(q.started_at)) {
            const mins = (Date.parse(q.ended_at) - Date.parse(q.started_at)) / 60_000;
            if (!Number.isInteger(q.minutes) || Math.abs((q.minutes as number) - mins) > 1) out.push({ at: `${at}.minutes`, message: `minutes is the outage's length, whole: ${Math.round(mins)}.` });
          }
          const prev = (v.outages as Record<string, unknown>[])[i - 1];
          if (i > 0 && typeof prev?.started_at === "string" && typeof q.started_at === "string" && q.started_at < prev.started_at) out.push({ at, message: "Outages are oldest first." });
        });
      }
    }
  }
  return out;
}

/** The catalog as a map by key, for the observation and baseline checks. */
export function catalogMap(metrics: readonly MetricDefinition[]): Map<string, MetricDefinition> {
  return new Map(metrics.map((m) => [m.key, m]));
}

/** A stable order for observations: day, then metric, then dimensions. */
export function observationOrder(a: Pick<Observation, "local_period" | "metric_key" | "dimensions">, b: Pick<Observation, "local_period" | "metric_key" | "dimensions">): number {
  return a.local_period.localeCompare(b.local_period) || a.metric_key.localeCompare(b.metric_key) || dimensionKey(a.dimensions).localeCompare(dimensionKey(b.dimensions));
}

/** Dimensions as one comparable string, names sorted. The total ({}) sorts first. */
export function dimensionKey(d: Record<string, string>): string {
  return Object.keys(d)
    .sort()
    .map((k) => `${k}=${d[k]}`)
    .join("&");
}
