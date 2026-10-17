import { cronAllowed } from "@/lib/cron";
import { runAll } from "@/lib/services/collect";
import { flushOutbox } from "@/lib/services/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** V-12: nightly collection for every application, each on its own; then the outbox. */
export async function GET(req: Request) {
  if (!cronAllowed(req)) return new Response("Not found", { status: 404 });
  const results = await runAll("nightly");
  const mail = await flushOutbox();
  return Response.json({ object: "run", kind: "nightly", ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, mail });
}
