// Generated from haziqfaris/antarax-api packages/lapisan-core/src by scripts/build-measure-pack.mjs. Do not edit.
/**
 * Measurement Link's contract (docs/14-measurement-link.md): the read-only
 * interface a measured solution exposes so Outcomes can collect its daily
 * figures. The shapes on the wire, their limits, and the pure checks both
 * sides use, so the kit that serves the interface, the contract test that
 * checks one, and the collector that reads one cannot disagree.
 *
 * Proposed (decision 0013). Imports nothing but Web standards, so a
 * solution that is not an AntaraX product can copy this folder as it is.
 */
/** Where the endpoints live on the solution's own host. */
export const MEASURE_BASE = "/internal/measure/v1";
export const MEASURE_PATHS = {
    manifest: `${MEASURE_BASE}/manifest`,
    metrics: `${MEASURE_BASE}/metrics`,
    observations: `${MEASURE_BASE}/observations`,
    health: `${MEASURE_BASE}/health`,
    baselines: `${MEASURE_BASE}/baselines`,
    openapi: `${MEASURE_BASE}/openapi.json`,
};
export const MEASURE_SCHEMA_VERSION = "1.0.0";
/** The longest window one observations read covers, in local days, both ends counted. */
export const MAX_OBSERVATION_DAYS = 92;
/** Page sizes, as every list in the contract (docs/03, 3.6). */
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
/** The most metrics one solution declares (PRD D10). */
export const MAX_METRICS = 200;
/** The most dimensions one metric has, and the most values one dimension takes in a window. */
export const MAX_DIMENSIONS = 5;
export const MAX_DIMENSION_VALUES = 20;
/**
 * The error codes this interface answers with, and their statuses. All are
 * already in registry/registry.json; a test holds the two together, so this
 * folder needs no registry of its own.
 */
export const MEASURE_ERRORS = {
    invalid_request: 422,
    invalid_cursor: 400,
    invalid_signature: 401,
    not_found: 404,
    rate_limited: 429,
    unavailable: 503,
    internal: 500,
};
// ---------------------------------------------------------------------------
// Shapes on the wire
// ---------------------------------------------------------------------------
export const METRIC_TYPES = ["counter", "gauge", "duration", "ratio", "distinct", "money"];
/** Units from a fixed list; anything else is namespaced, "x.batch". Money uses an ISO 4217 code instead. */
export const METRIC_UNITS = ["item", "document", "page", "request", "run", "message", "task", "person", "second", "minute", "hour", "day", "percent", "byte"];
const TIME_UNITS = new Set(["second", "minute", "hour", "day"]);
export const AGGREGATIONS = {
    duration: ["mean", "median", "p90"],
    gauge: ["last", "mean"],
};
export const CAPABILITIES = ["metrics", "observations", "health", "baselines"];
export const ENVIRONMENTS = ["production", "staging", "development"];
export const BASELINE_METHODS = ["timed_sample", "historical_records", "client_estimate"];
// ---------------------------------------------------------------------------
// Days and moments
// ---------------------------------------------------------------------------
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar day, YYYY-MM-DD. */
export function isDate(value) {
    if (typeof value !== "string" || !DATE.test(value))
        return false;
    const ms = Date.parse(`${value}T00:00:00Z`);
    return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}
/** A moment as the contract writes it: UTC, whole seconds, with Z. */
export function isMoment(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && !Number.isNaN(Date.parse(value));
}
/** A moment from milliseconds, in the contract's form. */
export function momentOf(ms) {
    return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}
/** Whether the runtime knows this IANA zone. */
export function isTimeZone(value) {
    if (typeof value !== "string" || !value.includes("/"))
        return value === "UTC";
    try {
        new Intl.DateTimeFormat("en-GB", { timeZone: value });
        return true;
    }
    catch {
        return false;
    }
}
const zoneFormats = new Map();
/** How far the zone's clock is ahead of UTC at a moment, in milliseconds. */
function offsetAt(ms, timeZone) {
    let f = zoneFormats.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
        zoneFormats.set(timeZone, f);
    }
    const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    return asUtc - Math.floor(ms / 1000) * 1000;
}
/** The UTC moment a local day starts, in milliseconds. Correct across daylight saving changes. */
function localMidnight(date, timeZone) {
    const naive = Date.parse(`${date}T00:00:00Z`);
    let guess = naive - offsetAt(naive, timeZone);
    guess = naive - offsetAt(guess, timeZone);
    return guess;
}
/** A local day's start and end in UTC, as an observation carries them. */
export function dayBounds(date, timeZone) {
    return { period_start: momentOf(localMidnight(date, timeZone)), period_end: momentOf(localMidnight(addLocalDays(date, 1), timeZone)) };
}
/** The local day a moment falls on. */
export function localDate(ms, timeZone) {
    return new Date(ms + offsetAt(ms, timeZone)).toISOString().slice(0, 10);
}
export function addLocalDays(date, n) {
    return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
/** Days from `from` to `to`, both counted. */
export function daysBetween(from, to) {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
const METRIC_KEY = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,3}$/;
const SNAKE = /^[a-z][a-z0-9_]{0,39}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/;
const CURRENCY = /^[A-Z]{3}$/;
const MONEY = /^-?\d{1,15}(\.\d{1,3})?$/;
/** Dimension values are short codes, never free text: no spaces, no @, at most 60 characters. */
const DIMENSION_VALUE = /^[a-z0-9][a-z0-9_.-]{0,59}$/;
export const isMetricKey = (v) => typeof v === "string" && METRIC_KEY.test(v);
/** Units a metric may use: the fixed list, or "x." and a snake_case name. */
export function isUnit(unit, type) {
    if (typeof unit !== "string")
        return false;
    if (type === "money")
        return CURRENCY.test(unit);
    return METRIC_UNITS.includes(unit) || /^x\.[a-z][a-z0-9_]{0,30}$/.test(unit);
}
/**
 * Text that looks like it is about one person: an email address, a phone
 * number, a Malaysian identity card number, or ten or more digits in a row
 * (an account or card number). Dimension values and descriptions are checked
 * with it, so an identifier cannot slip in as a "dimension".
 */
export function looksPersonal(text) {
    if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text))
        return true;
    if (/\b\d{6}-\d{2}-\d{4}\b/.test(text))
        return true;
    if (/(\+?6?0)[\s-]?1\d[\s-]?\d{3,4}[\s-]?\d{4}\b/.test(text))
        return true;
    if (/\d{10,}/.test(text))
        return true;
    return false;
}
const fieldsOf = (o) => new Set(Object.keys(o));
function unknownFields(o, allowed, at, out) {
    for (const k of fieldsOf(o))
        if (!allowed.includes(k))
            out.push({ at: `${at}.${k}`, message: `"${k}" is not a field here.` });
}
const METRIC_FIELDS = ["key", "type", "unit", "description", "label", "aggregation", "dimensions", "privacy", "numerator", "denominator", "identity", "since"];
/** One metric definition, alone. The catalog check adds what needs the others (ratios, repeats). */
export function checkMetric(m, at = "metric") {
    const out = [];
    if (!m || typeof m !== "object" || Array.isArray(m))
        return [{ at, message: "A metric is an object." }];
    const o = m;
    unknownFields(o, METRIC_FIELDS, at, out);
    if (!isMetricKey(o.key))
        out.push({ at: `${at}.key`, message: "key is lower-case words joined by dots, two to four parts: documents.generated." });
    const type = o.type;
    if (!METRIC_TYPES.includes(type))
        out.push({ at: `${at}.type`, message: `type is one of ${METRIC_TYPES.join(", ")}.` });
    if (!isUnit(o.unit, type))
        out.push({ at: `${at}.unit`, message: type === "money" ? "A money metric's unit is its ISO 4217 currency code, MYR." : `unit is one of ${METRIC_UNITS.join(", ")}, or x. and a name.` });
    if (typeof o.description !== "string" || o.description.trim().length < 8)
        out.push({ at: `${at}.description`, message: "Describe what it counts in plain words." });
    else if (looksPersonal(o.description))
        out.push({ at: `${at}.description`, message: "The description seems to hold personal data." });
    if (o.label !== undefined && (typeof o.label !== "string" || !o.label.trim() || o.label.length > 60))
        out.push({ at: `${at}.label`, message: "label is a short name, up to 60 characters." });
    if (o.privacy !== "aggregate")
        out.push({ at: `${at}.privacy`, message: 'privacy is "aggregate": no figure may be about one person.' });
    const aggs = AGGREGATIONS[type];
    if (aggs) {
        if (!aggs.includes(o.aggregation))
            out.push({ at: `${at}.aggregation`, message: `A ${type} declares its aggregation: ${aggs.join(", ")}.` });
    }
    else if (o.aggregation !== undefined)
        out.push({ at: `${at}.aggregation`, message: `Only durations and gauges declare an aggregation.` });
    if (type === "duration" && typeof o.unit === "string" && !TIME_UNITS.has(o.unit))
        out.push({ at: `${at}.unit`, message: "A duration is in second, minute, hour or day." });
    if (o.dimensions !== undefined) {
        if (!Array.isArray(o.dimensions) || o.dimensions.some((d) => typeof d !== "string" || !SNAKE.test(d)))
            out.push({ at: `${at}.dimensions`, message: "dimensions is a list of snake_case names." });
        else if (o.dimensions.length > MAX_DIMENSIONS)
            out.push({ at: `${at}.dimensions`, message: `At most ${MAX_DIMENSIONS} dimensions.` });
        else if (new Set(o.dimensions).size !== o.dimensions.length)
            out.push({ at: `${at}.dimensions`, message: "A dimension is listed twice." });
    }
    if (type === "ratio") {
        if (!isMetricKey(o.numerator) || !isMetricKey(o.denominator))
            out.push({ at, message: "A ratio names the counters it is worked out from: numerator and denominator." });
    }
    else if (o.numerator !== undefined || o.denominator !== undefined)
        out.push({ at, message: "Only ratios have a numerator and denominator." });
    if (type === "distinct") {
        if (typeof o.identity !== "string" || !SNAKE.test(o.identity))
            out.push({ at: `${at}.identity`, message: 'A distinct count says what it counts once, "operator".' });
    }
    else if (o.identity !== undefined)
        out.push({ at: `${at}.identity`, message: "Only distinct counts have an identity." });
    if (o.since !== undefined && !isDate(o.since))
        out.push({ at: `${at}.since`, message: "since is a day, YYYY-MM-DD." });
    return out;
}
/** The whole catalog: each metric, no key twice, ratios built from counters it holds. */
export function checkCatalog(metrics, at = "metrics") {
    if (!Array.isArray(metrics))
        return [{ at, message: "metrics is a list." }];
    const out = [];
    if (!metrics.length)
        out.push({ at, message: "Share at least one metric." });
    if (metrics.length > MAX_METRICS)
        out.push({ at, message: `At most ${MAX_METRICS} metrics.` });
    const byKey = new Map();
    metrics.forEach((m, i) => {
        out.push(...checkMetric(m, `${at}[${i}]`));
        const key = m?.key;
        if (typeof key === "string") {
            if (byKey.has(key))
                out.push({ at: `${at}[${i}].key`, message: `"${key}" is listed twice.` });
            byKey.set(key, m);
        }
    });
    metrics.forEach((m, i) => {
        const o = m;
        if (o?.type !== "ratio")
            return;
        for (const part of ["numerator", "denominator"]) {
            const ref = byKey.get(o[part]);
            if (typeof o[part] === "string" && (!ref || ref.type !== "counter"))
                out.push({ at: `${at}[${i}].${part}`, message: `${part} "${String(o[part])}" is not a counter in this catalog.` });
        }
    });
    return out;
}
const MANIFEST_FIELDS = ["object", "schema_version", "solution_id", "solution_name", "environment", "time_zone", "capabilities", "metric_catalog_version", "reporting_periods", "data_policy", "metrics"];
export function checkManifest(m) {
    if (!m || typeof m !== "object" || Array.isArray(m))
        return [{ at: "manifest", message: "The manifest is an object." }];
    const o = m;
    const out = [];
    unknownFields(o, MANIFEST_FIELDS, "manifest", out);
    if (o.object !== "manifest")
        out.push({ at: "manifest.object", message: 'object is "manifest".' });
    if (typeof o.schema_version !== "string" || !/^1\.\d+\.\d+$/.test(o.schema_version))
        out.push({ at: "manifest.schema_version", message: `schema_version is ${MEASURE_SCHEMA_VERSION} for this version of the interface.` });
    if (typeof o.solution_id !== "string" || !SLUG.test(o.solution_id))
        out.push({ at: "manifest.solution_id", message: "solution_id is a lower-case slug: contoh-document-workflow." });
    if (typeof o.solution_name !== "string" || !o.solution_name.trim())
        out.push({ at: "manifest.solution_name", message: "solution_name is the name people know it by." });
    if (!ENVIRONMENTS.includes(o.environment))
        out.push({ at: "manifest.environment", message: `environment is one of ${ENVIRONMENTS.join(", ")}.` });
    if (!isTimeZone(o.time_zone))
        out.push({ at: "manifest.time_zone", message: "time_zone is an IANA name: Asia/Kuala_Lumpur." });
    const caps = o.capabilities;
    if (!Array.isArray(caps) || caps.some((c) => !CAPABILITIES.includes(c)))
        out.push({ at: "manifest.capabilities", message: `capabilities come from ${CAPABILITIES.join(", ")}.` });
    else
        for (const need of ["metrics", "observations", "health"])
            if (!caps.includes(need))
                out.push({ at: "manifest.capabilities", message: `"${need}" is required.` });
    if (typeof o.metric_catalog_version !== "string" || !o.metric_catalog_version.trim())
        out.push({ at: "manifest.metric_catalog_version", message: "metric_catalog_version changes whenever a metric does; a date is fine." });
    if (!Array.isArray(o.reporting_periods) || o.reporting_periods.length !== 1 || o.reporting_periods[0] !== "day")
        out.push({ at: "manifest.reporting_periods", message: 'reporting_periods is ["day"] in v1.' });
    const dp = o.data_policy;
    if (!dp || typeof dp !== "object")
        out.push({ at: "manifest.data_policy", message: "data_policy is required." });
    else {
        unknownFields(dp, ["aggregation", "contains_personal_data", "retention_days"], "manifest.data_policy", out);
        if (dp.aggregation !== "daily")
            out.push({ at: "manifest.data_policy.aggregation", message: 'aggregation is "daily".' });
        if (dp.contains_personal_data !== false)
            out.push({ at: "manifest.data_policy.contains_personal_data", message: "This interface never carries personal data: contains_personal_data is false." });
        if (dp.retention_days !== undefined && (!Number.isInteger(dp.retention_days) || dp.retention_days < 1))
            out.push({ at: "manifest.data_policy.retention_days", message: "retention_days is a whole number of days." });
    }
    out.push(...checkCatalog(o.metrics, "manifest.metrics"));
    return out;
}
const OBSERVATION_FIELDS = ["object", "metric_key", "period_start", "period_end", "local_period", "value", "unit", "dimensions", "count", "sum", "quality", "source"];
export function checkObservation(x, ctx, at = "observation") {
    if (!x || typeof x !== "object" || Array.isArray(x))
        return [{ at, message: "An observation is an object." }];
    const o = x;
    const out = [];
    unknownFields(o, OBSERVATION_FIELDS, at, out);
    if (o.object !== "observation")
        out.push({ at: `${at}.object`, message: 'object is "observation".' });
    const m = ctx.metrics.get(o.metric_key);
    if (!m)
        return [...out, { at: `${at}.metric_key`, message: `"${String(o.metric_key)}" is not in the catalog.` }];
    if (!isDate(o.local_period))
        out.push({ at: `${at}.local_period`, message: "local_period is a day, YYYY-MM-DD." });
    else {
        const b = dayBounds(o.local_period, ctx.timeZone);
        if (o.period_start !== b.period_start || o.period_end !== b.period_end)
            out.push({ at, message: `period_start and period_end are ${o.local_period} in ${ctx.timeZone}: ${b.period_start} to ${b.period_end}.` });
    }
    if (!isMoment(o.period_start) || !isMoment(o.period_end))
        out.push({ at, message: "period_start and period_end are UTC moments with Z, in whole seconds." });
    if (o.unit !== m.unit)
        out.push({ at: `${at}.unit`, message: `unit is "${m.unit}", as the catalog says.` });
    const v = o.value;
    if (m.type === "money") {
        if (typeof v !== "string" || !MONEY.test(v))
            out.push({ at: `${at}.value`, message: 'Money is a string with the currency\'s decimals, "784.40", never a number.' });
    }
    else if (typeof v !== "number" || !Number.isFinite(v))
        out.push({ at: `${at}.value`, message: "value is a number." });
    else if ((m.type === "counter" || m.type === "distinct") && (!Number.isInteger(v) || v < 0))
        out.push({ at: `${at}.value`, message: `A ${m.type} is a whole number, zero or more.` });
    else if ((m.type === "duration" || m.type === "ratio") && v < 0)
        out.push({ at: `${at}.value`, message: `A ${m.type} is zero or more.` });
    const dims = o.dimensions;
    if (!dims || typeof dims !== "object" || Array.isArray(dims))
        out.push({ at: `${at}.dimensions`, message: "dimensions is an object; {} for the day's total." });
    else
        for (const [k, val] of Object.entries(dims)) {
            if (!(m.dimensions ?? []).includes(k))
                out.push({ at: `${at}.dimensions.${k}`, message: `"${k}" is not a dimension of ${m.key}.` });
            else if (typeof val !== "string" || !DIMENSION_VALUE.test(val))
                out.push({ at: `${at}.dimensions.${k}`, message: "A dimension value is a short lower-case code, no spaces: invoice, delivery_order." });
            else if (looksPersonal(val))
                out.push({ at: `${at}.dimensions.${k}`, message: "This dimension value looks like personal data." });
        }
    for (const f of ["count", "sum"]) {
        if (o[f] === undefined)
            continue;
        if (m.type !== "duration")
            out.push({ at: `${at}.${f}`, message: `Only durations carry ${f}.` });
        else if (typeof o[f] !== "number" || o[f] < 0 || (f === "count" && !Number.isInteger(o[f])))
            out.push({ at: `${at}.${f}`, message: `${f} is a number, zero or more${f === "count" ? ", whole" : ""}.` });
    }
    if (o.quality !== "measured" && o.quality !== "derived")
        out.push({ at: `${at}.quality`, message: 'quality is "measured" or "derived".' });
    if (typeof o.source !== "string" || !SNAKE.test(o.source))
        out.push({ at: `${at}.source`, message: "source is a snake_case name: application_aggregate." });
    return out;
}
export function checkHealth(x, metricKeys) {
    if (!x || typeof x !== "object" || Array.isArray(x))
        return [{ at: "health", message: "Health is an object." }];
    const o = x;
    const out = [];
    if (o.object !== "health")
        out.push({ at: "health.object", message: 'object is "health".' });
    if (!["ok", "degraded", "down"].includes(o.status))
        out.push({ at: "health.status", message: "status is ok, degraded or down." });
    if (!isMoment(o.checked_at))
        out.push({ at: "health.checked_at", message: "checked_at is a UTC moment with Z." });
    if (!Array.isArray(o.problems) || o.problems.some((p) => typeof p !== "string" || !SNAKE.test(p)))
        out.push({ at: "health.problems", message: "problems is a list of snake_case names; empty when all is well." });
    else if (o.status === "ok" && o.problems.length)
        out.push({ at: "health.problems", message: "A solution with problems is degraded or down, not ok." });
    const f = o.freshness;
    if (!f || typeof f !== "object" || Array.isArray(f))
        out.push({ at: "health.freshness", message: "freshness gives each metric's last complete day." });
    else
        for (const [k, d] of Object.entries(f)) {
            if (metricKeys && !metricKeys.has(k))
                out.push({ at: `health.freshness.${k}`, message: `"${k}" is not in the catalog.` });
            if (d !== null && !isDate(d))
                out.push({ at: `health.freshness.${k}`, message: "A day, YYYY-MM-DD, or null before its first figure." });
        }
    return out;
}
export function checkBaseline(x, metrics, at = "baseline") {
    if (!x || typeof x !== "object" || Array.isArray(x))
        return [{ at, message: "A baseline is an object." }];
    const o = x;
    const out = [];
    unknownFields(o, ["object", "metric_key", "value", "unit", "method", "period_from", "period_to", "sample_size", "evidence", "recorded_at"], at, out);
    if (o.object !== "baseline")
        out.push({ at: `${at}.object`, message: 'object is "baseline".' });
    const m = metrics.get(o.metric_key);
    if (!m)
        out.push({ at: `${at}.metric_key`, message: `"${String(o.metric_key)}" is not in the catalog.` });
    else if (o.unit !== m.unit)
        out.push({ at: `${at}.unit`, message: `unit is "${m.unit}", as the catalog says.` });
    if (typeof o.value !== "number" || !Number.isFinite(o.value) || o.value < 0)
        out.push({ at: `${at}.value`, message: "value is a number, zero or more." });
    if (!BASELINE_METHODS.includes(o.method))
        out.push({ at: `${at}.method`, message: `method is one of ${BASELINE_METHODS.join(", ")}.` });
    if (!isDate(o.period_from) || !isDate(o.period_to) || o.period_to < o.period_from)
        out.push({ at, message: "period_from and period_to are days, in order." });
    if (o.sample_size !== null && (!Number.isInteger(o.sample_size) || o.sample_size < 1))
        out.push({ at: `${at}.sample_size`, message: "sample_size is a whole number, or null." });
    if (typeof o.evidence !== "string" || o.evidence.trim().length < 8)
        out.push({ at: `${at}.evidence`, message: "Say where the baseline came from." });
    else if (looksPersonal(o.evidence))
        out.push({ at: `${at}.evidence`, message: "The evidence seems to hold personal data." });
    if (!isMoment(o.recorded_at))
        out.push({ at: `${at}.recorded_at`, message: "recorded_at is a UTC moment with Z." });
    return out;
}
/** The catalog as a map by key, for the observation and baseline checks. */
export function catalogMap(metrics) {
    return new Map(metrics.map((m) => [m.key, m]));
}
/** A stable order for observations: day, then metric, then dimensions. */
export function observationOrder(a, b) {
    return a.local_period.localeCompare(b.local_period) || a.metric_key.localeCompare(b.metric_key) || dimensionKey(a.dimensions).localeCompare(dimensionKey(b.dimensions));
}
/** Dimensions as one comparable string, names sorted. The total ({}) sorts first. */
export function dimensionKey(d) {
    return Object.keys(d)
        .sort()
        .map((k) => `${k}=${d[k]}`)
        .join("&");
}
