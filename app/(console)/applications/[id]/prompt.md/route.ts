import { actorFor } from "@/lib/services/staff";
import { sessionToken } from "@/lib/auth/session";
import { getApplication } from "@/lib/services/applications";
import { env } from "@/lib/env";
import { devPrompt } from "@/domain/prompt";
import { slug } from "@/domain/format";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await actorFor(await sessionToken()))) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  const { app, org } = await getApplication(id).catch(() => ({ app: null, org: null }) as never);
  if (!app) return new Response("Not found", { status: 404 });
  const text = devPrompt({ app: app.name, org: org.name, unitSingular: app.unit_singular, unitPlural: app.unit_plural, objective: app.objective, devLink: `${env().APP_URL.replace(/\/+$/, "")}/dev/…`, timeZone: org.time_zone });
  return new Response(text, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${slug(app.name)}-measurement-link.md"`, "cache-control": "no-store" } });
}
