import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, CheckCircle2, XCircle, Clock, 
  ChevronLeft, Upload, FileSignature, Stamp, 
  AlertCircle, Download, Eye, PenTool, Save
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useToast } from '../hooks/use-toast';
import { User, ApprovalRequest } from '../types';

interface ApprovalsProps {
  currentUser: User;
  tenantSignatureUrl?: string;
}

export default function Approvals({ currentUser, tenantSignatureUrl }: ApprovalsProps) {
  const [activeTab, setActiveTab] = useState<'my-requests' | 'for-approval'>('my-requests');
  const [myRequests, setMyRequests] = useState<ApprovalRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  
  // New Request State
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    manager_id: currentUser.manager_id || '',
    attachment_url: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [managers, setManagers] = useState<User[]>([]);

  // Approval State
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    fetchManagers();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'my-requests') {
        const data = await apiClient.getMyApprovalRequests();
        setMyRequests(data || []);
      } else {
        const data = await apiClient.getPendingApprovals();
        setPendingApprovals(data || []);
      }
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      // Use dedicated managers endpoint (available for all authenticated users)
      const users = await apiClient.getManagers();
      setManagers(users.filter(u => String(u.id) !== String(currentUser.id)));
    } catch (error) {
      console.error('Error fetching managers:', error);
      setManagers([]);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ 
        title: "خطأ", 
        description: "حجم الملف أكبر من 50 ميجابايت", 
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiClient.uploadFile(file, 3, 'approvals');
      setNewRequest(prev => ({ ...prev, attachment_url: result.url || result.file?.url }));
      toast({ title: "تم الرفع", description: "تم رفع الملف بنجاح" });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل رفع الملف", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.manager_id) {
      toast({ title: "تنبيه", description: "يرجى اختيار المدير", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await apiClient.createApprovalRequest({
        title: newRequest.title,
        description: newRequest.description,
        attachment_url: newRequest.attachment_url,
        manager_id: Number(newRequest.manager_id)
      });
      
      toast({ title: "تم بنجاح", description: "تم إرسال الطلب للاعتماد" });
      setShowNewRequestForm(false);
      setNewRequest({ title: '', description: '', manager_id: currentUser.manager_id || '', attachment_url: '' });
      fetchData();
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message || "فشل إرسال الطلب", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason) return;
    
    setIsSubmitting(true);
    try {
      await apiClient.updateApprovalRequest(selectedRequest.id, {
        status: 'REJECTED',
        rejection_reason: rejectionReason
      });
      
      toast({ title: "تم الرفض", description: "تم رفض الطلب بنجاح" });
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchData();
    } catch (error: any) {
      toast({ title: "خطأ", description: "فشل رفض الطلب", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    setIsSubmitting(true);
    try {
      await apiClient.updateApprovalRequest(selectedRequest.id, {
        status: 'APPROVED'
      });
      
      toast({ title: "تم الاعتماد", description: "تم اعتماد الطلب وتوقيعه بنجاح" });
      setShowSignModal(false);
      setSelectedRequest(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "خطأ", description: "فشل اعتماد الطلب", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">نظام الإعتمادات</h2>
          <p className="text-slate-500 mt-2 font-medium">إدارة الطلبات والموافقات الرسمية</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('my-requests')}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'my-requests' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            طلباتي
          </button>
          {(['manager', 'admin', 'supervisor'].includes(String(currentUser.role || '').toLowerCase())) && (
            <button
              onClick={() => setActiveTab('for-approval')}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'for-approval' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              للاعتماد
              {pendingApprovals.length > 0 && (
                <span className="mr-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingApprovals.length}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'my-requests' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => setShowNewRequestForm(true)}
              className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
            >
              <Plus size={18} /> طلب جديد
            </button>
          </div>

          {showNewRequestForm && (
            <form onSubmit={handleSubmitRequest} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900">إنشاء طلب جديد</h3>
                <button type="button" onClick={() => setShowNewRequestForm(false)} className="text-slate-400 hover:text-red-500"><XCircle size={24}/></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">عنوان الطلب</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:bg-white focus:border focus:border-slate-900 transition-all"
                    value={newRequest.title}
                    onChange={e => setNewRequest({...newRequest, title: e.target.value})}
                    placeholder="مثال: طلب إجازة، اعتماد مستند..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">المدير المسؤول</label>
                  {managers.length === 0 ? (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="text-amber-800 text-sm font-bold mb-2 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>لا يوجد مديرون متاحون</span>
                      </div>
                      <div className="text-amber-700 text-xs">
                        يرجى التواصل مع الإدارة لإعداد المديرين في النظام.
                      </div>
                    </div>
                  ) : (
                    <select 
                      required
                      className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:bg-white focus:border focus:border-slate-900 transition-all appearance-none"
                      value={newRequest.manager_id}
                      onChange={e => setNewRequest({...newRequest, manager_id: e.target.value})}
                    >
                      <option value="">اختر المدير...</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.id}>{m.full_name || m.username}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-slate-500">تفاصيل الطلب</label>
                  <textarea 
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:bg-white focus:border focus:border-slate-900 transition-all min-h-[100px]"
                    value={newRequest.description}
                    onChange={e => setNewRequest({...newRequest, description: e.target.value})}
                    placeholder="اكتب تفاصيل الطلب هنا..."
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-slate-500">المرفقات (PDF أو صورة)</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors relative">
                    <input 
                      type="file" 
                      accept=".pdf,image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                    {newRequest.attachment_url ? (
                      <div className="flex items-center justify-center gap-2 text-green-600 font-bold">
                        <CheckCircle2 size={20} />
                        تم رفع الملف بنجاح
                      </div>
                    ) : (
                      <div className="text-slate-400 font-bold flex flex-col items-center gap-2">
                        <Upload size={24} />
                        <span>اضغط لرفع الملف أو اسحبه هنا</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isSubmitting || !newRequest.attachment_url}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'جارٍ الإرسال...' : 'إرسال الطلب'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 gap-4">
            {myRequests.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    req.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                    req.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {req.status === 'APPROVED' ? <CheckCircle2 size={24} /> :
                     req.status === 'REJECTED' ? <XCircle size={24} /> :
                     <Clock size={24} />}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-lg">{req.title}</h4>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-400 mt-1">
                      <span>{new Date(req.created_at).toLocaleDateString('ar-SA')}</span>
                      <span>•</span>
                      <span>موجه إلى: {req.manager?.full_name || 'غير معروف'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className={`px-4 py-2 rounded-xl text-xs font-black text-center flex-1 md:flex-none ${
                    req.status === 'APPROVED' ? 'bg-green-50 text-green-700' :
                    req.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {req.status === 'APPROVED' ? 'تم الاعتماد' :
                     req.status === 'REJECTED' ? 'مرفوض' :
                     'قيد المراجعة'}
                  </div>
                  
                  {req.status === 'APPROVED' && req.signed_attachment_url && (
                    <a 
                      href={req.signed_attachment_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                      title="تحميل الملف المعتمد"
                    >
                      <Download size={18} />
                    </a>
                  )}

                  {req.status === 'REJECTED' && (
                    <button 
                      onClick={() => {
                        // Handle edit logic (populate form with this request)
                        setNewRequest({
                          title: req.title,
                          description: req.description || '',
                          manager_id: String(req.manager_id),
                          attachment_url: req.attachment_url
                        });
                        setShowNewRequestForm(true);
                      }}
                      className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                      title="تعديل وإعادة إرسال"
                    >
                      <PenTool size={18} />
                    </button>
                  )}
                </div>
                
                {req.status === 'REJECTED' && req.rejection_reason && (
                  <div className="w-full bg-red-50 p-4 rounded-2xl text-xs font-bold text-red-700 mt-2 md:mt-0">
                    سبب الرفض: {req.rejection_reason}
                  </div>
                )}
              </div>
            ))}
            
            {myRequests.length === 0 && !isLoading && (
              <div className="text-center py-12 text-slate-400 font-medium">لا توجد طلبات سابقة</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'for-approval' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {pendingApprovals.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-lg">{req.title}</h4>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-400 mt-1">
                        <span>مقدم الطلب: {req.requester?.full_name || 'غير معروف'}</span>
                        <span>•</span>
                        <span>{new Date(req.created_at).toLocaleDateString('ar-SA')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <a 
                      href={req.attachment_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
                    >
                      <Eye size={16} /> معاينة
                    </a>
                    
                    <button 
                      onClick={() => {
                        setSelectedRequest(req);
                        setShowRejectModal(true);
                      }}
                      className="px-4 py-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                    >
                      <XCircle size={16} /> رفض
                    </button>
                    
                    <button 
                      onClick={() => {
                        setSelectedRequest(req);
                        setShowSignModal(true);
                      }}
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg shadow-slate-200"
                    >
                      <FileSignature size={16} /> اعتماد وتوقيع
                    </button>
                  </div>
                </div>
                
                {req.description && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-sm text-slate-600 font-medium">
                    {req.description}
                  </div>
                )}
              </div>
            ))}
            
            {pendingApprovals.length === 0 && !isLoading && (
              <div className="text-center py-12 text-slate-400 font-medium">لا توجد طلبات بانتظار الاعتماد</div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-slate-900 mb-4">رفض الطلب</h3>
            <p className="text-slate-500 text-sm font-bold mb-4">يرجى ذكر سبب الرفض للموظف</p>
            
            <textarea 
              className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:bg-white focus:border focus:border-slate-900 transition-all min-h-[120px] mb-6"
              placeholder="سبب الرفض..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
            />
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={handleReject}
                disabled={!rejectionReason}
                className="flex-1 py-4 rounded-2xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Modal (Simplified for now) */}
      {showSignModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-2xl animate-in zoom-in-95 duration-300 h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">اعتماد وتوقيع</h3>
                <p className="text-slate-500 text-sm font-bold">سيتم إضافة التوقيع على المستند (توقيع المؤسسة/توقيعك) حسب المتوفر</p>
              </div>
              <button onClick={() => setShowSignModal(false)} className="text-slate-400 hover:text-red-500"><XCircle size={24}/></button>
            </div>
            
            <div className="flex-1 bg-slate-100 rounded-2xl overflow-hidden relative mb-6 flex items-center justify-center border border-slate-200">
              {/* Placeholder for PDF/Image Viewer & Canvas */}
              <div className="text-center p-8">
                <FileSignature size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-bold">معاينة المستند والتوقيع</p>
                <p className="text-xs text-slate-400 mt-2">في النسخة الكاملة، سيظهر هنا المستند مع إمكانية سحب وإفلات التوقيع</p>
                
                <div className="mt-8 flex justify-center gap-4">
                  {tenantSignatureUrl && (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <img src={tenantSignatureUrl} alt="Tenant Signature" className="h-12 object-contain" />
                      <p className="text-[10px] text-center mt-2 text-slate-400 font-bold">توقيع المؤسسة</p>
                    </div>
                  )}
                  {currentUser.signature_url && (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <img src={currentUser.signature_url} alt="Signature" className="h-12 object-contain" />
                      <p className="text-[10px] text-center mt-2 text-slate-400 font-bold">توقيعك</p>
                    </div>
                  )}
                  {currentUser.stamp_url && (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <img src={currentUser.stamp_url} alt="Stamp" className="h-12 object-contain" />
                      <p className="text-[10px] text-center mt-2 text-slate-400 font-bold">الختم</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={handleApprove}
                className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
              >
                <CheckCircle2 size={20} /> تأكيد الاعتماد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
