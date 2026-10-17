import { actorFor } from "@/lib/services/staff";
import { sessionToken } from "@/lib/auth/session";
import { sheetTemplate } from "@/lib/services/sheet";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await actorFor(await sessionToken()))) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  const text = await sheetTemplate(id).catch(() => null);
  if (text === null) return new Response("Not found", { status: 404 });
  return new Response(text, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="figures-template.csv"`, "cache-control": "no-store" } });
}
