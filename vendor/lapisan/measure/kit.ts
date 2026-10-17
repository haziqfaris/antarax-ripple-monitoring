import { fromBase64Url, toBase64Url } from "../crypto";
import { checkMeasureCall, type MeasureCheckFailure } from "./auth";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_OBSERVATION_DAYS,
  MEASURE_ERRORS,
  MEASURE_PATHS,
  MEASURE_SCHEMA_VERSION,
  catalogMap,
  checkBaseline,
  checkCapacity,
  checkHealth,
  checkManifest,
  checkObservation,
  dayBounds,
  daysBetween,
  isDate,
  momentOf,
  observationOrder,
  type Baseline,
  type Capability,
  type Capacity,
  type CapacityResource,
  type Manifest,
  type MeasureErrorCode,
  type MeasureHealthStatus,
  type MetricDefinition,
  type Observation,
  type ObservationQuality,
  type Problem,
} from "./contract";
import { MEASURE_OPENAPI } from "./openapi";

/**
 * The Measurement Link kit: every endpoint of the interface, its signed
 * door, paging and checks, written once. A solution hands over a small
 * adapter that knows its own figures; the kit answers in the contract's
 * shape and refuses to serve anything that would not pass the contract
 * test. Same pattern as AXLE Link's kit (src/link).
 *
 *   export const measure = measureLink(adapter, { key: () => env.AX_MEASURE_KEY });
 *   // Next.js: app/internal/measure/v1/[...path]/route.ts
 *   export const GET = measure;
 */

/** What the solution says about itself. The kit adds the rest of the manifest. */
export interface SolutionDescription {
  solution_id: string;
  solution_name: string;
  environment: Manifest["environment"];
  time_zone: string;
  metric_catalog_version: string;
  metrics: MetricDefinition[];
  retention_days?: number;
}

/** One day's figure as the solution knows it. The kit adds the period's UTC bounds, the unit and the object. */
export interface ObservationInput {
  metric_key: string;
  /** The local day, YYYY-MM-DD, in the solution's time zone. */
  local_period: string;
  value: number | string;
  /** Leave out, or {}, for the day's total. */
  dimensions?: Record<string, string>;
  count?: number;
  sum?: number;
  /** Default "measured". */
  quality?: ObservationQuality;
  /** Default "application_aggregate". */
  source?: string;
}

/** One resource as the application's latest snapshot has it. The kit works out percent when it is left out. */
export type CapacityResourceInput = Omit<CapacityResource, "percent" | "runway_days"> & { percent?: number | null; runway_days?: number | null };

/** The capacity summary, from the snapshots the application's capacity check already takes. The kit adds the object. */
export interface CapacityAnswer {
  snapshot_at: string;
  capacity_updated: string;
  resources: CapacityResourceInput[];
  availability: Capacity["availability"];
}

export interface MeasureAdapter {
  describe(): SolutionDescription | Promise<SolutionDescription>;
  /**
   * Every figure for the local days from `from` to `to`, both included, for
   * one metric or all. Days not finished yet are dropped by the kit; days
   * with no figures are simply missing (a gap, never a zero).
   */
  observations(query: { from: string; to: string; metric: string | null }): Promise<ObservationInput[]>;
  /** The solution's own summary of itself, and each metric's last complete day. */
  health(now: number): Promise<{ status: MeasureHealthStatus; problems: string[]; freshness: Record<string, string | null> }>;
  /** Baselines the solution holds, with where they came from. Optional. */
  baselines?(): Promise<Omit<Baseline, "object" | "unit">[]>;
  /**
   * Optional and supplementary (docs/14, 14.5a): the latest snapshots of the
   * resources in the application's capacity.json, read as they are. Measure
   * nothing new for it, and never include a cost, a plan or an account.
   * Present: the manifest lists "capacity" and GET /capacity answers.
   */
  capacity?(now: number): Promise<CapacityAnswer>;
}

export class MeasureError extends Error {
  readonly status: number;
  readonly code: MeasureErrorCode;
  /** Seconds, for 429 and 503. */
  readonly retryAfter?: number;
  constructor(code: MeasureErrorCode, message: string, retryAfter?: number) {
    super(message);
    this.name = "MeasureError";
    this.code = code;
    this.status = MEASURE_ERRORS[code];
    this.retryAfter = retryAfter;
  }
}

type Maybe<T> = T | (() => T | Promise<T>);
const read = async <T>(v: Maybe<T>): Promise<T> => (typeof v === "function" ? await (v as () => T | Promise<T>)() : v);

export interface MeasureAuditEntry {
  requestId: string;
  path: string;
  query: string;
  status: number;
  /** How many items the answer held, for lists. */
  count?: number;
}

export interface MeasureLinkOptions {
  /** The measurement key (AX_MEASURE_KEY). Missing: every path answers 404, as an unconfigured link should. */
  key: Maybe<string | null | undefined>;
  /** The next key, while one is being rotated in (AX_MEASURE_KEY_NEXT). */
  nextKey?: Maybe<string | null | undefined>;
  /** Whether the link is switched on. Default on. Off: every path answers 404. */
  enabled?: Maybe<boolean>;
  /** Every signed call, answered or refused. */
  audit?: (entry: MeasureAuditEntry) => void | Promise<void>;
  /** Unknown errors, and figures that failed the contract's checks. Default console.error. */
  onUnknownError?: (error: unknown, requestId: string) => void;
  /** A signature that did not check out, and why. Default console.warn. Never shown to the caller. */
  onRefused?: (why: MeasureCheckFailure, path: string, requestId: string) => void;
  /** Check every answer against the contract before sending it. Default on; leave it on. */
  checkAnswers?: boolean;
  /** Milliseconds since the epoch. Default Date.now. */
  now?: () => number;
}

const newRequestId = () => `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

function answer(status: number, body: unknown, requestId: string, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-request-id": requestId, ...extra },
  });
}

function errorAnswer(status: number, code: string, message: string, requestId: string, extra: Record<string, string> = {}): Response {
  return answer(status, { error: { code, message, request_id: requestId } }, requestId, extra);
}

/** The figures failed the contract's own checks: a bug in the adapter, logged, never served. */
class BadFigures extends Error {
  constructor(readonly problems: Problem[]) {
    super(`Measurement Link: the adapter's figures failed the contract: ${problems.slice(0, 5).map((p) => `${p.at}: ${p.message}`).join("; ")}`);
    this.name = "BadFigures";
  }
}

const ALLOWED: Record<string, readonly string[]> = {
  manifest: [],
  metrics: ["cursor", "limit"],
  observations: ["from", "to", "metric", "cursor", "limit"],
  health: [],
  baselines: ["cursor", "limit"],
  capacity: [],
  "openapi.json": [],
};

function limitOf(url: URL): number {
  const raw = url.searchParams.get("limit");
  if (raw === null) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || n < 1 || n > MAX_LIMIT) throw new MeasureError("invalid_request", `limit is a whole number from 1 to ${MAX_LIMIT}.`);
  return n;
}

/** A page of a list. The cursor remembers the question, so it cannot be used for a different one. */
function page<T>(all: T[], url: URL, question: string): { data: T[]; next: string | null } {
  const limit = limitOf(url);
  const raw = url.searchParams.get("cursor");
  let offset = 0;
  if (raw !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fromBase64Url(raw));
    } catch {
      parsed = null;
    }
    const [q, o] = Array.isArray(parsed) ? parsed : [];
    if (q !== question || !Number.isInteger(o) || (o as number) < 0) throw new MeasureError("invalid_cursor", "That cursor is not one this list gave out for this question.");
    offset = o as number;
  }
  const data = all.slice(offset, offset + limit);
  return { data, next: offset + limit < all.length ? toBase64Url(JSON.stringify([question, offset + limit])) : null };
}

/** The whole interface behind one function: (request) => response. */
export function measureLink(adapter: MeasureAdapter, options: MeasureLinkOptions): (request: Request) => Promise<Response> {
  const report = options.onUnknownError ?? ((e: unknown, id: string) => console.error(`[measure link ${id}]`, e));
  const refused = options.onRefused ?? ((why: MeasureCheckFailure, path: string) => console.warn(`measure link: refused ${path} (${why})`));
  const clock = options.now ?? Date.now;
  const strict = options.checkAnswers ?? true;

  async function manifest(): Promise<Manifest> {
    const d = await adapter.describe();
    const capabilities: Capability[] = ["metrics", "observations", "health"];
    if (adapter.baselines) capabilities.push("baselines");
    if (adapter.capacity) capabilities.push("capacity");
    const m: Manifest = {
      object: "manifest",
      schema_version: MEASURE_SCHEMA_VERSION,
      solution_id: d.solution_id,
      solution_name: d.solution_name,
      environment: d.environment,
      time_zone: d.time_zone,
      capabilities,
      metric_catalog_version: d.metric_catalog_version,
      reporting_periods: ["day"],
      data_policy: { aggregation: "daily", contains_personal_data: false, ...(d.retention_days ? { retention_days: d.retention_days } : {}) },
      metrics: d.metrics.map((x) => ({ ...x, privacy: "aggregate" as const })),
    };
    if (strict) {
      const problems = checkManifest(m);
      if (problems.length) throw new BadFigures(problems);
    }
    return m;
  }

  const handlers: Record<string, (url: URL, now: number) => Promise<{ body: unknown; count?: number }>> = {
    async manifest() {
      return { body: await manifest() };
    },

    async metrics(url) {
      const m = await manifest();
      const p = page(m.metrics, url, `metrics|${m.metric_catalog_version}`);
      return { body: { object: "list", data: p.data, next: p.next }, count: p.data.length };
    },

    async observations(url, now) {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const metric = url.searchParams.get("metric");
      if (!isDate(from)) throw new MeasureError("invalid_request", "from is a local day, YYYY-MM-DD.");
      if (!isDate(to)) throw new MeasureError("invalid_request", "to is a local day, YYYY-MM-DD.");
      if (to < from) throw new MeasureError("invalid_request", "to is on or after from.");
      if (daysBetween(from, to) > MAX_OBSERVATION_DAYS) throw new MeasureError("invalid_request", `At most ${MAX_OBSERVATION_DAYS} days in one read; ask in windows.`);
      const m = await manifest();
      const metrics = catalogMap(m.metrics);
      if (metric !== null && !metrics.has(metric)) throw new MeasureError("invalid_request", `metric "${metric}" is not in this solution's catalog.`);
      const rows = await adapter.observations({ from, to, metric });
      const out: Observation[] = [];
      const problems: Problem[] = [];
      for (const r of rows) {
        const def = metrics.get(r.metric_key);
        if (!isDate(r.local_period) || r.local_period < from || r.local_period > to || (metric && r.metric_key !== metric)) continue;
        const bounds = dayBounds(r.local_period, m.time_zone);
        if (Date.parse(bounds.period_end) > now) continue;
        const o: Observation = {
          object: "observation",
          metric_key: r.metric_key,
          ...bounds,
          local_period: r.local_period,
          value: r.value,
          unit: def?.unit ?? "",
          dimensions: r.dimensions ?? {},
          ...(r.count !== undefined ? { count: r.count } : {}),
          ...(r.sum !== undefined ? { sum: r.sum } : {}),
          quality: r.quality ?? "measured",
          source: r.source ?? "application_aggregate",
        };
        if (strict) problems.push(...checkObservation(o, { metrics, timeZone: m.time_zone }, `observation ${r.metric_key} ${r.local_period}`));
        out.push(o);
      }
      if (problems.length) throw new BadFigures(problems);
      out.sort(observationOrder);
      for (let i = 1; i < out.length; i++) {
        const a = out[i - 1]!, b = out[i]!;
        if (strict && observationOrder(a, b) === 0) throw new BadFigures([{ at: `observation ${b.metric_key} ${b.local_period}`, message: "The same metric, day and dimensions came twice." }]);
      }
      const p = page(out, url, `observations|${from}|${to}|${metric ?? ""}|${m.metric_catalog_version}`);
      return { body: { object: "list", from, to, time_zone: m.time_zone, data: p.data, next: p.next }, count: p.data.length };
    },

    async health(_url, now) {
      const m = await manifest();
      const h = await adapter.health(now);
      const body = { object: "health", status: h.status, checked_at: momentOf(now), problems: h.problems, freshness: h.freshness };
      if (strict) {
        const problems = checkHealth(body, new Set(m.metrics.map((x) => x.key)));
        if (problems.length) throw new BadFigures(problems);
      }
      return { body };
    },

    async baselines(url) {
      if (!adapter.baselines) throw new MeasureError("not_found", "There is nothing here.");
      const m = await manifest();
      const metrics = catalogMap(m.metrics);
      const list = (await adapter.baselines()).map((b) => ({ object: "baseline" as const, ...b, unit: metrics.get(b.metric_key)?.unit ?? "" }));
      if (strict) {
        const problems = list.flatMap((b, i) => checkBaseline(b, metrics, `baselines[${i}]`));
        if (problems.length) throw new BadFigures(problems);
      }
      const p = page(list, url, `baselines|${list.length}`);
      return { body: { object: "list", data: p.data, next: p.next }, count: p.data.length };
    },

    async capacity(_url, now) {
      if (!adapter.capacity) throw new MeasureError("not_found", "There is nothing here.");
      const { snapshot_at, capacity_updated, resources, availability, ...extra } = await adapter.capacity(now);
      const body: Capacity = {
        object: "capacity",
        snapshot_at,
        capacity_updated,
        resources: (resources ?? []).map(({ id, class: cls, name, unit, used, limit, per, percent, runway_days, measured_at, how, why_not, ...rest }) => ({
          id,
          class: cls,
          name,
          unit,
          used,
          limit,
          per,
          percent: percent !== undefined ? percent : typeof used === "number" && typeof limit === "number" && limit > 0 ? Math.round((used / limit) * 1000) / 10 : null,
          runway_days: runway_days ?? null,
          measured_at,
          how,
          ...(why_not !== undefined ? { why_not } : {}),
          ...rest,
        })),
        availability,
        ...extra,
      };
      if (strict) {
        const problems = checkCapacity(body);
        if (problems.length) throw new BadFigures(problems);
      }
      return { body };
    },

    async "openapi.json"() {
      return { body: MEASURE_OPENAPI };
    },
  };

  const names = new Map<string, string>(Object.values(MEASURE_PATHS).map((path) => [path, path.slice(path.lastIndexOf("/") + 1)]));

  return async (request: Request): Promise<Response> => {
    const requestId = newRequestId();
    const notHere = () => errorAnswer(404, "not_found", "There is nothing here.", requestId);
    const key = (await read(options.key))?.trim();
    if (!key) return notHere();
    if (options.enabled !== undefined && !(await read(options.enabled))) return notHere();
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const name = names.get(path);
    if (request.method !== "GET" || !name) return notHere();
    // An optional route the solution does not offer is not there, the same answer as a wrong path.
    if ((name === "baselines" && !adapter.baselines) || (name === "capacity" && !adapter.capacity)) return notHere();

    const now = clock();
    const checked = await checkMeasureCall([key, await read(options.nextKey ?? null)], request.method, url, request.headers, Math.floor(now / 1000));
    if (!checked.ok) {
      refused(checked.why, path, requestId);
      return errorAnswer(401, "invalid_signature", "This call is not signed with this solution's measurement key, or its time is more than five minutes off.", requestId, {
        "www-authenticate": 'AntaraX-Service realm="antarax"',
      });
    }

    const audit = async (status: number, count?: number) => {
      if (!options.audit) return;
      try {
        await options.audit({ requestId, path, query: url.search, status, count });
      } catch (error) {
        report(error, requestId);
      }
    };

    try {
      const unknown = [...url.searchParams.keys()].find((k) => !ALLOWED[name]!.includes(k));
      if (unknown) throw new MeasureError("invalid_request", `Not a parameter here: ${unknown}.`);
      const result = await handlers[name]!(url, now);
      await audit(200, result.count);
      return answer(200, result.body, requestId);
    } catch (error) {
      if (error instanceof MeasureError) {
        await audit(error.status);
        return errorAnswer(error.status, error.code, error.message, requestId, error.retryAfter ? { "retry-after": String(error.retryAfter) } : {});
      }
      report(error, requestId);
      await audit(500);
      return errorAnswer(500, "internal", "Something went wrong on our side. It has been recorded; try again.", requestId);
    }
  };
}
