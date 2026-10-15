// Generated from haziqfaris/antarax-api packages/lapisan-core/src by scripts/build-measure-pack.mjs. Do not edit.
/**
 * The OpenAPI 3.1 document for Measurement Link. The kit serves it at
 * /internal/measure/v1/openapi.json, and the integration pack's
 * openapi.json is written from it, so there is one copy.
 */
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, description) => ({ description, content: { "application/json": { schema } } });
const err = (description) => json(ref("Error"), description);
const day = { type: "string", format: "date", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const moment = { type: "string", format: "date-time", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$" };
const listOf = (item) => ({
    type: "object",
    required: ["object", "data", "next"],
    properties: { object: { const: "list" }, data: { type: "array", items: ref(item) }, next: { type: ["string", "null"], description: "Pass as ?cursor= for the next page; null on the last." } },
});
const pageParams = [
    { name: "cursor", in: "query", required: false, schema: { type: "string" }, description: "The next value of the page before." },
    { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
];
const common = {
    "401": err("Not signed with this solution's measurement key, or more than five minutes off: invalid_signature."),
    "404": err("Not there: the link is not configured or switched off, or the path is wrong: not_found."),
    "422": err("A parameter is wrong or unknown: invalid_request."),
    "429": err("Too many calls: rate_limited, with Retry-After."),
    "503": err("Figures are not ready yet: unavailable, with Retry-After."),
};
export const MEASURE_OPENAPI = {
    openapi: "3.1.0",
    info: {
        title: "Measurement Link",
        version: "1.0.0",
        summary: "The read-only interface a measured solution exposes so Outcomes can collect its daily figures.",
        description: "Every call is a signed GET. Figures are daily totals in the solution's own time zone, never about one person. Missing days are gaps, never zeros. See docs/14-measurement-link.md in haziqfaris/antarax-api.",
    },
    servers: [{ url: "/internal/measure/v1", description: "On the solution's own host" }],
    security: [{ measureSignature: [] }],
    paths: {
        "/manifest": {
            get: { operationId: "getManifest", summary: "Who the solution is, its time zone, and the metrics it shares", responses: { "200": json(ref("Manifest"), "The manifest"), ...common } },
        },
        "/metrics": {
            get: { operationId: "listMetrics", summary: "Every metric definition in full", parameters: pageParams, responses: { "200": json(listOf("Metric"), "A page of metrics"), ...common } },
        },
        "/observations": {
            get: {
                operationId: "listObservations",
                summary: "Daily figures for whole local days, oldest first",
                parameters: [
                    { name: "from", in: "query", required: true, schema: day, description: "First local day, included." },
                    { name: "to", in: "query", required: true, schema: day, description: "Last local day, included. At most 92 days after from, counting both." },
                    { name: "metric", in: "query", required: false, schema: { type: "string" }, description: "One metric key; all when left out." },
                    ...pageParams,
                ],
                responses: {
                    "200": json({ allOf: [listOf("Observation"), { type: "object", required: ["from", "to", "time_zone"], properties: { from: day, to: day, time_zone: { type: "string" } } }] }, "A page of observations. Days not finished yet are left out."),
                    "400": err("The cursor is not one this list gave out for this question: invalid_cursor."),
                    ...common,
                },
            },
        },
        "/health": {
            get: { operationId: "getHealth", summary: "The solution's own summary, and each metric's last complete day", responses: { "200": json(ref("Health"), "Health"), ...common } },
        },
        "/baselines": {
            get: {
                operationId: "listBaselines",
                summary: "Baselines the solution holds, with where they came from. Optional: 404 when the manifest does not list the baselines capability.",
                parameters: pageParams,
                responses: { "200": json(listOf("Baseline"), "A page of baselines"), ...common },
            },
        },
        "/openapi.json": {
            get: { operationId: "getOpenApi", summary: "This document", responses: { "200": { description: "OpenAPI 3.1", content: { "application/json": {} } }, ...common } },
        },
    },
    components: {
        securitySchemes: {
            measureSignature: {
                type: "apiKey",
                in: "header",
                name: "AntaraX-Service-Signature",
                description: 'Three headers on every call. AntaraX-Service: measure. AntaraX-Timestamp: unix seconds. AntaraX-Service-Signature: v1=<hex HMAC-SHA256, keyed with the integration\'s ax_msr_ key, of "<timestamp>\\nGET\\n<path with query string>\\n<hex SHA-256 of the empty body>">. Refused when more than 300 seconds off.',
            },
        },
        schemas: {
            Manifest: {
                type: "object",
                required: ["object", "schema_version", "solution_id", "solution_name", "environment", "time_zone", "capabilities", "metric_catalog_version", "reporting_periods", "data_policy", "metrics"],
                additionalProperties: false,
                properties: {
                    object: { const: "manifest" },
                    schema_version: { type: "string", pattern: "^1\\.\\d+\\.\\d+$" },
                    solution_id: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{1,62}$" },
                    solution_name: { type: "string" },
                    environment: { enum: ["production", "staging", "development"] },
                    time_zone: { type: "string", description: "IANA name, Asia/Kuala_Lumpur" },
                    capabilities: { type: "array", items: { enum: ["metrics", "observations", "health", "baselines"] } },
                    metric_catalog_version: { type: "string" },
                    reporting_periods: { type: "array", items: { const: "day" }, minItems: 1, maxItems: 1 },
                    data_policy: {
                        type: "object",
                        required: ["aggregation", "contains_personal_data"],
                        additionalProperties: false,
                        properties: { aggregation: { const: "daily" }, contains_personal_data: { const: false }, retention_days: { type: "integer", minimum: 1 } },
                    },
                    metrics: { type: "array", minItems: 1, maxItems: 200, items: ref("Metric") },
                },
            },
            Metric: {
                type: "object",
                required: ["key", "type", "unit", "description", "privacy"],
                additionalProperties: false,
                properties: {
                    key: { type: "string", pattern: "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*){1,3}$" },
                    type: { enum: ["counter", "gauge", "duration", "ratio", "distinct", "money"] },
                    unit: { type: "string", description: "item, document, page, request, run, message, task, person, second, minute, hour, day, percent, byte; or x.<name>; for money, an ISO 4217 code" },
                    description: { type: "string" },
                    label: { type: "string", maxLength: 60 },
                    aggregation: { enum: ["mean", "median", "p90", "last"], description: "Durations: mean, median or p90. Gauges: last or mean." },
                    dimensions: { type: "array", maxItems: 5, items: { type: "string", pattern: "^[a-z][a-z0-9_]{0,39}$" } },
                    privacy: { const: "aggregate" },
                    numerator: { type: "string", description: "Ratios: the counter on top" },
                    denominator: { type: "string", description: "Ratios: the counter below" },
                    identity: { type: "string", description: "Distinct counts: what is counted once" },
                    since: day,
                },
            },
            Observation: {
                type: "object",
                required: ["object", "metric_key", "period_start", "period_end", "local_period", "value", "unit", "dimensions", "quality", "source"],
                additionalProperties: false,
                properties: {
                    object: { const: "observation" },
                    metric_key: { type: "string" },
                    period_start: moment,
                    period_end: moment,
                    local_period: day,
                    value: { type: ["number", "string"], description: "A number; money is a string with the currency's decimals" },
                    unit: { type: "string" },
                    dimensions: { type: "object", additionalProperties: { type: "string", pattern: "^[a-z0-9][a-z0-9_.-]{0,59}$" }, description: "{} for the day's total" },
                    count: { type: "integer", minimum: 0, description: "Durations: items the value covers" },
                    sum: { type: "number", minimum: 0, description: "Durations: their total" },
                    quality: { enum: ["measured", "derived"] },
                    source: { type: "string", pattern: "^[a-z][a-z0-9_]{0,39}$" },
                },
            },
            Health: {
                type: "object",
                required: ["object", "status", "checked_at", "problems", "freshness"],
                properties: {
                    object: { const: "health" },
                    status: { enum: ["ok", "degraded", "down"] },
                    checked_at: moment,
                    problems: { type: "array", items: { type: "string", pattern: "^[a-z][a-z0-9_]{0,39}$" } },
                    freshness: { type: "object", additionalProperties: { oneOf: [day, { type: "null" }] }, description: "Each metric's last complete local day" },
                },
            },
            Baseline: {
                type: "object",
                required: ["object", "metric_key", "value", "unit", "method", "period_from", "period_to", "sample_size", "evidence", "recorded_at"],
                additionalProperties: false,
                properties: {
                    object: { const: "baseline" },
                    metric_key: { type: "string" },
                    value: { type: "number", minimum: 0 },
                    unit: { type: "string" },
                    method: { enum: ["timed_sample", "historical_records", "client_estimate"] },
                    period_from: day,
                    period_to: day,
                    sample_size: { type: ["integer", "null"], minimum: 1 },
                    evidence: { type: "string" },
                    recorded_at: moment,
                },
            },
            Error: {
                type: "object",
                required: ["error"],
                properties: {
                    error: {
                        type: "object",
                        required: ["code", "message", "request_id"],
                        properties: { code: { enum: ["invalid_request", "invalid_cursor", "invalid_signature", "not_found", "rate_limited", "unavailable", "internal"] }, message: { type: "string" }, request_id: { type: "string", pattern: "^req_" } },
                    },
                },
            },
        },
    },
};
