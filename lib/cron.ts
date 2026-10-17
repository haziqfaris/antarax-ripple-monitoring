import "server-only";
import { env } from "./env";
import { timingSafeEqual } from "../vendor/lapisan/crypto";

/** Vercel Cron calls with Authorization: Bearer CRON_SECRET. Anything else is refused. */
export function cronAllowed(req: Request): boolean {
  const h = req.headers.get("authorization") ?? "";
  return timingSafeEqual(h, `Bearer ${env().CRON_SECRET}`);
}
