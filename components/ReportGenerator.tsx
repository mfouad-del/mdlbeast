import React, { useState } from 'react';
import { Correspondence, DocType } from '../types';
import { Calendar, FileBarChart, Download, Printer, Filter, Info } from 'lucide-react';

interface ReportGeneratorProps {
  docs: Correspondence[];
  settings: {
    orgName: string;
    logoUrl: string;
  };
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ docs, settings }) => {
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [scope, setScope] = useState<'ALL'|'INCOMING'|'OUTGOING'>('ALL')

  const filteredDocs = docs.filter(doc => {
    // Use a robust date comparison using available date fields (documentDate, date, created_at)
    const start = new Date(startDate);
    start.setHours(0,0,0,0);
    const end = new Date(endDate);
    end.setHours(23,59,59,999);

    const raw = doc.documentDate || doc.date || (doc.created_at ? new Date(doc.created_at).toISOString() : '');
    const docDate = raw ? new Date(raw) : null;

    const inRange = docDate ? (docDate >= start && docDate <= end) : false;
    const inScope = scope === 'ALL' || (scope === 'INCOMING' && doc.type === DocType.INCOMING) || (scope === 'OUTGOING' && doc.type === DocType.OUTGOING);
    return inRange && inScope;
  });

  const [serverStats, setServerStats] = useState<{ total?: number; incoming?: number; outgoing?: number; archived?: number; urgent?: number }>({})

  React.useEffect(() => {
    import('../lib/api-client').then(m => m.apiClient.getStatistics().then((s: any) => setServerStats(s)).catch(() => {}))
  }, [])

  const stats = {
    total: filteredDocs.length,
    incoming: filteredDocs.filter(d => d.type === DocType.INCOMING).length,
    outgoing: filteredDocs.filter(d => d.type === DocType.OUTGOING).length,
  };

  const defaultLegal = `البيان والوصف الرسمي: تم قيد هذه المعاملة رقميًا وتوثيقها في السجل الموحد للمؤسسة، وتعتبر هذه النسخة أصلية بموجب\nالباركود المرجعي المسجل في أنظمة الحوكمة الرقمية`;

  // Determine which statement to show in A4 export
  const reportStatement = (() => {
    if (filteredDocs.length === 0) return defaultLegal
    // If only one doc, show its statement if present
    if (filteredDocs.length === 1) return filteredDocs[0].statement && String(filteredDocs[0].statement).trim() !== '' ? filteredDocs[0].statement : defaultLegal
    // If multiple docs but all share same non-empty statement, show it
    const s0 = filteredDocs[0].statement ? String(filteredDocs[0].statement).trim() : ''
    if (s0 !== '' && filteredDocs.every(d => String(d.statement || '').trim() === s0)) return s0
    // Otherwise fallback to default legal text
    return defaultLegal
  })()

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const orgName = settings.orgName;
    const logoUrl = settings.logoUrl;

    const tableRows = filteredDocs.map(doc => {
      const barcode = doc.barcode || doc.barcodeId || (doc.referenceNumber || '')
      const title = doc.subject || doc.title || doc.description || '—'
      const typeStr = (doc.type === DocType.INCOMING || String(doc.status) === 'وارد' || String(barcode).toUpperCase().startsWith('IN')) ? 'وارد' : 'صادر'
      const sender = doc.sender || doc.from || doc.createdBy || doc.user_id || '—'
      const receiver = doc.receiver || doc.recipient || doc.to || '—'
      const dateStr = doc.documentDate || doc.date || (doc.created_at ? new Date(doc.created_at).toISOString().split('T')[0] : '—')
      return `
        <tr>
          <td style="text-align: center; font-family: monospace; font-weight: bold; width: 140px;">${barcode}</td>
          <td style="width: 40%; word-break: break-word;">${title}</td>
          <td style="text-align: center; width: 80px;">${typeStr}</td>
          <td style="width: 160px;">${sender}</td>
          <td style="text-align: center; width: 120px;">${dateStr}</td>
        </tr>
      `
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>تقرير المعاملات - ${startDate} إلى ${endDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
            @page { size: A4 landscape; margin: 15mm; }
            body { 
              font-family: 'Tajawal', sans-serif; 
              direction: rtl; 
              padding: 12mm 12mm; 
              color: #0f172a;
              line-height: 1.45;
              font-size: 12px;
            }
            .header { 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              border-bottom: 3px solid #0f172a; 
              padding-bottom: 20px; 
              margin-bottom: 30px;
              position: relative;
            }
            .header .corner-date { position: absolute; top: 12px; font-size: 12px; color: #64748b; }
            .header .corner-left { left: 40px; }
            .header .corner-right { right: 40px; }
            .header-info h1 { margin: 0; font-size: 20px; font-weight: 900; }
            .header-info p { margin: 5px 0; font-size: 12px; color: #64748b; }
            
            .report-title { text-align: center; margin-bottom: 30px; }
            .report-title h2 { font-size: 24px; font-weight: 900; margin-bottom: 5px; }
            .report-title p { color: #64748b; font-weight: 700; }

            .stats-grid { 
              display: grid; 
              grid-template-cols: repeat(3, 1fr); 
              gap: 20px; 
              margin-bottom: 30px;
            }
            .stat-card { 
              border: 1px solid #e2e8f0; 
              padding: 15px; 
              border-radius: 15px; 
              text-align: center;
              background: #f8fafc;
            }
            .stat-value { font-size: 20px; font-weight: 900; display: block; }
            .stat-label { font-size: 12px; color: #64748b; font-weight: 700; }

            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; table-layout: fixed; }
            th { background: #f1f5f9; padding: 8px; border: 1px solid #e2e8f0; font-weight: 900; }
            td { padding: 8px; border: 1px solid #e2e8f0; word-break: break-word; }
            td.barcode { width: 140px; font-family: monospace; font-weight: 900; }
            td.title { width: 40%; }
            td.type { width: 80px; text-align:center }
            td.sender { width: 160px }

            .footer { 
              position: fixed; 
              bottom: 30px; 
              left: 40px; 
              right: 40px; 
              border-top: 1px solid #e2e8f0; 
              padding-top: 15px; 
              font-size: 10px; 
              text-align: center; 
              color: #94a3b8;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div style="position: absolute; top: 8px; left: 40px; font-size: 12px; color: #64748b;">نطاق: ${startDate} إلى ${endDate}</div>
          <div style="position: absolute; top: 8px; right: 40px; font-size: 12px; color: #64748b;">تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</div>

          <div class="header" style="direction: rtl;">
             <div style="width: 120px; text-align:right;">
               <img src="${logoUrl}" style="height: 70px; object-fit: contain;" />
             </div>
             <div class="header-info" style="text-align: center; width: 100%;">
                <h1 style="font-size:20px; margin:0;">${orgName}</h1>
                <p style="margin:0; font-size:12px; color:#64748b;">نظام ArchivX Enterprise - مركز التقارير</p>
             </div>
             <div style="width: 120px; text-align:center;">&nbsp;</div>
          </div>

          <div class="report-title">
            <h2>تقرير حركة الصادر والوارد</h2>
            <p>الفترة من ${startDate} إلى ${endDate}</p>
            <p style="margin-top:8px;">نطاق التقرير: ${scope === 'ALL' ? 'الوارد + الصادر' : (scope === 'INCOMING' ? 'الوارد' : 'الصادر')}</p>
          </div>

          <div style="margin-bottom:18px; padding:12px; background:#fff; border-radius:12px; border:1px solid #e6eef6; white-space: pre-wrap;">
            <strong>البيان:</strong>
            <div style="margin-top:8px; color:#0f172a; font-weight:700;">${(reportStatement || defaultLegal)}</div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-value">${stats.total}</span>
              <span class="stat-label">إجمالي المعاملات</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${stats.incoming}</span>
              <span class="stat-label">الوارد</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${stats.outgoing}</span>
              <span class="stat-label">الصادر</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>المعرف الرقمي</th>
                <th>موضوع المعاملة</th>
                <th>النوع</th>
                <th>الجهة</th>
                <th>تاريخ القيد</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            تم استخراج هذا التقرير آلياً بتاريخ ${new Date().toLocaleString('ar-SA')}. جميع البيانات موثقة ومعماة برمجياً.
          </div>

          <script>
            window.onload = function() {
              setTimeout(() => { window.print(); window.close(); }, 700);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/50">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-blue-600 p-4 rounded-3xl text-white shadow-lg shadow-blue-200">
            <FileBarChart size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 leading-tight">مركز توليد التقارير</h2>
            <p className="text-slate-500 font-medium">قم بتحديد النطاق الزمني لاستخراج تقرير مفصل بنسخة A4</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
              <Calendar size={14} /> تاريخ البداية
            </label>
            <input 
              type="date" 
              className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold transition-all"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
              <Calendar size={14} /> تاريخ النهاية
            </label>
            <input 
              type="date" 
              className="w-full p-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold transition-all"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">نطاق التقرير</label>
            <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold">
              <option value="ALL">الوارد + الصادر</option>
              <option value="INCOMING">الوارد فقط</option>
              <option value="OUTGOING">الصادر فقط</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي النتائج</p>
            <p className="text-4xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">الوارد</p>
            <p className="text-4xl font-black text-blue-600">{stats.incoming}</p>
          </div>
          <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">الصادر</p>
            <p className="text-4xl font-black text-indigo-600">{stats.outgoing}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={handlePrintReport}
            disabled={stats.total === 0}
            className="flex-1 bg-slate-900 hover:bg-black text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={24} /> معالجة وطباعة التقرير A4
          </button>
        </div>
      </div>

      <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 flex gap-5">
        <div className="bg-white p-3 rounded-2xl shadow-sm h-fit text-blue-600"><Info size={24} /></div>
        <div className="space-y-1">
          <h4 className="font-black text-blue-900">حول التقارير الذكية</h4>
          <p className="text-blue-800 text-sm leading-relaxed font-medium">
            يتم استخراج البيانات مباشرة من الأرشيف الرقمي المشفر. تأكد من أن الطابعة مضبوطة على وضع <strong>Landscape</strong> إذا كانت قائمة المعاملات طويلة جداً لضمان ظهور كافة الأعمدة بوضوح.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;
