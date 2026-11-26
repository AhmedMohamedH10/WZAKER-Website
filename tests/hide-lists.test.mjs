// التأكد إن ردود القوائم العامة نفسها (مش بس الشكل) ما فيهاش اسم اللاعب المخفي، وإن العدّ شغّال.
import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequest, _test as t } from "../functions/api/[[route]].js";
import { makeDB, sqliteAvailable } from "./d1-shim.mjs";

const hasSqlite = await sqliteAvailable();
const BASE = "https://wzaker.test";
const call = (route, { method = "GET", body = {}, cookie = "" } = {}, env) => {
  const headers = { "cf-connecting-ip": "203.0.113.9" };
  if (method === "POST") { headers["content-type"] = "application/json"; headers.origin = BASE; }
  if (cookie) headers.cookie = cookie;
  const request = new Request(BASE + "/api/" + route, { method, headers, body: method === "POST" ? JSON.stringify(body) : undefined });
  return onRequest({ request, env, params: { route: route.split("/") }, waitUntil: p => p });
};
const text = async r => JSON.stringify(await r.json());

test("اللاعب المخفي مش ظاهر في أي قائمة عامة والعدّ شغّال", { skip: !hasSqlite }, async () => {
  const DB = await makeDB(new URL("../sql/schema.sql", import.meta.url));
  const env = { DB, SESSION_SECRET: "s".repeat(32), GOOGLE_CLIENT_ID: "x" };
  const add = (id, n) => DB.prepare("INSERT INTO players(id,name,total,last_sync,google_sub,avatar,named,sv,banned) VALUES(?,?,?,0,?,?,1,0,0)").bind(id, n, 100, "s" + id, "https://lh3.googleusercontent.com/" + id).run();
  await add("hiddenpl01", "SECRETNAME"); await add("shownpl002", "SHOWNNAME");
  const ck = (await t.makeCookie(env, { id: "hiddenpl01", sv: 0 })).split(";")[0];
  const prep = async () => {
    const st = await (await call("contest/state", {}, env)).json(); assert.ok(st.on);
    return st;
  };
  let st = await prep();
  const cid = (await DB.prepare("SELECT id FROM contest ORDER BY id DESC LIMIT 1").first()).id;
  const now = Date.now(), day = (await (await call("daily/state", {}, env)).json());
  const dd = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date(now));
  for (const id of ["hiddenpl01", "shownpl002"]) {
    await DB.prepare("INSERT INTO contest_scores(contest_id,pid,count,first_sync,finished_at,status) VALUES(?,?,50,1,NULL,'ok')").bind(cid, id).run();
    await DB.prepare("INSERT OR REPLACE INTO daily_scores(day,pid,count,finished_at,last_at) VALUES(?,?,10,?,?)").bind(day.on ? dd : dd, id, now, now).run();
    await DB.prepare("INSERT INTO room_scores(room,id,count) VALUES('room12345',?,5)").bind(id).run();
  }
  const urls = ["contest/state", "daily/state", "top", "top?room=room12345"];
  const grab = async () => { const o = {}; for (const u of urls) o[u] = await text(await call(u, {}, env)); return o; };
  let before = await grab();
  assert.ok(Object.values(before).join().includes("SECRETNAME"), "الاسم لازم يظهر قبل الإخفاء");
  await call("account/hide", { method: "POST", body: { hide: true }, cookie: ck }, env);
  const after = await grab();
  for (const [u, v] of Object.entries(after)) { assert.ok(!v.includes("SECRETNAME"), u); assert.ok(!v.includes("hiddenpl01"), u); assert.ok(!v.includes("googleusercontent"), u); }
  assert.ok(after["top"].includes("SHOWNNAME") && after["daily/state"].includes("SHOWNNAME"));
  assert.equal(JSON.parse(after["daily/state"]).reached, 2);          // العدّ لسه بيشمل المخفي (رقم من غير اسم)
  // صاحب الحساب نفسه لسه بيشوف بياناته ومشاركته
  const me = await (await call("contest/state", { cookie: ck }, env)).json(); assert.equal(me.entered, true);
});
