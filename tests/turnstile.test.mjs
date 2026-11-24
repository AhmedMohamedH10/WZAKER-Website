// اختبارات منطق Turnstile: مقفول = عدّي، مفعّل = لازم توكن صحيح من Cloudflare
import { test } from "node:test";
import assert from "node:assert/strict";
import { _test as t } from "../functions/api/[[route]].js";

const req = { headers: new Headers({ "cf-connecting-ip": "203.0.113.9" }) };

test("من غير TURNSTILE_SECRET: التحقق متخطّى (الوضع الحالي)", async () => {
  assert.equal(await t.turnstileOk(undefined, {}, req), true);
});

test("مع TURNSTILE_SECRET: قبول/رفض حسب رد Cloudflare", async () => {
  const env = { TURNSTILE_SECRET: "test-secret" };
  const real = globalThis.fetch;
  try {
    let called = 0;
    globalThis.fetch = async () => { called++; return { json: async () => ({ success: true }) }; };
    assert.equal(await t.turnstileOk("a".repeat(20), env, req), true);
    assert.equal(called, 1);
    assert.equal(await t.turnstileOk("short", env, req), false);    // توكن قصير: بيترفض من غير ما نكلّم Cloudflare
    assert.equal(called, 1);
    globalThis.fetch = async () => ({ json: async () => ({ success: false }) });
    assert.equal(await t.turnstileOk("a".repeat(20), env, req), false);
    globalThis.fetch = async () => { throw new Error("network"); };
    assert.equal(await t.turnstileOk("a".repeat(20), env, req), false);   // فشل الشبكة = رفض آمن
  } finally { globalThis.fetch = real; }
});
