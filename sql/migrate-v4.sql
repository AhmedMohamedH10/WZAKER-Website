-- تحديث v4: رابط الإحالة (مشاركة الموقع). شغّله مرة واحدة في D1 Console.
ALTER TABLE visitors ADD COLUMN ref TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_vref ON visitors(ref);
