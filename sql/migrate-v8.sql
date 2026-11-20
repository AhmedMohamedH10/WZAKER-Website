-- تحديث v8: الهدف اليومي (هدف عشوائي كل يوم + أول 3 يبلغوه). شغّله مرة واحدة في D1 Console.
-- آمن لو شغّلته أكتر من مرة. لو ما شغّلتوش الموقع بيكمّل عادي من غير قسم الهدف اليومي.
CREATE TABLE IF NOT EXISTS daily_goal(day TEXT PRIMARY KEY, goal INTEGER NOT NULL, manual INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS daily_scores(day TEXT NOT NULL, pid TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, finished_at INTEGER, last_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, pid));
CREATE INDEX IF NOT EXISTS idx_dfin ON daily_scores(day, finished_at);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT NOT NULL);
