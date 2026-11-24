// بديل محلي بسيط لقاعدة D1 وقت الاختبارات: SQLite في الذاكرة من Node (node:sqlite).
// بيطبّق نفس الواجهة اللي الكود بيستخدمها: prepare/bind/first/all/run و batch.
// لو نسخة Node قديمة ومفيهاش node:sqlite، الاختبارات اللي محتاجة قاعدة بتتخطّى برسالة واضحة.
import { readFileSync } from "node:fs";

export async function sqliteAvailable() {
  try { await import("node:sqlite"); return true; } catch (e) { return false; }
}

export async function makeDB(schemaUrl) {
  const { DatabaseSync } = await import("node:sqlite");
  const s = new DatabaseSync(":memory:");
  s.exec(readFileSync(schemaUrl, "utf8"));
  const wrap = sql => {
    const st = { _sql: sql, _args: [] };
    st.bind = (...a) => { st._args = a; return st; };
    st.first = async () => { const r = s.prepare(st._sql).get(...st._args); return r === undefined ? null : r; };
    st.all = async () => ({ results: s.prepare(st._sql).all(...st._args) });
    st.run = async () => ({ meta: { changes: Number(s.prepare(st._sql).run(...st._args).changes) } });
    return st;
  };
  return {
    prepare: wrap,
    batch: async stmts => {
      const out = [];
      for (const st of stmts) out.push(/^\s*(select|with)/i.test(st._sql) ? await st.all() : { results: [], meta: (await st.run()).meta });
      return out;
    },
  };
}
