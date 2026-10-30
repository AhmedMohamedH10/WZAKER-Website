# موقع وذكر (WZAKER)

```
index.html        الصفحة الرئيسية
css/style.css     الألوان والخطوط والحركة
js/config.js      الإعدادات (اسم المستودع على GitHub)
js/main.js        جلب روابط التحميل تلقائياً من GitHub
js/challenge.js   تحدي التسبيح (الواجهة والعد والمزامنة)
css/challenge.css شكل قسم التحدي
functions/api/    السيرفر الصغير للتحدي (Cloudflare Pages Functions)
schema.sql        جداول قاعدة البيانات D1
assets/fonts/     الخطوط
assets/img/       الصور (الاسم، الأيقونة، favicon)
_headers          إعدادات التخزين المؤقت لـ Cloudflare Pages
```

قبل الرفع: افتح `js/config.js` وغيّر `OWNER/wzaker` لاسم حسابك واسم المستودع.
الرفع على Cloudflare Pages: Build command فاضي، Output directory = `/`.

## تشغيل تحدي التسبيح (مرة واحدة)
العد بيشتغل ومحفوظ في المتصفح من غير سيرفر. علشان لوحة الترتيب والغرف تشتغل:
1. ارفع الفولدر ده على مستودع GitHub، وفي Cloudflare Pages اختار Connect to Git (مجلد `functions` بيتبني تلقائياً بالطريقة دي بس، مش بالرفع اليدوي).
2. من Workers & Pages > D1 اعمل قاعدة بيانات اسمها `wzaker`، وشغّل محتوى `schema.sql` في الـ Console بتاعها.
3. من إعدادات مشروع Pages > Bindings أضف D1 database باسم المتغير `DB` واختار القاعدة، وبعدها أعد النشر.

لو كنت شغّلت `schema.sql` قبل كده: شغّل بس آخر 3 أسطر فيه (جدول `visitors`) علشان إحصائيات الزائرين تشتغل.
