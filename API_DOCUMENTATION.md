# 📚 SlideUP API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication
معظم الـ endpoints تتطلب JWT token في الـ header:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication Endpoints

### POST /api/login
تسجيل الدخول أو إنشاء حساب جديد تلقائياً

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "jwt_token",
  "user": {
    "id": 1,
    "username": "string",
    "role": "user|admin"
  },
  "isNewUser": true,
  "needsSecurityQuestion": true
}
```

### GET /api/me
الحصول على معلومات المستخدم الحالي

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": 1,
  "username": "string",
  "email": "string",
  "role": "user|admin",
  "created_at": "timestamp",
  "last_login": "timestamp"
}
```

---

## 🔑 Password Recovery

### POST /api/get-security-question
الحصول على سؤال الأمان

**Request Body:**
```json
{
  "username": "string"
}
```

### POST /api/reset-password
إعادة تعيين كلمة المرور

**Request Body:**
```json
{
  "username": "string",
  "answer": "string",
  "newPassword": "string"
}
```

### POST /api/set-security-question
تعيين سؤال الأمان

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "question": "string",
  "answer": "string"
}
```

---

## 📊 Presentations

### GET /api/presentations
الحصول على جميع العروض التقديمية للمستخدم

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
[
  {
    "id": "string",
    "title": "string",
    "slide_count": 10,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

### GET /api/presentations/:id
الحصول على عرض تقديمي محدد

**Headers:** `Authorization: Bearer <token>`

### POST /api/presentations
إنشاء أو تحديث عرض تقديمي

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "id": "string",
  "title": "string",
  "slideCount": 10,
  "data": "json_string"
}
```

### DELETE /api/presentations/:id
حذف عرض تقديمي

**Headers:** `Authorization: Bearer <token>`

### POST /api/presentations/:id/duplicate
نسخ عرض تقديمي

**Headers:** `Authorization: Bearer <token>`

---

## 🔔 Notifications

### GET /api/notifications
الحصول على الإشعارات

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
[
  {
    "id": 1,
    "title": "string",
    "content": "string",
    "type": "info|warning|success|urgent",
    "is_read": 0,
    "created_at": "timestamp"
  }
]
```

### POST /api/notifications/:id/read
تعليم إشعار كمقروء

**Headers:** `Authorization: Bearer <token>`

### POST /api/notifications/read-all
تعليم جميع الإشعارات كمقروءة

**Headers:** `Authorization: Bearer <token>`

---

## 📈 Version History

### GET /api/presentations/:id/versions
الحصول على سجل الإصدارات

**Headers:** `Authorization: Bearer <token>`

### POST /api/presentations/:id/versions
إنشاء نسخة جديدة

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "changeSummary": "string"
}
```

### POST /api/presentations/:id/versions/:versionId/restore
استعادة نسخة محددة

**Headers:** `Authorization: Bearer <token>`

---

## 💾 Auto Backups

### GET /api/presentations/:id/backups
الحصول على النسخ الاحتياطية

**Headers:** `Authorization: Bearer <token>`

### POST /api/presentations/:id/backup
إنشاء نسخة احتياطية

**Headers:** `Authorization: Bearer <token>`

---

## 📊 Usage Limits

### GET /api/limits
الحصول على حدود الاستخدام

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "maxSlides": 100,
  "maxElements": 50,
  "maxPresentations": 50,
  "maxExportsPerDay": 10,
  "canExportPptx": true,
  "canExportPdf": true
}
```

---

## 👑 Admin Endpoints

جميع الـ endpoints التالية تتطلب دور `admin`

### GET /api/admin/users
الحصول على جميع المستخدمين

### GET /api/admin/stats
الحصول على الإحصائيات

### GET /api/admin/presentations
الحصول على جميع العروض التقديمية

### GET /api/admin/logs
الحصول على سجل النشاط

### GET /api/admin/settings
الحصول على الإعدادات

### PATCH /api/admin/settings
تحديث الإعدادات

### POST /api/admin/notifications
إرسال إشعار

**Request Body:**
```json
{
  "title": "string",
  "content": "string",
  "type": "info|warning|success|urgent",
  "target_user_id": null
}
```

### POST /api/admin/users
إضافة مستخدم جديد

### PATCH /api/admin/users/:id
تحديث مستخدم

### DELETE /api/admin/users/:id
حذف مستخدم

---

## 🏥 Health Check

### GET /api/health
فحص حالة السيرفر

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

---

## ⚠️ Error Responses

جميع الـ endpoints ترجع أخطاء بالصيغة التالية:

```json
{
  "error": "Error message in Arabic or English"
}
```

### Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## 🔒 Rate Limiting

- الحد الافتراضي: 60 طلب/دقيقة
- يمكن تعديله من إعدادات الأدمن
- عند تجاوز الحد: `429 Too Many Requests`

---

## 📝 Notes

1. جميع التواريخ بصيغة ISO 8601
2. جميع الـ responses بصيغة JSON
3. الـ API يدعم اللغة العربية والإنجليزية
4. يتم حفظ العروض التقديمية تلقائياً
5. يتم ضغط البيانات تلقائياً لتوفير المساحة
