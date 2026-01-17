# MDLBEAST Communications System
[![Repository](https://img.shields.io/badge/repo-mdlbeast-blue?logo=github)](https://github.com/mfouad-del/mdlbeast.git)  
Repository: https://github.com/mfouad-del/mdlbeast.git

> **MDLBEAST** is an entertainment company rooted in music culture. Based in Saudi Arabia and shared globally – we are here to amplify the unseen.

## 🚀 Quick Start

### Frontend (Next.js)
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

## 📡 Deployment URLs

- **Frontend**: https://zaco.sa/mdlbeast
- **Backend API**: https://mdlbeast.onrender.com/api
- **Company Website**: https://mdlbeast.com

## 🔐 Environment Variables

### Backend Environment Variables (Render)

```env
# Database
DATABASE_URL=<POSTGRES_CONNECTION_STRING>

# Authentication
JWT_SECRET=<YOUR_JWT_SECRET>
REFRESH_TOKEN_SECRET=<YOUR_REFRESH_TOKEN_SECRET>
SESSION_SECRET=<YOUR_SESSION_SECRET>

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://zaco.sa/mdlbeast

# Cloudflare R2 Storage
CF_R2_ACCESS_KEY_ID=<YOUR_R2_ACCESS_KEY_ID>
CF_R2_SECRET_ACCESS_KEY=<YOUR_R2_SECRET_ACCESS_KEY>
CF_R2_ENDPOINT=<YOUR_R2_ENDPOINT>
CF_R2_BUCKET=<YOUR_R2_BUCKET>
CF_R2_REGION=auto
R2_PUBLIC_BASE_URL=<YOUR_R2_PUBLIC_BASE_URL>

# Storage Provider
STORAGE_PROVIDER=r2

# Backups
BACKUPS_ENABLED=true
BACKUP_ENCRYPTION=true
BACKUP_ENC_KEY=<YOUR_BACKUP_ENCRYPTION_KEY>
BACKUP_INTERVAL_DAYS=15
BACKUP_RETENTION_COUNT=6

# Migrations
AUTO_RUN_MIGRATIONS=false

# ⭐ Admin User (Created automatically on startup from these env vars)
SUPER_ADMIN_EMAIL=<ADMIN_EMAIL>
SUPER_ADMIN_PASSWORD=<ADMIN_PASSWORD>
SUPER_ADMIN_NAME=MDLBEAST Administrator

# ⭐ Test User (Optional - Created automatically on startup from these env vars)
TEST_USER_EMAIL=<TEST_USER_EMAIL>
TEST_USER_PASSWORD=<TEST_USER_PASSWORD>
TEST_USER_NAME=MDLBEAST Staff

# Debug (Optional)
DEBUG_SECRET=<YOUR_DEBUG_SECRET>

# Email (Optional)
EMAIL_SERVICE=gmail
EMAIL_USER=<YOUR_EMAIL>
EMAIL_PASS=<YOUR_APP_PASSWORD>

# AI Keys (Optional)
GEMINI_API_KEY=<YOUR_KEY>
GROQ_API_KEY=<YOUR_KEY>
```

### Frontend Environment Variables

```env
# Optional override. When deploying on Bluehost under /mdlbeast, prefer leaving this unset
# and using the Apache proxy rule (/mdlbeast/api -> Render) so the frontend can call same-origin.
NEXT_PUBLIC_API_URL=https://mdlbeast.onrender.com/api
NEXT_BASE_PATH=/mdlbeast
```

## 📦 Database Info
This project does not store database credentials in the repository.

Use your provider (Render/Supabase/etc) to obtain the correct connection string, and set it via environment variables.

## 🗄️ R2 Storage Info

### Bucket Details
- **Bucket Name**: <YOUR_R2_BUCKET>
- **Endpoint**: <YOUR_R2_ENDPOINT>
- **Public URL**: <YOUR_R2_PUBLIC_BASE_URL>
- **Access Key ID**: <YOUR_R2_ACCESS_KEY_ID>
- **Secret Access Key**: <YOUR_R2_SECRET_ACCESS_KEY>

## 👤 Default Users

Users are created automatically from environment variables when the server starts:

### Admin User
Set these environment variables on Render:
- `SUPER_ADMIN_EMAIL` - Admin email/username
- `SUPER_ADMIN_PASSWORD` - Admin password
- `SUPER_ADMIN_NAME` - Admin display name (optional)

### Test User (Optional)
Set these environment variables on Render:
- `TEST_USER_EMAIL` - Test user email/username
- `TEST_USER_PASSWORD` - Test user password  
- `TEST_USER_NAME` - Test user display name (optional)

## 📱 PWA Installation

The app supports installation on:
- Windows (Chrome/Edge)
- macOS (Chrome/Edge)
- Android
- iOS (Add to Home Screen)

## 🔧 Features

- ✅ Document Management System
- ✅ Approval Workflow
- ✅ Digital Signatures
- ✅ Barcode Tracking
- ✅ Report Generation
- ✅ User Management
- ✅ Backup System
- ✅ PWA Support (Desktop/Mobile Installation)
- ✅ RTL Arabic Support

## 📄 License

All Rights Reserved - MDLBEAST Entertainment Company © 2025
