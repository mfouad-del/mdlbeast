# دليل النشر والإعداد

## 🚀 نشر Backend

### على Render

1. **إنشاء Web Service جديد**:
   - اذهب إلى Render Dashboard
   - اختر "New Web Service"
   - اربط مستودع GitHub الخاص بك

2. **الإعدادات**:
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm start`
   - **Environment**: Node

3. **المتغيرات البيئية**:
   ```
   DATABASE_URL=<POSTGRES_CONNECTION_STRING>
   JWT_SECRET=<YOUR_JWT_SECRET>
   PORT=3001
   NODE_ENV=production
   FRONTEND_URL=https://zaco.sa
   ```

### على Heroku

```bash
cd backend
heroku create zaco-archive-api
heroku config:set DATABASE_URL=postgresql://...
heroku config:set JWT_SECRET=<YOUR_JWT_SECRET>
heroku config:set NODE_ENV=production
git push heroku main
```

## 🌐 نشر Frontend

### على Vercel (الموصى به)

1. **من Dashboard**:
   - اذهب إلى Vercel Dashboard
   - اضغط "New Project"
   - اختر المستودع
   - اضبط المتغيرات البيئية

2. **المتغيرات البيئية**:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.onrender.com/api
   ```

3. **النشر**:
   - Vercel سيتعرف تلقائياً على Next.js
   - سيتم النشر تلقائياً

### على zaco.sa/archive

#### إصدار artifact ثابت عبر GitHub Actions (مناسب للرفع اليدوي إلى Bluehost)

لقد أضفت Workflow جاهزًا لبناء وتصدير الموقع كملفات ثابتة (HTML/CSS/JS) ثم رفع مجلد `out/` كـ artifact.

- المسار إلى ملف الـ workflow: `.github/workflows/export-static.yml`
- يمكنك تشغيله يدويًا من تبويب **Actions → Build & Export Static Frontend → Run workflow** وإدخال القيم التالية (أو ترك القيم الافتراضية):
  - `next_public_api_url`: `https://zaco-backend.onrender.com/api`
  - `next_base_path`: `/archive` (إن أردت رفع الملفات إلى `https://zaco.sa/archive`)

Workflow سيقوم ب:
1. تثبيت الاعتماديات على بيئة Ubuntu (بما في ذلك أدوات البناء و libpq)
2. تشغيل `npm run export` لإنتاج مجلد `out/`
3. ضغط `out/` إلى `out.zip` ورفعه كـ artifact لتحميله

بعد تشغيل الـ workflow:
- نزّل الـ artifact `frontend-export-out` من صفحة الـ workflow run
- فك الضغط وارفع محتويات `out/` إلى مجلد `public_html/archive` في استضافة Bluehost

> ملاحظة: لا تقم بإضافة أي أسرار (مثل JWT_SECRET أو Database passwords) داخل الـ repo. استعمل `Repository secrets` أو صفحة الإدخال أثناء تشغيل الـ workflow إذا كانت مطلوبة.


#### الطريقة 1: استخدام Reverse Proxy

إذا كان لديك خادم يعمل على `zaco.sa`، أضف إعداد nginx:

```nginx
location /archive/ {
    proxy_pass https://zaco.sa/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

#### الطريقة 2: تحديث next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/archive',
  assetPrefix: '/archive',
  trailingSlash: true,
}

module.exports = nextConfig
```

## 🗄️ إعداد قاعدة البيانات

### الاتصال بقاعدة البيانات

```bash
# استخدم PSQL للاتصال
PGPASSWORD=<PASSWORD> psql -h <HOST> -U <USER> <DBNAME>
```

### تشغيل SQL Scripts

1. **إنشاء الجداول**:
```bash
psql $DATABASE_URL < scripts/01_create_tables.sql
```

2. **إضافة البيانات الأولية**:
```bash
psql $DATABASE_URL < scripts/02_seed_data.sql
```

### أو استخدم واجهة Render

1. اذهب إلى PostgreSQL Database في Render
2. اضغط "Connect"
3. اختر "External Connection"
4. استخدم أداة إدارة قواعد البيانات المفضلة لديك (pgAdmin, DBeaver, إلخ)

## 🔒 الأمان

### تغيير كلمات المرور الافتراضية

بعد النشر الأول، قم بتغيير كلمات المرور:

```sql
-- تحديث كلمة مرور الأدمن
UPDATE users 
SET password = 'new_bcrypt_hash_here'
WHERE username = 'admin@zaco.sa';
```

لتوليد hash جديد:
```bash
cd backend
npx ts-node src/scripts/generate-password.ts
```

### تحديث JWT_SECRET

استخدم JWT Secret قوي وفريد:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🔍 اختبار النشر

### اختبار Backend

```bash
# Health check
curl https://your-backend-url.onrender.com/health

# اختبار تسجيل الدخول
curl -X POST https://your-backend-url.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@zaco.sa","password":"admin123"}'
```

### اختبار Frontend

1. افتح المتصفح واذهب إلى `https://zaco.sa/archive`
2. جرب تسجيل الدخول بحساب الأدمن
3. تأكد من عمل جميع المميزات

## 📊 المراقبة

### Logs

**Render**:
- اذهب إلى Dashboard → Service → Logs

**Vercel**:
- اذهب إلى Dashboard → Project → Functions

### Database Monitoring

- راقب استخدام Database من Render Dashboard
- تحقق من أداء الاستعلامات
- راقب عدد الاتصالات النشطة

## ⚡ تحسين الأداء

### Backend
- استخدم connection pooling (مفعل بالفعل)
- أضف Redis للـ caching إذا لزم الأمر
- استخدم CDN للملفات الثابتة

### Frontend
- جميع الصور محسنة تلقائياً مع Next.js
- استخدم Edge Functions عند الحاجة
- فعّل ISR للصفحات الثابتة

## 🆘 استكشاف الأخطاء

### مشاكل الاتصال بقاعدة البيانات

```bash
# اختبر الاتصال
psql $DATABASE_URL -c "SELECT NOW();"
```

### مشاكل CORS

تأكد من إضافة النطاق الصحيح في Backend:
```typescript
cors({
  origin: process.env.FRONTEND_URL || 'https://zaco.sa',
  credentials: true
})
```

### مشاكل المصادقة

- تحقق من صحة JWT_SECRET
- تأكد من أن التوكن يُرسل في الـ Headers
- تحقق من صلاحية التوكن (24 ساعة)

## 📝 Checklist النشر

- [ ] قاعدة البيانات جاهزة وتعمل
- [ ] SQL Scripts تم تنفيذها
- [ ] Backend تم نشره ويعمل
- [ ] Frontend تم نشره ويعمل
- [ ] المتغيرات البيئية مضبوطة
- [ ] CORS مضبوط بشكل صحيح
- [ ] كلمات المرور الافتراضية تم تغييرها
- [ ] اختبار جميع المميزات
- [ ] SSL مفعل (HTTPS)
- [ ] Logs تعمل بشكل صحيح
