-- تحديث v3: اسم يختاره اللاعب + صورة الحساب + أوقات الوصول للهدف + أدوات مراجعة الفايز + إلغاء الجلسات والحظر.
-- شغّله مرة واحدة في D1 Console (بعد migrate-v2.sql). لو شغّلته مرتين هيطلع خطأ "duplicate column"، عادي، تجاهله.
ALTER TABLE players ADD COLUMN avatar TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN named INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN sv INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;
UPDATE players SET named=1 WHERE google_sub IS NULL AND name<>'';
ALTER TABLE contest_scores ADD COLUMN n_b INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contest_scores ADD COLUMN s_r REAL NOT NULL DEFAULT 0;
ALTER TABLE contest_scores ADD COLUMN s_r2 REAL NOT NULL DEFAULT 0;
ALTER TABLE contest_scores ADD COLUMN finished_at INTEGER;
ALTER TABLE contest_scores ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE contest_scores ADD COLUMN contact TEXT NOT NULL DEFAULT '';
ALTER TABLE contest_scores ADD COLUMN ip_h TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_cfin ON contest_scores(contest_id, finished_at);
-- لو كنت مجرّب مسابقة تجريبية قبل كده، امسح نتايجها علشان ما تدخلش في المسابقة الحقيقية:
-- DELETE FROM contest_scores; DELETE FROM contest_winner;
