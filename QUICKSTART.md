# دليل البدء السريع 🚀

## المتطلبات الأساسية

- Node.js (v18 أو أحدث)
- PostgreSQL (متوفر على Render)
- npm أو yarn

## خطوات التشغيل السريعة

### 1️⃣ Backend

```bash
# انتقل لمجلد Backend
cd backend

# ثبت المكتبات
npm install

# انسخ ملف البيئة
cp .env.example .env

# عدّل .env بمعلومات قاعدة البيانات
# (المعلومات موجودة في .env بالفعل)

# شغّل Backend
npm run dev
```

Backend سيعمل على: https://zaco-backend.onrender.com

### 2️⃣ إنشاء قاعدة البيانات

```bash
# اتصل بقاعدة البيانات
PGPASSWORD=ToKNTzF4XsvJHTxLqYYqCeyk7YAMjICO psql -h dpg-d54jrg6mcj7s73esp1i0-a.oregon-postgres.render.com -U zacodb_user zacodb

# نفذ السكريبتات داخل psql
\i scripts/01_create_tables.sql
\i scripts/02_seed_data.sql

# أو من خارج psql
psql $DATABASE_URL -f scripts/01_create_tables.sql
psql $DATABASE_URL -f scripts/02_seed_data.sql
```

### 3️⃣ Frontend

```bash
# في المجلد الرئيسي (ارجع من backend)
cd ..

# ثبت المكتبات
npm install

# انسخ ملف البيئة
cp .env.local.example .env.local

# شغّل Frontend
npm run dev
```

Frontend سيعمل محليًا على المنفذ 3000 (http://<your-host>:3000)

## 🔐 تسجيل الدخول

افتح http://<your-host>:3000 واستخدم:

**Admin:**
- Email: `admin@zaco.sa`
- Password: `admin123`

**User:**
- Email: `user@zaco.sa`
- Password: `user123`

## ✅ اختبار النظام

1. سجّل دخول بحساب Admin
2. اذهب إلى "قيد وارد جديد"
3. املأ النموذج واحفظ
4. شاهد المستند في "الأرشيف والبحث"
5. اطبع الباركود
6. جرب مسح الباركود

## 🎯 المشاكل الشائعة

### Backend لا يعمل؟
- تأكد من صحة DATABASE_URL في `.env`
- تأكد من تنفيذ SQL scripts
- تحقق من الـ logs

### Frontend لا يتصل بـ Backend؟
- تأكد من Backend يعمل على port 3001
- تحقق من NEXT_PUBLIC_API_URL في `.env.local`
- تحقق من CORS في Backend

### قاعدة البيانات لا تعمل؟
- تأكد من اتصالك بالإنترنت
- تحقق من معلومات الاتصال
- جرب الاتصال بـ psql مباشرة

## 📚 المزيد من المعلومات

- [README.md](./README.md) - معلومات شاملة
- [DEPLOYMENT.md](./DEPLOYMENT.md) - دليل النشر
- [backend/README.md](./backend/README.md) - Backend API
- [frontend/README.md](./frontend/README.md) - Frontend

## 🆘 تحتاج مساعدة؟

راجع الملفات التوثيقية أعلاه أو تواصل مع فريق التطوير.
