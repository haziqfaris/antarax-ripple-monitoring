// The developer link (V-22): the prompt, the pack, and where to paste the address. No sign-in; the token is the
// permission, kept as a hash, and expires in 14 days. It never shows the key. Rate-limited.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sha256Hex } from "@/vendor/lapisan/crypto";
import { inScope } from "@/lib/db";
import { rateLimit } from "@/lib/services/staff";
import { testConnection } from "@/lib/services/collect";
import { Refused } from "@/lib/services/actor";
import { env } from "@/lib/env";
import { devPrompt } from "@/domain/prompt";
import { CopyButton, Submit } from "../../_components/controls";
import { Notice, sp } from "../../_components/ui";

export const metadata = { title: "Developer link" };
export const dynamic = "force-dynamic";

async function find(token: string) {
  if (!/^[A-Za-z0-9]{20,64}$/.test(token)) return null;
  const h = await sha256Hex(token);
  return inScope("all", async (tx) => (await tx<{ id: string; name: string; org: string; unit_singular: string; unit_plural: string; objective: string; time_zone: string; base_url: string | null; state: string }[]>`
    select a.id, a.name, o.name as org, a.unit_singular, a.unit_plural, a.objective, o.time_zone, i.base_url, i.state
    from integrations i join applications a on a.id = i.application_id join organisations o on o.id = a.organisation_id
    where i.dev_token_hash = ${h} and i.dev_token_expires_at > now()`)[0] ?? null);
}

async function submitAddress(form: FormData) {
  "use server";
  const token = String(form.get("token") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!(await rateLimit(`dev:${ip}`, 20, 3600))) redirect(`/dev/${token}?e=` + encodeURIComponent("Too many tries from here. Try again in an hour."));
  const app = await find(token);
  if (!app) redirect(`/dev/${token}`);
  let to = `/dev/${token}`;
  try {
    const r = await testConnection(null, app.id, String(form.get("base") ?? ""));
    to += r.report.ok ? "?ok=" + encodeURIComponent("Connected. REKA can see the figures now; you're done.") : "?e=" + encodeURIComponent("The checks found problems: " + r.report.results.filter((x) => x.status === "fail").map((x) => `${x.title}${x.detail[0] ? ` (${x.detail[0]})` : ""}`).join("; "));
  } catch (e) {
    to += "?e=" + encodeURIComponent(e instanceof Refused ? e.message : "That didn't work. Check the address and the key, then try again.");
  }
  redirect(to);
}

export default async function DevLink({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const q = await searchParams;
  const app = await find(token);
  if (!app) return <main className="auth"><div className="card"><h1>This link has expired</h1><p className="muted">Ask REKA for a new developer link.</p></div></main>;
  const link = `${env().APP_URL.replace(/\/+$/, "")}/dev/${token}`;
  const prompt = devPrompt({ app: app.name, org: app.org, unitSingular: app.unit_singular, unitPlural: app.unit_plural, objective: app.objective, devLink: link, timeZone: app.time_zone });
  return (
    <main className="main" style={{ maxWidth: 900, margin: "0 auto" }}>
      <header className="topbar"><span className="axle-tag">AXLE</span><h1>Measurement Link for {app.name}</h1></header>
      <Notice e={sp(q.e)} ok={sp(q.ok)} />
      <section className="card">
        <h2>What to do</h2>
        <ol className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Give the prompt below to Claude Code (or follow it yourself) in {app.name}’s repository.</li>
          <li>Use the integration pack: the contract, a TypeScript kit, a Python signer, examples and the contract test. REKA sends it with this link.</li>
          <li>Set AX_MEASURE_KEY to the key REKA gave you, through your password manager.</li>
          <li>When the contract test passes, paste the address below. Outcomes runs the same checks and connects.</li>
        </ol>
      </section>
      <section className="card"><div className="card-head"><h2>The prompt</h2><CopyButton text={prompt} label="Copy the prompt" /></div><div className="code" tabIndex={0} role="region" aria-label="The prompt">{prompt}</div></section>
      <form action={submitAddress} className="card form">
        <input type="hidden" name="token" value={token} />
        <h2>Paste the address</h2>
        <div className="field"><label htmlFor="base">Base address, ending /internal/measure/v1</label><input className="input mono" id="base" name="base" defaultValue={app.base_url ?? ""} placeholder="https://app.example.com/internal/measure/v1" required /></div>
        <div><Submit primary>Test and connect</Submit></div>
      </form>
      <p className="small muted">This page never shows the key. It works for 14 days from when REKA made it.</p>
    </main>
  );
}
