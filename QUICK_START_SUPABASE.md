# 🚀 دليل سريع: تحويل Database إلى Supabase

## الخطوات بالترتيب:

### 1️⃣ تثبيت Dependencies الجديدة
```bash
npm install pg serverless-http
npm uninstall better-sqlite3
```

### 2️⃣ إنشاء حساب Supabase
1. اذهب إلى: https://supabase.com
2. سجل دخول بـ GitHub
3. اضغط "New Project"
4. املأ البيانات واحفظ كلمة المرور

### 3️⃣ تشغيل SQL Schema
1. في Supabase Dashboard → **SQL Editor**
2. افتح ملف `server/migrations/supabase-schema.sql`
3. انسخ كل المحتوى
4. الصقه في SQL Editor
5. اضغط **Run**

### 4️⃣ الحصول على Connection String
1. في Supabase → **Settings** → **Database**
2. انسخ **Connection String** (URI)
3. استبدل `[YOUR-PASSWORD]` بكلمة المرور الحقيقية

مثال:
```
postgresql://postgres:YourPassword123@db.abcdefgh.supabase.co:5432/postgres
```

### 5️⃣ إضافة Environment Variables

في ملف `.env`:
```env
DATABASE_URL=postgresql://postgres:YourPassword@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=your-super-secret-jwt-key
```

### 6️⃣ تحديث netlify.toml
تأكد من أن ملف `netlify.toml` يحتوي على:
```toml
[functions]
  node_bundler = "esbuild"
  external_node_modules = ["pg"]
```

### 7️⃣ إضافة Environment Variables في Netlify
1. اذهب إلى Netlify Dashboard
2. اختر موقعك → **Site settings** → **Environment variables**
3. أضف:
   - `DATABASE_URL` = Connection String من Supabase
   - `JWT_SECRET` = مفتاح سري قوي
   - `CORS_ORIGIN` = `https://your-site.netlify.app`
   - `NODE_ENV` = `production`

### 8️⃣ Deploy
```bash
git add .
git commit -m "Migrate to Supabase PostgreSQL"
git push origin main
```

---

## ✅ التحقق من النجاح

بعد الـ Deploy، اختبر:
1. افتح الموقع
2. سجل دخول أو أنشئ حساب جديد
3. أنشئ عرض تقديمي جديد
4. تأكد من حفظ البيانات

---

## 🔧 استكشاف الأخطاء

### خطأ: "Connection refused"
- تأكد من صحة `DATABASE_URL`
- تأكد من استبدال `[YOUR-PASSWORD]`

### خطأ: "SSL required"
- تأكد من أن Connection String يبدأ بـ `postgresql://`
- في Supabase، SSL مطلوب دائماً

### خطأ: "Table does not exist"
- تأكد من تشغيل SQL Schema في Supabase
- راجع SQL Editor → History

---

## 📊 مقارنة: قبل وبعد

| الميزة | SQLite (قبل) | Supabase (بعد) |
|--------|-------------|----------------|
| التخزين | ملف محلي | سحابي |
| Serverless | ❌ لا يعمل | ✅ يعمل |
| Backup | يدوي | تلقائي |
| Scalability | محدود | غير محدود |
| Real-time | ❌ | ✅ |
| المساحة المجانية | - | 500MB |

---

## 🎉 تم!

الآن مشروعك جاهز للعمل على Netlify مع Supabase!
