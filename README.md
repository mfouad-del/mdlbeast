# MDLBEAST Archive & Communications System

**Enterprise Document Management and Internal Communications Platform**

Version 2.0.0 | Production Ready | Proprietary Software

---

## Overview

Enterprise-grade archive and communications management system designed for MDLBEAST Entertainment Company. Provides comprehensive document lifecycle management, secure internal communications, and advanced workflow automation capabilities.

**Production URL:** https://zaco.sa/mdlbeast  
**API Endpoint:** https://mdlbeast.onrender.com/api

## Core Features

## Core Features

### Document Management
- Smart archive system with advanced search and filtering capabilities
- Automatic barcode generation and scanning for document tracking
- Multi-format support (PDF, images, office documents)
- Document version control and audit trail
- Digital signature and official stamp embedding
- Secure document storage on Cloudflare R2

### Security & Access Control
- Granular Role-Based Access Control (RBAC)
- Four-tier role hierarchy (Admin, Manager, Supervisor, Member)
- Custom permission overrides at user level
- Hierarchical manager-subordinate relationships
- Complete audit logging for compliance
- JWT-based secure authentication with refresh tokens

### Workflow Automation
- Multi-level approval workflows
- Digital signature integration
- Document status tracking and lifecycle management
- Automated notifications for pending actions
- Electronic stamping capabilities
- Approval delegation support

### Internal Communications
- Real-time team messaging and collaboration
- Company-wide announcements system
- Secure file sharing within organization
- User presence and activity indicators

### Reporting & Analytics
- Customizable report generation by date, type, and user
- Export functionality (PDF, Excel, CSV)
- Visual dashboard with key performance indicators
- Historical data analysis and retention
- Document activity tracking

### Localization & Accessibility
- Full bilingual support (Arabic and English)
- Right-to-left (RTL) layout for Arabic interface
- Responsive design across all devices
- Dark mode support
- Progressive Web App (PWA) capabilities
- WCAG accessibility compliance

### Infrastructure & Performance
- Cloudflare R2 distributed object storage
- PostgreSQL database with JSONB support
- Automated backup system with encryption
- High-availability deployment on Render.com
- Redis caching layer for performance optimization

## Technology Stack

**Frontend**
- React 18 with TypeScript
- Vite build system
- Tailwind CSS for styling
- shadcn/ui component library
- React Query for state management

**Backend**
- Node.js with Express.js
- TypeScript for type safety
- PostgreSQL relational database
- JWT authentication
- Bcrypt password hashing

**Infrastructure**
- Cloudflare R2 object storage
- Render.com application hosting
- GitHub for version control
- Automated CI/CD pipeline

## Installation & Setup

## Installation & Setup

**System Requirements**
- Node.js 18.x or higher
- PostgreSQL 14.x or higher
- npm or pnpm package manager

**Installation Steps**

1. Clone the repository
```bash
git clone https://github.com/mfouad-del/mdlbeast.git
cd mdlbeast
```

2. Install dependencies
```bash
npm install
cd backend && npm install
```

3. Configure environment variables
```bash
cp .env.example .env.local
cd backend && cp .env.example .env
```

4. Initialize database
```bash
cd backend
node scripts/run_migration.js
```

5. Start development servers
```bash
# Frontend (http://localhost:3000)
npm run dev

# Backend (http://localhost:3001)
cd backend && npm run dev
```

## Version History

**Version 2.0.0** (January 2026)
- Complete permission system refactor with granular RBAC
- Custom permission overrides for individual users
- Enhanced security middleware and authentication
- Database migration for permissions structure
- Improved user management interface

**Version 1.3.0**
- Approval workflows with digital signatures
- Multi-level approval delegation
- Electronic document stamping

**Version 1.2.0**
- Barcode generation and scanning system
- Document tracking enhancements

**Version 1.1.0**
- Internal communications module
- Real-time messaging capabilities

**Version 1.0.0**
- Initial production release
- Core archive and document management features

## Production Deployment

**Live Application:** https://zaco.sa/mdlbeast  
**API Endpoint:** https://mdlbeast.onrender.com/api

Environment variables must be configured according to `.env.example` specifications. Contact the developer for production deployment credentials and configuration details.

## Developer Information

**Mahmoud Fouad**  
Full-Stack Software Engineer

Email: mahmoud.a.fouad2@gmail.com  
Phone: +966 530 047 640 | +20 111 658 8189  
GitHub: @mfouad-del

## Legal & Licensing

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited without explicit written permission from the copyright holder.

**Copyright © 2024-2026 Mahmoud Fouad. All Rights Reserved.**

All intellectual property rights, including but not limited to source code, design, architecture, algorithms, and documentation, are the exclusive property of Mahmoud Fouad.

For licensing inquiries or legal matters, please contact the developer directly.

See [LICENSE](./LICENSE) for complete terms and conditions.

## Contributing

This is proprietary software developed exclusively for MDLBEAST Entertainment Company. External contributions are not accepted without prior written authorization.

For authorized contributors, please review [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines and workflow procedures.

## About MDLBEAST

MDLBEAST is an entertainment company rooted in music culture, based in Saudi Arabia and shared globally, amplifying unseen and unheard voices in the music industry.

---

**Developed by Mahmoud Fouad for MDLBEAST Entertainment Company**
