import { addLocalDays, daysBetween, localDate, momentOf, type MetricDefinition } from "./contract";
import type { CapacityAnswer, MeasureAdapter, ObservationInput, SolutionDescription } from "./kit";

/**
 * An invented solution for tests, the integration pack's examples and the
 * contract test's --example run: a document workflow at "Contoh Logistik"
 * (contoh is Malay for example). Every figure is made up, from the day
 * alone, so the same day always gives the same figures.
 */

export const EXAMPLE_METRICS: MetricDefinition[] = [
  { key: "documents.generated", label: "Documents generated", type: "counter", unit: "document", description: "Documents the workflow produced and sent on.", dimensions: ["document_type"], privacy: "aggregate", since: "2026-06-01" },
  { key: "documents.returned_for_correction", label: "Returned for correction", type: "counter", unit: "document", description: "Documents a person sent back to be fixed.", dimensions: ["document_type"], privacy: "aggregate", since: "2026-06-01" },
  { key: "documents.generation_duration", label: "Time to generate", type: "duration", unit: "second", aggregation: "mean", description: "Machine time to produce one document, from upload to ready.", privacy: "aggregate", since: "2026-06-01" },
  { key: "documents.correction_rate", label: "Correction rate", type: "ratio", unit: "percent", numerator: "documents.returned_for_correction", denominator: "documents.generated", description: "Share of documents returned for correction.", privacy: "aggregate", since: "2026-06-01" },
  { key: "operators.active", label: "People using it", type: "distinct", unit: "person", identity: "operator", description: "People who used the workflow that day, each counted once.", privacy: "aggregate", since: "2026-06-01" },
  { key: "runs.failed", label: "Failed runs", type: "counter", unit: "run", description: "Runs that stopped with an error and needed a person.", privacy: "aggregate", since: "2026-06-01" },
];

const TYPES = [
  ["invoice", 0.62],
  ["delivery_order", 0.3],
  ["credit_note", 0.08],
] as const;

/** A number from 0 to 1, the same for the same text. */
function noise(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

export interface ExampleOptions {
  /** Days with no figures (the solution was down): gaps, never zeros. */
  missing?: readonly string[];
  /** The first day with figures. Default 2026-06-01. */
  goLive?: string;
  timeZone?: string;
  /** Share the optional capacity summary. Default true. */
  capacity?: boolean;
}

/**
 * The example's capacity summary: what its nightly capacity check took at
 * 06:00 Kuala Lumpur (22:00 UTC) before now. Invented figures, as if read
 * from an example capacity.json; no costs or plans, as the contract says.
 */
export function exampleCapacity(now: number): CapacityAnswer {
  const day = 86_400_000;
  const snapshot = Math.floor((now - 22 * 3_600_000) / day) * day + 22 * 3_600_000;
  const at = momentOf(snapshot);
  const outageDay = new Date(snapshot - 6 * day).toISOString().slice(0, 10);
  const started = Date.parse(`${outageDay}T03:12:00Z`);
  return {
    snapshot_at: at,
    capacity_updated: "2026-10-01",
    resources: [
      { id: "database", class: "data", name: "Database size (example)", unit: "byte", used: 6_550_000_000, limit: 8_589_934_592, per: "none", runway_days: 150, measured_at: at, how: "query" },
      { id: "files", class: "files", name: "Stored documents (example)", unit: "byte", used: 44_200_000_000, limit: 107_374_182_400, per: "none", runway_days: 410, measured_at: at, how: "provider-api" },
      { id: "db-connections", class: "connections", name: "Database connections at the busiest hour (example)", unit: "x.connection", used: 54, limit: 60, per: "none", runway_days: null, measured_at: at, how: "query" },
      { id: "requests", class: "requests", name: "Requests this month (example)", unit: "request", used: 1_840_000, limit: 5_000_000, per: "month", runway_days: null, measured_at: at, how: "provider-api" },
      { id: "ai-tokens", class: "ai", name: "AI tokens this month (example)", unit: "x.token", used: 12_400_000, limit: 20_000_000, per: "month", runway_days: null, measured_at: at, how: "log" },
      { id: "egress", class: "transfer", name: "Bandwidth out (example)", unit: "byte", used: null, limit: 107_374_182_400, per: "month", measured_at: null, how: "none", why_not: "The host has no usage API yet" },
    ],
    availability: {
      every_minutes: 5,
      last_checked_at: momentOf(Math.floor(now / 300_000) * 300_000),
      last_result: "up",
      up_share_90d: Math.round((1 - 14 / (90 * 1440)) * 10_000) / 10_000,
      outages: [{ started_at: momentOf(started), ended_at: momentOf(started + 14 * 60_000), minutes: 14 }],
    },
  };
}

/** One day's figures for the example solution. */
export function exampleDay(date: string): ObservationInput[] {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const trend = Math.min(daysBetween("2026-06-01", date), 120) / 120;
  const total = Math.round((weekend ? 18 : 150 + 60 * trend) * (0.85 + 0.3 * noise(`v${date}`)));
  const split = TYPES.map(([t, share], i) => [t, i === TYPES.length - 1 ? 0 : Math.round(total * share)] as [string, number]);
  split[split.length - 1]![1] = total - split.slice(0, -1).reduce((a, [, n]) => a + n, 0);
  const rate = 0.06 - 0.025 * trend + 0.01 * noise(`r${date}`);
  const returned = split.map(([t, n]) => [t, Math.round(n * rate)] as [string, number]);
  const ret = returned.reduce((a, [, n]) => a + n, 0);
  const mean = Math.round((34 + 8 * noise(`d${date}`)) * 10) / 10;
  const out: ObservationInput[] = [
    { metric_key: "documents.generated", local_period: date, value: total },
    ...split.filter(([, n]) => n > 0).map(([t, n]) => ({ metric_key: "documents.generated", local_period: date, value: n, dimensions: { document_type: t } })),
    { metric_key: "documents.returned_for_correction", local_period: date, value: ret },
    ...returned.filter(([, n]) => n > 0).map(([t, n]) => ({ metric_key: "documents.returned_for_correction", local_period: date, value: n, dimensions: { document_type: t } })),
    { metric_key: "documents.generation_duration", local_period: date, value: mean, count: total, sum: Math.round(mean * total * 10) / 10 },
    { metric_key: "documents.correction_rate", local_period: date, value: total ? Math.round((1000 * ret) / total) / 10 : 0, quality: "derived" },
    { metric_key: "operators.active", local_period: date, value: weekend ? 2 : 9 + Math.round(4 * noise(`p${date}`)) },
    { metric_key: "runs.failed", local_period: date, value: Math.round(3 * noise(`f${date}`) * (weekend ? 0.3 : 1)) },
  ];
  return out;
}

export function exampleAdapter(o: ExampleOptions = {}): MeasureAdapter {
  const goLive = o.goLive ?? "2026-06-01";
  const tz = o.timeZone ?? "Asia/Kuala_Lumpur";
  const missing = new Set(o.missing ?? []);
  const withCapacity = o.capacity ?? true;
  const description: SolutionDescription = {
    solution_id: "contoh-document-workflow",
    solution_name: "Document workflow (example)",
    environment: "production",
    time_zone: tz,
    metric_catalog_version: "2026-10-15",
    metrics: EXAMPLE_METRICS,
    retention_days: 400,
  };
  const adapter: MeasureAdapter = {
    describe: () => description,
    async observations({ from, to, metric }) {
      const out: ObservationInput[] = [];
      for (let d = from < goLive ? goLive : from; d <= to; d = addLocalDays(d, 1)) if (!missing.has(d)) out.push(...exampleDay(d));
      return metric ? out.filter((x) => x.metric_key === metric) : out;
    },
    async health(now) {
      let last = addLocalDays(localDate(now, tz), -1);
      while (missing.has(last)) last = addLocalDays(last, -1);
      const yesterdayMissing = missing.has(addLocalDays(localDate(now, tz), -1));
      return {
        status: yesterdayMissing ? "degraded" : "ok",
        problems: yesterdayMissing ? ["aggregates_late"] : [],
        freshness: Object.fromEntries(EXAMPLE_METRICS.map((m) => [m.key, last < goLive ? null : last])),
      };
    },
    async baselines() {
      return [
        {
          metric_key: "documents.generation_duration",
          value: 1260,
          method: "timed_sample",
          period_from: "2026-05-04",
          period_to: "2026-05-15",
          sample_size: 40,
          evidence: "Timed sample of 40 documents prepared by hand before go-live, signed by the accounts payable lead.",
          recorded_at: "2026-05-18T03:00:00Z",
        },
      ];
    },
  };
  if (withCapacity) adapter.capacity = async (now) => exampleCapacity(now);
  return adapter;
}
