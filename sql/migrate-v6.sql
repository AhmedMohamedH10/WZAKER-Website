-- تحديث v6: حفظ إيميل جوجل للاعب (بيظهر في لوحة الأدمن للفايزين بس، مش للعامة). شغّله مرة واحدة في D1 Console.
-- لو شغّلته مرتين هيطلع خطأ "duplicate column"، عادي، تجاهله.
ALTER TABLE players ADD COLUMN email TEXT NOT NULL DEFAULT '';
