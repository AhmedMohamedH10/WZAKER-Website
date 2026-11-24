// API التحدي والمسابقة: Cloudflare Pages Functions + قاعدة D1 (الـ binding اسمه DB)
const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", ...h } });
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const rid = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => ALPHA[b % ALPHA.length]).join("");
const cleanName = s => String(s || "").replace(/[<>&"'`\u0000-\u001f\u200b-\u200f\u202a-\u202e]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
const RESERVED = /wzaker|وذكر|admin|support|moderator|الادارة|الإدارة|ادمن|أدمن|مشرف|رسمي/i;   // أسماء ممنوعة علشان محدش ينتحل صفة الموقع
const nameOk = n => n.length >= 2 && !RESERVED.test(n);
const okId = s => (typeof s === "string" && /^[a-z0-9]{10}$/.test(s)) ? s : null;
const okRoom = s => (typeof s === "string" && /^[a-z0-9]{4,10}$/.test(s)) ? s : null;
const okAvatar = s => (typeof s === "string" && s.length <= 400 && /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//i.test(s)) ? s : "";
const pub = p => ({ id: p.id, name: p.name, total: p.total, avatar: p.avatar || "", named: !!p.named });

// ───── جلسات: كوكي موقّع بـ HMAC. فيه رقم نسخة (sv) بنقارنه بالقاعدة، فنقدر نلغي أي جلسة (خروج / حظر) ─────
const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const hkey = (env, use) => crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, [use]);
const COOKIE = "__Host-wz_s", DAYS = 14;
const PL = "id,name,total,avatar,named,sv,banned,google_sub,last_sync";
const SYNC_RATE = 12, SYNC_CREDIT = 60e3;      // سقف تسبيح الحساب: 12 في الثانية كمتوسط، ورصيد أقصاه دقيقة (720) لو كان ساكت. الرصيد تراكمي مش بيتجدد مع كل طلب
const MERGE_CAP = 5000;                        // أقصى عدّ بيتنقل من لاعب قديم من غير جوجل لما يسجّل دخوله (الحسابات دي اتقفلت وممكن تكون متلاعب فيها)
async function makeCookie(env, p) {
  const body = p.id + "." + (Date.now() + DAYS * 864e5) + "." + (p.sv || 0);
  const sig = b64u(await crypto.subtle.sign("HMAC", await hkey(env, "sign"), enc.encode(body)));
  return `${COOKIE}=${body}.${sig}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`;
}
const clearCookie = `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
async function sessionPlayer(request, env, db) {          // صف اللاعب لو الجلسة سليمة وما انتهتش وما اتلغتش وهو مش محظور
  if (!env.SESSION_SECRET) return null;
  const m = (request.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  const parts = m && m[1].split(".");
  if (!parts || parts.length !== 4 || !okId(parts[0]) || !(+parts[1] > Date.now())) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hkey(env, "verify"), unb64u(parts[3]), enc.encode(parts.slice(0, 3).join(".")));
    if (!ok) return null;
    const p = await db.prepare(`SELECT ${PL} FROM players WHERE id=?`).bind(parts[0]).first();
    return p && p.google_sub && !p.banned && p.sv === +parts[2] ? p : null;
  } catch (e) { return null; }
}

// ───── التحقق من توكن جوجل (RS256) بمفاتيح جوجل العامة، من غير مكتبات ─────
let CERTS = { t: 0, keys: [] };
async function googleKeys(force) {
  if (!force && Date.now() - CERTS.t < 3600e3 && CERTS.keys.length) return CERTS.keys;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!r.ok) throw new Error("certs");
  CERTS = { t: Date.now(), keys: (await r.json()).keys || [] };
  return CERTS.keys;
}
async function googleVerify(token, env) {
  const [h, p, sg] = String(token || "").split(".");
  if (!sg) throw new Error("format");
  const head = JSON.parse(dec.decode(unb64u(h))), pay = JSON.parse(dec.decode(unb64u(p)));
  if (head.alg !== "RS256") throw new Error("alg");
  let jwk = (await googleKeys()).find(k => k.kid === head.kid);
  if (!jwk) jwk = (await googleKeys(true)).find(k => k.kid === head.kid);
  if (!jwk) throw new Error("kid");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(sg), enc.encode(h + "." + p))) throw new Error("sig");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(pay.iss)) throw new Error("iss");
  if (pay.aud !== env.GOOGLE_CLIENT_ID) throw new Error("aud");
  if (!(pay.exp * 1000 > Date.now())) throw new Error("exp");
  if (!(pay.iat * 1000 > Date.now() - 15 * 60e3 && pay.iat * 1000 < Date.now() + 60e3)) throw new Error("iat");   // توكن طازة بس (يمنع إعادة استخدام توكن قديم)
  if (!(pay.email_verified === true || pay.email_verified === "true")) throw new Error("email");
  if (!pay.sub) throw new Error("sub");
  return pay;
}

// ───── Cloudflare Turnstile (اختياري): تحقق إنه إنسان قبل دخول المسابقة ─────
async function turnstileOk(token, env, request) {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) return false;
  try {
    const f = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: request.headers.get("cf-connecting-ip") || "" });
    const j = await (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: f })).json();
    return !!j.success;
  } catch (e) { return false; }
}
async function ipHash(request, env) {                      // بصمة مختصرة للـ IP (مش الـ IP نفسه) علشان نكشف حسابات متعددة من نفس المكان
  const d = await crypto.subtle.digest("SHA-256", enc.encode(env.SESSION_SECRET + "|" + (request.headers.get("cf-connecting-ip") || "")));
  return [...new Uint8Array(d).slice(0, 6)].map(x => x.toString(16).padStart(2, "0")).join("");
}

// ───── تحديد معدل الطلبات: طبقة أولى ضد البوتات والإغراق، بيتكمّل بـ Rate Limiting من لوحة Cloudflare ─────
// عدّاد في ذاكرة نسخة التشغيل: نافذة دقيقة واحدة لكل (نوع مسار + بصمة IP + هوية الزائر). الحدود واسعة بحيث المستخدم
// الطبيعي (حتى مع تبويبين مفتوحين أو شبكة مشتركة) ما يوصلهاش؛ اللي يعدّيها بيرجعله 429 من غير ما الطلب يتنفّذ.
// الهوية من الكوكي أو معرّف اللاعب/الزائر، فالناس اللي على نفس الشبكة (واي فاي/موبايل) ما بيتعاقبوش ببعض.
// ملحوظتان: العدّاد لكل نسخة تشغيل (isolate) ومش مشترك بينها، ولو حصل أي خطأ في العدّاد نفسه الطلب بيكمّل عادي.
const RL_WIN = 60e3;
const RL_GROUPS = [
  ["admin", /^admin\//, 60, true],                                            // لوحة الأدمن: بالـ IP بس (مع قفل المحاولات الغلط الموجود). تبويبين من اللوحة ~26/دقيقة
  ["auth", /^(auth\/google|auth\/logout|account\/name|contest\/enter|contest\/claim)$/, 20, false],
  ["write", /^(sync|contest\/sync|ping)$/, 600, false],                        // المزامنة والنبض: تبويب واحد نشط في المسابقة ~113/دقيقة، فالحد فيه مساحة لـ 5 أجهزة
];
const RL_ALL = 12000;                                                          // سقف إجمالي لكل IP لكل طلبات POST، مهما غيّر المهاجم هويته (واسع عشان الشبكات المشتركة: ~100 تبويب نشط في المسابقة ~113/دقيقة لكل واحد)
const rlBuckets = new Map();
function rlSubject(request, b) {                                               // هوية الزائر في العدّاد: الكوكي أو معرّف اللاعب/الزائر (من غير بيانات حساسة)
  const m = (request.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  return String((m && m[1]) || b.id || b.vid || "").slice(0, 60);
}
async function rateLimited(route, request, env, b) {
  try {
    const now = Date.now();
    if (rlBuckets.size > 5000) rlBuckets.clear();
    const ip = await ipHash(request, env);
    const hit = k => { let x = rlBuckets.get(k); if (!x || x.reset <= now) { x = { n: 0, reset: now + RL_WIN }; rlBuckets.set(k, x); } return ++x.n; };
    if (hit("all|" + ip) > RL_ALL) return true;
    const g = RL_GROUPS.find(([, re]) => re.test(route));
    if (!g) return false;
    return hit(g[0] + "|" + ip + "|" + (g[3] ? "" : rlSubject(request, b))) > g[2];
  } catch (e) { return false; }
}

// ───── المسابقة: "مَكْرُمَةُ ذِي الأَلْف" ─────
// جولة كل خميس الساعة 10:00 مساءً بتوقيت بلد اللاعب. الجولات بتتعمل لوحدها أول ما حد يفتح الصفحة (من غير أي إعداد أو جدولة).
// مفيش مدة للجولة: بتتقفل بأول واحد يبلغ الهدف، وساعتها اللاعبين بيشوفوا الجولة اللي بعدها (عدّ تنازلي لخميس الجاي).
// لو محدش فاز لحد خميس الجاي، الجولة الجديدة بتحل محلها. اللاعبين اللي ليهم نفس الساعة (نفس فرق التوقيت) في جولة واحدة.
// حد السرعة الكلي: إجمالي التسبيحات المقبولة ما يزيدش عن (الوقت من أول دفعة × 9) + 20. يعني 1000 تسبيحة مستحيل أقل من حوالي دقيقتين.
const C_RATE = 9, C_BURST = 20, C_MIN_GAP = 900;
const C_TARGET = 1000, C_WEEKDAY = 4, C_HOUR = 22;           // الهدف، الخميس = 4، الساعة 10 مساءً
const CLAIM_MS = 24 * 3600e3;                                // مهلة الفايز لكتابة وسيلة التواصل بعد فوزه
const C_LAUNCH = Date.UTC(2026, 10, 26);                     // أول جولة ما تبدأش قبل التاريخ ده (26 نوفمبر 2026 UTC). غيّره لو عاوز تأجّل البداية

// التوقيت المحلي: Intl بتعرف فرق التوقيت والتوقيت الصيفي لأي منطقة زمنية
const dtfs = {};
const dtf = tz => dtfs[tz] || (dtfs[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }));
const validTz = tz => { try { if (typeof tz !== "string" || tz.length > 64) return false; dtf(tz); return true; } catch (e) { return false; } };
function offsetMs(ms, tz) {                                  // فرق توقيت المنطقة عن UTC في اللحظة دي
  const p = {}; for (const x of dtf(tz).formatToParts(new Date(ms))) p[x.type] = +x.value;
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}
function localToUtc(y, m, d, h, tz) {                        // الساعة h بتوقيت المنطقة → لحظة UTC (بمرّتين علشان التوقيت الصيفي)
  const g = Date.UTC(y, m - 1, d, h);
  return g - offsetMs(g - offsetMs(g, tz), tz);
}
function roundStarts(now, tz) {                              // آخر خميس 22:00 فات (أو دلوقتي)، والخميس اللي بعده
  const L = new Date(now + offsetMs(now, tz));               // الساعة المحلية مكتوبة كأنها UTC
  let back = (L.getUTCDay() - C_WEEKDAY + 7) % 7;
  const at = k => { const x = new Date(Date.UTC(L.getUTCFullYear(), L.getUTCMonth(), L.getUTCDate() - back + k)); return localToUtc(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate(), C_HOUR, tz); };
  let last = at(0); if (last > now) { back += 7; last = at(0); }
  return { last, next: at(7) };
}
// المنطقة الزمنية من Cloudflare (حسب الـ IP، مش بتتزوّر من المتصفح). الـ hint بس لو Cloudflare مش باعتها (تشغيل محلي)
const tzOf = (request, hint) => { const z = request.cf && request.cf.timezone; return validTz(z) ? z : validTz(hint) ? hint : "UTC"; };
const ccOf = request => { const c = String((request.cf && request.cf.country) || request.headers.get("cf-ipcountry") || "").toUpperCase(); return /^[A-Z]{2}$/.test(c) && c !== "XX" ? c : ""; };

const ROUND_SQL = "SELECT id,starts_at,ends_at,target FROM contest WHERE starts_at=?";
async function getRound(db, start, tz) {                     // الجولة بتاعت الموعد ده، وبتتعمل لو مش موجودة. ends_at = الخميس اللي بعده
  let c = await db.prepare(ROUND_SQL).bind(start).first();
  if (!c) {
    await db.prepare("INSERT OR IGNORE INTO contest(starts_at,target,prize,ends_at) VALUES(?,?,'',?)").bind(start, C_TARGET, roundStarts(start + 1000, tz).next).run();
    c = await db.prepare(ROUND_SQL).bind(start).first();
  }
  return c;
}
// الجولة الأسبوعية اللي اللاعب شايفها (c): الجولة الحالية (من آخر خميس) لو لسه ما اتكسبتش، وإلا الجولة الجاية (عدّ تنازلي). cur = الحالية (علشان نعرض فايزها)
async function weeklyFor(db, tz, now) {
  const { last, next } = roundStarts(now, tz);
  if (last >= C_LAUNCH) {
    const cur = await getRound(db, last, tz);
    if (!await hasWinner(db, cur.id)) return { c: cur, cur };
    return { c: await getRound(db, next, tz), cur };
  }
  let first = next; for (let i = 0; first < C_LAUNCH && i < 600; i++) first = roundStarts(first + 1000, tz).next;   // قبل تاريخ البداية: أول خميس بعده
  return { c: await getRound(db, first, tz), cur: null };
}
// ───── جولات يدوية من لوحة الأدمن: «ابدأ الآن» و«جدولة» (موعد واحد لكل العالم، مش بتوقيت كل بلد)، وإيقاف/تشغيل الجولات الأسبوعية ─────
// الجولة اليدوية اللي بدأت بتحل محل الأسبوعية لحد ما حد يفوز، أو ييجي خميس جديد (لو الأسبوعي شغال)، أو تتجدول جولة يدوية تانية. محتاج migrate-v7.sql، ولو ما اتشغلش الموقع بيكمّل أسبوعي عادي.
async function ctl(db) {
  try {
    const [a, m] = await db.batch([db.prepare("SELECT v FROM settings WHERE k='weekly_off'"), db.prepare("SELECT id,starts_at,target FROM contest_manual WHERE status='scheduled' ORDER BY starts_at")]);
    return { ok: true, weeklyOn: !(a.results[0] && a.results[0].v === "1"), manual: m.results };
  } catch (e) { return { ok: false, weeklyOn: true, manual: [] }; }
}
async function manualRow(db, m) {                            // صف الجولة اليدوية في جدول contest (بيتعمل لو مش موجود). ends_at بعيد علشان الواجهة تفضل مفتوحة لحد ما حد يفوز
  let c = await db.prepare(ROUND_SQL).bind(m.starts_at).first();
  if (!c) {
    await db.prepare("INSERT OR IGNORE INTO contest(starts_at,target,prize,ends_at) VALUES(?,?,'',?)").bind(m.starts_at, m.target, m.starts_at + 365 * 864e5).run();
    c = await db.prepare(ROUND_SQL).bind(m.starts_at).first();
  }
  return { ...c, manual: true };
}
async function weeklyNext(db, tz, now) {                     // أقرب خميس جاي (بعد تاريخ البداية C_LAUNCH)
  let first = roundStarts(now, tz).next; for (let i = 0; first < C_LAUNCH && i < 600; i++) first = roundStarts(first + 1000, tz).next;
  return getRound(db, first, tz);
}
// بيرجّع { c, cur }: c = الجولة اللي اللاعب شايفها (ممكن تكون null لو الأسبوعي موقوف ومفيش جولة جاية)، cur = الجولة الحالية/اللي خلصت (علشان نعرض فايزها)
async function roundFor(db, tz, now) {
  const k = await ctl(db);
  if (!k.manual.length && k.weeklyOn) return weeklyFor(db, tz, now);      // الطريق العادي: مفيش جولات يدوية
  const { last } = roundStarts(now, tz);
  const S = k.manual.filter(m => m.starts_at <= now).pop(), U = k.manual.find(m => m.starts_at > now);
  let res = null;
  if (S && (!k.weeklyOn || last < S.starts_at)) {                          // جولة يدوية بدأت ولسه ما جاش خميس بعدها
    const row = await manualRow(db, S);
    res = (await hasWinner(db, row.id)) ? { c: null, cur: row } : { c: row, cur: row };
  }
  if (!res) res = k.weeklyOn ? await weeklyFor(db, tz, now) : { c: null, cur: null };
  if (!res.c && k.weeklyOn) res.c = await weeklyNext(db, tz, now);         // اليدوية خلصت: عدّ تنازلي للخميس الجاي
  if (U && (!res.c || (res.c.starts_at > now && U.starts_at < res.c.starts_at))) res.c = await manualRow(db, U);   // جولة متجدولة أقرب من العدّ التنازلي الحالي
  return res;
}
// الفايز = أول واحد وصل للهدف ومش مرفوض. فيه فايز واحد بس في الجولة (التحديث في sync بيمنع غيره)
const hasWinner = async (db, cid) => !!await db.prepare("SELECT 1 AS x FROM contest_scores WHERE contest_id=? AND finished_at IS NOT NULL AND status<>'rejected' LIMIT 1").bind(cid).first();
const WIN_SQL = "SELECT s.pid AS pid, p.name AS name, s.cc AS cc, s.finished_at AS fa, s.first_sync AS fs FROM contest_scores s JOIN players p ON p.id=s.pid WHERE s.contest_id=? AND s.finished_at IS NOT NULL AND s.status<>'rejected' ORDER BY s.finished_at ASC LIMIT 1";
const myWin = (db, pid) => db.prepare("SELECT contest_id, contact, finished_at FROM contest_scores WHERE pid=? AND finished_at IS NOT NULL AND status<>'rejected' AND finished_at>? ORDER BY finished_at DESC LIMIT 1").bind(pid, Date.now() - CLAIM_MS).first();   // آخر فوز للاعب خلال 24 ساعة
// إشعار تليجرام لصاحب الموقع (اختياري): بيشتغل بس لو TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID متضافين. لو فشل ما بيأثرش على أي حاجة
async function notify(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try { await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: String(text).slice(0, 1000) }) }); } catch (e) {}
}
const HALL_SQL = "SELECT p.name AS name, s.cc AS cc, s.finished_at AS fa, s.first_sync AS fs FROM contest_scores s JOIN players p ON p.id=s.pid WHERE s.finished_at IS NOT NULL AND s.status<>'rejected' ORDER BY s.finished_at DESC LIMIT 10";

// ───── الهدف اليومي: كل يوم هدف عشوائي (الافتراضي بين 3000 و5000) على تسبيح الصفحة الرئيسية ─────
// أي لاعب يبلغ الهدف اسمه بيتسجّل بوقت وصوله، والموقع بيعرض أول 3 بس، ويفضلوا ظاهرين لحد نهاية اليوم، وبعدها يجي هدف جديد وقايمة فاضية.
// اليوم بيتحسب بتوقيت واحد للكل (D_TZ) علشان الهدف والأسماء يتجددوا في نفس اللحظة عند الكل. غيّره لو عاوز توقيت بلد تانية.
// التحكم من لوحة الأدمن (تبويب «اليومي»): تشغيل/إيقاف، مدى الهدف العشوائي، وتحديد هدف اليوم بإيدك أو هدف عشوائي جديد. محتاج migrate-v8.sql، ولو ما اتشغّلش الموقع بيكمّل عادي من غير القسم ده.
const D_TZ = "Africa/Cairo", D_MIN = 3000, D_MAX = 5000;
function dayInfo(now) {                                      // مفتاح اليوم (2026-11-20) ولحظة نهايته بتوقيت D_TZ
  const p = {}; for (const x of dtf(D_TZ).formatToParts(new Date(now))) p[x.type] = +x.value;
  return { day: p.year + "-" + String(p.month).padStart(2, "0") + "-" + String(p.day).padStart(2, "0"), end: localToUtc(p.year, p.month, p.day + 1, 0, D_TZ) };
}
const randGoal = (a, b) => a + crypto.getRandomValues(new Uint32Array(1))[0] % (b - a + 1);
async function dailyInfo(db, now, force) {                   // إعدادات الهدف + هدف اليوم (بيتعمل عشوائي أول طلب في اليوم). force: للأدمن حتى لو الميزة مقفولة
  const { day, end } = dayInfo(now);
  const [s, g] = await db.batch([db.prepare("SELECT k,v FROM settings WHERE k IN ('daily_on','daily_min','daily_max')"), db.prepare("SELECT goal,manual FROM daily_goal WHERE day=?").bind(day)]);
  const c = {}; for (const r of s.results) c[r.k] = r.v;
  const mn = Math.floor(+c.daily_min), mx = Math.floor(+c.daily_max), ok = mn >= 10 && mx >= mn && mx <= 100000;
  const min = ok ? mn : D_MIN, max = ok ? mx : D_MAX, on = c.daily_on !== "0";
  if (!on && !force) return { on: false };
  let row = g.results[0];
  if (!row) {                                                // INSERT OR IGNORE: لو طلبين جم مع بعض، الهدف الأول هو اللي يفضل للكل
    await db.prepare("INSERT OR IGNORE INTO daily_goal(day,goal,manual) VALUES(?,?,0)").bind(day, randGoal(min, max)).run();
    row = await db.prepare("SELECT goal,manual FROM daily_goal WHERE day=?").bind(day).first();
  }
  return { on, min, max, day, end, goal: row.goal, manual: !!row.manual };
}
async function dailyAdd(db, pid, d, now) {                   // يضيف تسبيحات اللاعب على يوم النهاردة، ويسجّل وقت وصوله للهدف لأول مرة. لو أي حاجة فشلت (جدول ناقص) بيرجّع null والتسبيح العادي مش بيتأثر
  try {
    const g = await dailyInfo(db, now); if (!g.on) return null;
    const r = await db.prepare(`INSERT INTO daily_scores(day,pid,count,finished_at,last_at) VALUES(?1,?2,?3,CASE WHEN ?3>=?4 THEN ?5 END,?5)
      ON CONFLICT(day,pid) DO UPDATE SET count=count+?3, last_at=?5, finished_at=CASE WHEN finished_at IS NULL AND count+?3>=?4 THEN ?5 ELSE finished_at END
      RETURNING count, finished_at`).bind(g.day, pid, d, g.goal, now).first();
    return { count: r.count, goal: g.goal, done: r.finished_at != null };
  } catch (e) { return null; }
}
const D_OK = "p.banned=0 AND p.name<>'' AND p.google_sub IS NOT NULL";                    // المحظور ومن غير اسم ما بيظهروش للعامة

// ───── لوحة الأدمن: مفتاح سري (ADMIN_KEY) بيتقارن بمقارنة ثابتة الزمن. لو المتغير مش موجود اللوحة مقفولة ─────
async function adminOk(env, key) {
  if (!env.ADMIN_KEY || env.ADMIN_KEY.length < 16 || typeof key !== "string" || key.length > 200) return false;
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(key)), crypto.subtle.digest("SHA-256", enc.encode(env.ADMIN_KEY))]);
  const x = new Uint8Array(a), y = new Uint8Array(b); let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
// ───── حماية مفتاح الأدمن: بعد 5 محاولات غلط من نفس الشبكة بيتقفل 15 دقيقة (بيتخزّن في جدول settings من v7، ولو مش موجود بيكمّل بالتأخير بس) ─────
const AF_MAX = 5, AF_WIN = 15 * 60e3;
async function afRow(db, k) {
  try { const r = await db.prepare("SELECT v FROM settings WHERE k=?").bind(k).first(); if (!r) return null; const [n, t] = String(r.v).split("|").map(Number); return { n: n || 0, t: t || 0 }; } catch (e) { return null; }
}
async function afFail(db, k, row, now) {
  try {
    const keep = row && now - row.t < AF_WIN, n = keep ? row.n + 1 : 1, t = keep ? row.t : now;
    await db.batch([
      db.prepare("INSERT INTO settings(k,v) VALUES(?1,?2) ON CONFLICT(k) DO UPDATE SET v=?2").bind(k, n + "|" + t),
      db.prepare("DELETE FROM settings WHERE k LIKE 'af:%' AND CAST(substr(v, instr(v,'|')+1) AS INTEGER) < ?").bind(now - AF_WIN)]);   // تنضيف القديم
  } catch (e) {}
}
// ───── تنضيف الزوار القدام: اللي ما سبّحوش وغايبين 90 يوم. العدد المحذوف بيتحفظ في settings ويتضاف للعدّاد علشان الرقم المعروض ما ينزلش ─────
const prunedN = async db => { try { const r = await db.prepare("SELECT v FROM settings WHERE k='v_pruned'").first(); return r ? parseInt(r.v, 10) || 0 : 0; } catch (e) { return 0; } };
// ───── العدّاد العالمي: مجموع تسبيحات كل اللاعبين. بيتخزّن في settings (taps_total) ويزيد مع كل مزامنة؛ أول مرة بيتحسب من مجموع players.total ─────
const tapsTotal = async db => {
  try {
    const q = () => db.prepare("SELECT v FROM settings WHERE k='taps_total'").first();
    let r = await q();
    if (!r) { await db.prepare("INSERT OR IGNORE INTO settings(k,v) SELECT 'taps_total', CAST(COALESCE(SUM(total),0) AS TEXT) FROM players").run(); r = await q(); }
    return r ? Math.max(0, parseInt(r.v, 10) || 0) : null;
  } catch (e) { return null; }
};
async function pruneVisitors(db, now) {
  try {
    await db.prepare("INSERT OR IGNORE INTO settings(k,v) VALUES('v_pruned','0')").run();   // لو جدول settings مش موجود بيفشل هنا قبل أي حذف
    const r = await db.prepare("DELETE FROM visitors WHERE last_seen<? AND last_tap=0").bind(now - 90 * 864e5).run(), n = (r.meta && r.meta.changes) || 0;
    if (n > 0) await db.prepare("UPDATE settings SET v=CAST(CAST(v AS INTEGER)+? AS TEXT) WHERE k='v_pruned'").bind(n).run();
  } catch (e) {}
}
const WINNERS_SQL = "SELECT s.contest_id AS cid, s.pid AS pid, p.name AS name, %EMAIL% AS email, s.contact AS contact, s.cc AS cc, s.finished_at AS fa, s.first_sync AS fs, s.status AS status, p.banned AS banned, s.n_b AS nb, s.s_r AS sr, s.s_r2 AS sr2, (SELECT target FROM contest WHERE id=s.contest_id) AS target, (SELECT COUNT(DISTINCT o.pid) FROM contest_scores o WHERE s.ip_h<>'' AND o.ip_h=s.ip_h AND o.pid<>s.pid) AS ipn FROM contest_scores s JOIN players p ON p.id=s.pid WHERE s.finished_at IS NOT NULL ORDER BY s.finished_at DESC LIMIT 50";

export async function onRequest({ request, env, params, waitUntil }) {
  const bg = p => waitUntil ? waitUntil(p) : p;                 // الإشعار بيتبعت في الخلفية من غير ما يبطّئ الرد
  const db = env.DB, url = new URL(request.url), route = [].concat(params.route || []).join("/");
  if (!db) return J({ error: "no-db" }, 503);
  try {
    if (request.method === "POST") {
      // حماية CSRF: الطلبات لازم تيجي من نفس الموقع وبصيغة JSON
      if (request.headers.get("origin") !== url.origin) return J({ error: "origin" }, 403);
      if (!(request.headers.get("content-type") || "").includes("application/json")) return J({ error: "type" }, 415);
      const b = await request.json().catch(() => ({}));
      const id = okId(b.id);

      if (await rateLimited(route, request, env, b)) return J({ error: "rate" }, 429, { "retry-after": "60" });

      if (route.startsWith("admin/")) {             // لوحة الأدمن: كل المسارات محمية بـ ADMIN_KEY
        if (!env.ADMIN_KEY) return J({ error: "admin-off" }, 503);
        const now = Date.now(), afk = "af:" + await ipHash(request, env), af = await afRow(db, afk);
        if (af && af.n >= AF_MAX && now - af.t < AF_WIN) return J({ error: "locked" }, 429);
        if (!await adminOk(env, b.key)) { await afFail(db, afk, af, now); await new Promise(r => setTimeout(r, 800)); return J({ error: "auth" }, 401); }
        if (af) { try { await db.prepare("DELETE FROM settings WHERE k=?").bind(afk).run(); } catch (e) {} }   // دخول صح: نمسح عدّاد المحاولات الغلط
        try {
          if (route === "admin/winners") {            // قائمة الفائزين (آخر 50) بأسمائهم وأرقامهم
            let rows;
            try { rows = (await db.prepare(WINNERS_SQL.replace("%EMAIL%", "p.email")).all()).results; }
            catch (e) { rows = (await db.prepare(WINNERS_SQL.replace("%EMAIL%", "''")).all()).results; }   // لو migrate-v6 لسه ما اتشغّلش
            return J({ now, claimMs: CLAIM_MS, winners: rows.map(r => {
              // مؤشرات المراجعة: rate = متوسط سرعة الجولة كلها (تسبيحة/ث)، cv = تذبذب السرعة بين الدفعات (رقم صغير = منتظم زي الآلة)، ipn = حسابات تانية دخلت من نفس الشبكة
              const n = r.nb || 0, avg = n ? r.sr / n : 0, sd = n ? Math.sqrt(Math.max(0, r.sr2 / n - avg * avg)) : 0, secs = Math.round((r.fa - r.fs) / 1000);
              const { nb, sr, sr2, ...o } = r;
              return { ...o, secs, rate: secs > 0 && r.target ? Math.round(r.target / secs * 10) / 10 : 0, cv: n >= 5 && avg > 0 ? Math.round(sd / avg * 100) / 100 : null, open: !r.contact && r.fa + CLAIM_MS > now && r.status !== "rejected" };
            }) });
          }
          if (route === "admin/winner/reject") {     // استبعاد فايز (لو غش) وحظره. بعدها الجولة بتتفتح تاني لباقي اللاعبين لأن مفيش فايز مقبول
            const cid = Math.floor(+b.cid), pid = okId(b.pid);
            if (!(cid > 0) || !pid) return J({ error: "id" }, 400);
            await db.batch([
              db.prepare("UPDATE contest_scores SET status='rejected' WHERE contest_id=? AND pid=? AND finished_at IS NOT NULL").bind(cid, pid),
              db.prepare("UPDATE players SET banned=1, sv=sv+1 WHERE id=?").bind(pid)]);   // sv+1 بيلغي جلسته فورًا
            return J({ ok: true });
          }
          if (route === "admin/players") {            // بحث اللاعبين بالاسم أو الإيميل (أو أعلى 30 لو البحث فاضي). banned:true = المحظورين بس
            const raw = String(b.q || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 30), like = "%" + raw.replace(/[\\%_]/g, m => "\\" + m) + "%";
            const run = async em => {
              const w = [], a = [];
              if (raw) { w.push(`(name LIKE ? ESCAPE '\\' OR ${em} LIKE ? ESCAPE '\\')`); a.push(like, like); } else w.push("(name<>'' OR banned=1)");
              if (b.banned === true) w.push("banned=1");
              return (await db.prepare(`SELECT id,name,total,banned,${em} AS email FROM players WHERE ${w.join(" AND ")} ORDER BY total DESC LIMIT 30`).bind(...a).all()).results;
            };
            let rows;
            try { rows = await run("email"); } catch (e) { rows = await run("''"); }   // لو migrate-v6 لسه ما اتشغّلش
            return J({ players: rows.map(r => ({ pid: r.id, name: r.name, total: r.total, banned: !!r.banned, email: r.email || "" })) });
          }
          if (route === "admin/player/ban") {         // حظر / فك حظر لاعب. الحظر بيلغي جلسته ويطلّعه من الجولات
            const pid = okId(b.pid);
            if (!pid || typeof b.banned !== "boolean") return J({ error: "id" }, 400);
            await db.prepare(b.banned ? "UPDATE players SET banned=1, sv=sv+1 WHERE id=?" : "UPDATE players SET banned=0 WHERE id=?").bind(pid).run();
            return J({ ok: true });
          }
          if (route === "admin/stats") {              // إحصائيات الموقع (زوار + لاعبين). كل مجموعة في try لوحدها لو جدول ناقص
            const day = 864e5, one = r => r.results[0].n;
            let v = null, p = null;
            try {
              const r = await db.batch([
                db.prepare("SELECT COUNT(*) AS n FROM visitors"),
                db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE last_seen>?").bind(now - 150000),
                db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE last_tap>?").bind(now - 90000),
                db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE first_seen>?").bind(now - day),
                db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE last_seen>?").bind(now - day),
                db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE ref<>''")]);
              v = { total: one(r[0]) + await prunedN(db), online: one(r[1]), tapping: one(r[2]), fresh: one(r[3]), active: one(r[4]), ref: one(r[5]) };
            } catch (e) {}
            try {
              const r = await db.batch([
                db.prepare("SELECT COUNT(*) AS n FROM players"),
                db.prepare("SELECT COUNT(*) AS n FROM players WHERE named=1"),
                db.prepare("SELECT COUNT(*) AS n FROM players WHERE google_sub IS NOT NULL AND google_sub<>''"),
                db.prepare("SELECT COUNT(*) AS n FROM players WHERE banned=1")]);
              p = { total: one(r[0]), named: one(r[1]), google: one(r[2]), banned: one(r[3]) };
            } catch (e) {}
            return J({ now, v, p });
          }
          if (route === "admin/contest") {            // حالة المسابقة للأدمن: الأسبوعي شغال/موقوف، الجولة الحالية، والجولات اليدوية
            const k = await ctl(db), { c, cur } = await roundFor(db, tzOf(request, b.tz), now);
            let list = [];
            if (k.ok) list = (await db.prepare("SELECT m.id AS id, m.starts_at AS at, m.target AS target, m.status AS status, (SELECT COUNT(*) FROM contest x JOIN contest_scores s ON s.contest_id=x.id WHERE x.starts_at=m.starts_at) AS entries, (SELECT COUNT(*) FROM contest x JOIN contest_scores s ON s.contest_id=x.id WHERE x.starts_at=m.starts_at AND s.finished_at IS NOT NULL AND s.status<>'rejected') AS won FROM contest_manual m ORDER BY m.starts_at DESC LIMIT 12").all()).results;
            let entries = 0;
            if (c) entries = (await db.prepare("SELECT COUNT(*) AS n FROM contest_scores WHERE contest_id=?").bind(c.id).first()).n;
            // ترتيب المتسابقين: الجولة اللي خلصت لو لسه فايزها معروض، وإلا الجولة الحالية/الجاية. ممكن الأدمن يختار جولة تانية (cid) لأن كل منطقة زمنية ليها جولتها
            const S = cur && c && cur.id !== c.id ? cur : (c || cur), want = Math.floor(+b.cid) > 0 ? Math.floor(+b.cid) : (S ? S.id : 0);
            const rounds = (await db.prepare("SELECT x.id AS id, x.starts_at AS at, x.target AS target, (SELECT COUNT(*) FROM contest_scores s WHERE s.contest_id=x.id) AS entries, (SELECT COUNT(*) FROM contest_scores s WHERE s.contest_id=x.id AND s.finished_at IS NOT NULL AND s.status<>'rejected') AS won FROM contest x WHERE x.id=?1 OR x.id IN (SELECT contest_id FROM contest_scores) ORDER BY x.starts_at DESC LIMIT 8").bind(S ? S.id : 0).all()).results;
            const sel = rounds.find(r => r.id === want) || rounds.find(r => S && r.id === S.id) || rounds[0] || null;
            let st = { cid: 0, target: 0, rows: [], rounds: [] };
            if (sel) {
              const rs = (await db.prepare("SELECT p.name AS name, s.cc AS cc, s.count AS n, s.finished_at AS fa, s.status AS st, p.banned AS bn FROM contest_scores s JOIN players p ON p.id=s.pid WHERE s.contest_id=? ORDER BY CASE WHEN s.finished_at IS NOT NULL AND s.status<>'rejected' THEN 0 ELSE 1 END, s.count DESC, s.first_sync ASC LIMIT 100").bind(sel.id).all()).results;
              st = { cid: sel.id, target: sel.target, rounds, rows: rs.map(r => ({ name: r.name, cc: r.cc, n: Math.min(r.n, sel.target), win: !!r.fa && r.st !== "rejected", rej: r.st === "rejected", ban: !!r.bn })) };
            }
            return J({ now, v7: k.ok, weeklyOn: k.weeklyOn, target: C_TARGET, round: c ? { at: c.starts_at, target: c.target, manual: !!c.manual, live: c.starts_at <= now, entries } : null, lastWon: !!(cur && c && cur.id !== c.id), list, st });
          }
          if (route.startsWith("admin/daily")) {      // الهدف اليومي: حالة، تحديد هدف اليوم، إعدادات (محتاج migrate-v8.sql)
            let g;
            try { g = await dailyInfo(db, now, true); } catch (e) { return route === "admin/daily" ? J({ now, v8: false }) : J({ error: "migrate-v8" }, 409); }
            if (route === "admin/daily") {
              const [n, rs] = await db.batch([
                db.prepare("SELECT COUNT(*) AS n, COUNT(finished_at) AS f FROM daily_scores WHERE day=?").bind(g.day),
                db.prepare("SELECT d.pid AS pid, p.name AS name, d.count AS n, d.finished_at AS fa, p.banned AS bn FROM daily_scores d JOIN players p ON p.id=d.pid WHERE d.day=? AND d.finished_at IS NOT NULL ORDER BY d.finished_at ASC, d.pid ASC LIMIT 30").bind(g.day)]);
              return J({ now, v8: true, on: g.on, min: g.min, max: g.max, day: g.day, end: g.end, goal: g.goal, manual: g.manual, entries: n.results[0].n, reached: n.results[0].f,
                rows: rs.results.map(r => ({ pid: r.pid, name: r.name, n: r.n, fa: r.fa, ban: !!r.bn })) });
            }
            if (route === "admin/daily/set") {        // هدف اليوم: رقم من عندك، أو من غير رقم = عشوائي جديد من المدى. اللي وصلوا قبل كده بيفضلوا (وصلوا للهدف وقتها)
              const goal = b.goal == null ? randGoal(g.min, g.max) : Math.floor(+b.goal);
              if (!(goal >= 10 && goal <= 100000)) return J({ error: "id" }, 400);
              await db.batch([
                db.prepare("UPDATE daily_goal SET goal=?, manual=? WHERE day=?").bind(goal, b.goal == null ? 0 : 1, g.day),
                db.prepare("UPDATE daily_scores SET finished_at=last_at WHERE day=? AND finished_at IS NULL AND count>=?").bind(g.day, goal)]);   // لو نزّلت الهدف: اللي كان عدّاده فوقه بيتسجّل بوقت آخر تسبيحة ليه
              return J({ ok: true, goal });
            }
            if (route === "admin/daily/config") {     // تشغيل/إيقاف + مدى الهدف العشوائي (بيتطبّق من الهدف العشوائي الجاي، مش هدف النهاردة)
              const up = (k, v) => db.prepare("INSERT INTO settings(k,v) VALUES(?1,?2) ON CONFLICT(k) DO UPDATE SET v=?2").bind(k, String(v)), st = [];
              if (b.on !== undefined) st.push(up("daily_on", b.on === false ? "0" : "1"));
              if (b.min !== undefined || b.max !== undefined) {
                const mn = Math.floor(+b.min), mx = Math.floor(+b.max);
                if (!(mn >= 10 && mx >= mn && mx <= 100000)) return J({ error: "range" }, 400);
                st.push(up("daily_min", mn), up("daily_max", mx));
              }
              if (st.length) await db.batch(st);
              return J({ ok: true });
            }
            return J({ error: "not-found" }, 404);
          }
          const tgt = Math.max(10, Math.min(100000, Math.floor(+b.target) || C_TARGET));
          if (route === "admin/contest/start") {      // ابدأ جولة دلوقتي (لكل العالم). بتحل محل الجولة الأسبوعية/اليدوية الشغالة
            await db.prepare("INSERT INTO contest_manual(starts_at,target,status,created_at) VALUES(?,?,'scheduled',?)").bind(now, tgt, now).run();
            return J({ ok: true });
          }
          if (route === "admin/contest/schedule") {   // جدول جولة في موعد محدد (UTC بالمللي ثانية، المتصفح بيحوّل من توقيتك)
            const at = Math.floor(+b.at);
            if (!(at > now + 60e3 && at < now + 400 * 864e5)) return J({ error: "time" }, 400);
            await db.prepare("INSERT INTO contest_manual(starts_at,target,status,created_at) VALUES(?,?,'scheduled',?)").bind(at, tgt, now).run();
            return J({ ok: true });
          }
          if (route === "admin/contest/cancel") {     // إلغاء جولة متجدولة أو شغالة
            const mid = Math.floor(+b.id); if (!(mid > 0)) return J({ error: "id" }, 400);
            await db.prepare("UPDATE contest_manual SET status='canceled' WHERE id=?").bind(mid).run();
            return J({ ok: true });
          }
          if (route === "admin/contest/weekly") {     // تشغيل/إيقاف الجولات الأسبوعية التلقائية
            await db.prepare("INSERT INTO settings(k,v) VALUES('weekly_off',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(b.on === false ? "1" : "0").run();
            return J({ ok: true });
          }
        } catch (e) {
          if (/no such table/i.test(String(e && e.message))) return J({ error: "migrate-v7" }, 409);
          if (/UNIQUE/i.test(String(e && e.message))) return J({ error: "exists" }, 409);
          throw e;
        }
        return J({ error: "not-found" }, 404);
      }

      if (route === "join") return J({ error: "login" }, 403);   // التسجيل بدون جوجل اتقفل: الترتيب والهدف اليومي لحسابات جوجل بس (الاسم من account/name)
      if (route === "ping") {                       // نبضة الحضور + الإحصائيات
        const vid = okId(b.vid); if (!vid) return J({ error: "vid" }, 400);
        const ref = okId(b.ref) && b.ref !== vid ? b.ref : "";       // المُحيل: بيتسجّل مرة واحدة بس عند أول زيارة للزائر
        const now = Date.now(), tap = b.tap ? now : 0;
        await db.prepare("INSERT INTO visitors(vid,first_seen,last_seen,last_tap,ref) VALUES(?1,?2,?2,?3,?4) ON CONFLICT(vid) DO UPDATE SET last_seen=?2, last_tap=MAX(last_tap,?3)").bind(vid, now, tap, ref).run();
        const [a, o, t, r] = await db.batch([
          db.prepare("SELECT COUNT(*) AS n FROM visitors"),
          db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE last_seen>?").bind(now - 150000),
          db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE last_tap>?").bind(now - 90000),
          db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE ref=? AND last_tap>0").bind(vid)]);   // اللي انضمّوا عبر رابطك وسبّحوا فعلاً
        if (Math.random() < 0.01) bg(pruneVisitors(db, now));
        return J({ visitors: a.results[0].n + await prunedN(db), online: o.results[0].n, tapping: t.results[0].n, refs: r.results[0].n, taps: await tapsTotal(db) });
      }

      if (route === "auth/google") {                // دخول بجوجل: يربط الحساب باللاعب (ويحتفظ بتقدّم الجهاز لو أول مرة)
        if (!env.GOOGLE_CLIENT_ID || !env.SESSION_SECRET) return J({ error: "auth-off" }, 503);
        let g; try { g = await googleVerify(b.credential, env); } catch (e) { return J({ error: "token" }, 401); }
        const avatar = okAvatar(g.picture);
        let p = await db.prepare(`SELECT ${PL} FROM players WHERE google_sub=?`).bind(g.sub).first();
        if (p && p.banned) return J({ error: "banned" }, 403);
        if (p) {
          if (p.avatar !== avatar) { await db.prepare("UPDATE players SET avatar=? WHERE id=?").bind(avatar, p.id).run(); p.avatar = avatar; }
        } else {
          const anon = id && await db.prepare(`SELECT ${PL} FROM players WHERE id=?`).bind(id).first();
          if (anon && !anon.google_sub && !anon.banned) {
            await db.prepare("UPDATE players SET google_sub=?1, avatar=?2, total=MIN(total,?3) WHERE id=?4").bind(g.sub, avatar, MERGE_CAP, id).run();
            p = { ...anon, avatar, total: Math.min(anon.total, MERGE_CAP) };
          } else {                                  // حساب جديد: من غير اسم. اللاعب بيختار اسمه بنفسه (مش اسم جوجل)
            const nid = rid(10);
            await db.prepare("INSERT INTO players(id,name,total,last_sync,google_sub,avatar,named) VALUES(?,'',0,?,?,?,0)").bind(nid, Date.now(), g.sub, avatar).run();
            p = { id: nid, name: "", total: 0, avatar, named: 0, sv: 0 };
          }
        }
        if (g.email) { try { await db.prepare("UPDATE players SET email=? WHERE id=?").bind(String(g.email).slice(0, 120), p.id).run(); } catch (e) {} }   // للتواصل مع الفايز لو ما كتبش رقمه (محتاج migrate-v6)
        return J(pub(p), 200, { "set-cookie": await makeCookie(env, p) });
      }
      if (route === "auth/logout") {                // يلغي الجلسة على كل الأجهزة (مش بس مسح الكوكي)
        const me = await sessionPlayer(request, env, db);
        if (me) await db.prepare("UPDATE players SET sv=sv+1 WHERE id=?").bind(me.id).run();
        return J({ ok: true }, 200, { "set-cookie": clearCookie });
      }
      if (route === "account/name") {               // الاسم الظاهر للناس (اللاعب بيكتبه بنفسه)
        const me = await sessionPlayer(request, env, db); if (!me) return J({ error: "auth" }, 401);
        const name = cleanName(b.name);
        if (!nameOk(name)) return J({ error: "name" }, 400);
        await db.prepare("UPDATE players SET name=?, named=1 WHERE id=?").bind(name, me.id).run();
        return J(pub({ ...me, name, named: 1 }));
      }

      if (route === "contest/enter") {              // تأكيد المشاركة: جلسة + اسم + (Turnstile لو متفعّل). بعدها بس يقدر يسبّح في المسابقة
        const me = await sessionPlayer(request, env, db); if (!me) return J({ error: "auth" }, 401);
        if (!me.named) return J({ error: "name" }, 403);
        const now = Date.now(), { c } = await roundFor(db, tzOf(request, b.tz), now);
        if (!c) return J({ error: "no-round" }, 409);
        if (!await turnstileOk(b.ts, env, request)) return J({ error: "captcha" }, 403);
        await db.prepare("INSERT OR IGNORE INTO contest_scores(contest_id,pid,count,last_sync,first_sync,ip_h,cc) VALUES(?,?,0,0,0,?,?)").bind(c.id, me.id, await ipHash(request, env), ccOf(request)).run();
        return J({ ok: true });
      }
      if (route === "contest/sync") {               // تسبيحات المسابقة: جلسة + مشاركة مؤكدة + حد سرعة كلي. السيرفر هو اللي بيحدد وقت الوصول للهدف
        const me = await sessionPlayer(request, env, db); if (!me) return J({ error: "auth" }, 401);
        const now = Date.now(), { c } = await roundFor(db, tzOf(request, b.tz), now);
        if (!c) return J({ error: "no-round" }, 409);
        if (now < c.starts_at) return J({ error: "not-started" }, 409);
        const row = await db.prepare("SELECT count,last_sync,first_sync,finished_at FROM contest_scores WHERE contest_id=? AND pid=?").bind(c.id, me.id).first();
        if (!row) return J({ error: "not-entered" }, 403);
        if (row.finished_at) return J({ count: c.target, accepted: 0, done: true });
        const first = !row.first_sync, gap = first ? C_MIN_GAP : now - row.last_sync;
        let d = 0;
        if (gap >= C_MIN_GAP) {
          const room = Math.floor((first ? 0 : now - row.first_sync) / 1000 * C_RATE) + C_BURST - row.count;
          d = Math.max(0, Math.min(Math.floor(+b.delta) || 0, room, 200));
        }
        if (d) {
          const rate = first ? 0 : d / (Math.min(gap, 15000) / 1000);
          // وقت الوصول بيتسجّل بس لو مفيش فايز قبله (الشرط NOT EXISTS في نفس الأمر، فمفيش فايزين اتنين حتى لو وصلوا في نفس اللحظة)
          await db.prepare(`UPDATE contest_scores SET count=count+?1,
              first_sync=CASE WHEN first_sync=0 THEN ?2 ELSE first_sync END, last_sync=?2,
              n_b=n_b+?3, s_r=s_r+?4, s_r2=s_r2+?4*?4,
              finished_at=CASE WHEN count+?1>=?5 AND NOT EXISTS(SELECT 1 FROM contest_scores o WHERE o.contest_id=?6 AND o.finished_at IS NOT NULL AND o.status<>'rejected') THEN ?2 END
            WHERE contest_id=?6 AND pid=?7 AND finished_at IS NULL`).bind(d, now, first ? 0 : 1, rate, c.target, c.id, me.id).run();
        } else if (row.count >= c.target) {            // وصل الهدف بعد فايز، والفايز اتستبعد: اللاعب ده بيتحسم له الفوز من غير ما يحتاج تسبيحة جديدة
          await db.prepare("UPDATE contest_scores SET finished_at=?1 WHERE contest_id=?2 AND pid=?3 AND finished_at IS NULL AND NOT EXISTS(SELECT 1 FROM contest_scores o WHERE o.contest_id=?2 AND o.finished_at IS NOT NULL AND o.status<>'rejected')").bind(now, c.id, me.id).run();
        }
        const cur = await db.prepare("SELECT count,finished_at,first_sync,cc FROM contest_scores WHERE contest_id=? AND pid=?").bind(c.id, me.id).first();
        if (cur.finished_at) bg(notify(env, `🏆 فائز جديد في مَكْرُمَةُ ذِي الأَلْف\nالاسم: ${me.name}${cur.cc ? "\nالبلد: " + cur.cc : ""}\nالمدة: ${Math.round((cur.finished_at - cur.first_sync) / 1000)} ثانية\nسيكتب رقمه خلال 24 ساعة.`));
        return J({ count: Math.min(cur.count, c.target), accepted: d, done: !!cur.finished_at, closed: !cur.finished_at && cur.count >= c.target });
      }
      if (route === "contest/claim") {              // الفايز يسيب وسيلة تواصل (رقم/حساب) علشان نوصله. بتتسجل على آخر فوز ليه، وبس خلال 24 ساعة من فوزه (حتى لو الجولة خلصت وبدأت جولة جديدة)
        const me = await sessionPlayer(request, env, db); if (!me) return J({ error: "auth" }, 401);
        const contact = String(b.contact || "").replace(/[<>\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
        if (contact.length < 5) return J({ error: "contact" }, 400);
        const w = await myWin(db, me.id); if (!w) return J({ error: "not-winner" }, 403);
        await db.prepare("UPDATE contest_scores SET contact=? WHERE contest_id=? AND pid=?").bind(contact, w.contest_id, me.id).run();
        bg(notify(env, `📞 بيانات تواصل الفائز\nالاسم: ${me.name}\nالتواصل: ${contact}`));
        return J({ ok: true });
      }
      if (route === "sync") {                       // إضافة تسبيحات (delta): حسابات جوجل بس، بسقف سرعة تراكمي (token bucket) مش بيتجدد مع كل طلب
        const me = await sessionPlayer(request, env, db); if (!me) return J({ error: "auth" }, 401);
        if (!me.named) return J({ error: "name" }, 403);
        const now = Date.now(), base = Math.max(me.last_sync, now - SYNC_CREDIT);          // الرصيد بيتحسب من آخر لحظة اتصرف منها، ومحدود بدقيقة
        const cap = Math.floor((now - base) / 1000 * SYNC_RATE);
        const d = Math.max(0, Math.min(Math.floor(+b.delta) || 0, cap, 2000));
        if (!d) return J({ total: me.total, accepted: 0 });
        // last_sync بيتقدّم بقدر اللي اتصرف بس. الشرط last_sync=? بيمنع طلبين متوازيين من إنهم ياخدوا نفس الرصيد
        const u = await db.prepare("UPDATE players SET total=total+?1, last_sync=?2 WHERE id=?3 AND last_sync=?4 RETURNING total").bind(d, Math.min(now, Math.round(base + d / SYNC_RATE * 1000)), me.id, me.last_sync).first();
        if (!u) return J({ total: me.total, accepted: 0 });      // طلب تاني سبقنا: العميل بيعيد المحاولة في المزامنة الجاية
        bg(db.prepare("UPDATE settings SET v=CAST(CAST(v AS INTEGER)+?1 AS TEXT) WHERE k='taps_total'").bind(d).run().catch(() => {}));   // العدّاد العالمي (لو لسه مش موجود بيتحسب من المجموع أول نبضة)
        const r = okRoom(b.room);
        if (r) await db.prepare("INSERT INTO room_scores(room,id,count) VALUES(?1,?2,?3) ON CONFLICT(room,id) DO UPDATE SET count=count+?3").bind(r, me.id, d).run();
        const dy = await dailyAdd(db, me.id, d, now);             // الهدف اليومي (اختياري)
        return J({ total: u.total, accepted: d, ...(dy ? { daily: dy } : {}) });
      }
    } else if (route === "auth/me") {               // مين اللي داخل بجوجل دلوقتي (لو فيه)
      const me = await sessionPlayer(request, env, db);
      return J({ authOn: !!(env.GOOGLE_CLIENT_ID && env.SESSION_SECRET), user: me ? pub(me) : null });
    } else if (route === "contest/state") {         // حالة الجولة: الموعد، فايز الجولة اللي خلصت (لو فيه)، حالتك، الأعلى حالياً، ولوحة المكرَّمين
      const now = Date.now(), tz = tzOf(request, url.searchParams.get("tz")), { c, cur } = await roundFor(db, tz, now);
      if (!c) return J({ on: false, authOn: !!(env.GOOGLE_CLIENT_ID && env.SESSION_SECRET) });   // الجولات الأسبوعية موقوفة ومفيش جولة متجدولة
      const me = await sessionPlayer(request, env, db);
      const q = [db.prepare(HALL_SQL),
        db.prepare("SELECT p.name AS name, s.count AS c FROM contest_scores s JOIN players p ON p.id=s.pid WHERE s.contest_id=? AND s.finished_at IS NULL AND s.count>0 ORDER BY s.count DESC LIMIT 3").bind(c.id)];
      const wi = cur && cur.id !== c.id ? q.push(db.prepare(WIN_SQL).bind(cur.id)) - 1 : -1;   // الجولة الحالية اتكسبت: بنعرض فايزها وعدّ تنازلي للجاية
      const mi = me ? q.push(db.prepare("SELECT count,finished_at,status FROM contest_scores WHERE contest_id=? AND pid=?").bind(c.id, me.id)) - 1 : -1;
      const rs = await db.batch(q), w = wi >= 0 ? rs[wi].results[0] : null, mine = mi >= 0 ? rs[mi].results[0] : null, win = me ? await myWin(db, me.id) : null;
      const dur = f => Math.max(0, f.fa - f.fs);
      return J({ on: true, now, tz, start: c.starts_at, end: c.ends_at, target: c.target, manual: !!c.manual,
        authOn: !!(env.GOOGLE_CLIENT_ID && env.SESSION_SECRET), captcha: !!env.TURNSTILE_SECRET,
        auth: !!me, named: !!(me && me.named), entered: !!mine,
        done: !!(mine && mine.finished_at), rej: !!(mine && mine.status === "rejected"),   // done من غير rej مستحيل: اللي بيوصل بيتقفل عليه الجولة
        me: mine ? Math.min(mine.count, c.target) : 0,
        claim: win ? { c: !!win.contact, until: win.finished_at + CLAIM_MS } : null,        // لو اللاعب فاز في آخر 24 ساعة: هل سابق وسيلة تواصل، ولحد امتى يقدر
        winner: w ? { name: w.name, cc: w.cc, d: dur(w), mine: !!me && w.pid === me.id } : null,
        top: rs[1].results.map(x => ({ name: x.name, c: Math.min(x.c, c.target) })),
        hall: rs[0].results.map(f => ({ n: f.name, cc: f.cc, t: f.fa, d: dur(f) })) });
    } else if (route === "daily/state") {           // الهدف اليومي للعامة: هدف النهاردة، أول 3 وصلوه، وتقدّم اللاعب (لو بعت id)
      const now = Date.now(); let g;
      try { g = await dailyInfo(db, now); } catch (e) { return J({ on: false }); }
      if (!g.on) return J({ on: false });
      const me = okId(url.searchParams.get("id")) || "";
      const [t, n, m] = await db.batch([
        db.prepare(`SELECT p.name AS name, d.finished_at AS t, (p.id=?) AS me FROM daily_scores d JOIN players p ON p.id=d.pid WHERE d.day=? AND d.finished_at IS NOT NULL AND ${D_OK} ORDER BY d.finished_at ASC, d.pid ASC LIMIT 3`).bind(me, g.day),
        db.prepare(`SELECT COUNT(*) AS n FROM daily_scores d JOIN players p ON p.id=d.pid WHERE d.day=? AND d.finished_at IS NOT NULL AND ${D_OK}`).bind(g.day),
        db.prepare("SELECT count, finished_at FROM daily_scores WHERE day=? AND pid=?").bind(g.day, me)]);
      const mine = m.results[0];
      return J({ on: true, now, end: g.end, goal: g.goal, reached: n.results[0].n,
        top: t.results.map(x => ({ name: x.name, t: x.t, me: !!x.me })), me: { count: mine ? mine.count : 0, done: !!(mine && mine.finished_at != null) } });
    } else if (route === "top") {                   // لوحة الترتيب: أعلى 3 فقط (عامة أو غرفة)
      const r = okRoom(url.searchParams.get("room")), me = okId(url.searchParams.get("id")) || "";
      const q = r
        ? db.prepare("SELECT p.name AS name, s.count AS c, (p.id=?) AS me FROM room_scores s JOIN players p ON p.id=s.id WHERE s.room=? AND p.name<>'' AND p.banned=0 ORDER BY s.count DESC LIMIT 3").bind(me, r)
        : db.prepare("SELECT name, total AS c, (id=?) AS me FROM players WHERE total>0 AND name<>'' AND banned=0 ORDER BY total DESC LIMIT 3").bind(me);
      return J({ top: (await q.all()).results });
    }
    return J({ error: "not-found" }, 404);
  } catch (e) { return J({ error: "server" }, 500); }
}

// تصدير دوال داخلية علشان اختبارات مجلد tests/ بس. ما بيغيّرش أي سلوك في الموقع، والمتصفح مش بيستخدمه.
export const _test = { cleanName, nameOk, okId, okRoom, okAvatar, turnstileOk, adminOk, makeCookie, sessionPlayer, ipHash, rateLimited, rlBuckets, offsetMs, localToUtc, roundStarts, validTz, dayInfo };
