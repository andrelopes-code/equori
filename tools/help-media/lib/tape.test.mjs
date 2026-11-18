import assert from "node:assert/strict";
import { test } from "node:test";

import { key, passes } from "./tape.mjs";

const request = (method, path, body = null) => ({
  method: () => method,
  url: () => `http://127.0.0.1:5173${path}`,
  postData: () => body,
});

test("a read is keyed by its method, path and query", () => {
  assert.equal(key(request("GET", "/api/v1/rules?active=true")), "GET /api/v1/rules?active=true");
});

test("a declared read with a body is keyed by the body too", () => {
  const one = key(request("POST", "/api/v1/rules/preview", '{"name":"a"}'));
  const other = key(request("POST", "/api/v1/rules/preview", '{"name":"b"}'));

  assert.match(one, /^POST \/api\/v1\/rules\/preview [0-9a-f]{64}$/);
  assert.notEqual(one, other);
});

test("only a read, the sign-in and a declared read reach the instance", () => {
  const reads = ["POST /api/v1/rules/preview"];

  assert.equal(passes(request("GET", "/api/v1/rules"), reads), true);
  assert.equal(passes(request("POST", "/api/v1/session"), reads), true);
  assert.equal(passes(request("POST", "/api/v1/rules/preview", "{}"), reads), true);
  assert.equal(passes(request("POST", "/api/v1/rules", "{}"), reads), false);
  assert.equal(passes(request("POST", "/api/v1/rules/preview", "{}"), []), false);
  assert.equal(passes(request("DELETE", "/api/v1/rules/1"), reads), false);
});
