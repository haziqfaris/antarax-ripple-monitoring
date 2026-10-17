import "server-only";
import { redirect, unstable_rethrow } from "next/navigation";
import { Refused } from "./services/actor";

const withParam = (path: string, k: string, v: string) => {
  const [p, hash] = path.split("#");
  const u = new URL(p!, "http://x");
  u.searchParams.set(k, v);
  return `${u.pathname}${u.search}${hash ? `#${hash}` : ""}`;
};

/**
 * Run a form's work, then go back with a plain message. A refusal (a rule, a missing role) says why;
 * anything else is logged on the server and the page says only that it failed. Never echoes a secret.
 */
export async function act(back: string, fn: () => Promise<string | { to?: string; ok?: string } | void>): Promise<never> {
  let to: string;
  try {
    const r = await fn();
    to = typeof r === "string" ? r : r?.to ? (r.ok ? withParam(r.to, "ok", r.ok) : r.to) : r?.ok ? withParam(back, "ok", r.ok) : back;
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof Refused) to = withParam(back, "e", e.message);
    else { console.error(e); to = withParam(back, "e", "That didn't work. The details are in the server log."); }
  }
  redirect(to);
}

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const numOrNull = (f: FormData, k: string) => { const v = str(f, k).replace(/,/g, ""); if (v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : NaN; };
