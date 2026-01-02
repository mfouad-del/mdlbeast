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
