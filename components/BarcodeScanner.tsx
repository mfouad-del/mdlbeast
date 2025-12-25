import React, { useState, useEffect, useRef } from 'react';
import { Scan, Search, FileText, X, AlertCircle } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import AsyncButton from './ui/async-button'

const BarcodeScanner: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [manualId, setManualId] = useState('');
  const [foundDoc, setFoundDoc] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoadingBarcode, setIsLoadingBarcode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => stopScanner();
  }, [])

  const detectorRef = useRef<any | null>(null);
  const rafRef = useRef<number | null>(null);

  const fetchByBarcode = async (rawBarcode: string) => {
    const barcode = String(rawBarcode || '').trim().toUpperCase()
    if (!barcode) {
      setStatusMessage('قيمة الباركود فارغة');
      return;
    }
    setIsLoadingBarcode(true);
    setStatusMessage(null);
    try {
      const res = await apiClient.getBarcode(barcode);
      if (res) {
        setFoundDoc(res);
        const tl = await apiClient.getBarcodeTimeline(barcode).catch(() => []);
        setTimeline(tl || []);
        setStatusMessage('تم العثور على المعاملة');
        return;
      }
      // fallback: search endpoint
      const search = await apiClient.searchBarcodes(barcode).catch(() => [])
      if (Array.isArray(search) && search.length === 1) {
        const b = search[0]
        setFoundDoc(b)
        const tl = await apiClient.getBarcodeTimeline(b.barcode).catch(() => [])
        setTimeline(tl || [])
        setStatusMessage('تم العثور على المعاملة عبر البحث')
        return
      }
      setFoundDoc(null);
      setTimeline([]);
      setStatusMessage('لم يتم العثور على معاملة بهذا الرقم.');
    } catch (err: any) {
      console.error('API error', err);
      if (err && String(err).toLowerCase().includes('not found')) setStatusMessage('لم يتم العثور على معاملة بهذا الرقم.');
      else setStatusMessage('حدث خطأ أثناء جلب البيانات من الخادم.');
    } finally {
      setIsLoadingBarcode(false);
    }
  };

  const decodeLoop = async () => {
    if (!videoRef.current || !detectorRef.current) return;
    try {
      // BarcodeDetector API
      const detections = await detectorRef.current.detect(videoRef.current);
      if (detections && detections.length) {
        const code = detections[0].rawValue || detections[0].rawData;
        if (code) {
          stopScanner();
          fetchByBarcode(code);
          return;
        }
      }
    } catch (err) {
      // ignore detection errors
      console.debug('Detection error', err);
    }
    rafRef.current = requestAnimationFrame(decodeLoop);
  };

  const startScanner = async () => {
    setIsScanning(true);
    setFoundDoc(null);
    setTimeline([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      if ((window as any).BarcodeDetector) {
        detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'code_93'] });
        rafRef.current = requestAnimationFrame(decodeLoop);
      } else {
        alert('الكشف التلقائي غير متوفر في المتصفح. الرجاء استخدام البحث اليدوي.');
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("تعذر الوصول للكاميرا. يرجى التأكد من منح الصلاحيات.");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    detectorRef.current = null;
    setIsScanning(false);
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId || manualId.trim().length < 2) return;
    await fetchByBarcode(manualId.trim().toUpperCase());
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-black text-slate-900 mb-2">ماسح الباركود الذكي</h2>
        <p className="text-slate-500">استخدم الكاميرا أو أدخل الرقم يدوياً للاستعلام عن معاملة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
          <div className="w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden relative mb-6 border-4 border-slate-800">
            {isScanning ? (
              <>
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-32 border-2 border-blue-500 border-dashed rounded-lg animate-pulse"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_red] animate-scan"></div>
                </div>
                <button 
                  onClick={stopScanner}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2"
                >
                  <X size={18} /> إيقاف
                </button>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                <Scan size={64} className="opacity-20" />
                <button 
                  onClick={startScanner}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
                >
                  تشغيل الكاميرا
                </button>
              </div>
            )}
          </div>
          
          <div className="w-full border-t border-slate-100 pt-6">
            <form onSubmit={handleManualSearch} className="flex gap-2">
              <input 
                type="text" 
                placeholder="أدخل رقم الباركود يدوياً (مثال: IN-2025-...)"
                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm uppercase"
                value={manualId}
                onChange={e => setManualId(e.target.value)}
              />
              <button className="bg-slate-800 text-white px-6 rounded-xl font-bold flex items-center gap-2">
                <Search size={18} /> بحث
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          {foundDoc ? (
            <div className="bg-white p-8 rounded-3xl border border-blue-200 shadow-xl shadow-blue-50 animate-in slide-in-from-left duration-500">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                    foundDoc.type === 'INCOMING' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {foundDoc.type === 'INCOMING' ? 'وارد' : 'صادر'}
                  </span>
                  <h3 className="text-xl font-black mt-2 text-slate-900">{foundDoc.title}</h3>
                </div>
                <div className="font-mono text-xs font-bold bg-slate-100 p-2 rounded border border-slate-200 whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px]">
                  {foundDoc.barcodeId}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-500 text-sm">من:</span>
                  <span className="font-bold text-slate-800">{foundDoc.sender || foundDoc.from || '—'}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-500 text-sm">إلى:</span>
                  <span className="font-bold text-slate-800">{foundDoc.recipient || foundDoc.to || '—'}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-500 text-sm">تاريخ التسجيل:</span>
                  <span className="font-bold text-slate-800">{foundDoc.date || (foundDoc.created_at ? new Date(foundDoc.created_at).toLocaleString() : '—')}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-500 text-sm block mb-1">الوصف:</span>
                  <p className="text-sm text-slate-700 leading-relaxed">{foundDoc.description || foundDoc.notes || 'لا يوجد وصف مضاف.'}</p>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-bold text-slate-700 mb-2">السجل الزمني</h4>
                  <div className="space-y-2 max-h-40 overflow-auto">
                    {timeline.length ? (
                      timeline.map((t, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100">
                          <div className="text-xs text-slate-500 font-mono">{new Date(t.created_at || t.date || t.ts || Date.now()).toLocaleString()}</div>
                          <div className="text-sm text-slate-700">{t.message || t.note || t.action || JSON.stringify(t)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-slate-500">لا توجد مدخلات في السجل حتى الآن.</div>
                    )}
                  </div>

                  <form className="mt-3 flex gap-2" onSubmit={async (e) => {
                    e.preventDefault();
                    const el = (e.target as HTMLFormElement).elements.namedItem('note') as HTMLInputElement;
                    const val = el.value.trim();
                    if (!val) return;
                    try {
                      setStatusMessage('جاري إضافة المدخل...');
                      await apiClient.addBarcodeTimeline(foundDoc.barcodeId || foundDoc.code || foundDoc.barcode, { action: val });
                      // optimistic: append locally and then refetch
                      setTimeline(prev => [{ created_at: new Date().toISOString(), message: val, action: val }, ...prev]);
                      el.value = '';
                      setStatusMessage('تم إضافة المدخل');
                    } catch (err) {
                      console.error(err);
                      setStatusMessage('فشل إضافة مدخل للسجل');
                    } finally {
                      setTimeout(() => setStatusMessage(null), 2000);
                    }
                  }}>
                    <input name="note" placeholder="أضف ملاحظة للسجل" className="flex-1 p-2 rounded-xl border border-slate-200" />
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-xl">إضافة</button>
                  </form>
                </div>
              </div>

              <div className="flex gap-3">
                <AsyncButton className="w-full mt-6 bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2" onClickAsync={async () => {
                  try {
                    const previewUrl = await apiClient.getPreviewUrl(foundDoc.barcode || foundDoc.barcodeId)
                    if (!previewUrl) { alert('لم يتم العثور على ملف للمعاينة'); return }
                    window.open(previewUrl, '_blank')
                  } catch (e: any) {
                    console.error('Failed to open preview', e)
                    alert('فشل فتح الملف - حاول مرة أخرى')
                  }
                }}>
                  <FileText size={20} /> فتح الملف الكامل
                </AsyncButton>
                <AsyncButton className="mt-6 bg-red-500 text-white py-4 rounded-xl font-bold flex items-center gap-2 px-4" onClickAsync={async () => { if (!confirm('حذف المستند؟')) return; await apiClient.deleteDocument(foundDoc.barcode || foundDoc.barcodeId); setFoundDoc(null); setTimeline([]); setStatusMessage('تم حذف المستند'); }}>
                  حذف
                </AsyncButton>
              </div>
            </div>
          ) : (
            <div className="h-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-12 text-slate-400 text-center gap-4">
              <AlertCircle size={48} className="opacity-20" />
              <div>
                <p className="font-bold text-slate-600">انتظار القراءة</p>
                <p className="text-sm">قم بمسح الباركود أو البحث اليدوي لعرض البيانات هنا</p>
                {statusMessage && <p className="text-sm text-slate-600 mt-2">{statusMessage}</p>}
                {isLoadingBarcode && <p className="text-sm text-slate-600 mt-2">جاري البحث...</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 10%; }
          100% { top: 90%; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
};

export default BarcodeScanner;
