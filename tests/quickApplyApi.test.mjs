import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/quick-apply.js";
import { FORM_TEMPLATES } from "../src/lib/quickApply.js";
const jobId = "00000000-0000-0000-0000-000000000010";
const formId = "00000000-0000-0000-0000-000000000011";
const valid = {
  jobId,
  formId,
  requestToken: "00000000-0000-0000-0000-000000000012",
  consent: true,
  answers: {
    full_name: "Test Applicant",
    phone: "9876543210",
    location: "Vizag",
  },
  source: "instagram",
};
function response() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(value) {
      this.body = JSON.parse(value);
    },
  };
}
test("quick API uses stored schema, strips forged identity/status and keeps receipts private", async () => {
  const previousFetch = globalThis.fetch;
  const previousEnv = { ...process.env };
  const calls = [];
  process.env.SUPABASE_URL = "https://quick-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-secret";
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(
      JSON.stringify(
        String(url).includes("get_quick_job")
          ? {
              id: jobId,
              form_id: formId,
              is_open: true,
              fields: FORM_TEMPLATES.Basic,
            }
          : { accepted: true, claimable: true },
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const res = response();
    await handler(
      {
        method: "POST",
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
        body: {
          ...valid,
          answers: {
            ...valid.answers,
            student_user_id: "forged",
            status: "hired",
          },
        },
      },
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { accepted: true, claimable: true });
    const saved = calls.find((c) =>
      c.url.includes("submit_quick_application"),
    ).body;
    assert.equal(saved.p_user_id, null);
    assert.equal(saved.p_answers.phone, "+919876543210");
    assert.equal(saved.p_answers.status, undefined);
    assert.equal(saved.p_answers.student_user_id, undefined);
    assert.match(saved.p_token_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(saved.p_ip_key, "127.0.0.1");
    for (const patch of [
      { consent: false },
      { formId: "changed" },
      { answers: { ...valid.answers, location: "" } },
    ]) {
      const r = response();
      await handler(
        { method: "POST", headers: {}, body: { ...valid, ...patch } },
        r,
      );
      assert.equal(r.statusCode, 400);
    }
    const oversized = response();
    await handler(
      {
        method: "POST",
        headers: {},
        body: { ...valid, answers: { text: "x".repeat(33000) } },
      },
      oversized,
    );
    assert.equal(oversized.statusCode, 413);
    const method = response();
    await handler({ method: "GET" }, method);
    assert.equal(method.statusCode, 405);
  } finally {
    globalThis.fetch = previousFetch;
    process.env = previousEnv;
  }
});
