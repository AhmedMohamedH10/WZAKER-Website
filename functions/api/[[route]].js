// API التحدي: Cloudflare Pages Functions + قاعدة D1 (الـ binding اسمه DB)
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const rid = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => ALPHA[b % ALPHA.length]).join("");
const cleanName = s => String(s || "").replace(/[<>&"'`\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
const okId = s => (typeof s === "string" && /^[a-z0-9]{10}$/.test(s)) ? s : null;
const okRoom = s => (typeof s === "string" && /^[a-z0-9]{4,10}$/.test(s)) ? s : null;

export async function onRequest({ request, env, params }) {
  const db = env.DB, url = new URL(request.url), route = [].concat(params.route || []).join("/");
  if (!db) return J({ error: "no-db" }, 503);
  try {
    if (request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const id = okId(b.id);

      if (route === "join") {                       // تسجيل الاسم (أو تغييره)
        const name = cleanName(b.name);
        if (name.length < 2) return J({ error: "name" }, 400);
        const p = id && await db.prepare("SELECT total FROM players WHERE id=?").bind(id).first();
        if (p) { await db.prepare("UPDATE players SET name=? WHERE id=?").bind(name, id).run(); return J({ id, name, total: p.total }); }
        const nid = rid(10), seed = Math.max(0, Math.min(Math.floor(+b.seed) || 0, 50000));   // عدّ الجهاز لو الحساب اتمسح من السيرفر
        await db.prepare("INSERT INTO players(id,name,total,last_sync) VALUES(?,?,?,?)").bind(nid, name, seed, Date.now()).run();
        return J({ id: nid, name, total: seed });
      }
      if (route === "ping") {                       // نبضة الحضور + الإحصائيات
        const vid = okId(b.vid); if (!vid) return J({ error: "vid" }, 400);
        const now = Date.now(), tap = b.tap ? now : 0;
        await db.prepare("INSERT INTO visitors(vid,first_seen,last_seen,last_tap) VALUES(?1,?2,?2,?3) ON CONFLICT(vid) DO UPDATE SET last_seen=?2, last_tap=MAX(last_tap,?3)").bind(vid, now, tap).run();
        const [a, o, t] = await db.batch([
          db.prepare("SELECT COUNT(*) AS n FROM visitors"),
          db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE last_seen>?").bind(now - 150000),
          db.prepare("SELECT COUNT(*) AS n FROM visitors WHERE last_tap>?").bind(now - 90000)]);
        return J({ visitors: a.results[0].n, online: o.results[0].n, tapping: t.results[0].n });
      }
      if (route === "sync") {                       // إضافة تسبيحات (delta) مع حد أقصى للسرعة
        const p = id && await db.prepare("SELECT total,last_sync FROM players WHERE id=?").bind(id).first();
        if (!p) return J({ error: "unknown" }, 404);
        const now = Date.now(), cap = Math.floor((now - p.last_sync) / 1000 * 12) + 60;
        const d = Math.max(0, Math.min(Math.floor(+b.delta) || 0, cap, 2000));
        const r = okRoom(b.room);
        const st = [db.prepare("UPDATE players SET total=total+?, last_sync=? WHERE id=?").bind(d, now, id)];
        if (r && d) st.push(db.prepare("INSERT INTO room_scores(room,id,count) VALUES(?,?,?) ON CONFLICT(room,id) DO UPDATE SET count=count+?").bind(r, id, d, d));
        await db.batch(st);
        return J({ total: p.total + d, accepted: d });
      }
    } else if (route === "top") {                   // لوحة الترتيب: أعلى 3 فقط (عامة أو غرفة)
      const r = okRoom(url.searchParams.get("room")), me = okId(url.searchParams.get("id")) || "";
      const q = r
        ? db.prepare("SELECT p.name AS name, s.count AS c, (p.id=?) AS me FROM room_scores s JOIN players p ON p.id=s.id WHERE s.room=? ORDER BY s.count DESC LIMIT 3").bind(me, r)
        : db.prepare("SELECT name, total AS c, (id=?) AS me FROM players WHERE total>0 ORDER BY total DESC LIMIT 3").bind(me);
      return J({ top: (await q.all()).results });
    }
    return J({ error: "not-found" }, 404);
  } catch (e) { return J({ error: "server" }, 500); }
}
