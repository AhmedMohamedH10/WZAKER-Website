-- تحديث v5: مسابقة "مَكْرُمَةُ ذِي الأَلْف" التلقائية (كل خميس 10:00 صباحاً بتوقيت بلد اللاعب).
-- شغّله مرة واحدة في D1 Console (بعد v3 و v4). لو شغّلته مرتين هيطلع خطأ "duplicate column"، عادي، تجاهله.
ALTER TABLE contest ADD COLUMN ends_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contest_scores ADD COLUMN cc TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_contest_start ON contest(starts_at);
CREATE INDEX IF NOT EXISTS idx_cwin ON contest_scores(finished_at);
-- لو كنت مجرّب جولات يدوية قبل كده وعاوز تبدأ نضيف، امسحها (اختياري):
-- DELETE FROM contest_scores; DELETE FROM contest; DELETE FROM contest_winner;
