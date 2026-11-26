// اختبار إخفاء الاسم من القوائم (account/hide). على قاعدة SQLite في الذاكرة.
import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequest, _test as t } from "../functions/api/[[route]].js";
import { makeDB, sqliteAvailable } from "./d1-shim.mjs";

const hasSqlite = await sqliteAvailable();
const BASE = "https://wzaker.test";
const call = (route, { method = "POST", body = {}, cookie = "" } = {}, env) => {
  const headers = { "cf-connecting-ip": "203.0.113.9" };
  if (method === "POST") { headers["content-type"] = "application/json"; headers.origin = BASE; }
  if (cookie) headers.cookie = cookie;
  const request = new Request(BASE + "/api/" + route, { method, headers, body: method === "POST" ? JSON.stringify(body) : undefined });
  return onRequest({ request, env, params: { route: route.split("/") }, waitUntil: p => p });
};

test("account/hide: يخفي الاسم من لوحة الترتيب ويرجّعه", { skip: !hasSqlite }, async () => {
  const DB = await makeDB(new URL("../sql/schema.sql", import.meta.url));
  const env = { DB, SESSION_SECRET: "s".repeat(32), GOOGLE_CLIENT_ID: "x" };
  for (const [id, nm, tot] of [["player0001", "اول", 50], ["player0002", "تاني", 40]])
    await DB.prepare("INSERT INTO players(id,name,total,last_sync,google_sub,avatar,named,sv,banned) VALUES(?,?,?,0,?,'',1,0,0)").bind(id, nm, tot, "sub-" + id).run();
  const ck = (await t.makeCookie(env, { id: "player0001", sv: 0 })).split(";")[0];
  let r = await call("account/hide", { body: { hide: true } }, env); assert.equal(r.status, 401);
  r = await call("account/hide", { body: { hide: "yes" }, cookie: ck }, env); assert.equal(r.status, 400);
  let top = (await (await call("top", { method: "GET" }, env)).json()).top;
  assert.deepEqual(top.map(x => x.name), ["اول", "تاني"]);
  r = await call("account/hide", { body: { hide: true }, cookie: ck }, env);
  assert.equal(r.status, 200); assert.equal((await r.json()).hide, true);
  top = (await (await call("top", { method: "GET" }, env)).json()).top;
  assert.deepEqual(top.map(x => x.name), ["تاني"]);
  let me = await (await call("auth/me", { method: "GET", cookie: ck }, env)).json(); assert.equal(me.user.hide, true);
  await call("account/hide", { body: { hide: false }, cookie: ck }, env);
  top = (await (await call("top", { method: "GET" }, env)).json()).top;
  assert.equal(top.length, 2);
});
