import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, CheckCircle2, XCircle, Clock, 
  ChevronLeft, Upload, FileSignature, Stamp, 
  AlertCircle, Download, Eye, PenTool, Save
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useToast } from '../hooks/use-toast';
import { User, ApprovalRequest } from '../types';
import ApprovalSigner from './ApprovalSigner';
import { useI18n } from '../lib/i18n-context';

interface ApprovalsProps {
  currentUser: User;
}

export default function Approvals({ currentUser }: ApprovalsProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'my-requests' | 'for-approval'>('my-requests');
  const [myRequests, setMyRequests] = useState<ApprovalRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  
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
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    fetchManagers();
    fetchNotifications();
  }, [activeTab]);

  // Fetch signed URL when sign modal opens
  useEffect(() => {
    const fetchPreviewUrl = async () => {
      if (showSignModal && selectedRequest) {
        try {
          const { url } = await apiClient.getApprovalAttachmentUrl(selectedRequest.id);
          setPreviewUrl(url);
        } catch (error) {
          console.error('Failed to fetch preview URL:', error);
          toast({ title: t('new.key.1faeys'), description: t('new.key.vpn4ha'), variant: "destructive" });
        }
      }
    };
    fetchPreviewUrl();
  }, [showSignModal, selectedRequest]);

  const fetchNotifications = async () => {
    try {
      const data = await apiClient.getApprovalsNotificationCount();
      setNotificationCount(data?.count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'my-requests') {
        const data = await apiClient.getMyApprovalRequests();
        setMyRequests(data || []);
        
        // Mark all non-pending requests as seen
        const unseenRequests = (data || []).filter((r: ApprovalRequest) => r.status !== 'PENDING');
        for (const req of unseenRequests) {
          try {
            await apiClient.markApprovalAsSeen(req.id);
          } catch (err) {
            // Ignore errors (column might not exist yet)
          }
        }
        
        // Refresh notification count after marking as seen
        fetchNotifications();
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
      const myRole = String(currentUser.role || '').toLowerCase();
      
      // If user is admin/manager/supervisor, show all managers
      if (['admin', 'manager', 'supervisor'].includes(myRole)) {
        const users = await apiClient.getManagers();
        setManagers(users.filter(u => String(u.id) !== String(currentUser.id)));
      } else {
        // Regular users: only show their assigned manager (from manager_id)
        if (currentUser.manager_id) {
          const users = await apiClient.getManagers();
          const assignedManager = users.find(u => String(u.id) === String(currentUser.manager_id));
          setManagers(assignedManager ? [assignedManager] : []);
        } else {
          // No manager assigned
          setManagers([]);
        }
      }
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
        title: t('new.key.1faeys'), 
        description: t('new.key.pr4y0r'), 
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
      toast({ title: t('new.key.1faeys'), description: t('new.key.7v3omg'), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.attachment_url) {
      toast({ 
        title: t('approvals.alert'), 
        description: t('approvals.attach_file_first'), 
        variant: "destructive" 
      });
      return;
    }

    if (!newRequest.manager_id) {
      toast({ title: t('common.error'), description: t('approvals.select_manager_required'), variant: "destructive" });
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
      
      toast({ title: t('common.success'), description: t('approvals.submit_success') });
      setShowNewRequestForm(false);
      setNewRequest({ title: '', description: '', manager_id: currentUser.manager_id || '', attachment_url: '' });
      fetchData();
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || t('approvals.error_submit'), variant: "destructive" });
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
      
      toast({ title: t('approvals.status_rejected'), description: t('common.success') });
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchData();
    } catch (error: any) {
      toast({ title: t('common.error'), description: t('approvals.error_reject'), variant: "destructive" });
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
      
      toast({ title: t('approvals.status_approved'), description: t('common.success') });
      setShowSignModal(false);
      setSelectedRequest(null);
      fetchData();
    } catch (error: any) {
      toast({ title: t('common.error'), description: t('approvals.error_approve'), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t('approvals.title')}</h2>
          <p className="text-slate-500 mt-2 font-medium">{t('approvals.subtitle')}</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('my-requests')}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'my-requests' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t('approvals.my_requests')}
          </button>
          {(['manager', 'admin', 'supervisor'].includes(String(currentUser.role || '').toLowerCase())) && (
            <button
              onClick={() => setActiveTab('for-approval')}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'for-approval' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {t('approvals.for_approval')}
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
              <Plus size={18} /> {t('approvals.new_request')}
            </button>
          </div>

          {showNewRequestForm && (
            <form onSubmit={handleSubmitRequest} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900">{t('approvals.create_request')}</h3>
                <button type="button" onClick={() => setShowNewRequestForm(false)} className="text-slate-400 hover:text-red-500"><XCircle size={24}/></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">{t('approvals.request_title')}</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:bg-white focus:border focus:border-slate-900 transition-all"
                    value={newRequest.title}
                    onChange={e => setNewRequest({...newRequest, title: e.target.value})}
                    placeholder={t('approvals.request_title_placeholder')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">{t('approvals.responsible_manager')}</label>
                  {managers.length === 0 ? (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="text-amber-800 text-sm font-bold mb-2 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{t('approvals.no_manager_assigned')}</span>
                      </div>
                      <div className="text-amber-700 text-xs">
                        {t('approvals.contact_admin')}
                      </div>
                    </div>
                  ) : (
                    <select 
                      required
                      className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:bg-white focus:border focus:border-slate-900 transition-all appearance-none"
                      value={newRequest.manager_id}
                      onChange={e => setNewRequest({...newRequest, manager_id: e.target.value})}
                    >
                      <option value="">{t('approvals.select_manager')}</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.id}>{m.full_name || m.username}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-slate-500">{t('approvals.request_details')}</label>
                  <textarea 
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:bg-white focus:border focus:border-slate-900 transition-all min-h-[100px]"
                    value={newRequest.description}
                    onChange={e => setNewRequest({...newRequest, description: e.target.value})}
                    placeholder={t('approvals.request_details_placeholder')}
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-slate-500">{t('approvals.attachments')}</label>
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
                        {t('approvals.file_uploaded')}
                      </div>
                    ) : (
                      <div className="text-slate-400 font-bold flex flex-col items-center gap-2">
                        <Upload size={24} />
                        <span>{t('approvals.upload_file')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? t('approvals.submitting') : t('approvals.submit_request')}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 gap-4">
            {myRequests.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      req.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                      req.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {req.status === 'APPROVED' ? <CheckCircle2 size={24} /> :
                       req.status === 'REJECTED' ? <XCircle size={24} /> :
                       <Clock size={24} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-slate-900 text-lg">{req.title}</h4>
                        {req.approval_number && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-mono font-bold rounded-lg">
                            {req.approval_number}
                          </span>
                        )}
                      </div>
                      {req.description && (
                        <p className="text-sm text-slate-600 mb-2 line-clamp-2">{req.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock size={14} />
                          <span>{new Date(req.created_at).toLocaleString('en-GB', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</span>
                        </div>
                        <span className="text-slate-300">•</span>
                        <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                          <FileSignature size={14} />
                          <span>{t('approvals.directed_to')}: {req.manager?.full_name || t('approvals.unknown')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <div className={`px-4 py-2 rounded-xl text-xs font-black text-center flex-1 md:flex-none whitespace-nowrap ${
                      req.status === 'APPROVED' ? 'bg-green-50 text-green-700 border border-green-200' :
                      req.status === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200' :
                      'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {req.status === 'APPROVED' ? `✓ ${t('approvals.status_approved')}` :
                       req.status === 'REJECTED' ? `✕ ${t('approvals.status_rejected')}` :
                       `⏱ ${t('approvals.status_pending')}`}
                    </div>
                    
                    {req.status === 'APPROVED' && req.signed_attachment_url && (
                      <button
                        onClick={async () => {
                          try {
                            // Extract R2 key and get signed URL
                            const url = req.signed_attachment_url;
                            if (!url) {
                              toast({ 
                                title: t('approvals.error'), 
                                description: t('approvals.no_signed_file'), 
                                variant: "destructive" 
                              });
                              return;
                            }
                            
                            let key = '';
                            
                            if (url.includes('r2.cloudflarestorage.com')) {
                              const urlObj = new URL(url);
                              let pathname = urlObj.pathname.replace(/^\//, '');
                              const bucket = 'mdlbeast';
                              if (pathname.startsWith(bucket + '/')) {
                                pathname = pathname.slice(bucket.length + 1);
                              }
                              key = pathname;
                            } else {
                              key = url;
                            }
                            
                            // Get signed URL
                            const { url: signedUrl } = await apiClient.getSignedUrl(key);
                            
                            // Open in new tab
                            window.open(signedUrl, '_blank');
                          } catch (error) {
                            console.error('Failed to download:', error);
                            toast({ 
                              title: t('approvals.error'), 
                              description: t('approvals.download_failed'), 
                              variant: "destructive" 
                            });
                          }
                        }}
                        className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                        title={t('approvals.download_signed')}
                      >
                        <Download size={18} />
                      </button>
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
                        title={t('approvals.edit_and_resend')}
                      >
                        <PenTool size={18} />
                      </button>
                    )}
                  </div>
                </div>
                
                {req.status === 'REJECTED' && req.rejection_reason && (
                  <div className="w-full bg-red-50 p-4 rounded-2xl text-xs font-bold text-red-700 mt-4">
                    {t('approvals.rejection_reason')}: {req.rejection_reason}
                  </div>
                )}
              </div>
            ))}
            
            {myRequests.length === 0 && !isLoading && (
              <div className="text-center py-12 text-slate-400 font-medium">{t('approvals.no_previous_requests')}</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'for-approval' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {pendingApprovals.map(req => (
              <div key={req.id} className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-[2rem] border-2 border-blue-100 shadow-md hover:shadow-xl hover:border-blue-200 transition-all">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg">
                      <FileText size={26} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-black text-slate-900 text-xl">{req.title}</h4>
                        {req.approval_number && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-mono font-bold rounded-lg">
                            {req.approval_number}
                          </span>
                        )}
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-black rounded-full">{t('approvals.new')}</span>
                      </div>
                      {req.description && (
                        <p className="text-sm text-slate-600 mb-3 leading-relaxed">{req.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg">
                          <span className="text-lg">👤</span>
                          <span>{t('approvals.submitted_by')}: {req.requester?.full_name || t('approvals.unknown')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock size={14} />
                          <span>{new Date(req.created_at).toLocaleString('en-GB', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                    <button 
                      onClick={async () => {
                        try {
                          const { url } = await apiClient.getApprovalAttachmentUrl(req.id);
                          window.open(url, '_blank');
                        } catch (error) {
                          toast({ title: t('approvals.error'), description: t('approvals.preview_failed'), variant: "destructive" });
                        }
                      }}
                      className="flex-1 px-5 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye size={18} /> {t('approvals.preview_document')}
                    </button>
                    
                    <button 
                      onClick={() => {
                        setSelectedRequest(req);
                        setShowRejectModal(true);
                      }}
                      className="flex-1 px-5 py-3 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle size={18} /> {t('approvals.reject_request')}
                    </button>
                    
                    <button 
                      onClick={() => {
                        setSelectedRequest(req);
                        setShowSignModal(true);
                      }}
                      className="flex-1 px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <FileSignature size={18} /> {t('approvals.approve_and_sign')}
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
              <div className="text-center py-12 text-slate-400 font-medium">{t('approvals.no_pending_requests')}</div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-slate-900 mb-4">{t('approvals.reject_request')}</h3>
            <p className="text-slate-500 text-sm font-bold mb-4">{t('approvals.provide_rejection_reason')}</p>
            
            <textarea 
              className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:bg-white focus:border focus:border-slate-900 transition-all min-h-[120px] mb-6"
              placeholder={t('approvals.rejection_reason_placeholder')}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
            />
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                {t('approvals.cancel')}
              </button>
              <button 
                onClick={handleReject}
                disabled={!rejectionReason}
                className="flex-1 py-4 rounded-2xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {t('approvals.confirm_reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Signer Modal */}
      {showSignModal && selectedRequest && (
        <ApprovalSigner
          approvalId={selectedRequest.id}
          approvalTitle={selectedRequest.title}
          approvalDescription={selectedRequest.description}
          attachmentUrl={selectedRequest.attachment_url}
          signatureUrl={selectedRequest.manager?.signature_url || currentUser.signature_url}
          stampUrl={selectedRequest.manager?.stamp_url || currentUser.stamp_url}
          onSuccess={() => {
            setShowSignModal(false);
            setSelectedRequest(null);
            fetchData();
          }}
          onCancel={() => setShowSignModal(false)}
        />
      )}
    </div>
  );
}
