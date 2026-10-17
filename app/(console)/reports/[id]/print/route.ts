import { actorFor } from "@/lib/services/staff";
import { sessionToken } from "@/lib/auth/session";
import { getReport } from "@/lib/services/reports";

/** The frozen, approved report exactly as hashed. Print it, or save it as PDF, from the browser. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await actorFor(await sessionToken()))) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  const r = await getReport(id).catch(() => null);
  if (!r || r.status !== "approved" || !r.html) return new Response("Not approved yet.", { status: 404 });
  return new Response(r.html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-sha256": r.html_sha256 ?? "", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; frame-ancestors 'self'" } });
}
