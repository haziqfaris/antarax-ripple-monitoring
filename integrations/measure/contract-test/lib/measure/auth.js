// Generated from haziqfaris/antarax-api packages/lapisan-core/src by scripts/build-measure-pack.mjs. Do not edit.
import { hmacHex, randomString, sha256Hex, timingSafeEqual } from "../crypto.js";
/**
 * How Outcomes signs its calls to a solution's Measurement Link, and how the
 * solution checks them (decision 0013). The same signature as
 * AXLE Link (src/service-auth.ts), with one difference: the key belongs to
 * one integration, not to an AntaraX product, because the solutions measured
 * are mostly REKA-built client systems that are not in the registry.
 *
 *   AntaraX-Service:           measure
 *   AntaraX-Timestamp:         unix seconds
 *   AntaraX-Service-Signature: v1=<hex HMAC-SHA256 with the measurement key>
 *
 * over "<timestamp>\n<METHOD>\n<path with its query string>\n<hex SHA-256
 * of the body>". Every call is a GET, so the body is "". Calls more than
 * five minutes off are refused.
 *
 * The key is ax_msr_ and 32 characters. Outcomes makes one per integration
 * and keeps it sealed; the solution keeps it as a secret (AX_MEASURE_KEY).
 * Both hold the key itself, not a hash, because both make the same HMAC.
 * To rotate, the solution accepts two keys for a while (AX_MEASURE_KEY and
 * AX_MEASURE_KEY_NEXT), Outcomes switches, then the old one goes.
 */
export const MEASURE_SERVICE = "measure";
export const MEASURE_SERVICE_HEADER = "AntaraX-Service";
export const MEASURE_TIMESTAMP_HEADER = "AntaraX-Timestamp";
export const MEASURE_SIGNATURE_HEADER = "AntaraX-Service-Signature";
export const MEASURE_TOLERANCE_SECONDS = 300;
const MEASURE_KEY = /^ax_msr_[A-Za-z0-9]{32}$/;
export const isMeasureKey = (key) => MEASURE_KEY.test(key.trim());
/** A new measurement key for one integration. */
export function newMeasureKey() {
    return `ax_msr_${randomString(32)}`;
}
async function canonical(method, pathAndQuery, timestamp) {
    return `${timestamp}\n${method.toUpperCase()}\n${pathAndQuery}\n${await sha256Hex("")}`;
}
/** The path a call signs: the URL's path with its query string, when it has one. */
export function signedPath(url) {
    const u = typeof url === "string" ? new URL(url, "https://solution.invalid") : url;
    return u.pathname + u.search;
}
/** The three headers for one signed call. */
export async function signMeasureCall(key, method, url, timestamp = Math.floor(Date.now() / 1000)) {
    const k = key.trim();
    if (!MEASURE_KEY.test(k))
        throw new Error("signMeasureCall: that is not an ax_msr_ key");
    const t = Math.floor(timestamp);
    return {
        [MEASURE_SERVICE_HEADER]: MEASURE_SERVICE,
        [MEASURE_TIMESTAMP_HEADER]: String(t),
        [MEASURE_SIGNATURE_HEADER]: `v1=${await hmacHex(k, await canonical(method, signedPath(url), t))}`,
    };
}
/**
 * Whether a call was signed with one of these keys (the current one, and
 * the next during a rotation), for this method and URL, within the
 * tolerance; and why not, when it was not.
 */
export async function checkMeasureCall(keys, method, url, headers, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = MEASURE_TOLERANCE_SECONDS) {
    const usable = keys.map((k) => (k ?? "").trim()).filter((k) => MEASURE_KEY.test(k));
    if (!usable.length)
        return { ok: false, why: "no_key" };
    if (headers.get(MEASURE_SERVICE_HEADER) !== MEASURE_SERVICE)
        return { ok: false, why: "wrong_service" };
    const t = headers.get(MEASURE_TIMESTAMP_HEADER);
    if (!t || !/^\d{1,12}$/.test(t) || Math.abs(nowSeconds - Number(t)) > toleranceSeconds)
        return { ok: false, why: "stale" };
    const sig = /^v1=([0-9a-f]{64})$/.exec(headers.get(MEASURE_SIGNATURE_HEADER) ?? "")?.[1];
    if (!sig)
        return { ok: false, why: "bad_signature" };
    const message = await canonical(method, signedPath(url), Number(t));
    let ok = false;
    for (const k of usable)
        if (timingSafeEqual(await hmacHex(k, message), sig))
            ok = true;
    return ok ? { ok: true } : { ok: false, why: "bad_signature" };
}
