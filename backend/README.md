# نظام الأرشفة الموحد - Backend API

> **الإصدار:** **مستقر — v.1** ✅  (تاريخ الإصدار: 2025-12-25)


نظام Backend للأرشفة الإلكترونية مبني بـ Express.js و TypeScript مع قاعدة بيانات PostgreSQL.

## 🚀 التثبيت والإعداد

### 1. تثبيت المكتبات
```bash
cd backend
npm install
```

### 2. إعداد المتغيرات البيئية
انسخ `.env.example` إلى `.env`:
```bash
cp .env.example .env
```

الملف `.env` يحتوي على الإعدادات الصحيحة بالفعل:
```env
DATABASE_URL=<POSTGRES_CONNECTION_STRING>
JWT_SECRET=your-jwt-secret-key-here
REFRESH_TOKEN_SECRET=your-refresh-token-secret-here
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://zaco.sa
```

**ملاحظة أمنية**: استبدل القيم أعلاه بالقيم الفعلية من ملف `.env` أو من لوحة التحكم على Render.

### 3. تشغيل SQL Scripts
قم بتنفيذ السكريبتات لإنشاء قاعدة البيانات:

```bash
# استخدام psql مع متغيرات بيئية
psql $DATABASE_URL -f ../scripts/01_create_tables.sql
psql $DATABASE_URL -f ../scripts/02_seed_data.sql

# أو من داخل psql
psql $DATABASE_URL
\i ../scripts/01_create_tables.sql
\i ../scripts/02_seed_data.sql
```

### 4. تشغيل Server

**وضع التطوير:**
```bash
npm run dev
```

**وضع الإنتاج:**
```bash
npm run build
npm start
```

Server سيعمل على: `https://zaco-backend.onrender.com` (production)

## 📡 API Endpoints

### Authentication (المصادقة)
- `POST /api/auth/login` - تسجيل دخول
- `POST /api/auth/register` - تسجيل مستخدم جديد (admin فقط)

### Documents (المستندات)
- `GET /api/documents` - الحصول على جميع المستندات (مع الفلاتر)
- `GET /api/documents/:barcode` - الحصول على مستند بالباركود
- `POST /api/documents` - إنشاء مستند جديد
- `PUT /api/documents/:barcode` - تحديث مستند
- `DELETE /api/documents/:barcode` - حذف مستند
- `GET /api/documents/stats/summary` - إحصائيات

### Users (المستخدمين)
- `GET /api/users` - جميع المستخدمين (admin فقط)
- `GET /api/users/me` - المستخدم الحالي

## Storage migration note

This project has migrated storage to Cloudflare R2 and runs in **R2-only** mode by default. The code no longer uses Supabase storage for uploads/previews/stamping. If you previously used Supabase, do not remove SUPABASE_* env vars from your host immediately — rotate those secrets only when you are ready to decommission the Supabase project.

If you need to temporarily re-enable Supabase paths for rollback, set `USE_R2_ONLY=false` (not recommended for long-term usage).

## 🔐 بيانات الدخول الافتراضية

**Admin:**
- Username: `admin@zaco.sa`
- Password: `admin123`

**User:**
- Username: `user@zaco.sa`
- Password: `user123`

⚠️ **مهم جداً:** قم بتغيير كلمات المرور بعد أول تسجيل دخول!

## 🛠️ أدوات مساعدة

### توليد Password Hash
```bash
npx ts-node src/scripts/generate-password.ts
```

## 🧪 اختبار API

### Health Check
```bash
curl https://zaco-backend.onrender.com/health
```

### تسجيل دخول
```bash
curl -X POST https://zaco-backend.onrender.com/api/auth/login \\
  -H "Content-Type: application/json" \
  -d '{"username":"admin@zaco.sa","password":"admin123"}'
```

## 🗄️ قاعدة البيانات

### معلومات الاتصال
- **Host**: <HOST>
- **Port**: 5432
- **Database**: <DBNAME>
- **Username**: <USER>
- **Password**: <PASSWORD>

> ملاحظة: لا تقم بتخزين بيانات الاتصال الحقيقية داخل المستودع. استخدم متغيرات البيئة أو أسرار منصة النشر.

### الجداول
1. **users** - جدول المستخدمين
2. **documents** - جدول المستندات

## 📦 النشر على الإنتاج

### Render
1. Push الكود إلى GitHub
2. إنشاء Web Service جديد في Render
3. اضبط Build Command: `cd backend && npm install && npm run build`
4. اضبط Start Command: `cd backend && npm start`
5. أضف المتغيرات البيئية

### Heroku
```bash
cd backend
heroku create zaco-archive-api
heroku config:set DATABASE_URL=...
heroku config:set JWT_SECRET=...
git push heroku main
```

## 🔒 الأمان

- JWT authentication
- Bcrypt password hashing
- Helmet security headers
- CORS protection
- Input validation with express-validator

## 📝 ملاحظات

- جميع كلمات المرور مشفرة بـ bcrypt
- JWT tokens صالحة لمدة 24 ساعة
- CORS مضبوط للسماح فقط من FRONTEND_URL
