# 🚀 دليل رفع المشروع على Netlify

## ⚠️ تنبيه مهم
Netlify لا يدعم SQLite بشكل كامل في البيئة Serverless. الداتابيس ستكون **للقراءة فقط** (Read-Only) بعد الـ Build.

## 📋 الخطوات:

### 1️⃣ تثبيت Dependencies الجديدة
```bash
npm install serverless-http
```

### 2️⃣ رفع الكود على GitHub
```bash
git add .
git commit -m "Prepare for Netlify deployment"
git push origin main
```

### 3️⃣ إنشاء حساب على Netlify
- اذهب إلى: https://www.netlify.com
- سجل دخول بحساب GitHub

### 4️⃣ ربط المشروع
1. اضغط "Add new site" → "Import an existing project"
2. اختر GitHub واختر الـ Repository
3. إعدادات البناء:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`

### 5️⃣ إضافة Environment Variables
في إعدادات الموقع → Environment Variables، أضف:

```
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this
CORS_ORIGIN=https://your-site-name.netlify.app
ADMIN_PASSWORD=your-secure-admin-password
```

### 6️⃣ Deploy
اضغط "Deploy site" وانتظر حتى ينتهي البناء.

---

## ⚠️ القيود والمشاكل المحتملة:

### 1. SQLite في Netlify Functions
- ❌ **المشكلة**: SQLite لا يعمل بشكل جيد في Serverless
- ❌ **السبب**: كل Function تعمل في Container منفصل
- ❌ **النتيجة**: البيانات لن تُحفظ بين الـ Requests

### 2. الحلول البديلة:

#### ✅ الحل الأول (الأفضل): استخدام Database خارجي
استبدل SQLite بـ:
- **Supabase** (PostgreSQL مجاني)
- **PlanetScale** (MySQL مجاني)
- **MongoDB Atlas** (NoSQL مجاني)

#### ✅ الحل الثاني: استخدام Netlify Blob Storage
- لتخزين الملفات والبيانات
- يحتاج تعديل كبير في الكود

#### ✅ الحل الثالث (الموصى به): استخدام Render.com
- يدعم SQLite بشكل كامل
- مجاني 100%
- أسهل في الإعداد

---

## 🎯 التوصية النهائية:

**لا ننصح باستخدام Netlify لهذا المشروع** بسبب SQLite.

### الخيارات الأفضل:
1. **Render.com** - يدعم SQLite بشكل كامل ✅
2. **Railway.app** - يدعم SQLite ✅
3. **Fly.io** - يدعم SQLite ✅

### إذا أردت الاستمرار مع Netlify:
يجب تحويل الداتابيس إلى:
- Supabase (PostgreSQL)
- MongoDB Atlas
- Firebase

---

## 📞 المساعدة
إذا واجهت مشاكل، راجع:
- https://docs.netlify.com/functions/overview/
- https://www.netlify.com/blog/2021/07/12/how-to-include-files-in-netlify-functions/
