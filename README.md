# نظام الأرشفة الموحد - زوايا البناء

نظام إدارة المراسلات والأرشفة الرقمية المتكامل مع فصل كامل بين Backend و Frontend.

## 📋 المميزات

- ✅ نظام أرشفة إلكتروني متكامل
- ✅ إدارة المستندات الواردة والصادرة
- ✅ طباعة باركود لكل مستند
- ✅ مسح ضوئي للباركود
- ✅ ختم PDF بالباركود
- ✅ إصدار سندات قبض رسمية
- ✅ لوحة تحكم تحليلية شاملة
- ✅ نظام مستخدمين متعدد المستويات (Admin/User)
- ✅ واجهة عربية كاملة مع دعم RTL
- ✅ تصميم احترافي متجاوب

## 🏗️ البنية التقنية

### Backend
- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL (Render)
- **Authentication**: JWT + Bcrypt
- **API**: RESTful API

### Frontend
- **Framework**: Next.js 16
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Font**: Tajawal (Google Fonts)
- **Language**: Arabic (RTL)

## 🚀 التثبيت والتشغيل

### Backend Setup

1. الانتقال إلى مجلد Backend:
```bash
cd backend
```

2. تثبيت المكتبات:
```bash
npm install
```

3. إنشاء ملف `.env`:
```bash
cp backend/.env.example backend/.env
```

4. **تحديث قيم البيئة**:
   - اتصل بـ Render Dashboard أو قاعدة البيانات لديك
   - أضف قيم صحيحة لـ `DATABASE_URL` و `JWT_SECRET` في الملف `.env`
   - لا تشارك هذه المفاتيح مع أحد أو تضيفها للـ Git
   
   > ⚠️ **تنبيه أمني**: المفاتيح السرية لا تُخزّن في الـ repo. استخدم GitHub Secrets للـ CI/CD

4. تشغيل SQL Scripts لإنشاء الجداول:
- قم بتنفيذ `scripts/01_create_tables.sql`
- ثم `scripts/02_seed_data.sql`

5. تشغيل الـ Backend:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Frontend Setup

1. تثبيت المكتبات:
```bash
npm install
```

2. إنشاء ملف `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://zaco-backend.onrender.com/api
# للإنتاج:
# NEXT_PUBLIC_API_URL=https://api.zaco.sa/api
```

3. تشغيل الـ Frontend:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 👤 حسابات الدخول

### حساب المدير (Admin)
- **البريد الإلكتروني**: admin@zaco.sa
- **كلمة المرور**: admin123

### حساب مستخدم (User)
- **البريد الإلكتروني**: user@zaco.sa
- **كلمة المرور**: user123

⚠️ **مهم**: يرجى تغيير كلمات المرور بعد أول تسجيل دخول!

## 📦 قاعدة البيانات

### معلومات الاتصال

لا تشارك معلومات الاتصال مع أحد أو تضيفها للـ repository. استخدم:
- **GitHub Secrets** للـ CI/CD pipelines
- **متغيرات البيئة المحلية** لـ development فقط

اطلب معلومات الاتصال من:
- 🔐 **مسؤول النظام** إذا كنت في فريق
- 📧 **صاحب المشروع** للوصول للـ production

### الجداول

1. **users** - المستخدمين
   - id, username, password, full_name, role, created_at, updated_at

2. **documents** - المستندات
   - id, barcode, type, sender, receiver, date, subject, priority, status, classification, notes, attachments, user_id, created_at, updated_at

## 🎨 التصميم

- **الخط**: Tajawal من Google Fonts للعناوين والنصوص العربية
- **الألوان**: نظام ألوان محايد مع لمسات من الأزرق
- **التخطيط**: تصميم متجاوب يدعم جميع الأجهزة
- **الاتجاه**: RTL كامل للعربية

## 📁 هيكل المشروع

```
.
├── backend/                 # Backend API
│   ├── src/
│   │   ├── config/         # Database config
│   │   ├── middleware/     # Auth & error handling
│   │   ├── routes/         # API routes
│   │   ├── scripts/        # Utility scripts
│   │   └── server.ts       # Main server
│   ├── .env.example
│   └── package.json
│
├── scripts/                # SQL scripts
│   ├── 01_create_tables.sql
│   └── 02_seed_data.sql
│
├── app/                    # Next.js pages
├── components/             # React components
├── lib/                    # Utilities & API client
└── package.json
```

## 🔧 الأدوات المساعدة

### توليد كلمات مرور مشفرة

```bash
cd backend
npx ts-node src/scripts/generate-password.ts
```

## 🌐 النشر

### Backend
يمكن نشر Backend على:
- Render
- Heroku
- Railway
- DigitalOcean
- أي خادم يدعم Node.js

### Frontend
يمكن نشر Frontend على:
- Vercel (موصى به)
- Netlify
- zaco.sa/archive (حسب إعدادات النطاق)

### إعدادات النطاق zaco.sa

للنشر على `zaco.sa/archive`:
1. قم بضبط basePath في `next.config.js` (أو استخدم متغير البيئة `NEXT_BASE_PATH`):
```javascript
module.exports = {
  basePath: '/archive',
  // ...
}
```

2. لتصدير موقع ثابت (لرفع الملفات يدويًا على استضافة مثل Bluehost):

- قم بتعيين `NEXT_BASE_PATH=/archive` في بيئتك إذا كنت ستستخدم المسار الفرعي.
- ثم شغّل:
```bash
# يبني المشروع ثم يصدر ملفات ثابتة إلى مجلد out/
npm run export
```
- مجلد `out/` الناتج يحتوي على HTML، CSS، JS وجاهز للرفع إلى مجلد `public_html/archive` على Bluehost.

3. تأكد من إعداد CORS في Backend للسماح بالاتصال من `https://zaco.sa`

## � إعداد CI/CD والمتغيرات الحساسة

### GitHub Secrets (للـ CI/CD)

1. اذهب إلى: **Settings → Secrets and variables → Actions**
2. أضف الـ secrets التالية:
   - `JWT_SECRET_TEST`: JWT secret للاختبارات
   - `REFRESH_TOKEN_SECRET_TEST`: Refresh token secret للاختبارات
   - `DATABASE_URL_TEST`: Connection string لـ test database (اختياري)
   - `JWT_SECRET`: JWT secret للإنتاج
   - `DATABASE_URL`: Production database URL

### المتغيرات المحلية

ملف `.env` (يجب عدم مشاركته):
```
DATABASE_URL=postgresql://user:pass@host/dbname
JWT_SECRET=your-strong-secret-key-here
REFRESH_TOKEN_SECRET=your-refresh-secret-key-here
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

> ⚠️ **لا تشارك أو تضيف .env للـ Git!** الملف مُضاف في `.gitignore` بالفعل.

## �📞 الدعم

للمساعدة أو الاستفسارات، يرجى التواصل مع فريق التطوير.

## 📄 الترخيص

جميع الحقوق محفوظة - زوايا البناء © 2025
