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
  const [isUploading, setIsUploading] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(user.signature_url || '');
  const [stampUrl, setStampUrl] = useState(user.stamp_url || '');
  const { toast } = useToast();

  const canUploadSignatures = ['manager', 'admin', 'supervisor'].includes(
    String(user.role || '').toLowerCase()
  );

  const handleFileUpload = async (file: File, type: 'signature' | 'stamp') => {
    setIsUploading(true);
    try {
      const result = await apiClient.uploadFile(file, 3, 'signatures');
      const uploadedUrl = result.url || result.file?.url;

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
      await apiClient.updateUser(user.id, {
        [type === 'signature' ? 'signature_url' : 'stamp_url']: uploadedUrl
      });

      if (type === 'signature') {
        setSignatureUrl(displayUrl);
      } else {
        setStampUrl(displayUrl);
      }

      toast({
        title: '✅ تم الرفع بنجاح',
        description: `تم رفع ${type === 'signature' ? 'التوقيع' : 'الختم'} وحفظه`
      });

      onUpdate();
    } catch (error: any) {
      toast({
        title: '❌ خطأ',
        description: error.message || 'فشل رفع الملف',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
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
                <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    التوقيع الشخصي
                  </div>
                  {signatureUrl && (
                    <div className="bg-white p-4 rounded-xl border-2 border-slate-200">
                      <img
                        src={signatureUrl}
                        alt="التوقيع"
                        className="h-20 w-full object-contain"
                      />
                    </div>
                  )}
                  <label className="cursor-pointer flex items-center justify-center gap-3 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">
                    <Upload size={18} />
                    {isUploading ? 'جارٍ الرفع...' : signatureUrl ? 'تغيير التوقيع' : 'رفع توقيع'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
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
                <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    ختم القسم
                  </div>
                  {stampUrl && (
                    <div className="bg-white p-4 rounded-xl border-2 border-slate-200">
                      <img
                        src={stampUrl}
                        alt="الختم"
                        className="h-20 w-full object-contain"
                      />
                    </div>
                  )}
                  <label className="cursor-pointer flex items-center justify-center gap-3 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors">
                    <Stamp size={18} />
                    {isUploading ? 'جارٍ الرفع...' : stampUrl ? 'تغيير الختم' : 'رفع ختم'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
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
