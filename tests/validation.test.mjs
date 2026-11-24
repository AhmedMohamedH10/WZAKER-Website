// اختبارات دوال التحقق والتنضيف (من غير قاعدة بيانات)
import { test } from "node:test";
import assert from "node:assert/strict";
import { _test as t } from "../functions/api/[[route]].js";

test("cleanName: يشيل الرموز الخطيرة وعلامات الاتجاه ويقصّر لـ 20 حرف", () => {
  assert.equal(t.cleanName("<b>أحمد</b>"), "bأحمد/b");
  assert.equal(t.cleanName("  أحمد   محمد  "), "أحمد محمد");
  assert.equal(t.cleanName("أحمد\u202Eمحمد"), "أحمدمحمد");          // علامة عكس الاتجاه بتتشال
  assert.equal(t.cleanName("أ".repeat(50)).length, 20);
  assert.equal(t.cleanName(null), "");
});

test("nameOk: حروفين على الأقل وممنوع انتحال صفة الموقع", () => {
  assert.equal(t.nameOk("أحمد"), true);
  assert.equal(t.nameOk("أ"), false);
  assert.equal(t.nameOk("وذكر"), false);
  assert.equal(t.nameOk("admin"), false);
  assert.equal(t.nameOk("الإدارة"), false);
});

test("okId و okRoom و okAvatar", () => {
  assert.equal(t.okId("abcdefg123"), "abcdefg123");
  assert.equal(t.okId("abcdefg12"), null);                          // 9 حروف
  assert.equal(t.okId("ABCDEFG123"), null);                         // كابيتال ممنوع
  assert.equal(t.okId(1234567890), null);
  assert.equal(t.okRoom("room12"), "room12");
  assert.equal(t.okRoom("ro!m"), null);
  assert.ok(t.okAvatar("https://lh3.googleusercontent.com/a-/xyz"));
  assert.equal(t.okAvatar("https://evil.com/x.jpg"), "");
  assert.equal(t.okAvatar("http://lh3.googleusercontent.com/x"), "");
});
