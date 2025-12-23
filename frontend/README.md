# نظام الأرشفة الموحد - Frontend (Next.js)

## التثبيت والتشغيل

### 1. تثبيت المكتبات
```bash
npm install
```

### 2. إعداد المتغيرات البيئية
انسخ ملف `.env.local.example` إلى `.env.local` وقم بتحديث الإعدادات:

```bash
cp .env.local.example .env.local
```

عدل قيمة `NEXT_PUBLIC_API_URL` لتشير إلى عنوان الـ Backend API الخاص بك.

### 3. تشغيل التطبيق

وضع التطوير:
```bash
npm run dev
```

بناء للإنتاج:
```bash
npm run build
npm start
```

## الاتصال بالـ Backend

تأكد من أن الـ Backend API يعمل على `https://zaco-backend.onrender.com` أو عدل المتغير البيئي.

## رفع على الاستضافة

### رفع على Vercel
1. ربط المشروع بـ GitHub
2. استيراد المشروع في Vercel
3. إضافة المتغير البيئي `NEXT_PUBLIC_API_URL` في إعدادات المشروع
4. Deploy

### رفع على خادم خاص (zaco.sa/archive)
```bash
npm run build
# نقل محتويات مجلد .next و public إلى الخادم
# تشغيل: npm start
```

## معلومات تسجيل الدخول الافتراضية
- اسم المستخدم: `admin`
- كلمة المرور: `admin123`

**مهم:** يجب تغيير كلمة المرور بعد أول تسجيل دخول!
