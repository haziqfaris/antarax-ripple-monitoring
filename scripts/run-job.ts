// Run a scheduled job by hand: npm run jobs:run -- nightly | health | mail
import { runAll } from "../lib/services/collect";
import { flushOutbox } from "../lib/services/mail";
import { closeDb } from "../lib/db";

const job = process.argv[2];
(async () => {
  if (job === "nightly" || job === "health") for (const r of await runAll(job)) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.app}: ${r.note}`);
  else if (job === "mail") console.log(await flushOutbox());
  else { console.error("Usage: npm run jobs:run -- nightly | health | mail"); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => closeDb());
