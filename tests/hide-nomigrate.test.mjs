// نفس الاختبار من غير عمود hide (قبل migrate-v9). ملف منفصل لأن حالة الكشف بتتخزّن في الذاكرة. على قاعدة SQLite في الذاكرة.
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

test("من غير migrate-v9 الموقع يكمّل عادي والزر بيرفض", { skip: !hasSqlite }, async () => {
  const DB = await makeDB(new URL("../sql/schema.sql", import.meta.url));
  await DB.prepare("ALTER TABLE players DROP COLUMN hide").run();
  const env = { DB, SESSION_SECRET: "s".repeat(32), GOOGLE_CLIENT_ID: "x" };
  await DB.prepare("INSERT INTO players(id,name,total,last_sync,google_sub,avatar,named,sv,banned) VALUES('player0001','اول',5,0,'s','',1,0,0)").run();
  const ck = (await t.makeCookie(env, { id: "player0001", sv: 0 })).split(";")[0];
  assert.equal((await call("account/hide", { body: { hide: true }, cookie: ck }, env)).status, 400);
  assert.equal((await (await call("top", { method: "GET" }, env)).json()).top.length, 1);
});
