import React, { useState } from 'react';
import { Correspondence, DocType } from '../types';
import { FileBarChart, Download, Printer, Filter, Info } from 'lucide-react';
import { formatDateTimeGregorian } from "@/lib/utils";
import { useI18n } from '../lib/i18n-context';

interface ReportGeneratorProps {
  docs: Correspondence[];
  settings: {
    orgName: string;
    logoUrl: string;
  };
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ docs, settings }) => {
  const { t, dir, locale } = useI18n();
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
       } catch (_e) { /* ignore */ }
    }

    const inRange = String(raw) >= startDate && String(raw) <= endDate;
    const inScope = scope === 'ALL' || (scope === 'INCOMING' && doc.type === DocType.INCOMING) || (scope === 'OUTGOING' && doc.type === DocType.OUTGOING);
    return inRange && inScope;
  });

  const [_serverStats, setServerStats] = useState<{ total?: number; incoming?: number; outgoing?: number; archived?: number; urgent?: number }>({})

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

    // Use settings from localStorage if available, or fallbacks
    const orgName = settings.orgName || t('app.title');
    const logoUrl = settings.logoUrl || '';

    // Pre-translate strings for the print view
    const reportTitle = t('reports.title');
    const reportSubtitle = t('reports.subtitle');
    const reportDateLabel = t('reports.reportDate');
    const periodLabel = t('reports.period');
    const totalLabel = t('reports.total');
    const incomingLabel = t('reports.incoming');
    const outgoingLabel = t('reports.outgoing');
    
    const thBarcode = t('archive.unifiedID');
    const thSubject = t('archive.subject');
    const thType = t('archive.type');
    const thFromTo = t('archive.from') + ' / ' + t('archive.to');
    const thDate = t('archive.date');
    
    const footerText = t('reports.footer');
    
    const tableRows = filteredDocs.map(doc => {
      const barcode = doc.barcode || (doc.referenceNumber || '')
      const title = doc.subject || doc.title || doc.description || '—'
      const typeStr = (doc.type === DocType.INCOMING || String(doc.status) === t('new.key.3mij8b') || String(barcode).toUpperCase().startsWith('IN')) ? t('archive.incoming') : t('archive.outgoing')
      /* const counterparty = (typeStr === t('archive.outgoing') || doc.type === DocType.OUTGOING) // FIX: logic with translated string is risky */
      const isOutgoing = doc.type === DocType.OUTGOING || String(barcode).toUpperCase().startsWith('OUT');
      const counterparty = isOutgoing
        ? (doc.receiver || (doc as any).recipient || '—')
        : (doc.sender || '—')
        
      const dateStr = doc.date || doc.documentDate || (doc.created_at ? new Date(doc.created_at).toISOString().split('T')[0] : '—')
      return `
        <tr>
          <td style="text-align: center; font-family: monospace; font-weight: bold; width: 140px;">${barcode}</td>
          <td style="width: 40%; word-break: break-word;">${title}</td>
          <td style="text-align: center; width: 80px;">${typeStr}</td>
          <td style="width: 160px;">${counterparty}</td>
          <td style="text-align: center; width: 120px;">${dateStr}</td>
        </tr>
      `
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${reportTitle} - ${startDate} / ${endDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            @page { size: A4; margin: 10mm; }
            body { 
              font-family: ${locale === 'ar' ? "'Tajawal', sans-serif" : "'Inter', sans-serif"}; 
              direction: ${dir}; 
              padding: 5mm;
              color: #0f172a;
              line-height: 1.5;
              font-size: 12px;
              max-width: 210mm;
              margin: 0 auto;
            }
            
            /* Header Grid: Right (Logo), Center (Title), Left (Date) */
            .header-grid {
              display: grid;
              grid-template-columns: 1fr 2fr 1fr;
              align-items: center;
              border-bottom: 3px double #0f172a;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header-right {
              text-align: ${dir === 'rtl' ? 'right' : 'left'};
            }
            .header-center {
              text-align: center;
            }
            .header-left {
              text-align: ${dir === 'rtl' ? 'left' : 'right'};
              font-size: 12px;
              color: #64748b;
            }
            
            .logo-img {
              max-height: 100px;
              max-width: 100%;
              object-fit: contain;
            }

            .org-title {
              font-size: 24px;
              font-weight: 900;
              margin: 0;
              margin-bottom: 5px;
            }
            .report-subtitle {
              font-size: 16px;
              color: #475569;
              font-weight: 700;
            }

            /* Stats Cards */
            .stats-grid { 
              display: grid; 
              grid-template-columns: repeat(3, 1fr); 
              gap: 15px; 
              margin-bottom: 30px;
            }
            .stat-card { 
              border: 1px solid #cbd5e1; 
              padding: 10px; 
              border-radius: 8px; 
              text-align: center;
              background-color: #f8fafc;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .stat-value { font-size: 18px; font-weight: 900; display: block; color: #0f172a; }
            .stat-label { font-size: 12px; color: #64748b; font-weight: 700; }

            /* Table Styles */
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th { 
              background-color: #f1f5f9 !important; 
              padding: 10px; 
              border: 1px solid #cbd5e1; 
              font-weight: 900; 
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
              text-align: ${dir === 'rtl' ? 'right' : 'left'};
            }
            td { padding: 8px; border: 1px solid #cbd5e1; vertical-align: middle; text-align: ${dir === 'rtl' ? 'right' : 'left'}; }
            
            /* Footer */
            .footer { 
              position: fixed; 
              bottom: 10mm; 
              left: 0; 
              right: 0; 
              text-align: center; 
              font-size: 10px; 
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }

            @media print {
              .no-print { display: none; }
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          
          <div class="header-grid">
            <div class="header-right">
              ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="Logo" />` : '<div style="height: 80px; width: 80px; background: #f1f5f9; border-radius: 50%;"></div>'}
            </div>
            <div class="header-center">
              <h1 class="org-title">${orgName}</h1>
              <div class="report-subtitle">${reportSubtitle}</div>
            </div>
            <div class="header-left">
              <div>${reportDateLabel}: ${new Date().toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}</div>
              <div>${periodLabel}: ${startDate} - ${endDate}</div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-value">${stats.total}</span>
              <span class="stat-label">${totalLabel}</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${stats.incoming}</span>
              <span class="stat-label">${incomingLabel}</span>
            </div>
            <div class="stat-card">
              <span class="stat-value">${stats.outgoing}</span>
              <span class="stat-label">${outgoingLabel}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>${thBarcode}</th>
                <th>${thSubject}</th>
                <th>${thType}</th>
                <th>${thFromTo}</th>
                <th>${thDate}</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            ${footerText} | ${new Date().toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
          </div>

          <script>
            window.onload = () => { window.print(); }
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
          <h1 className="text-4xl font-black text-slate-900 font-heading tracking-tight">{t('reports.title')}</h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">{t('reports.description')}</p>
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
                <h3 className="text-lg font-black text-slate-900">{t('reports.customize')}</h3>
                <p className="text-xs font-bold text-slate-400">{t('reports.selectRange')}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-1">{t('reports.fromDate')}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-1">{t('reports.toDate')}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-1">{t('reports.type')}</label>
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-xl">
                  {[
                    { id: 'ALL', label: t('archive.all') },
                    { id: 'INCOMING', label: t('archive.incoming') },
                    { id: 'OUTGOING', label: t('archive.outgoing') }
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
                <span className="text-xs font-bold text-slate-400">{t('reports.resultsCount')}</span>
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
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{t('archive.incoming')}</div>
            </div>
            <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100">
              <div className="text-indigo-600 mb-2"><FileBarChart size={20} /></div>
              <div className="text-2xl font-black text-slate-900">{stats.outgoing}</div>
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{t('archive.outgoing')}</div>
            </div>
          </div>
        </div>

        {/* Actions & Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-900/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-20 -mt-20 blur-3xl"></div>
            
            <div className="relative z-10">
              <h2 className="text-2xl font-black mb-2">{t('reports.exportTitle')}</h2>
              <p className="text-slate-400 text-sm font-medium mb-8 max-w-md">
                 {t('reports.exportDesc')
                    .replace('{count}', filteredDocs.length.toString())
                    .replace('{start}', startDate)
                    .replace('{end}', endDate)}
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handlePrintReport}
                  disabled={filteredDocs.length === 0}
                  className="flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-black hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/10"
                >
                  <Printer size={20} />
                  <span>{t('reports.printPDF')}</span>
                </button>

                <button
                  onClick={() => {
                    import('../lib/barcode-service').then(m => m.exportToCSV(t, filteredDocs, `Report_${startDate}_${endDate}`))
                  }}
                  disabled={filteredDocs.length === 0}
                  className="flex items-center gap-3 bg-slate-800 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700"
                >
                  <Download size={20} />
                  <span>{t('reports.exportCSV')}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm min-h-[300px]">
            <div className="flex items-center gap-3 mb-6">
              <Info size={20} className="text-slate-400" />
              <h3 className="text-lg font-black text-slate-900">{t('reports.preview')}</h3>
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
                      {doc.type === 'INCOMING' ? t('archive.incoming') : t('archive.outgoing')}
                    </span>
                  </div>
                ))}
                {filteredDocs.length > 5 && (
                  <div className="text-center py-4 text-xs font-bold text-slate-400">
                    + {filteredDocs.length - 5} {t('reports.moreDocs')}...
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <Filter size={32} className="mb-3 opacity-20" />
                <p className="font-bold">{t('reports.noData')}</p>
                <p className="text-xs mt-1">{t('reports.changeFilters')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;

