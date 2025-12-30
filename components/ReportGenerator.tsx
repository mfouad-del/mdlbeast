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
    // Prioritize documentDate (ISO) over date (which might be formatted display string)
    let raw = doc.documentDate || (doc as any).created_at || doc.date || '';
    // Normalize to YYYY-MM-DD
    if (typeof raw === 'string' && raw.includes('T')) {
      raw = raw.split('T')[0];
    }
    // If raw is still not YYYY-MM-DD (e.g. formatted string), try to parse or ignore
    // This simple check ensures we don't compare "1445..." with "2025..."
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) {
       // fallback: try to create Date and toISOString
       try {
         const d = new Date(raw);
         if (!isNaN(d.getTime())) raw = d.toISOString().split('T')[0];
       } catch (e) { /* ignore */ }
    }

    const inRange = String(raw) >= startDate && String(raw) <= endDate;
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

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const orgName = settings.orgName;
    const logoUrl = settings.logoUrl;

    const tableRows = filteredDocs.map(doc => {
      const barcode = doc.barcode || (doc.referenceNumber || '')
      const title = doc.subject || doc.title || doc.description || '—'
      const typeStr = (doc.type === DocType.INCOMING || String(doc.status) === 'وارد' || String(barcode).toUpperCase().startsWith('IN')) ? 'وارد' : 'صادر'
      const sender = doc.sender || doc.createdBy || String(doc.user_id || '') || '—'
      const receiver = doc.receiver || doc.recipient || '—'
      const dateStr = doc.date || doc.documentDate || (doc.created_at ? new Date(doc.created_at).toISOString().split('T')[0] : '—')
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
            @page { size: A4; margin: 15mm; }
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
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 font-heading tracking-tight">مركز التقارير</h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">تصدير وطباعة تقارير الأداء والأرشفة</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Filters Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                <Filter size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">تخصيص التقرير</h3>
                <p className="text-xs font-bold text-slate-400">حدد النطاق الزمني والنوع</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-1">من تاريخ</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-1">نوع المعاملات</label>
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-xl">
                  {[
                    { id: 'ALL', label: 'الكل' },
                    { id: 'INCOMING', label: 'وارد' },
                    { id: 'OUTGOING', label: 'صادر' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setScope(opt.id as any)}
                      className={`py-2.5 rounded-lg text-xs font-black transition-all ${
                        scope === opt.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400">عدد النتائج</span>
                <span className="text-xl font-black text-slate-900">{filteredDocs.length}</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-full animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Quick Stats Mini Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100">
              <div className="text-blue-600 mb-2"><FileBarChart size={20} /></div>
              <div className="text-2xl font-black text-slate-900">{stats.incoming}</div>
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">وارد</div>
            </div>
            <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100">
              <div className="text-indigo-600 mb-2"><FileBarChart size={20} /></div>
              <div className="text-2xl font-black text-slate-900">{stats.outgoing}</div>
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">صادر</div>
            </div>
          </div>
        </div>

        {/* Actions & Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-900/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-20 -mt-20 blur-3xl"></div>
            
            <div className="relative z-10">
              <h2 className="text-2xl font-black mb-2">تصدير التقرير</h2>
              <p className="text-slate-400 text-sm font-medium mb-8 max-w-md">
                سيتم إنشاء تقرير تفصيلي يتضمن {filteredDocs.length} معاملة للفترة من {startDate} إلى {endDate}
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handlePrintReport}
                  disabled={filteredDocs.length === 0}
                  className="flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/10"
                >
                  <Printer size={20} />
                  <span>طباعة التقرير (PDF)</span>
                </button>

                <button
                  onClick={() => {
                    import('../lib/barcode-service').then(m => m.exportToCSV(filteredDocs, `Report_${startDate}_${endDate}`))
                  }}
                  disabled={filteredDocs.length === 0}
                  className="flex items-center gap-3 bg-slate-800 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700"
                >
                  <Download size={20} />
                  <span>تصدير Excel / CSV</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm min-h-[300px]">
            <div className="flex items-center gap-3 mb-6">
              <Info size={20} className="text-slate-400" />
              <h3 className="text-lg font-black text-slate-900">معاينة سريعة</h3>
            </div>

            {filteredDocs.length > 0 ? (
              <div className="space-y-3">
                {filteredDocs.slice(0, 5).map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs font-black text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{doc.barcode}</span>
                      <span className="text-sm font-bold text-slate-900 line-clamp-1">{doc.title || doc.subject}</span>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${
                      doc.type === 'INCOMING' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {doc.type === 'INCOMING' ? 'وارد' : 'صادر'}
                    </span>
                  </div>
                ))}
                {filteredDocs.length > 5 && (
                  <div className="text-center py-4 text-xs font-bold text-slate-400">
                    + {filteredDocs.length - 5} معاملات أخرى...
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <Filter size={32} className="mb-3 opacity-20" />
                <p className="font-bold">لا توجد بيانات للعرض</p>
                <p className="text-xs mt-1">قم بتغيير فلاتر البحث لإظهار النتائج</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;
