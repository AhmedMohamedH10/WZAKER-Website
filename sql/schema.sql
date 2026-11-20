-- قاعدة جديدة خالص: شغّل الملف ده كله مرة واحدة في D1 Console (فيه كل حاجة لحد v8).
-- لو القاعدة قديمة (شغّلت v2 قبل كده): شغّل migrate-v3.sql ثم migrate-v4.sql ثم migrate-v5.sql ثم migrate-v6.sql ثم migrate-v7.sql ثم migrate-v8.sql.
CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, name TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 0, last_sync INTEGER NOT NULL, google_sub TEXT, avatar TEXT NOT NULL DEFAULT '', named INTEGER NOT NULL DEFAULT 0, sv INTEGER NOT NULL DEFAULT 0, banned INTEGER NOT NULL DEFAULT 0, email TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_total ON players(total DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gsub ON players(google_sub);
CREATE TABLE IF NOT EXISTS room_scores(room TEXT NOT NULL, id TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(room, id));
CREATE INDEX IF NOT EXISTS idx_room ON room_scores(room, count DESC);
CREATE TABLE IF NOT EXISTS visitors(vid TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, last_tap INTEGER NOT NULL DEFAULT 0, ref TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_seen ON visitors(last_seen);
CREATE INDEX IF NOT EXISTS idx_tap ON visitors(last_tap);
CREATE INDEX IF NOT EXISTS idx_vref ON visitors(ref);
CREATE TABLE IF NOT EXISTS contest(id INTEGER PRIMARY KEY AUTOINCREMENT, starts_at INTEGER NOT NULL, target INTEGER NOT NULL DEFAULT 1000, prize TEXT NOT NULL DEFAULT '', ends_at INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contest_start ON contest(starts_at);
CREATE TABLE IF NOT EXISTS contest_scores(contest_id INTEGER NOT NULL, pid TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, last_sync INTEGER NOT NULL DEFAULT 0, first_sync INTEGER NOT NULL DEFAULT 0, n_b INTEGER NOT NULL DEFAULT 0, s_r REAL NOT NULL DEFAULT 0, s_r2 REAL NOT NULL DEFAULT 0, finished_at INTEGER, status TEXT NOT NULL DEFAULT 'pending', contact TEXT NOT NULL DEFAULT '', ip_h TEXT NOT NULL DEFAULT '', cc TEXT NOT NULL DEFAULT '', PRIMARY KEY(contest_id, pid));
CREATE INDEX IF NOT EXISTS idx_cscore ON contest_scores(contest_id, count DESC);
CREATE INDEX IF NOT EXISTS idx_cfin ON contest_scores(contest_id, finished_at);
CREATE INDEX IF NOT EXISTS idx_cwin ON contest_scores(finished_at);
CREATE TABLE IF NOT EXISTS contest_manual(id INTEGER PRIMARY KEY AUTOINCREMENT, starts_at INTEGER NOT NULL UNIQUE, target INTEGER NOT NULL DEFAULT 1000, status TEXT NOT NULL DEFAULT 'scheduled', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS daily_goal(day TEXT PRIMARY KEY, goal INTEGER NOT NULL, manual INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS daily_scores(day TEXT NOT NULL, pid TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, finished_at INTEGER, last_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, pid));
CREATE INDEX IF NOT EXISTS idx_dfin ON daily_scores(day, finished_at);
