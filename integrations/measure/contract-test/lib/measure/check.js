// Generated from haziqfaris/antarax-api packages/lapisan-core/src by scripts/build-measure-pack.mjs. Do not edit.
import { newMeasureKey, signMeasureCall } from "./auth.js";
import { MAX_DIMENSION_VALUES, MAX_OBSERVATION_DAYS, addLocalDays, catalogMap, checkBaseline, checkHealth, checkManifest, checkMetric, checkObservation, dimensionKey, localDate, observationOrder, } from "./contract.js";
const MAX_SHOWN = 8;
const lines = (problems) => problems.slice(0, MAX_SHOWN).map((p) => `${p.at}: ${p.message}`).concat(problems.length > MAX_SHOWN ? [`and ${problems.length - MAX_SHOWN} more`] : []);
export async function checkMeasureLink(options) {
    const doFetch = options.fetch ?? ((r) => fetch(r));
    const now = options.now ?? Date.now();
    const days = Math.min(Math.max(options.days ?? 7, 1), MAX_OBSERVATION_DAYS);
    const base = options.base.replace(/\/+$/, "");
    const results = [];
    const errorShapes = [];
    const personalSeen = [];
    const add = (id, title, status, detail = []) => results.push({ id, title, status, detail });
    async function call(path, how = {}) {
        const url = `${base}/${path}`;
        const headers = how.sign === false ? {} : await signMeasureCall(how.key ?? options.key, "GET", new URL(url), Math.floor((how.at ?? now) / 1000));
        const res = await doFetch(new Request(url, { method: "GET", headers }));
        const text = await res.text();
        let body = null;
        try {
            body = JSON.parse(text);
        }
        catch {
            body = null;
        }
        const problems = shapeProblems(res, body);
        if (problems.length)
            errorShapes.push(`${path.split("?")[0]} (${res.status}): ${problems.join("; ")}`);
        return { status: res.status, headers: res.headers, body };
    }
    const code = (a) => a.body?.error?.code;
    const expectError = (a, status, c) => (a.status === status && code(a) === c ? [] : [`Expected ${status} ${c}, got ${a.status}${code(a) ? ` ${code(a)}` : ""}.`]);
    // 1. The door
    const unsigned = await call("manifest", { sign: false });
    if (unsigned.status === 404) {
        add("configured", "The link is switched on", "fail", ["Every path answers 404, so the link has no key or is switched off. Set AX_MEASURE_KEY on the solution and redeploy."]);
        return { ok: false, base, checked_at: new Date(now).toISOString(), window: null, results };
    }
    add("unsigned", "Refuses calls that are not signed", unsigned.status === 401 && code(unsigned) === "invalid_signature" ? "pass" : "fail", expectError(unsigned, 401, "invalid_signature"));
    const stale = await call("manifest", { at: now - 10 * 60_000 });
    add("stale", "Refuses signatures more than five minutes old", stale.status === 401 ? "pass" : "fail", expectError(stale, 401, "invalid_signature"));
    const other = await call("manifest", { key: newMeasureKey() });
    add("wrong_key", "Refuses calls signed with another key", other.status === 401 ? "pass" : "fail", expectError(other, 401, "invalid_signature"));
    // 2. The manifest
    const man = await call("manifest");
    if (man.status !== 200) {
        add("manifest", "Manifest", "fail", [`GET manifest answered ${man.status}${code(man) ? ` ${code(man)}` : ""}. Check the key matches the one Outcomes gave you.`]);
        return finish(null);
    }
    const mp = checkManifest(man.body);
    add("manifest", "Manifest", mp.length ? "fail" : "pass", lines(mp));
    if (mp.length)
        return finish(null);
    const manifest = man.body;
    const metrics = catalogMap(manifest.metrics);
    const tz = manifest.time_zone;
    const personal = (ps) => ps.filter((p) => /personal/.test(p.message));
    // 3. Metrics, walked one page at a time
    const listed = [];
    const pageSize = manifest.metrics.length > 30 ? 25 : 2;
    let cursor = null;
    let pages = 0;
    const metricProblems = [];
    do {
        const a = await call(`metrics?limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        if (a.status !== 200) {
            metricProblems.push(`GET metrics answered ${a.status}.`);
            break;
        }
        const b = a.body;
        if (b.object !== "list" || !Array.isArray(b.data) || b.next === undefined) {
            metricProblems.push('A list is { "object": "list", "data": [...], "next": null }.');
            break;
        }
        listed.push(...b.data);
        cursor = b.next;
    } while (cursor && ++pages < 200);
    const defProblems = listed.flatMap((m, i) => checkMetric(m, `metrics[${i}]`));
    personalSeen.push(...personal(defProblems));
    metricProblems.push(...lines(defProblems));
    const sameKeys = JSON.stringify(listed.map((m) => m.key).sort()) === JSON.stringify([...metrics.keys()].sort());
    if (!sameKeys)
        metricProblems.push("GET metrics lists different metrics from the manifest.");
    else if (listed.some((m) => JSON.stringify(m) !== JSON.stringify(metrics.get(m.key))))
        metricProblems.push("A metric's definition differs between the manifest and GET metrics.");
    add("metrics", `Metrics (${listed.length}), page by page`, metricProblems.length ? "fail" : "pass", metricProblems);
    // 4. Observations for the last finished days
    const to = addLocalDays(localDate(now, tz), -1);
    const from = addLocalDays(to, -(days - 1));
    const window = { from, to };
    const all = [];
    const obsProblems = [];
    const listProblems = [];
    cursor = null;
    pages = 0;
    let first = null;
    do {
        const a = await call(`observations?from=${from}&to=${to}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
        if (a.status !== 200) {
            listProblems.push(`GET observations answered ${a.status}${code(a) ? ` ${code(a)}` : ""}.`);
            break;
        }
        const b = a.body;
        if (b.object !== "list" || !Array.isArray(b.data) || b.next === undefined) {
            listProblems.push('A list is { "object": "list", "data": [...], "next": null }.');
            break;
        }
        if (b.from !== from || b.to !== to || b.time_zone !== tz)
            listProblems.push("The list repeats the from, to and time_zone it answers for.");
        if (!first)
            first = { next: b.next, data: b.data };
        b.data.forEach((o, i) => obsProblems.push(...checkObservation(o, { metrics, timeZone: tz }, `observations[${all.length + i}]`)));
        all.push(...b.data);
        cursor = b.next;
    } while (cursor && ++pages < 500);
    personalSeen.push(...personal(obsProblems));
    for (let i = 0; i < all.length; i++) {
        const o = all[i];
        if (o.local_period < from || o.local_period > to)
            listProblems.push(`${o.metric_key} ${o.local_period} is outside ${from} to ${to}.`);
        if (i > 0) {
            const c = observationOrder(all[i - 1], o);
            if (c > 0)
                listProblems.push(`Not oldest first: ${o.metric_key} ${o.local_period} comes after ${all[i - 1].local_period}.`);
            if (c === 0)
                listProblems.push(`${o.metric_key} ${o.local_period} ${dimensionKey(o.dimensions) || "total"} comes twice.`);
        }
    }
    const obsWarn = [];
    const quiet = [...metrics.keys()].filter((k) => !all.some((o) => o.metric_key === k));
    if (quiet.length)
        obsWarn.push(`No figures in ${from} to ${to} for: ${quiet.join(", ")}. Fine if they had nothing to count; a missing day is shown as a gap, never a zero.`);
    for (const m of metrics.values()) {
        const mine = all.filter((o) => o.metric_key === m.key);
        const daysWithSplit = new Set(mine.filter((o) => Object.keys(o.dimensions).length).map((o) => o.local_period));
        const daysWithTotal = new Set(mine.filter((o) => !Object.keys(o.dimensions).length).map((o) => o.local_period));
        const noTotal = [...daysWithSplit].filter((d) => !daysWithTotal.has(d));
        if (noTotal.length)
            listProblems.push(`${m.key} has split figures but no total ({} dimensions) on ${noTotal.slice(0, 3).join(", ")}${noTotal.length > 3 ? " and more" : ""}.`);
        for (const dim of m.dimensions ?? []) {
            const values = new Set(mine.map((o) => o.dimensions[dim]).filter((v) => v !== undefined));
            if (values.size > MAX_DIMENSION_VALUES)
                listProblems.push(`${m.key} splits by ${dim} into ${values.size} values; at most ${MAX_DIMENSION_VALUES}, so nobody slips identifiers in as dimensions.`);
        }
    }
    const obsAll = [...lines(obsProblems), ...listProblems.slice(0, MAX_SHOWN)];
    add("observations", `Observations, ${days} finished day${days === 1 ? "" : "s"} (${all.length})`, obsAll.length ? "fail" : obsWarn.length ? "warn" : "pass", obsAll.length ? obsAll : obsWarn);
    // 5. Paging and refusals
    if (all.length >= 3) {
        const got = [];
        let c = null;
        for (let i = 0; i < 3; i++) {
            const a = await call(`observations?from=${from}&to=${to}&limit=1${c ? `&cursor=${encodeURIComponent(c)}` : ""}`);
            const b = a.body;
            if (a.status !== 200 || !Array.isArray(b.data))
                break;
            got.push(...b.data);
            c = b.next ?? null;
            if (!c)
                break;
        }
        const same = JSON.stringify(got) === JSON.stringify(all.slice(0, 3));
        add("paging", "Pages follow on with ?cursor=", same ? "pass" : "fail", same ? [] : ["Three pages of one did not match the first three observations."]);
    }
    else
        add("paging", "Pages follow on with ?cursor=", "warn", ["Too few observations to test paging; run again once the solution has a few days of figures."]);
    if (first?.next) {
        const wrong = await call(`observations?from=${addLocalDays(from, -1)}&to=${to}&limit=100&cursor=${encodeURIComponent(first.next)}`);
        add("cursor", "Refuses a cursor from a different question", wrong.status === 400 && code(wrong) === "invalid_cursor" ? "pass" : "fail", expectError(wrong, 400, "invalid_cursor"));
    }
    const tooLong = await call(`observations?from=${addLocalDays(to, -MAX_OBSERVATION_DAYS)}&to=${to}`);
    add("range", `Refuses more than ${MAX_OBSERVATION_DAYS} days in one read`, tooLong.status === 422 && code(tooLong) === "invalid_request" ? "pass" : "fail", expectError(tooLong, 422, "invalid_request"));
    const badParam = await call(`observations?from=${from}&to=${to}&colour=blue`);
    add("unknown_parameter", "Refuses parameters it does not know", badParam.status === 422 ? "pass" : "fail", expectError(badParam, 422, "invalid_request"));
    const badMetric = await call(`observations?from=${from}&to=${to}&metric=not.a_metric`);
    add("unknown_metric", "Refuses a metric it does not have", badMetric.status === 422 ? "pass" : "fail", expectError(badMetric, 422, "invalid_request"));
    const badDay = await call(`observations?from=yesterday&to=${to}`);
    add("bad_day", "Refuses a day that is not YYYY-MM-DD", badDay.status === 422 ? "pass" : "fail", expectError(badDay, 422, "invalid_request"));
    // 6. Health, baselines, the document, and nothing else
    const health = await call("health");
    if (health.status !== 200)
        add("health", "Health", "fail", [`GET health answered ${health.status}.`]);
    else {
        const hp = checkHealth(health.body, new Set(metrics.keys()));
        const h = health.body;
        const warn = [];
        if (!hp.length) {
            if (h.status !== "ok")
                warn.push(`The solution says it is ${h.status}: ${h.problems.join(", ") || "no reason given"}.`);
            const missing = [...metrics.keys()].filter((k) => !(k in h.freshness));
            if (missing.length)
                warn.push(`freshness leaves out ${missing.join(", ")}.`);
            const late = Object.entries(h.freshness).filter(([, d]) => d !== null && d < addLocalDays(to, -1));
            if (late.length)
                warn.push(`Behind by more than a day: ${late.map(([k, d]) => `${k} (${d})`).join(", ")}.`);
        }
        add("health", "Health", hp.length ? "fail" : warn.length ? "warn" : "pass", hp.length ? lines(hp) : warn);
    }
    if (manifest.capabilities.includes("baselines")) {
        const bl = await call("baselines?limit=100");
        const b = bl.body;
        const bp = bl.status === 200 && Array.isArray(b.data) ? b.data.flatMap((x, i) => checkBaseline(x, metrics, `baselines[${i}]`)) : [{ at: "baselines", message: `GET baselines answered ${bl.status}.` }];
        add("baselines", "Baselines, with where they came from", bp.length ? "fail" : "pass", lines(bp));
    }
    else {
        const bl = await call("baselines");
        add("baselines", "No baselines endpoint unless the manifest lists it", bl.status === 404 ? "pass" : "fail", expectError(bl, 404, "not_found"));
    }
    const doc = await call("openapi.json");
    const openapi = doc.body?.openapi ?? "";
    add("openapi", "Serves its OpenAPI document", doc.status === 200 && openapi.startsWith("3.1") ? "pass" : "fail", doc.status === 200 ? (openapi.startsWith("3.1") ? [] : ["openapi.json is not an OpenAPI 3.1 document."]) : [`GET openapi.json answered ${doc.status}.`]);
    const nothing = await call("nothing-here");
    add("not_advertised", "Answers 404 for anything else", nothing.status === 404 ? "pass" : "fail", expectError(nothing, 404, "not_found"));
    return finish(window);
    function finish(w) {
        add("personal_data", "No personal data in names, descriptions or dimension values", personalSeen.length ? "fail" : "pass", lines(personalSeen));
        add("answers", "Every answer is uncached JSON with a request id; errors in the contract's shape", errorShapes.length ? "fail" : "pass", errorShapes.slice(0, MAX_SHOWN));
        return { ok: results.every((r) => r.status !== "fail"), base, checked_at: new Date(now).toISOString(), window: w, results };
    }
}
/** What every answer needs, whatever its status. */
function shapeProblems(res, body) {
    const out = [];
    if (!(res.headers.get("content-type") ?? "").includes("application/json"))
        out.push("not JSON");
    if (!(res.headers.get("cache-control") ?? "").includes("no-store"))
        out.push("Cache-Control is not no-store");
    const id = res.headers.get("x-request-id") ?? "";
    if (!/^req_[A-Za-z0-9]{8,40}$/.test(id))
        out.push("no X-Request-Id (req_...)");
    if (res.status >= 400) {
        const e = body?.error;
        if (!e || typeof e.code !== "string" || typeof e.message !== "string")
            out.push('errors are { "error": { "code", "message", "request_id" } }');
        else if (e.request_id !== id)
            out.push("error.request_id differs from X-Request-Id");
    }
    return out;
}
/** The report as lines for a terminal. */
export function formatCheckReport(report) {
    const mark = { pass: "PASS", warn: "WARN", fail: "FAIL" };
    const out = [`Measurement Link contract test: ${report.base}`, report.window ? `Observations read for ${report.window.from} to ${report.window.to}` : "", ""];
    for (const r of report.results) {
        out.push(`${mark[r.status]}  ${r.title}`);
        for (const d of r.detail)
            out.push(`      ${d}`);
    }
    const n = (s) => report.results.filter((r) => r.status === s).length;
    out.push("", `${n("pass")} passed, ${n("warn")} to look at, ${n("fail")} failed. ${report.ok ? "Ready for Outcomes to connect." : "Fix the failures and run it again."}`);
    return out.filter((l, i) => l !== "" || i > 0).join("\n");
}
