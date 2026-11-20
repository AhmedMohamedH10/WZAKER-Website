-- تحديث v2: دخول جوجل + المسابقة. شغّله مرة واحدة في D1 Console (لو القاعدة قديمة).
ALTER TABLE players ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gsub ON players(google_sub);
CREATE TABLE IF NOT EXISTS contest(id INTEGER PRIMARY KEY AUTOINCREMENT, starts_at INTEGER NOT NULL, target INTEGER NOT NULL DEFAULT 1000, prize TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS contest_scores(contest_id INTEGER NOT NULL, pid TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, last_sync INTEGER NOT NULL DEFAULT 0, first_sync INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(contest_id, pid));
CREATE INDEX IF NOT EXISTS idx_cscore ON contest_scores(contest_id, count DESC);
CREATE TABLE IF NOT EXISTS contest_winner(contest_id INTEGER PRIMARY KEY, pid TEXT NOT NULL, won_at INTEGER NOT NULL, contact TEXT NOT NULL DEFAULT '');
