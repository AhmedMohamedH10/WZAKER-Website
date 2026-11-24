// اختبارات الـ API نفسه (HTTP مستوى الطلب والرد) على قاعدة SQLite في الذاكرة.
// بتحتاج node:sqlite (Node 22.5+). لو مش موجود بتتخطّى برسالة.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { onRequest, _test as t } from "../functions/api/[[route]].js";
import { makeDB, sqliteAvailable } from "./d1-shim.mjs";

const hasSqlite = await sqliteAvailable();
const BASE = "https://wzaker.test";

function req(route, { method = "POST", body, ip = "203.0.113.1", cookie = "", origin = BASE, ctype = "application/json", tz = "" } = {}) {
  const headers = {};
  if (method === "POST") { headers["content-type"] = ctype; if (origin !== null) headers.origin = origin; }
  headers["cf-connecting-ip"] = ip;
  if (cookie) headers.cookie = cookie;
  return new Request(BASE + "/api/" + route + (tz ? "?tz=" + tz : ""), { method, headers, body: method === "POST" ? JSON.stringify(body || {}) : undefined });
}
const call = (route, opts, env) => onRequest({ request: req(route, opts), env, params: { route: route.split("/") }, waitUntil: p => p });

const SECRET = "s".repeat(32), AKEY = "k".repeat(32);
let DB, env;
const addPlayer = async (db, id, { named = 1, total = 0, lastSync = 0, name = "أحمد" } = {}) =>
  db.prepare("INSERT INTO players(id,name,total,last_sync,google_sub,avatar,named,sv,banned) VALUES(?,?,?,?,?,?,?,0,0)")
    .bind(id, named ? name : "", total, lastSync, "sub-" + id, "", named).run();
const cookieFor = async (env, id) => (await t.makeCookie(env, { id, sv: 0 })).split(";")[0];

before(async () => {
  if (!hasSqlite) return;
  DB = await makeDB(new URL("../sql/schema.sql", import.meta.url));
  env = { DB, SESSION_SECRET: SECRET, ADMIN_KEY: AKEY, GOOGLE_CLIENT_ID: "test-client-id" };
});

test("حماية CSRF: من غير Origin مرفوض، وبصيغة غير JSON مرفوض", { skip: !hasSqlite }, async () => {
  let r = await call("ping", { origin: null, body: { vid: "visitor123" } }, env);
  assert.equal(r.status, 403); assert.equal((await r.json()).error, "origin");
  r = await call("ping", { origin: "https://evil.example", body: { vid: "visitor123" } }, env);
  assert.equal(r.status, 403);
  r = await call("ping", { ctype: "text/plain", body: { vid: "visitor123" } }, env);
  assert.equal(r.status, 415);
});

test("ping: زائر صحيح بيتسجّل، ومعرّف غلط بيترفض", { skip: !hasSqlite }, async () => {
  let r = await call("ping", { body: { vid: "visitor123", tap: true }, ip: "203.0.113.2" }, env);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.visitors >= 1 && j.online >= 1 && j.tapping >= 1);
  r = await call("ping", { body: { vid: "xx" }, ip: "203.0.113.2" }, env);
  assert.equal(r.status, 400);
});

test("الجلسة: كوكي صحيح بيعرّف اللاعب، والمعدّل والمحظور مرفوضين", { skip: !hasSqlite }, async () => {
  await addPlayer(DB, "player0001");
  const ck = await cookieFor(env, "player0001");
  let r = await call("auth/me", { method: "GET", cookie: ck, ip: "203.0.113.3" }, env);
  let j = await r.json();
  assert.equal(j.authOn, true); assert.equal(j.user.name, "أحمد");
  r = await call("auth/me", { method: "GET", cookie: ck.slice(0, -2) + "zz", ip: "203.0.113.3" }, env);
  assert.equal((await r.json()).user, null);
  await DB.prepare("UPDATE players SET banned=1 WHERE id='player0001'").run();
  r = await call("auth/me", { method: "GET", cookie: ck, ip: "203.0.113.3" }, env);
  assert.equal((await r.json()).user, null);
  await DB.prepare("UPDATE players SET banned=0 WHERE id='player0001'").run();
});

test("account/name: يحتاج جلسة، والاسم المحجوز مرفوض", { skip: !hasSqlite }, async () => {
  const ck = await cookieFor(env, "player0001");
  let r = await call("account/name", { body: { name: "بطل" }, ip: "203.0.113.4" }, env);
  assert.equal(r.status, 401);
  r = await call("account/name", { body: { name: "ادمن" }, cookie: ck, ip: "203.0.113.4" }, env);
  assert.equal(r.status, 400);
  r = await call("account/name", { body: { name: "بطل التسبيح" }, cookie: ck, ip: "203.0.113.4" }, env);
  assert.equal(r.status, 200);
});

test("دخول جوجل: توكن غلط = 401، ومن غير إعداد = 503", { skip: !hasSqlite }, async () => {
  let r = await call("auth/google", { body: { credential: "bad" }, ip: "203.0.113.5" }, env);
  assert.equal(r.status, 401); assert.equal((await r.json()).error, "token");
  r = await call("auth/google", { body: { credential: "bad" }, ip: "203.0.113.5" }, { DB, SESSION_SECRET: SECRET });
  assert.equal(r.status, 503);
});

test("sync: سقف السرعة التراكمي بيمنع ضخ التسبيحات", { skip: !hasSqlite }, async () => {
  await addPlayer(DB, "player0002", { lastSync: Date.now() - 60000 });
  const ck = await cookieFor(env, "player0002");
  let r = await call("sync", { body: { delta: 100 }, cookie: ck, ip: "203.0.113.6" }, env);
  let j = await r.json();
  assert.equal(j.accepted, 100); assert.equal(j.total, 100);
  let drained = false;
  for (let i = 0; i < 10 && !drained; i++) {
    r = await call("sync", { body: { delta: 2000 }, cookie: ck, ip: "203.0.113.6" }, env);
    j = await r.json();
    if (j.accepted === 0) drained = true;
  }
  assert.equal(drained, true);          // رصيد الدقيقة خلص: ضخ آلي أكتر بيتوقف
  const p = await DB.prepare("SELECT total FROM players WHERE id='player0002'").first();
  assert.ok(p.total <= 100 + 720 + 24); // المقبول كله في حدود رصيد الدقيقة (+ سماحية ثواني التنفيذ)
});

test("لوحة الأدمن: مفتاح غلط 401، صح 200، وبعد 5 غلط قفل 15 دقيقة", { skip: !hasSqlite }, async () => {
  const ip = "203.0.113.7";
  let r = await call("admin/stats", { body: { key: "wrong" }, ip }, env);
  assert.equal(r.status, 401);
  r = await call("admin/stats", { body: { key: AKEY }, ip: "203.0.113.71" }, env);   // الدخول الصح بيصفّر عدّاد المحاولات، فبنجربه من شبكة تانية
  assert.equal(r.status, 200);
  for (let i = 0; i < 4; i++) await call("admin/stats", { body: { key: "wrong" }, ip }, env);   // المجموع 5 غلط ورا بعض
  r = await call("admin/stats", { body: { key: AKEY }, ip }, env);
  assert.equal(r.status, 429);           // حتى بالمفتاح الصح: مقفول
  assert.equal((await r.json()).error, "locked");
}, { timeout: 20000 });

test("المسابقة كاملة: بداية يدوية، مشاركة، فوز واحد، وسيلة تواصل", { skip: !hasSqlite }, async () => {
  t.rlBuckets.clear();
  const DB2 = await makeDB(new URL("../sql/schema.sql", import.meta.url));
  const env2 = { DB: DB2, SESSION_SECRET: SECRET, ADMIN_KEY: AKEY };
  const ip = "203.0.113.8";
  let r = await call("admin/contest/start", { body: { key: AKEY, target: 10 }, ip }, env2);
  assert.equal((await r.json()).ok, true);

  await addPlayer(DB2, "player1001");
  await addPlayer(DB2, "player1002", { name: "سعيد" });
  const ck1 = await cookieFor(env2, "player1001"), ck2 = await cookieFor(env2, "player1002");
  r = await call("contest/enter", { body: { tz: "UTC" }, cookie: ck1, ip }, env2);
  assert.equal((await r.json()).ok, true);
  r = await call("contest/enter", { body: { tz: "UTC" }, cookie: ck2, ip }, env2);   // لاعب تاني مشارك قبل ما حد يفوز
  assert.equal((await r.json()).ok, true);
  r = await call("contest/sync", { body: { delta: 5, tz: "UTC" }, cookie: ck2, ip }, env2);
  assert.equal((await r.json()).accepted, 5);
  r = await call("contest/sync", { body: { delta: 50, tz: "UTC" }, cookie: ck1, ip }, env2);
  let j = await r.json();
  assert.equal(j.done, true);            // وصل الهدف (10) = فاز
  assert.equal(j.count, 10);

  r = await call("contest/state", { method: "GET", cookie: ck1, ip, tz: "UTC" }, env2);
  j = await r.json();
  assert.equal(j.on, true); assert.equal(j.winner.mine, true); assert.equal(j.winner.t, 10);   // فايز الجولة اللي خلصت ظاهر، والعرض الحالي عدّ تنازلي للجولة الجاية
  assert.equal(j.entered, false); assert.equal(j.claim.c, false); // لسه ماكتبش وسيلة التواصل

  r = await call("contest/claim", { body: { contact: "01001234567" }, cookie: ck1, ip }, env2);
  assert.equal((await r.json()).ok, true);
  const w = await DB2.prepare("SELECT contact FROM contest_scores WHERE pid='player1001'").first();
  assert.equal(w.contact, "01001234567");
  r = await call("contest/state", { method: "GET", cookie: ck1, ip, tz: "UTC" }, env2);
  assert.equal((await r.json()).claim.c, true);   // وسيلة التواصل اتسجّلت

  // بعد الفوز الجولة اتقفلت: مزامنة اللاعب التاني في الجولة القديمة مرفوضة، والفوز مش بيتنسب له
  r = await call("contest/sync", { body: { delta: 50, tz: "UTC" }, cookie: ck2, ip }, env2);
  assert.equal(r.status, 409); assert.equal((await r.json()).error, "not-started");   // العرض انتقل للجولة الجاية (لسه ما بدأتش)
  const p2 = await DB2.prepare("SELECT count, finished_at FROM contest_scores WHERE pid='player1002'").first();
  assert.equal(p2.count, 5); assert.equal(p2.finished_at, null);   // عدّه محفوظ زي ما وصل، من غير فوز
  r = await call("contest/state", { method: "GET", cookie: ck2, ip, tz: "UTC" }, env2);
  j = await r.json();
  assert.equal(j.winner.mine, false); assert.equal(j.winner.name, "أحمد");

  // لاعب من غير اسم: ممنوع من المشاركة
  await addPlayer(DB2, "player1003", { named: 0 });
  const ck3 = await cookieFor(env2, "player1003");
  r = await call("contest/enter", { body: { tz: "UTC" }, cookie: ck3, ip }, env2);
  assert.equal(r.status, 403); assert.equal((await r.json()).error, "name");
});

test("تجاوز حد الطلبات: الطلب الـ21 على مسار الدخول بيرجع 429 ومعاه Retry-After", { skip: !hasSqlite }, async () => {
  t.rlBuckets.clear();
  const ip = "203.0.113.77";
  for (let i = 0; i < 20; i++) {
    const r = await call("account/name", { body: { name: "أحمد" }, ip }, env);
    assert.notEqual(r.status, 429);
  }
  const r = await call("account/name", { body: { name: "أحمد" }, ip }, env);
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("retry-after"), "60");
  assert.equal((await r.json()).error, "rate");
  t.rlBuckets.clear();
});
