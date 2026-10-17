// The kit's example application ("Document workflow (example)") served on http://localhost:4010/internal/measure/v1,
// signed with AX_MEASURE_KEY. A stand-in pilot for development and the end-to-end test. Every figure is invented.
import { createServer } from "node:http";
import { exampleAdapter, measureLink } from "../vendor/lapisan/measure/index";

const port = Number(process.env.EXAMPLE_PORT ?? 4010);
let key = process.env.AX_MEASURE_KEY ?? null;
const handler = measureLink(exampleAdapter({ missing: (process.env.EXAMPLE_MISSING ?? "").split(",").filter(Boolean) }), { key: () => key, onRefused: () => {}, onUnknownError: (e) => console.error(e) });

createServer(async (req, res) => {
  // For tests on this machine only: set the key the console just made (it is shown once there).
  if (req.method === "POST" && req.url === "/__set-key" && process.env.EXAMPLE_ALLOW_SET_KEY === "1") {
    let body = ""; for await (const c of req) body += c;
    key = body.trim(); res.writeHead(204).end(); return;
  }
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const r = await handler(new Request(url, { method: req.method, headers: req.headers as Record<string, string> }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`Example application on http://localhost:${port}/internal/measure/v1${key ? "" : " (no key yet: every path answers 404)"}`));
