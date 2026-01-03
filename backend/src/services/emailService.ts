import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
}

// Create reusable transporter
const createTransporter = () => {
  const emailService = process.env.EMAIL_SERVICE || 'gmail'
  const emailUser = process.env.EMAIL_USER
  const emailPass = process.env.EMAIL_PASS
  
  if (!emailUser || !emailPass) {
    console.warn('[EmailService] EMAIL_USER or EMAIL_PASS not configured. Email notifications disabled.')
    return null
  }

  return nodemailer.createTransport({
    service: emailService,
    auth: {
      user: emailUser,
      pass: emailPass
    }
  })
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transporter = createTransporter()
  
  if (!transporter) {
    console.warn('[EmailService] Transporter not available. Skipping email.')
    return false
  }

  try {
    await transporter.sendMail({
      from: `"نظام الاتصالات الإدارية - زوايا" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html
    })
    
    console.log('[EmailService] Email sent successfully to:', options.to)
    return true
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error)
    return false
  }
}

export function generateApprovalRequestEmail(data: {
  managerName: string
  requesterName: string
  requestTitle: string
  requestDescription?: string
  requestNumber?: string
  dashboardUrl: string
}): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f3f4f6;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: 900;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .message {
      color: #4b5563;
      line-height: 1.8;
      margin-bottom: 30px;
    }
    .request-card {
      background: #f9fafb;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .request-title {
      font-size: 18px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 10px;
    }
    .request-number {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .request-desc {
      color: #6b7280;
      font-size: 14px;
      line-height: 1.6;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 16px;
      margin: 20px 0;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    .cta-button:hover {
      box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 13px;
      border-top: 1px solid #e5e7eb;
    }
    .footer-note {
      margin-top: 15px;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏛️ زوايا البناء للاستشارات الهندسية</div>
      <div class="subtitle">نظام الاتصالات الإدارية</div>
    </div>
    
    <div class="content">
      <div class="greeting">مرحباً ${data.managerName} 👋</div>
      
      <div class="message">
        تم تقديم طلب اعتماد جديد من قبل <strong>${data.requesterName}</strong> ويحتاج إلى مراجعتك واعتمادك.
      </div>
      
      <div class="request-card">
        ${data.requestNumber ? `<div class="request-number">${data.requestNumber}</div>` : ''}
        <div class="request-title">${data.requestTitle}</div>
        ${data.requestDescription ? `<div class="request-desc">${data.requestDescription}</div>` : ''}
      </div>
      
      <center>
        <a href="${data.dashboardUrl}" class="cta-button">
          📋 عرض الطلب والاعتماد
        </a>
      </center>
      
      <div class="message" style="margin-top: 30px; font-size: 14px;">
        يرجى مراجعة الطلب في أقرب وقت ممكن. يمكنك الموافقة عليه أو رفضه مباشرة من لوحة التحكم.
      </div>
    </div>
    
    <div class="footer">
      <strong>زوايا البناء للاستشارات الهندسية</strong>
      <div class="footer-note">
        هذه رسالة تلقائية من نظام الاتصالات الإدارية. يرجى عدم الرد على هذه الرسالة.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

// Email template for approved request
export function generateApprovalApprovedEmail(data: {
  requesterName: string
  managerName: string
  requestTitle: string
  requestNumber?: string
  dashboardUrl: string
}): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f3f4f6;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: 900;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: #374151;
      margin-bottom: 25px;
    }
    .success-icon {
      font-size: 64px;
      text-align: center;
      margin: 20px 0;
    }
    .request-card {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      padding: 25px;
      border-radius: 12px;
      border: 2px solid #10b981;
      margin: 25px 0;
    }
    .request-number {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .request-title {
      font-size: 20px;
      font-weight: 700;
      color: #065f46;
      margin-bottom: 8px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: white;
      padding: 16px 40px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      margin: 20px 0;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      transition: all 0.3s;
    }
    .cta-button:hover {
      box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 13px;
      border-top: 1px solid #e5e7eb;
    }
    .footer-note {
      margin-top: 15px;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏛️ زوايا البناء للاستشارات الهندسية</div>
      <div class="subtitle">نظام الاتصالات الإدارية</div>
    </div>
    
    <div class="content">
      <div class="success-icon">✅</div>
      <div class="greeting">مبروك ${data.requesterName}!</div>
      
      <div class="message">
        تم <strong>اعتماد</strong> طلبك من قبل ${data.managerName}.
      </div>
      
      <div class="request-card">
        ${data.requestNumber ? `<div class="request-number">${data.requestNumber}</div>` : ''}
        <div class="request-title">${data.requestTitle}</div>
      </div>
      
      <center>
        <a href="${data.dashboardUrl}" class="cta-button">
          📥 تحميل الملف المعتمد
        </a>
      </center>
      
      <div class="message" style="margin-top: 30px; font-size: 14px;">
        يمكنك الآن تحميل نسخة من المستند المعتمد والموقع من لوحة التحكم.
      </div>
    </div>
    
    <div class="footer">
      <strong>زوايا البناء للاستشارات الهندسية</strong>
      <div class="footer-note">
        هذه رسالة تلقائية من نظام الاتصالات الإدارية. يرجى عدم الرد على هذه الرسالة.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

// Email template for rejected request
export function generateApprovalRejectedEmail(data: {
  requesterName: string
  managerName: string
  requestTitle: string
  requestNumber?: string
  rejectionReason: string
  dashboardUrl: string
}): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f3f4f6;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: 900;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      line-height: 1.6;
      color: #374151;
      margin-bottom: 25px;
    }
    .warning-icon {
      font-size: 64px;
      text-align: center;
      margin: 20px 0;
    }
    .request-card {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      padding: 25px;
      border-radius: 12px;
      border: 2px solid #ef4444;
      margin: 25px 0;
    }
    .request-number {
      display: inline-block;
      background: #ef4444;
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .request-title {
      font-size: 20px;
      font-weight: 700;
      color: #991b1b;
      margin-bottom: 8px;
    }
    .reason-box {
      background: #fef2f2;
      border-right: 4px solid #ef4444;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .reason-label {
      font-size: 13px;
      font-weight: 700;
      color: #991b1b;
      margin-bottom: 8px;
    }
    .reason-text {
      font-size: 15px;
      color: #7f1d1d;
      line-height: 1.6;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      color: white;
      padding: 16px 40px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      margin: 20px 0;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      transition: all 0.3s;
    }
    .cta-button:hover {
      box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
    }
    .footer {
      background: #f9fafb;
      padding: 30px;
      text-align: center;
      color: #6b7280;
      font-size: 13px;
      border-top: 1px solid #e5e7eb;
    }
    .footer-note {
      margin-top: 15px;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏛️ زوايا البناء للاستشارات الهندسية</div>
      <div class="subtitle">نظام الاتصالات الإدارية</div>
    </div>
    
    <div class="content">
      <div class="warning-icon">❌</div>
      <div class="greeting">عزيزي ${data.requesterName}</div>
      
      <div class="message">
        تم <strong>رفض</strong> طلبك من قبل ${data.managerName}.
      </div>
      
      <div class="request-card">
        ${data.requestNumber ? `<div class="request-number">${data.requestNumber}</div>` : ''}
        <div class="request-title">${data.requestTitle}</div>
      </div>
      
      <div class="reason-box">
        <div class="reason-label">سبب الرفض:</div>
        <div class="reason-text">${data.rejectionReason}</div>
      </div>
      
      <center>
        <a href="${data.dashboardUrl}" class="cta-button">
          ✏️ تعديل وإعادة الإرسال
        </a>
      </center>
      
      <div class="message" style="margin-top: 30px; font-size: 14px;">
        يمكنك تعديل الطلب والقيام بإرساله مرة أخرى بعد مراعاة الملاحظات.
      </div>
    </div>
    
    <div class="footer">
      <strong>زوايا البناء للاستشارات الهندسية</strong>
      <div class="footer-note">
        هذه رسالة تلقائية من نظام الاتصالات الإدارية. يرجى عدم الرد على هذه الرسالة.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}
