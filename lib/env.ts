import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is not set"),
  SEAL_KEY: z.string().refine((v) => Buffer.from(v, "base64").length === 32, "SEAL_KEY must be 32 bytes, base64"),
  CRON_SECRET: z.string().min(24, "CRON_SECRET must be at least 24 characters"),
  APP_URL: z.string().url(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("AXLE · Outcomes <outcomes@antarax.ai>"),
  /** antarax.ai only sends (brand kit 13 §2): replies go to support. */
  MAIL_REPLY_TO: z.string().default("support@go.antarax.ai"),
  ALERT_TO: z.string().default(""),
  /** Tests only: sign-in e-mails are written to this file instead of sent. Never set it in a deployment. */
  MAIL_CAPTURE_FILE: z.string().optional(),
}).refine((e) => process.env.NODE_ENV !== "production" || e.RESEND_API_KEY || e.MAIL_CAPTURE_FILE, { message: "RESEND_API_KEY is needed: sign-in is by e-mailed link", path: ["RESEND_API_KEY"] });

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
