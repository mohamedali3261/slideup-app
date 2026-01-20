# 🔧 استكشاف الأخطاء - Supabase + Netlify

## المشاكل الشائعة وحلولها

### 1️⃣ خطأ: "Connection refused" أو "ECONNREFUSED"

**السبب:** Connection String غير صحيح

**الحل:**
1. تأكد من نسخ Connection String من Supabase بشكل صحيح
2. تأكد من استبدال `[YOUR-PASSWORD]` بكلمة المرور الحقيقية
3. تأكد من عدم وجود مسافات في بداية أو نهاية الـ URL

**مثال صحيح:**
```
DATABASE_URL=postgresql://postgres:MyPass123@db.abcdefgh.supabase.co:5432/postgres
```

---

### 2️⃣ خطأ: "SSL required" أو "no pg_hba.conf entry"

**السبب:** Supabase يتطلب SSL connection

**الحل:**
في ملف `server/db-postgres.ts`، تأكد من:
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // ✅ مهم جداً
});
```

---

### 3️⃣ خطأ: "relation does not exist" أو "table not found"

**السبب:** لم يتم تشغيل SQL Schema

**الحل:**
1. اذهب إلى Supabase Dashboard
2. افتح **SQL Editor**
3. انسخ محتوى `server/migrations/supabase-schema.sql`
4. الصقه واضغط **Run**
5. تأكد من عدم وجود أخطاء في الـ Output

---

### 4️⃣ خطأ: "Cannot find module 'pg'"

**السبب:** لم يتم تثبيت pg package

**الحل:**
```bash
npm install pg
```

---

### 5️⃣ خطأ: "Function timeout" في Netlify

**السبب:** الـ Function تأخذ وقت طويل

**الحل:**
1. في `netlify.toml`، أضف:
```toml
[functions]
  timeout = 30
```

2. أو في Netlify Dashboard:
   - Settings → Functions → Function timeout
   - زود الوقت إلى 26 ثانية (الحد الأقصى للخطة المجانية)

---

### 6️⃣ خطأ: "Environment variable not found"

**السبب:** لم يتم إضافة Environment Variables في Netlify

**الحل:**
1. اذهب إلى Netlify Dashboard
2. Site settings → Environment variables
3. أضف:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CORS_ORIGIN`
   - `NODE_ENV=production`

---

### 7️⃣ خطأ: "Invalid token" بعد Login

**السبب:** JWT_SECRET مختلف بين البيئات

**الحل:**
تأكد من أن `JWT_SECRET` نفسه في:
- ملف `.env` المحلي
- Netlify Environment Variables

---

### 8️⃣ البيانات لا تُحفظ

**السبب:** قد يكون هناك خطأ في الـ Query

**الحل:**
1. افتح Netlify Functions Logs:
   - Netlify Dashboard → Functions → View logs
2. ابحث عن أخطاء PostgreSQL
3. تحقق من الـ Console في المتصفح

---

### 9️⃣ خطأ: "Too many connections"

**السبب:** Connection Pool ممتلئ

**الحل:**
في `server/db-postgres.ts`:
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,  // قلل العدد
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
});
```

---

### 🔟 الموقع بطيء جداً

**السبب:** Cold start في Netlify Functions

**الحل:**
- هذا طبيعي في الخطة المجانية
- أول Request بعد فترة خمول يأخذ 5-10 ثواني
- الـ Requests التالية ستكون أسرع

**تحسين:**
1. استخدم Caching في الكود
2. قلل حجم الـ Functions
3. استخدم Netlify Edge Functions (إذا متاح)

---

## 🧪 اختبار الـ Connection

### اختبار محلي:
```bash
# إنشاء ملف test-connection.js
node -e "
const { Client } = require('pg');
const client = new Client({
  connectionString: 'YOUR_DATABASE_URL',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => console.log('✅ Connected!'))
  .catch(err => console.error('❌ Error:', err))
  .finally(() => client.end());
"
```

### اختبار في Supabase:
```sql
-- في SQL Editor
SELECT version();
SELECT current_database();
SELECT current_user;
```

---

## 📊 مراقبة الأداء

### في Supabase:
1. Dashboard → Database → Usage
2. راقب:
   - Database size
   - Active connections
   - Query performance

### في Netlify:
1. Dashboard → Functions
2. راقب:
   - Invocations
   - Run time
   - Errors

---

## 🆘 الحصول على المساعدة

إذا لم تحل المشكلة:

1. **Supabase Support:**
   - https://supabase.com/docs
   - Discord: https://discord.supabase.com

2. **Netlify Support:**
   - https://docs.netlify.com
   - Community: https://answers.netlify.com

3. **PostgreSQL Docs:**
   - https://www.postgresql.org/docs/

---

## 📝 Logs مفيدة

### عرض Logs في Netlify:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# View logs
netlify functions:log api
```

### عرض Logs في Supabase:
1. Dashboard → Logs
2. اختر نوع الـ Log:
   - Postgres Logs
   - API Logs
   - Auth Logs

---

## ✅ Checklist للتأكد من كل شيء

- [ ] تم تثبيت `pg` و `serverless-http`
- [ ] تم إزالة `better-sqlite3`
- [ ] تم تشغيل SQL Schema في Supabase
- [ ] تم نسخ Connection String بشكل صحيح
- [ ] تم إضافة Environment Variables في Netlify
- [ ] تم تحديث `netlify.toml`
- [ ] تم عمل Commit و Push للكود
- [ ] تم Deploy على Netlify
- [ ] تم اختبار Login
- [ ] تم اختبار إنشاء Presentation

---

## 🎯 نصائح للأداء الأفضل

1. **استخدم Indexes:** تأكد من وجود Indexes على الأعمدة المستخدمة في WHERE
2. **استخدم Connection Pooling:** موجود بالفعل في `db-postgres.ts`
3. **استخدم Caching:** موجود في الكود للـ Queries المتكررة
4. **قلل حجم البيانات:** استخدم Pagination للبيانات الكبيرة
5. **استخدم Compression:** موجود بالفعل للـ Presentations data

---

**آخر تحديث:** يناير 2026
