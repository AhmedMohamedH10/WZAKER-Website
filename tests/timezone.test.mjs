// اختبارات حساب مواعيد الجولات والتوقيت الصيفي (الخميس 10 مساءً بتوقيت كل بلد)
import { test } from "node:test";
import assert from "node:assert/strict";
import { _test as t } from "../functions/api/[[route]].js";

test("roundStarts: الخميس 22:00 بتوقيت القاهرة (شتاءً UTC+2)", () => {
  const now = Date.UTC(2026, 10, 24, 12);                 // ثلاثاء 24 نوفمبر 2026
  const { last, next } = t.roundStarts(now, "Africa/Cairo");
  assert.equal(last, Date.UTC(2026, 10, 19, 20));         // خميس 19 نوفمبر 22:00 القاهرة
  assert.equal(next, Date.UTC(2026, 10, 26, 20));         // خميس 26 نوفمبر 22:00 القاهرة
});

test("roundStarts: التوقيت الصيفي (يوليو، القاهرة UTC+3)", () => {
  const now = Date.UTC(2026, 6, 15, 12);                  // أربعاء 15 يوليو 2026
  const { last, next } = t.roundStarts(now, "Africa/Cairo");
  assert.equal(last, Date.UTC(2026, 6, 9, 19));           // خميس 9 يوليو 22:00 القاهرة
  assert.equal(next, Date.UTC(2026, 6, 16, 19));
});

test("dayInfo: اليوم بيتبدل نص الليل بتوقيت القاهرة", () => {
  const g = t.dayInfo(Date.UTC(2026, 10, 24, 23));        // 01:00 صباح يوم 25 في القاهرة
  assert.equal(g.day, "2026-11-25");
  assert.equal(g.end, Date.UTC(2026, 10, 25, 22));        // 00:00 يوم 26 بالقاهرة
});

test("validTz: يقبل المناطق الصحيحة ويرفض الغلط", () => {
  assert.equal(t.validTz("Africa/Cairo"), true);
  assert.equal(t.validTz("Evil/Zone"), false);
  assert.equal(t.validTz(123), false);
  assert.equal(t.validTz("x".repeat(100)), false);
});
