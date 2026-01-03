import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Save, Move } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

interface ApprovalSignerProps {
  approvalId: number;
  approvalTitle: string;
  approvalDescription?: string;
  attachmentUrl: string;
  signatureUrl?: string;
  stampUrl?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ApprovalSigner({
  approvalId,
  approvalTitle,
  approvalDescription,
  attachmentUrl,
  signatureUrl,
  stampUrl,
  onSuccess,
  onCancel
}: ApprovalSignerProps) {
  const [selectedType, setSelectedType] = useState<'signature' | 'stamp'>('signature');
  const [signSize, setSignSize] = useState(120);
  const [signPosition, setSignPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [signedSignatureUrl, setSignedSignatureUrl] = useState('');
  const [signedStampUrl, setSignedStampUrl] = useState('');
  const [gridSnap, setGridSnap] = useState(false);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Convert R2 URL to signed URL
  const getSignedUrlFromR2 = async (r2Url: string): Promise<string> => {
    try {
      if (!r2Url || !r2Url.includes('r2.cloudflarestorage.com')) {
        return r2Url; // Already signed or not R2
      }
      
      const urlObj = new URL(r2Url);
      let pathname = urlObj.pathname.replace(/^\//, '');
      const bucket = 'zaco';
      if (pathname.startsWith(bucket + '/')) {
        pathname = pathname.slice(bucket.length + 1);
      }
      
      const response = await apiClient.getSignedUrl(pathname);
      return response.url;
    } catch (error) {
      console.error('Failed to get signed URL:', error);
      return r2Url; // Fallback to original
    }
  };

  // Fetch signed URLs for images and PDF preview
  useEffect(() => {
    const fetchUrls = async () => {
      try {
        // Fetch PDF preview
        const { url } = await apiClient.getApprovalAttachmentUrl(approvalId);
        setPreviewUrl(url);
        
        // Convert signature URL
        if (signatureUrl) {
          const signed = await getSignedUrlFromR2(signatureUrl);
          setSignedSignatureUrl(signed);
        }
        
        // Convert stamp URL
        if (stampUrl) {
          const signed = await getSignedUrlFromR2(stampUrl);
          setSignedStampUrl(signed);
        }
      } catch (error) {
        console.error('Failed to fetch URLs:', error);
        toast({ title: "خطأ", description: "فشل تحميل المعاينة", variant: "destructive" });
      }
    };
    fetchUrls();
  }, [approvalId, signatureUrl, stampUrl]);

  const currentImageUrl = selectedType === 'signature' ? signedSignatureUrl : signedStampUrl;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!pdfContainerRef.current) return;
    const rect = pdfContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    // Check if clicked on signature/stamp
    const isOnSign = 
      x >= signPosition.x && 
      x <= signPosition.x + signSize &&
      y >= signPosition.y && 
      y <= signPosition.y + signSize;
    
    if (isOnSign) {
      setIsDragging(true);
      setDragOffset({ 
        x: x - signPosition.x, 
        y: y - signPosition.y 
      });
      e.preventDefault(); // Prevent text selection
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !pdfContainerRef.current) return;
    
    e.preventDefault(); // Prevent default drag behavior
    
    const rect = pdfContainerRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left - dragOffset.x * zoom) / zoom;
    let y = (e.clientY - rect.top - dragOffset.y * zoom) / zoom;
    
    // Apply grid snapping if enabled
    if (gridSnap) {
      const gridSize = 20;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }
    
    // Keep within bounds
    const maxX = rect.width / zoom - signSize;
    const maxY = rect.height / zoom - signSize;
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    
    setSignPosition({ x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Also handle mouse leave to prevent stuck dragging
  const handleMouseLeave = () => {
    setIsDragging(false);
  };
  
  // Center the signature/stamp
  const handleCenter = () => {
    if (!pdfContainerRef.current) return;
    const rect = pdfContainerRef.current.getBoundingClientRect();
    const centerX = (rect.width / zoom - signSize) / 2;
    const centerY = (rect.height / zoom - signSize) / 2;
    setSignPosition({ x: centerX, y: centerY });
  };

  const handleFinalize = async () => {
    if (!pdfContainerRef.current || !currentImageUrl) return;
    
    setIsSubmitting(true);
    try {
      const containerWidth = pdfContainerRef.current.offsetWidth / zoom;
      const containerHeight = pdfContainerRef.current.offsetHeight / zoom;
      
      const payload: {
        status: 'APPROVED';
        signature_type: 'signature' | 'stamp';
        signature_position: {
          x: number;
          y: number;
          width: number;
          height: number;
          containerWidth: number;
          containerHeight: number;
        };
      } = {
        status: 'APPROVED',
        signature_type: selectedType,
        signature_position: {
          x: signPosition.x,
          y: signPosition.y,
          width: signSize,
          height: signSize,
          containerWidth: Math.round(containerWidth),
          containerHeight: Math.round(containerHeight)
        }
      };

      await apiClient.updateApprovalRequest(approvalId, payload);
      
      toast({ 
        title: "✅ تم الاعتماد", 
        description: "تم اعتماد المستند وإضافة التوقيع/الختم بنجاح" 
      });
      
      onSuccess();
    } catch (error: any) {
      console.error('Approval failed:', error);
      
      // Check if error is about missing signature/stamp
      const errorMsg = error?.response?.data?.error || error.message || "فشل اعتماد المستند";
      const needsSignature = error?.response?.data?.needsSignature;
      
      toast({ 
        title: needsSignature ? "⚠️ توقيع مطلوب" : "❌ خطأ", 
        description: errorMsg, 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-7xl h-[95vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-2xl font-black text-slate-900 mb-2">اعتماد وتوقيع المستند</h3>
              <div className="bg-white p-4 rounded-xl border-2 border-blue-200 shadow-sm">
                <p className="font-black text-lg text-slate-900 mb-1">{approvalTitle}</p>
                {approvalDescription && (
                  <p className="text-sm text-slate-600 leading-relaxed">{approvalDescription}</p>
                )}
              </div>
              <p className="text-xs text-slate-500 font-bold mt-3">اختر التوقيع أو الختم ثم اسحبه للمكان المطلوب على المستند</p>
            </div>
            <button 
              onClick={onCancel}
              className="text-slate-400 hover:text-red-500 transition-colors ml-4"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-6 p-6 overflow-hidden">
          {/* PDF Preview Area */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-3 bg-slate-100 p-3 rounded-xl">
              <button 
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className="p-2 bg-white rounded-lg hover:bg-slate-50 transition-colors"
                title="تصغير"
              >
                <ZoomOut size={18} />
              </button>
              <span className="font-bold text-sm min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button 
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                className="p-2 bg-white rounded-lg hover:bg-slate-50 transition-colors"
                title="تكبير"
              >
                <ZoomIn size={18} />
              </button>
              <button 
                onClick={() => setZoom(1)}
                className="p-2 bg-white rounded-lg hover:bg-slate-50 transition-colors"
                title="إعادة"
              >
                <RotateCcw size={18} />
              </button>
              <div className="h-6 w-px bg-slate-300 mx-2" />
              <button
                onClick={handleCenter}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-bold"
                title="توسيط التوقيع"
              >
                توسيط
              </button>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gridSnap}
                  onChange={(e) => setGridSnap(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-xs font-bold text-slate-600">محاذاة تلقائية</span>
              </label>
              <div className="flex-1" />
              <Move size={18} className="text-slate-400" />
              <span className="text-xs text-slate-500 font-bold">اسحب التوقيع/الختم</span>
            </div>

            {/* PDF Container with Signature/Stamp Overlay */}
            <div 
              ref={pdfContainerRef}
              className="flex-1 bg-slate-100 rounded-2xl overflow-auto relative border-2 border-slate-200"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: isDragging ? 'grabbing' : 'default', userSelect: 'none' }}
            >
              <div 
                style={{ 
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  width: '100%',
                  height: '100%',
                  transition: 'transform 0.2s ease'
                }}
              >
                {previewUrl ? (
                  <iframe
                    src={`${previewUrl}#view=FitH`}
                    className="w-full min-h-[842px]"
                    style={{ height: '100vh' }}
                    title="معاينة المستند"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-400 font-bold animate-pulse">جاري التحميل...</p>
                  </div>
                )}

                {/* Signature/Stamp Overlay */}
                {currentImageUrl && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${signPosition.x}px`,
                      top: `${signPosition.y}px`,
                      width: `${signSize}px`,
                      height: `${signSize}px`,
                      cursor: 'move',
                      zIndex: 10
                    }}
                    className="border-2 border-dashed border-blue-500 rounded-lg bg-white/80 backdrop-blur-sm p-1 shadow-lg"
                  >
                    <img 
                      src={currentImageUrl} 
                      alt={selectedType === 'signature' ? 'التوقيع' : 'الختم'}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                      ⋮⋮
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className="w-80 flex flex-col gap-4">
            {/* Type Selection */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 block">
                اختر نوع الاعتماد
              </label>
              <div className="space-y-2">
                {signedSignatureUrl && (
                  <button
                    onClick={() => setSelectedType('signature')}
                    className={`w-full p-3 rounded-xl border-2 transition-all ${
                      selectedType === 'signature'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={signedSignatureUrl} alt="التوقيع" className="h-10 w-20 object-contain" />
                      <span className="font-bold text-sm">التوقيع</span>
                    </div>
                  </button>
                )}
                {signedStampUrl && (
                  <button
                    onClick={() => setSelectedType('stamp')}
                    className={`w-full p-3 rounded-xl border-2 transition-all ${
                      selectedType === 'stamp'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={signedStampUrl} alt="الختم" className="h-10 w-20 object-contain" />
                      <span className="font-bold text-sm">ختم القسم</span>
                    </div>
                  </button>
                )}
                {!signedSignatureUrl && !signedStampUrl && (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    <p className="font-bold">جاري التحميل...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Size Control */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 block">
                حجم التوقيع/الختم
              </label>
              <input
                type="range"
                min="60"
                max="300"
                step="10"
                value={signSize}
                onChange={(e) => setSignSize(Number(e.target.value))}
                className="w-full h-2 bg-gradient-to-r from-blue-200 to-blue-500 rounded-lg appearance-none cursor-pointer"
              />
              <div className="mt-2 text-center">
                <span className="inline-block px-3 py-1 bg-white rounded-lg text-sm font-bold">
                  {signSize} بكسل
                </span>
              </div>
            </div>

            {/* Position & Size Info */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 block">
                معلومات التوضيع
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg">
                  <span className="text-slate-400">X:</span>{' '}
                  <span className="font-bold">{Math.round(signPosition.x)} بكسل</span>
                </div>
                <div className="bg-white p-2 rounded-lg">
                  <span className="text-slate-400">Y:</span>{' '}
                  <span className="font-bold">{Math.round(signPosition.y)} بكسل</span>
                </div>
                <div className="bg-white p-2 rounded-lg col-span-2">
                  <span className="text-slate-400">الحجم:</span>{' '}
                  <span className="font-bold">{signSize} × {signSize} بكسل</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex-1" />
            <div className="space-y-3">
              <button
                onClick={handleFinalize}
                disabled={isSubmitting || !currentImageUrl}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save size={20} />
                {isSubmitting ? 'جاري الاعتماد...' : 'تأكيد الاعتماد'}
              </button>
              <button
                onClick={onCancel}
                className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
