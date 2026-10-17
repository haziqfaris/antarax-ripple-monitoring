import { describe, expect, it } from "vitest";
import { compute, dayRange, organisationHours, series, standardKpis, checkFormula, type Days } from "@/domain/kpi";

const day = (figs: Record<string, { value: number; count?: number; sum?: number }>) => new Map(Object.entries(figs));

describe("hours saved: PRD §10.3 worked example (V-19 golden test)", () => {
  // 4,812 documents; by hand 18 min (14 to 22); machine 0.6 min (36 s, re-weighted); review 4 min (3 to 6).
  const days: Days = new Map([["2026-09-30", day({ "documents.generated": { value: 4812 }, "documents.generation_duration": { value: 36, count: 4812, sum: 36 * 4812 } })]]);
  const baseline = { low: 14, mid: 18, high: 22, reviewLow: 3, reviewMid: 4, reviewHigh: 6, appliesFrom: "2026-06-01" };
  const r = compute({ op: "hours_saved", volume: "documents.generated", machine: "documents.generation_duration" }, ["2026-09-30"], days, { baseline });
  it("gives 1,075 hours, likely 593 to 1,476", () => {
    expect(r.quality).toBe("estimated");
    expect(Math.round(r.value!)).toBe(1075);
    expect(Math.round(r.low!)).toBe(593);
    expect(Math.round(r.high!)).toBe(1476);
    expect(r.parts?.machineMinutes).toBeCloseTo(0.6, 6);
  });
  it("is unavailable without a baseline, never zero", () => {
    const n = compute({ op: "hours_saved", volume: "documents.generated" }, ["2026-09-30"], days);
    expect(n.value).toBeNull();
    expect(n.why).toMatch(/baseline/);
  });
  it("doesn't count days before the baseline applies", () => {
    const n = compute({ op: "hours_saved", volume: "documents.generated" }, ["2026-09-30"], days, { baseline: { ...baseline, appliesFrom: "2026-10-01" } });
    expect(n.value).toBeNull();
  });
});

describe("the engine", () => {
  const window = dayRange("2026-10-01", "2026-10-05");
  const days: Days = new Map([
    ["2026-10-01", day({ v: { value: 100 }, c: { value: 10 }, p: { value: 4 }, d: { value: 30, count: 100, sum: 3000 } })],
    ["2026-10-02", day({ v: { value: 300 }, c: { value: 6 }, p: { value: 8 }, d: { value: 10, count: 300, sum: 3000 } })],
    // 10-03 missing: a gap
    ["2026-10-04", day({ v: { value: 0 }, c: { value: 0 }, p: { value: 0 } })],
    ["2026-10-05", day({ v: { value: 100 }, c: { value: 4 } })],
  ]);
  it("sums counters and counts gaps as missing, not zero", () => {
    const r = compute({ op: "sum", metric: "v" }, window, days);
    expect(r.value).toBe(500);
    expect(r).toMatchObject({ expected: 5, withData: 4, missing: 1, quality: "measured" });
  });
  it("recomputes a ratio from its parts, never averages percentages", () => {
    const r = compute({ op: "ratio", numerator: "c", denominator: "v" }, window, days);
    expect(r.value).toBeCloseTo((100 * 20) / 500, 10); // not the mean of 10%, 2%, 4%
  });
  it("re-weights durations from sum and count", () => {
    expect(compute({ op: "mean_duration", metric: "d" }, window, days).value).toBe(15); // 6000 / 400, not (30 + 10) / 2
  });
  it("averages distinct counts by day, never adds them", () => {
    expect(compute({ op: "daily_average", metric: "p" }, window, days).value).toBe(4);
  });
  it("expects nothing before the first figures", () => {
    const r = compute({ op: "sum", metric: "v" }, window, days, { since: "2026-10-04" });
    expect(r).toMatchObject({ expected: 2, withData: 2, value: 100 });
  });
  it("marks gaps in a trend as null", () => {
    expect(series("v", window, days).map((p) => p.value)).toEqual([100, 300, null, 0, 100]);
  });
});

describe("standard KPIs and formulas", () => {
  it("builds the three standard KPIs from the mapping", () => {
    const k = standardKpis({ volume: "claims.processed", corrections: "claims.returned", machine: null, unitPlural: "claims" });
    expect(k.map((x) => x.name)).toEqual(["Claims handled", "Share of claims needing correction", "Hours saved"]);
    expect(k[1]!.better).toBe("down");
  });
  it("refuses a formula over the wrong kind of figure", () => {
    const cat = new Map([["a", { type: "counter" }], ["p", { type: "distinct" }], ["d", { type: "duration" }]]);
    expect(checkFormula({ op: "sum", metric: "p" }, cat)).toHaveLength(1);
    expect(checkFormula({ op: "hours_saved", volume: "a", machine: "d" }, cat)).toHaveLength(0);
    expect(checkFormula({ op: "hours_saved", volume: "a", machine: "a" }, cat)).toHaveLength(1);
    expect(checkFormula({ op: "sum", metric: "zzz" }, cat)[0]).toMatch(/not a figure/);
  });
  it("adds hours across applications and says what it left out", () => {
    const t = organisationHours([
      { application: "A", result: { value: 10, low: 5, high: 15, quality: "estimated", expected: 1, withData: 1, missing: 0 } },
      { application: "B", result: { value: null, quality: "unavailable", expected: 1, withData: 0, missing: 1 } },
    ]);
    expect(t).toMatchObject({ value: 10, low: 5, high: 15, included: 1, of: 2, left: ["B"] });
  });
});
