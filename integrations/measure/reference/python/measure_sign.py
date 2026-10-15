"""Measurement Link signatures, for a solution not written in TypeScript.

The same signature as the TypeScript kit (antarax-api docs/14, section 14.6):
HMAC-SHA256, keyed with the whole ax_msr_ key, over
"<timestamp>\\nGET\\n<path with its query string>\\n<SHA-256 of the empty body>".

Check this file against the pack's vectors:  python3 measure_sign.py ../../test-vectors.json
"""

import hashlib
import hmac
import json
import sys
import time

EMPTY_BODY_SHA256 = hashlib.sha256(b"").hexdigest()
TOLERANCE_SECONDS = 300


def sign_measure_call(key: str, path_and_query: str, timestamp: int | None = None) -> dict:
    """The three headers for one call. Outcomes does this; a solution needs it only to test."""
    t = int(timestamp if timestamp is not None else time.time())
    message = f"{t}\nGET\n{path_and_query}\n{EMPTY_BODY_SHA256}"
    signature = hmac.new(key.strip().encode(), message.encode(), hashlib.sha256).hexdigest()
    return {"AntaraX-Service": "measure", "AntaraX-Timestamp": str(t), "AntaraX-Service-Signature": f"v1={signature}"}


def check_measure_call(keys: list, method: str, path_and_query: str, headers: dict, now: int | None = None) -> bool:
    """True when a call was signed with one of these keys (current, and next during a rotation).

    path_and_query is the request's path with its query string, exactly as received.
    Answer every False with one plain 401 invalid_signature, and log why only on your side.
    """
    now = int(now if now is not None else time.time())
    get = {k.lower(): v for k, v in headers.items()}.get
    if method.upper() != "GET" or get("antarax-service") != "measure":
        return False
    t = get("antarax-timestamp") or ""
    if not t.isdigit() or abs(now - int(t)) > TOLERANCE_SECONDS:
        return False
    got = get("antarax-service-signature") or ""
    usable = [k.strip() for k in keys if k and k.strip().startswith("ax_msr_")]
    return any(hmac.compare_digest(sign_measure_call(k, path_and_query, int(t))["AntaraX-Service-Signature"], got) for k in usable)


if __name__ == "__main__":
    vectors = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "test-vectors.json"))["vectors"]
    for v in vectors:
        assert sign_measure_call(v["key"], v["path"], v["timestamp"]) == v["headers"], v["path"]
        assert check_measure_call([v["key"]], "GET", v["path"], v["headers"], v["timestamp"] + 10)
        assert not check_measure_call([v["key"]], "GET", v["path"], v["headers"], v["timestamp"] + TOLERANCE_SECONDS + 1)
    print(f"{len(vectors)} vectors match")
