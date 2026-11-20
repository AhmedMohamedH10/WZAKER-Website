-- تحديث v7: تحكم الأدمن في المسابقة (ابدأ الآن / جدولة جولة / إيقاف الجولات الأسبوعية). شغّله مرة واحدة في D1 Console.
CREATE TABLE IF NOT EXISTS contest_manual(id INTEGER PRIMARY KEY AUTOINCREMENT, starts_at INTEGER NOT NULL UNIQUE, target INTEGER NOT NULL DEFAULT 1000, status TEXT NOT NULL DEFAULT 'scheduled', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT NOT NULL);
