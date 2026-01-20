# 🚀 دليل النشر الكامل - SlideUP على Netlify + Supabase

## 📋 جدول المحتويات
1. [المتطلبات](#المتطلبات)
2. [إعداد Supabase](#إعداد-supabase)
3. [إعداد المشروع](#إعداد-المشروع)
4. [إعداد Netlify](#إعداد-netlify)
5. [النشر](#النشر)
6. [ما بعد النشر](#ما-بعد-النشر)

---

## المتطلبات

قبل البدء، تأكد من توفر:
- ✅ حساب GitHub
- ✅ حساب Supabase (مجاني)
- ✅ حساب Netlify (مجاني)
- ✅ Node.js 18+ مثبت محلياً
- ✅ Git مثبت

---

## إعداد Supabase

### الخطوة 1: إنشاء مشروع جديد

1. اذهب إلى: https://supabase.com
2. اضغط "Start your project"
3. سجل دخول بحساب GitHub
4. اضغط "New Project"
5. املأ البيانات:
   ```
   Name: slideup-db
   Database Password: [اختر كلمة مرور قوية واحفظها]
   Region: [اختر الأقرب لك]
   Pricing Plan: Free
   ```
6. اضغط "Create new project"
7. انتظر 2-3 دقائق حتى يتم إنشاء المشروع

### الخطوة 2: تشغيل SQL Schema

1. في Supabase Dashboard، اذهب إلى **SQL Editor** (من القائمة الجانبية)
2. افتح ملف `server/migrations/supabase-schema.sql` من مشروعك
3. انسخ **كل** المحتوى (Ctrl+A ثم Ctrl+C)
4. الصقه في SQL Editor
5. اضغط **Run** (أو Ctrl+Enter)
6. انتظر حتى يظهر "Success. No rows returned"

### الخطوة 3: الحصول على Connection String

1. في Supabase Dashboard، اذهب إلى **Settings** → **Database**
2. ابحث عن قسم "Connection string"
3. اختر **URI** (وليس Session mode)
4. انسخ الـ Connection String
5. استبدل `[YOUR-PASSWORD]` بكلمة المرور التي اخترتها في الخطوة 1

**مثال:**
```
قبل: postgresql://postgres:[YOUR-PASSWORD]@db.abcdefgh.supabase.co:5432/postgres
بعد: postgresql://postgres:MySecurePass123@db.abcdefgh.supabase.co:5432/postgres
```

**⚠️ مهم:** احفظ هذا الـ Connection String في مكان آمن!

---

## إعداد المشروع

### الخطوة 1: تثبيت Dependencies

```bash
# إزالة SQLite وتثبيت PostgreSQL
npm uninstall better-sqlite3
npm install pg serverless-http dotenv

# تثبيت باقي الـ Dependencies
npm install
```

### الخطوة 2: إنشاء ملف .env

```bash
# انسخ ملف المثال
copy .env.example.supabase .env

# أو في Linux/Mac
cp .env.example.supabase .env
```

### الخطوة 3: تحديث ملف .env

افتح ملف `.env` وحدث القيم:

```env
# Database Connection (الصق Connection String من Supabase)
DATABASE_URL=postgresql://postgres:YourPassword@db.xxxxx.supabase.co:5432/postgres

# JWT Secret (اختر مفتاح سري قوي)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long

# CORS Origin (سيتم تحديثه بعد إنشاء موقع Netlify)
CORS_ORIGIN=*

# Node Environment
NODE_ENV=development

# Admin Password (غيره بعد أول تسجيل دخول!)
ADMIN_PASSWORD=01021303309
```

### الخطوة 4: اختبار الاتصال محلياً (اختياري)

```bash
# اختبار الاتصال بـ Supabase
node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => {
    console.log('✅ Connected to Supabase!');
    return client.query('SELECT version()');
  })
  .then(res => {
    console.log('PostgreSQL version:', res.rows[0].version);
    client.end();
  })
  .catch(err => {
    console.error('❌ Connection error:', err);
    client.end();
  });
"
```

### الخطوة 5: ترحيل البيانات من SQLite (إذا كان لديك بيانات)

```bash
# إذا كان لديك database SQLite موجود
npm run migrate:postgres
```

---

## إعداد Netlify

### الخطوة 1: رفع الكود على GitHub

```bash
# إذا لم تكن قد أنشأت Repository بعد
git init
git add .
git commit -m "Initial commit with Supabase integration"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main

# إذا كان لديك Repository موجود
git add .
git commit -m "Migrate to Supabase PostgreSQL"
git push origin main
```

### الخطوة 2: إنشاء موقع على Netlify

1. اذهب إلى: https://app.netlify.com
2. سجل دخول بحساب GitHub
3. اضغط "Add new site" → "Import an existing project"
4. اختر "GitHub"
5. ابحث عن Repository الخاص بك واختره
6. إعدادات البناء:
   ```
   Build command: npm run build
   Publish directory: dist
   Functions directory: netlify/functions
   ```
7. **لا تضغط Deploy بعد!** اذهب للخطوة التالية أولاً

### الخطوة 3: إضافة Environment Variables

1. في صفحة إعداد الموقع، اضغط "Show advanced"
2. اضغط "New variable" وأضف:

```
DATABASE_URL = postgresql://postgres:YourPassword@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET = your-super-secret-jwt-key-min-32-characters-long
CORS_ORIGIN = *
NODE_ENV = production
ADMIN_PASSWORD = 01021303309
```

**⚠️ مهم جداً:**
- استخدم نفس `DATABASE_URL` من ملف `.env`
- استخدم نفس `JWT_SECRET` من ملف `.env`
- `CORS_ORIGIN` سيتم تحديثه لاحقاً

3. اضغط "Deploy site"

---

## النشر

### الخطوة 1: انتظر اكتمال البناء

1. سيبدأ Netlify في بناء الموقع تلقائياً
2. راقب الـ Logs في صفحة Deploy
3. انتظر حتى يظهر "Site is live" (عادة 2-5 دقائق)

### الخطوة 2: احصل على رابط الموقع

1. بعد اكتمال البناء، ستحصل على رابط مثل:
   ```
   https://random-name-123456.netlify.app
   ```
2. انسخ هذا الرابط

### الخطوة 3: تحديث CORS_ORIGIN

1. في Netlify Dashboard، اذهب إلى:
   **Site settings** → **Environment variables**
2. ابحث عن `CORS_ORIGIN`
3. غير القيمة من `*` إلى رابط موقعك:
   ```
   https://your-site-name.netlify.app
   ```
4. اضغط "Save"
5. اذهب إلى **Deploys** → اضغط "Trigger deploy" → "Clear cache and deploy site"

---

## ما بعد النشر

### ✅ اختبار الموقع

1. افتح رابط الموقع
2. جرب تسجيل الدخول:
   ```
   Username: admin
   Password: 01021303309
   ```
3. غير كلمة مرور الـ Admin فوراً!
4. جرب إنشاء عرض تقديمي جديد
5. تأكد من حفظ البيانات

### 🔒 تأمين الموقع

#### 1. تغيير كلمة مرور Admin
- سجل دخول كـ Admin
- غير كلمة المرور من الإعدادات

#### 2. تحديث JWT_SECRET
إذا كنت تستخدم المفتاح الافتراضي:
1. أنشئ مفتاح جديد قوي:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. حدث `JWT_SECRET` في Netlify Environment Variables
3. Redeploy الموقع

#### 3. تفعيل Row Level Security في Supabase (اختياري)
في Supabase SQL Editor:
```sql
ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own presentations"
ON presentations FOR ALL
USING (user_id = current_setting('app.current_user_id')::integer);
```

### 📊 مراقبة الأداء

#### في Netlify:
- **Functions**: راقب عدد الـ Invocations والأخطاء
- **Bandwidth**: راقب استهلاك الـ Bandwidth
- **Build minutes**: راقب دقائق البناء المتبقية

#### في Supabase:
- **Database**: راقب حجم الـ Database (500MB مجاناً)
- **API requests**: راقب عدد الطلبات (50,000 شهرياً مجاناً)
- **Auth users**: راقب عدد المستخدمين (50,000 مجاناً)

### 🔄 التحديثات المستقبلية

عند تحديث الكود:
```bash
git add .
git commit -m "Your update message"
git push origin main
```

سيتم Deploy تلقائياً على Netlify!

### 🎨 تخصيص Domain (اختياري)

1. في Netlify: **Domain settings** → **Add custom domain**
2. اتبع التعليمات لربط Domain الخاص بك
3. حدث `CORS_ORIGIN` بالـ Domain الجديد

---

## 📈 الحدود المجانية

### Netlify Free Tier:
- ✅ 100GB Bandwidth شهرياً
- ✅ 300 Build minutes شهرياً
- ✅ Unlimited sites
- ✅ Automatic HTTPS
- ⚠️ Functions: 125K invocations/month
- ⚠️ Function runtime: 10 seconds max

### Supabase Free Tier:
- ✅ 500MB Database storage
- ✅ 1GB File storage
- ✅ 50,000 Monthly Active Users
- ✅ 2GB Bandwidth
- ✅ 500MB Egress
- ⚠️ Database pauses after 1 week of inactivity

---

## 🆘 المساعدة

إذا واجهت مشاكل، راجع:
- 📖 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- 📖 [Netlify Docs](https://docs.netlify.com)
- 📖 [Supabase Docs](https://supabase.com/docs)

---

## ✅ Checklist النهائي

- [ ] تم إنشاء مشروع Supabase
- [ ] تم تشغيل SQL Schema
- [ ] تم نسخ Connection String
- [ ] تم تثبيت Dependencies
- [ ] تم إنشاء ملف .env
- [ ] تم رفع الكود على GitHub
- [ ] تم إنشاء موقع Netlify
- [ ] تم إضافة Environment Variables
- [ ] تم Deploy الموقع
- [ ] تم اختبار Login
- [ ] تم تغيير كلمة مرور Admin
- [ ] تم تحديث CORS_ORIGIN
- [ ] تم اختبار إنشاء Presentation

---

**🎉 تهانينا! موقعك الآن يعمل على Netlify + Supabase!**

آخر تحديث: يناير 2026
