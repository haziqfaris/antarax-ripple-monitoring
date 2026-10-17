import { cronAllowed } from "@/lib/cron";
import { runAll } from "@/lib/services/collect";
import { flushOutbox } from "@/lib/services/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** V-13: the hourly health check; changes states and why, never figures. Then the outbox. */
export async function GET(req: Request) {
  if (!cronAllowed(req)) return new Response("Not found", { status: 404 });
  const results = await runAll("health");
  const mail = await flushOutbox();
  return Response.json({ object: "run", kind: "health", ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, mail });
}
