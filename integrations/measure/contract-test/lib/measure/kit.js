// Generated from haziqfaris/antarax-api packages/lapisan-core/src by scripts/build-measure-pack.mjs. Do not edit.
import { fromBase64Url, toBase64Url } from "../crypto.js";
import { checkMeasureCall } from "./auth.js";
import { DEFAULT_LIMIT, MAX_LIMIT, MAX_OBSERVATION_DAYS, MEASURE_ERRORS, MEASURE_PATHS, MEASURE_SCHEMA_VERSION, catalogMap, checkBaseline, checkHealth, checkManifest, checkObservation, dayBounds, daysBetween, isDate, momentOf, observationOrder, } from "./contract.js";
import { MEASURE_OPENAPI } from "./openapi.js";
export class MeasureError extends Error {
    status;
    code;
    /** Seconds, for 429 and 503. */
    retryAfter;
    constructor(code, message, retryAfter) {
        super(message);
        this.name = "MeasureError";
        this.code = code;
        this.status = MEASURE_ERRORS[code];
        this.retryAfter = retryAfter;
    }
}
const read = async (v) => (typeof v === "function" ? await v() : v);
const newRequestId = () => `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
function answer(status, body, requestId, extra = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-request-id": requestId, ...extra },
    });
}
function errorAnswer(status, code, message, requestId, extra = {}) {
    return answer(status, { error: { code, message, request_id: requestId } }, requestId, extra);
}
/** The figures failed the contract's own checks: a bug in the adapter, logged, never served. */
class BadFigures extends Error {
    problems;
    constructor(problems) {
        super(`Measurement Link: the adapter's figures failed the contract: ${problems.slice(0, 5).map((p) => `${p.at}: ${p.message}`).join("; ")}`);
        this.problems = problems;
        this.name = "BadFigures";
    }
}
const ALLOWED = {
    manifest: [],
    metrics: ["cursor", "limit"],
    observations: ["from", "to", "metric", "cursor", "limit"],
    health: [],
    baselines: ["cursor", "limit"],
    "openapi.json": [],
};
function limitOf(url) {
    const raw = url.searchParams.get("limit");
    if (raw === null)
        return DEFAULT_LIMIT;
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || n < 1 || n > MAX_LIMIT)
        throw new MeasureError("invalid_request", `limit is a whole number from 1 to ${MAX_LIMIT}.`);
    return n;
}
/** A page of a list. The cursor remembers the question, so it cannot be used for a different one. */
function page(all, url, question) {
    const limit = limitOf(url);
    const raw = url.searchParams.get("cursor");
    let offset = 0;
    if (raw !== null) {
        let parsed;
        try {
            parsed = JSON.parse(fromBase64Url(raw));
        }
        catch {
            parsed = null;
        }
        const [q, o] = Array.isArray(parsed) ? parsed : [];
        if (q !== question || !Number.isInteger(o) || o < 0)
            throw new MeasureError("invalid_cursor", "That cursor is not one this list gave out for this question.");
        offset = o;
    }
    const data = all.slice(offset, offset + limit);
    return { data, next: offset + limit < all.length ? toBase64Url(JSON.stringify([question, offset + limit])) : null };
}
/** The whole interface behind one function: (request) => response. */
export function measureLink(adapter, options) {
    const report = options.onUnknownError ?? ((e, id) => console.error(`[measure link ${id}]`, e));
    const refused = options.onRefused ?? ((why, path) => console.warn(`measure link: refused ${path} (${why})`));
    const clock = options.now ?? Date.now;
    const strict = options.checkAnswers ?? true;
    async function manifest() {
        const d = await adapter.describe();
        const capabilities = ["metrics", "observations", "health"];
        if (adapter.baselines)
            capabilities.push("baselines");
        const m = {
            object: "manifest",
            schema_version: MEASURE_SCHEMA_VERSION,
            solution_id: d.solution_id,
            solution_name: d.solution_name,
            environment: d.environment,
            time_zone: d.time_zone,
            capabilities,
            metric_catalog_version: d.metric_catalog_version,
            reporting_periods: ["day"],
            data_policy: { aggregation: "daily", contains_personal_data: false, ...(d.retention_days ? { retention_days: d.retention_days } : {}) },
            metrics: d.metrics.map((x) => ({ ...x, privacy: "aggregate" })),
        };
        if (strict) {
            const problems = checkManifest(m);
            if (problems.length)
                throw new BadFigures(problems);
        }
        return m;
    }
    const handlers = {
        async manifest() {
            return { body: await manifest() };
        },
        async metrics(url) {
            const m = await manifest();
            const p = page(m.metrics, url, `metrics|${m.metric_catalog_version}`);
            return { body: { object: "list", data: p.data, next: p.next }, count: p.data.length };
        },
        async observations(url, now) {
            const from = url.searchParams.get("from");
            const to = url.searchParams.get("to");
            const metric = url.searchParams.get("metric");
            if (!isDate(from))
                throw new MeasureError("invalid_request", "from is a local day, YYYY-MM-DD.");
            if (!isDate(to))
                throw new MeasureError("invalid_request", "to is a local day, YYYY-MM-DD.");
            if (to < from)
                throw new MeasureError("invalid_request", "to is on or after from.");
            if (daysBetween(from, to) > MAX_OBSERVATION_DAYS)
                throw new MeasureError("invalid_request", `At most ${MAX_OBSERVATION_DAYS} days in one read; ask in windows.`);
            const m = await manifest();
            const metrics = catalogMap(m.metrics);
            if (metric !== null && !metrics.has(metric))
                throw new MeasureError("invalid_request", `metric "${metric}" is not in this solution's catalog.`);
            const rows = await adapter.observations({ from, to, metric });
            const out = [];
            const problems = [];
            for (const r of rows) {
                const def = metrics.get(r.metric_key);
                if (!isDate(r.local_period) || r.local_period < from || r.local_period > to || (metric && r.metric_key !== metric))
                    continue;
                const bounds = dayBounds(r.local_period, m.time_zone);
                if (Date.parse(bounds.period_end) > now)
                    continue;
                const o = {
                    object: "observation",
                    metric_key: r.metric_key,
                    ...bounds,
                    local_period: r.local_period,
                    value: r.value,
                    unit: def?.unit ?? "",
                    dimensions: r.dimensions ?? {},
                    ...(r.count !== undefined ? { count: r.count } : {}),
                    ...(r.sum !== undefined ? { sum: r.sum } : {}),
                    quality: r.quality ?? "measured",
                    source: r.source ?? "application_aggregate",
                };
                if (strict)
                    problems.push(...checkObservation(o, { metrics, timeZone: m.time_zone }, `observation ${r.metric_key} ${r.local_period}`));
                out.push(o);
            }
            if (problems.length)
                throw new BadFigures(problems);
            out.sort(observationOrder);
            for (let i = 1; i < out.length; i++) {
                const a = out[i - 1], b = out[i];
                if (strict && observationOrder(a, b) === 0)
                    throw new BadFigures([{ at: `observation ${b.metric_key} ${b.local_period}`, message: "The same metric, day and dimensions came twice." }]);
            }
            const p = page(out, url, `observations|${from}|${to}|${metric ?? ""}|${m.metric_catalog_version}`);
            return { body: { object: "list", from, to, time_zone: m.time_zone, data: p.data, next: p.next }, count: p.data.length };
        },
        async health(_url, now) {
            const m = await manifest();
            const h = await adapter.health(now);
            const body = { object: "health", status: h.status, checked_at: momentOf(now), problems: h.problems, freshness: h.freshness };
            if (strict) {
                const problems = checkHealth(body, new Set(m.metrics.map((x) => x.key)));
                if (problems.length)
                    throw new BadFigures(problems);
            }
            return { body };
        },
        async baselines(url) {
            if (!adapter.baselines)
                throw new MeasureError("not_found", "There is nothing here.");
            const m = await manifest();
            const metrics = catalogMap(m.metrics);
            const list = (await adapter.baselines()).map((b) => ({ object: "baseline", ...b, unit: metrics.get(b.metric_key)?.unit ?? "" }));
            if (strict) {
                const problems = list.flatMap((b, i) => checkBaseline(b, metrics, `baselines[${i}]`));
                if (problems.length)
                    throw new BadFigures(problems);
            }
            const p = page(list, url, `baselines|${list.length}`);
            return { body: { object: "list", data: p.data, next: p.next }, count: p.data.length };
        },
        async "openapi.json"() {
            return { body: MEASURE_OPENAPI };
        },
    };
    const names = new Map(Object.values(MEASURE_PATHS).map((path) => [path, path.slice(path.lastIndexOf("/") + 1)]));
    return async (request) => {
        const requestId = newRequestId();
        const notHere = () => errorAnswer(404, "not_found", "There is nothing here.", requestId);
        const key = (await read(options.key))?.trim();
        if (!key)
            return notHere();
        if (options.enabled !== undefined && !(await read(options.enabled)))
            return notHere();
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, "");
        const name = names.get(path);
        if (request.method !== "GET" || !name)
            return notHere();
        const now = clock();
        const checked = await checkMeasureCall([key, await read(options.nextKey ?? null)], request.method, url, request.headers, Math.floor(now / 1000));
        if (!checked.ok) {
            refused(checked.why, path, requestId);
            return errorAnswer(401, "invalid_signature", "This call is not signed with this solution's measurement key, or its time is more than five minutes off.", requestId, {
                "www-authenticate": 'AntaraX-Service realm="antarax"',
            });
        }
        const audit = async (status, count) => {
            if (!options.audit)
                return;
            try {
                await options.audit({ requestId, path, query: url.search, status, count });
            }
            catch (error) {
                report(error, requestId);
            }
        };
        try {
            const unknown = [...url.searchParams.keys()].find((k) => !ALLOWED[name].includes(k));
            if (unknown)
                throw new MeasureError("invalid_request", `Not a parameter here: ${unknown}.`);
            const result = await handlers[name](url, now);
            await audit(200, result.count);
            return answer(200, result.body, requestId);
        }
        catch (error) {
            if (error instanceof MeasureError) {
                await audit(error.status);
                return errorAnswer(error.status, error.code, error.message, requestId, error.retryAfter ? { "retry-after": String(error.retryAfter) } : {});
            }
            report(error, requestId);
            await audit(500);
            return errorAnswer(500, "internal", "Something went wrong on our side. It has been recorded; try again.", requestId);
        }
    };
}
