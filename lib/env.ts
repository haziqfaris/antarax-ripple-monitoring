import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is not set"),
  SEAL_KEY: z.string().refine((v) => Buffer.from(v, "base64").length === 32, "SEAL_KEY must be 32 bytes, base64"),
  CRON_SECRET: z.string().min(24, "CRON_SECRET must be at least 24 characters"),
  APP_URL: z.string().url(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Outcomes <outcomes@localhost>"),
  ALERT_TO: z.string().default(""),
});

export type Env = z.infer<typeof schema>;
let cached: Env | null = null;

/** Read and check the environment once. Throws with every problem named, never with a value. */
export function env(): Env {
  if (cached) return cached;
  const r = schema.safeParse(process.env);
  if (!r.success) throw new Error("Environment: " + r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  cached = r.data;
  return cached;
}

/** Tests change the environment between files. */
export function resetEnv(): void { cached = null; }
