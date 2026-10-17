import { describe, expect, it } from "vitest";
import { totpAt, verifyTotp, newTotpSecret } from "@/lib/auth/totp";
import { canDecide } from "@/lib/auth/roles";
import { linkState } from "@/domain/link-state";
import { parseCsv } from "@/domain/csv";
import { devPrompt } from "@/domain/prompt";

describe("two-step codes (RFC 6238 test vector, SHA-1)", () => {
  // RFC 6238 appendix B: secret "12345678901234567890", T = 59 → 94287082 (8 digits); 6 digits → 287082.
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  it("matches the RFC", async () => {
    expect(await totpAt(secret, 59)).toBe("287082");
    expect(await totpAt(secret, 1111111109)).toBe("081804");
  });
  it("accepts one step of drift and nothing more", async () => {
    const s = newTotpSecret(), now = 1_800_000_000;
    expect(await verifyTotp(s, await totpAt(s, now - 30), now)).toBe(true);
    expect(await verifyTotp(s, await totpAt(s, now - 90), now)).toBe(false);
  });
});

describe("separation of duties (V-09)", () => {
  it("stops whoever proposed or edited an item from approving it", () => {
    expect(canDecide("approver", "a", { proposedBy: "a" }).ok).toBe(false);
    expect(canDecide("approver", "a", { proposedBy: "b", editedBy: "a" }).ok).toBe(false);
    expect(canDecide("operator", "a", { proposedBy: "b" }).ok).toBe(false);
    expect(canDecide("approver", "a", { proposedBy: "b" }).ok).toBe(true);
  });
});

describe("link states (V-13)", () => {
  const y = "2026-10-16";
  it("reads in words, never a zero", () => {
    expect(linkState({ connected: false, health: null, lastDay: null, yesterday: y }).state).toBe("not_connected");
    expect(linkState({ connected: true, health: null, lastDay: y, yesterday: y }).state).toBe("not_answering");
    expect(linkState({ connected: true, health: "ok", lastDay: "2026-10-13", yesterday: y })).toMatchObject({ state: "late", why: "No new figures for 3 days" });
    expect(linkState({ connected: true, health: "ok", lastDay: "2026-10-15", yesterday: y }).state).toBe("on_time");
  });
});

describe("spreadsheet (V-15)", () => {
  const known = new Set(["claims.processed", "claims.returned"]);
  it("reads finished days; an empty cell is a gap", () => {
    const r = parseCsv("date,claims.processed,claims.returned\n2026-10-14,120,4\n2026-10-15,,2\n", known, "2026-10-17");
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([{ day: "2026-10-14", metric: "claims.processed", value: 120 }, { day: "2026-10-14", metric: "claims.returned", value: 4 }, { day: "2026-10-15", metric: "claims.returned", value: 2 }]);
  });
  it("refuses today, unknown columns, negatives and repeats", () => {
    expect(parseCsv("date,nope\n2026-10-14,1", known, "2026-10-17").problems[0]).toMatch(/not a figure/);
    const r = parseCsv("date,claims.processed\n2026-10-17,1\n2026-10-14,-2\n2026-10-13,1\n2026-10-13,1", known, "2026-10-17");
    expect(r.rows).toEqual([]);
    expect(r.problems).toHaveLength(3);
  });
});

describe("developer prompt", () => {
  it("is specific to the application and says never to send a zero for an uncounted day", () => {
    const t = devPrompt({ app: "Claim reader", org: "Harapan Foods", unitSingular: "claim", unitPlural: "claims", objective: "", devLink: "https://x/dev/abc", timeZone: "Asia/Kuala_Lumpur" });
    expect(t).toContain("claims.processed");
    expect(t).toContain('solution_id "harapan-foods-claim-reader"');
    expect(t).toMatch(/never send zero/);
  });
});
