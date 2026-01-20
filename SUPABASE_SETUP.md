# 🗄️ دليل تحويل Database من SQLite إلى Supabase

## 1️⃣ إنشاء حساب Supabase

1. اذهب إلى: https://supabase.com
2. سجل دخول بحساب GitHub
3. اضغط "New Project"
4. املأ البيانات:
   - **Name**: slideforge-db
   - **Database Password**: احفظها في مكان آمن
   - **Region**: اختر الأقرب لك
5. انتظر 2-3 دقائق حتى يتم إنشاء الـ Database

## 2️⃣ الحصول على Connection String

بعد إنشاء المشروع:
1. اذهب إلى **Settings** → **Database**
2. انسخ **Connection String** (URI)
3. استبدل `[YOUR-PASSWORD]` بكلمة المرور

مثال:
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

## 3️⃣ تثبيت Dependencies الجديدة

```bash
npm install pg
npm uninstall better-sqlite3
```

## 4️⃣ تشغيل SQL Script

في Supabase Dashboard:
1. اذهب إلى **SQL Editor**
2. افتح ملف `server/migrations/supabase-schema.sql`
3. انسخ المحتوى والصقه في SQL Editor
4. اضغط **Run**

## 5️⃣ إضافة Environment Variables

في ملف `.env`:
```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=your-super-secret-jwt-key
```

في Netlify Environment Variables:
```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=your-super-secret-jwt-key
CORS_ORIGIN=https://your-site.netlify.app
```

## 6️⃣ Deploy

```bash
git add .
git commit -m "Migrate to Supabase PostgreSQL"
git push origin main
```

---

## ✅ المميزات بعد التحويل:

- ✅ Database حقيقي في السحابة
- ✅ يعمل مع Netlify Functions
- ✅ Backup تلقائي
- ✅ 500MB مساحة مجانية
- ✅ Real-time subscriptions
- ✅ Row Level Security

---

## 📞 المساعدة

إذا واجهت مشاكل:
- https://supabase.com/docs
- https://supabase.com/docs/guides/database
