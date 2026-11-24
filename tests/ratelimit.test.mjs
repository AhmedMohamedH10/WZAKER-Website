// اختبارات تحديد معدل الطلبات: حدود المجموعات، العزل بين الزائرين، والسقف العام لكل IP
import { test } from "node:test";
import assert from "node:assert/strict";
import { _test as t } from "../functions/api/[[route]].js";

const env = { SESSION_SECRET: "s".repeat(32) };
const reqAt = ip => ({ headers: new Headers({ "cf-connecting-ip": ip }) });

test("مسارات الدخول: 20/دقيقة لكل زائر، والواحد والعشرين 429", async () => {
  t.rlBuckets.clear();
  const r = reqAt("198.51.100.10");
  for (let i = 0; i < 20; i++) assert.equal(await t.rateLimited("auth/google", r, env, {}), false);
  assert.equal(await t.rateLimited("auth/google", r, env, {}), true);
});

test("العزل بالهوية: زائر تاني على نفس الشبكة مالوش دعوة", async () => {
  t.rlBuckets.clear();
  const r = reqAt("198.51.100.11");
  for (let i = 0; i < 20; i++) await t.rateLimited("auth/google", r, env, { id: "aaaaaaa111" });
  assert.equal(await t.rateLimited("auth/google", r, env, { id: "aaaaaaa111" }), true);
  assert.equal(await t.rateLimited("auth/google", r, env, { id: "bbbbbbb222" }), false);   // زائر جديد، عدّاده صفر
});

test("الأدمن: بالـ IP بس، تغيير المفتاح ما بيفتحش عدّاد جديد", async () => {
  t.rlBuckets.clear();
  const r = reqAt("198.51.100.12");
  for (let i = 0; i < 60; i++) await t.rateLimited("admin/stats", r, env, { key: "guess-" + i });
  assert.equal(await t.rateLimited("admin/stats", r, env, { key: "guess-61" }), true);
});

test("المزامنة: 600/دقيقة (التبويب النشط في المسابقة ~113)", async () => {
  t.rlBuckets.clear();
  const r = reqAt("198.51.100.13");
  for (let i = 0; i < 600; i++) assert.equal(await t.rateLimited("sync", r, env, { id: "ccccccc333" }), false);
  assert.equal(await t.rateLimited("sync", r, env, { id: "ccccccc333" }), true);
});

test("مسار مش في القواعد: مفيش تحديد", async () => {
  t.rlBuckets.clear();
  const r = reqAt("198.51.100.14");
  for (let i = 0; i < 50; i++) assert.equal(await t.rateLimited("something/else", r, env, {}), false);
});
