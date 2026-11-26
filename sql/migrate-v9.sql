-- تحديث v9: خيار إخفاء اسم اللاعب من القوائم العامة. شغّله مرة واحدة في D1 Console.
-- لو شغّلته مرتين هيطلع خطأ "duplicate column"، عادي، تجاهله. من غيره الموقع يشتغل عادي والزر بس ما يحفظش.
ALTER TABLE players ADD COLUMN hide INTEGER NOT NULL DEFAULT 0;
