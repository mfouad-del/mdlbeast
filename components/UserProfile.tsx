import React, { useState } from 'react';
import { FileSignature, Stamp, Upload, User, Mail, Shield, Save, X } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useToast } from '../hooks/use-toast';

interface UserProfileProps {
  user: {
    id: number | string;
    username: string;
    full_name?: string;
    email?: string;
    role: string;
    signature_url?: string;
    stamp_url?: string;
  };
  onUpdate: () => void;
  onClose: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdate, onClose }) => {
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [isUploadingStamp, setIsUploadingStamp] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(user.signature_url || '');
  const [stampUrl, setStampUrl] = useState(user.stamp_url || '');
  const [uploadSuccess, setUploadSuccess] = useState<'signature' | 'stamp' | null>(null);
  const { toast } = useToast();

  const canUploadSignatures = ['manager', 'admin', 'supervisor'].includes(
    String(user.role || '').toLowerCase()
  );

  const handleFileUpload = async (file: File, type: 'signature' | 'stamp') => {
    // Set loading state based on type
    if (type === 'signature') {
      setIsUploadingSignature(true);
    } else {
      setIsUploadingStamp(true);
    }
    
    setUploadSuccess(null);
    
    try {
      const result = await apiClient.uploadFile(file, 3, 'signatures');
      const uploadedUrl = result.url || result.file?.url;

      if (!uploadedUrl) {
        throw new Error('لم يتم الحصول على رابط الملف');
      }

      // Get signed URL for immediate preview
      let displayUrl = uploadedUrl;
      if (uploadedUrl) {
        try {
          const urlObj = new URL(uploadedUrl);
          let pathname = urlObj.pathname.replace(/^\//, '');
          const bucket = 'zaco';
          if (pathname.startsWith(bucket + '/')) {
            pathname = pathname.slice(bucket.length + 1);
          }
          const signedResponse = await apiClient.getSignedUrl(pathname);
          displayUrl = signedResponse.url;
        } catch (err) {
          console.warn('Failed to get signed URL:', err);
        }
      }

      // Update user profile with new signature/stamp
      const updateData = type === 'signature' 
        ? { signature_url: uploadedUrl }
        : { stamp_url: uploadedUrl };
      
      await apiClient.updateUser(user.id, updateData);

      // Update local state with signed URL
      if (type === 'signature') {
        setSignatureUrl(displayUrl);
      } else {
        setStampUrl(displayUrl);
      }

      // Show success indicator
      setUploadSuccess(type);
      
      toast({
        title: '✅ تم الرفع بنجاح',
        description: `تم رفع ${type === 'signature' ? 'التوقيع الشخصي' : 'ختم القسم'} وحفظه بنجاح`
      });

      // Refresh parent component
      onUpdate();
      
      // Clear success indicator after 3 seconds
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: '❌ فشل الرفع',
        description: error.message || `فشل رفع ${type === 'signature' ? 'التوقيع' : 'الختم'}. حاول مرة أخرى`,
        variant: 'destructive'
      });
    } finally {
      if (type === 'signature') {
        setIsUploadingSignature(false);
      } else {
        setIsUploadingStamp(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-100 rounded-2xl">
                <User size={32} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">الملف الشخصي</h2>
                <p className="text-sm text-slate-500 font-bold mt-1">إدارة بياناتك والتوقيع والختم</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* User Info */}
          <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <User size={18} className="text-slate-400" />
              <div>
                <div className="text-xs text-slate-400 font-bold">الاسم الكامل</div>
                <div className="text-lg font-black text-slate-900">{user.full_name || user.username}</div>
              </div>
            </div>
            {user.email && (
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-slate-400" />
                <div>
                  <div className="text-xs text-slate-400 font-bold">البريد الإلكتروني</div>
                  <div className="text-lg font-black text-slate-900">{user.email}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-slate-400" />
              <div>
                <div className="text-xs text-slate-400 font-bold">الدور الوظيفي</div>
                <div className="text-lg font-black text-slate-900">
                  {user.role === 'admin' ? 'مدير نظام' :
                   user.role === 'manager' ? 'مدير تنفيذي' :
                   user.role === 'supervisor' ? 'مدير مباشر' : 'مستخدم عادي'}
                </div>
              </div>
            </div>
          </div>

          {/* Signature & Stamp Upload - Only for Managers/Supervisors/Admins */}
          {canUploadSignatures && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-slate-700 font-black text-sm">
                <FileSignature size={20} />
                <span>التوقيع والختم</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Signature */}
                <div className="bg-slate-50 p-6 rounded-2xl space-y-4 relative">
                  {uploadSuccess === 'signature' && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold animate-pulse">
                      ✓ تم الرفع
                    </div>
                  )}
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    التوقيع الشخصي
                  </div>
                  {signatureUrl ? (
                    <div className="bg-white p-4 rounded-xl border-2 border-green-200 shadow-sm">
                      <img
                        src={signatureUrl}
                        alt="التوقيع"
                        className="h-20 w-full object-contain"
                        key={signatureUrl} // Force re-render on URL change
                      />
                    </div>
                  ) : (
                    <div className="bg-white p-4 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center h-28">
                      <p className="text-sm text-slate-400 font-bold">لا يوجد توقيع</p>
                    </div>
                  )}
                  <label className={`cursor-pointer flex items-center justify-center gap-3 p-4 rounded-xl font-bold transition-all ${
                    isUploadingSignature 
                      ? 'bg-blue-400 cursor-wait' 
                      : signatureUrl 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                  } text-white`}>
                    <Upload size={18} className={isUploadingSignature ? 'animate-bounce' : ''} />
                    {isUploadingSignature ? 'جارٍ الرفع...' : signatureUrl ? 'تغيير التوقيع' : 'رفع توقيع'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingSignature}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'signature');
                      }}
                    />
                  </label>
                  <p className="text-xs text-slate-500 text-center">
                    يفضل صورة شفافة (PNG) بخلفية بيضاء
                  </p>
                </div>

                {/* Stamp */}
                <div className="bg-slate-50 p-6 rounded-2xl space-y-4 relative">
                  {uploadSuccess === 'stamp' && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold animate-pulse">
                      ✓ تم الرفع
                    </div>
                  )}
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    ختم القسم
                  </div>
                  {stampUrl ? (
                    <div className="bg-white p-4 rounded-xl border-2 border-green-200 shadow-sm">
                      <img
                        src={stampUrl}
                        alt="الختم"
                        className="h-20 w-full object-contain"
                        key={stampUrl} // Force re-render on URL change
                      />
                    </div>
                  ) : (
                    <div className="bg-white p-4 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center h-28">
                      <p className="text-sm text-slate-400 font-bold">لا يوجد ختم</p>
                    </div>
                  )}
                  <label className={`cursor-pointer flex items-center justify-center gap-3 p-4 rounded-xl font-bold transition-all ${
                    isUploadingStamp 
                      ? 'bg-indigo-400 cursor-wait' 
                      : stampUrl 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-indigo-600 hover:bg-indigo-700'
                  } text-white`}>
                    <Stamp size={18} className={isUploadingStamp ? 'animate-bounce' : ''} />
                    {isUploadingStamp ? 'جارٍ الرفع...' : stampUrl ? 'تغيير الختم' : 'رفع ختم'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingStamp}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'stamp');
                      }}
                    />
                  </label>
                  <p className="text-xs text-slate-500 text-center">
                    يفضل صورة شفافة (PNG) بخلفية بيضاء
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
