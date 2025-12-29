"use client"

import type { Correspondence, SystemSettings } from "@/types"
import { FileText } from "lucide-react"

interface OfficialReceiptProps {
  doc: Correspondence
  settings: SystemSettings
}

export default function OfficialReceipt({ doc, settings }: OfficialReceiptProps) {
  const handlePrint = () => {
    const p = window.open("", "_blank")
    if (!p) return

    const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${
      doc.barcode
    }&scale=8&rotate=N&includetext=false`

    p.document.write(`
      <html>
        <head>
          <title>مستند رسمي - ${doc.barcode}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
            @page { size: A4; margin: 0; }
            body { 
              font-family: 'Tajawal', sans-serif; 
              direction: rtl; 
              margin: 0; padding: 0; 
              background: #fff; color: #000;
              width: 210mm; height: 297mm;
              overflow: hidden;
              -webkit-print-color-adjust: exact;
            }
            .container {
              padding: 10mm;
              height: 297mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              position: relative;
            }
            .border-frame {
              border: 2.5pt solid #000;
              height: 100%;
              padding: 6mm;
              display: flex;
              flex-direction: column;
              position: relative;
              box-sizing: border-box;
            }
            .header-table {
              width: 100%;
              border-bottom: 3pt solid #000;
              padding-bottom: 4mm;
              margin-bottom: 5mm;
              border-collapse: collapse;
            }
            .logo-cell img { height: 18mm; width: auto; object-fit: contain; }
            .title-cell { text-align: center; }
            .title-cell h1 { margin: 0; font-size: 13pt; font-weight: 900; color: #000; }
            .title-cell p { margin: 1mm 0; font-size: 8pt; color: #333; font-weight: bold; text-transform: uppercase; }
            
            .barcode-cell { text-align: left; vertical-align: middle; }
            .barcode-cell img { width: 38mm; height: 9mm; }
            .barcode-id { font-family: monospace; font-size: 8.5pt; font-weight: 900; display: block; margin-top: 1mm; text-align: center; width: 38mm; }

            .metadata-strip {
              background: #f8fafc;
              display: grid;
              grid-template-columns: 1.2fr 1fr 0.8fr;
              padding: 2.5mm 4mm;
              border: 1.5pt solid #000;
              font-size: 9pt;
              font-weight: 900;
              margin-bottom: 6mm;
            }

            .main-body { flex: 1; padding: 0 4mm; }
            .doc-heading {
              font-size: 16pt;
              font-weight: 900;
              text-align: center;
              margin-bottom: 8mm;
              text-decoration: underline;
              text-underline-offset: 4px;
            }

            .info-row { display: flex; margin-bottom: 4mm; font-size: 10.5pt; border-bottom: 0.5pt solid #ddd; padding-bottom: 1.5mm; }
            .label { width: 35mm; font-weight: 900; color: #000; }
            .value { flex: 1; font-weight: 700; color: #111; }

            .description-box {
              margin-top: 4mm;
              padding: 5mm;
              border: 1pt solid #aaa;
              background: #fff;
              min-height: 40mm;
              font-size: 10.5pt;
              line-height: 1.6;
              border-radius: 1.5mm;
            }

            .footer-signature {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: auto;
              padding-bottom: 4mm;
            }
            .stamp-placeholder {
              width: 35mm; height: 35mm;
              border: 2pt dashed #ddd;
              border-radius: 50%;
              display: flex;
              align-items: center; justify-content: center;
              font-size: 8pt; color: #ccc; font-weight: 900;
              transform: rotate(-10deg);
            }
            .signature-box { text-align: center; border-top: 2pt solid #000; min-width: 55mm; padding-top: 2.5mm; }

            .page-footer {
              position: absolute;
              bottom: 4mm; left: 0; right: 0;
              text-align: center;
              font-size: 8pt; color: #555; font-weight: 900;
              border-top: 1pt solid #eee;
              padding-top: 2mm;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="border-frame">
              <table class="header-table">
                <tr>
                  <td width="30%" class="logo-cell">
                    <img src="${settings.logoUrl || "https://www.zaco.sa/logo2.png"}">
                  </td>
                  <td width="40%" class="title-cell">
                     <h1>${settings.orgName || "زوايا البناء للإستشارات الهندسية"}</h1>
                     <p>${settings.orgNameEn || "ZAWAYA ALBINA ENGINEERING"}</p>
                  </td>
                  <td width="30%" class="barcode-cell">
                    <img src="${barcodeUrl}">
                    <span class="barcode-id">${doc.barcode}</span>
                  </td>
                </tr>
              </table>

              <div class="metadata-strip">
                <div>رقم المرجع: ${doc.barcode}</div>
                <div>تاريخ القيد: ${doc.dateHijri || doc.date} (${doc.dateGregorian || doc.date})</div>
                <div>نوع المعاملة: ${doc.type === "INCOMING" ? "وارد" : "صادر"}</div>
              </div>

              <div class="main-body">
                <h2 class="doc-heading">${doc.title || doc.subject}</h2>
                
                <div class="info-row"><div class="label">مرسل من:</div><div class="value">${doc.sender}</div></div>
                <div class="info-row"><div class="label">مرسل إلى:</div><div class="value">${
                  doc.recipient || doc.receiver
                }</div></div>
                <div class="info-row"><div class="label">تاريخ الخطاب:</div><div class="value">${(doc.dateHijri || doc.date) + ' (' + (doc.dateGregorian || doc.date) + ')'}</div></div>
                <div class="info-row"><div class="label">الأولوية:</div><div class="value">${doc.priority}</div></div>
                <div class="info-row"><div class="label">درجة السرية:</div><div class="value">${
                  doc.security || "عام"
                }</div></div>

                <div class="description-box">
                  <strong>البيان والوصف الرسمي:</strong><br><br>
                  ${
                    doc.description ||
                    doc.notes ||
                    "تم قيد هذه المعاملة رقمياً وتوثيقها في السجل الموحد للمؤسسة، وتعتبر هذه النسخة أصلية بموجب الباركود المرجعي المسجل في أنظمة الحوكمة الرقمية."
                  }
                </div>
              </div>

              <div class="footer-signature">
                <div class="stamp-placeholder">ختم المؤسسة المعتمد</div>
                <div class="signature-box">
                   <div style="font-weight: 900; font-size: 12pt; margin-bottom: 2mm;">يعتمد،، الإدارة العامة</div>
                   <div style="font-size: 9.5pt;">${(doc as any).signatory || "المدير التنفيذي"}</div>
                </div>
              </div>

              <div class="page-footer">
                نظام إدارة المراسلات - ${settings.orgName} - جميع الحقوق محفوظة © ${new Date().getFullYear()}
              </div>
            </div>
          </div>
          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 800); }</script>
        </body>
      </html>
    `)
    p.document.close()
  }

  return (
    <button
      onClick={handlePrint}
      className="p-3 text-slate-400 hover:text-slate-900 bg-white border border-slate-200 rounded-2xl transition-all flex items-center gap-2.5 group shadow-sm hover:shadow-xl"
      title="طباعة خطاب A4"
    >
      <FileText size={19} />
      <span className="text-[10px] font-black uppercase tracking-tight">A4 Doc</span>
    </button>
  )
}
