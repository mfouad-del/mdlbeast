import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, FilePlus, FileMinus, Search, Scan,
  Users, Briefcase, LogOut, Trash2, Building2, Plus, Lock,
  AlertCircle, DownloadCloud, UploadCloud, Database, RefreshCcw, ShieldCheck, Edit3, X, Check, Menu, FileSignature,
  ChevronDown, FolderOpen, CreditCard, FileText, BarChart3, Settings, DollarSign
} from 'lucide-react';
import { DocType, Correspondence, DocStatus, SystemSettings, User } from './types';
import { apiClient } from './lib/api-client';
import Dashboard from './components/Dashboard';
import DocumentForm from './components/DocumentForm';
import ChangePassword from './components/ChangePassword';
import DocumentList from './components/DocumentList';
import BarcodeScanner from './components/BarcodeScanner';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import AdminStatus from './components/AdminStatus';
import AsyncButton from './components/ui/async-button'
import { LoadingProvider } from './components/ui/loading-context'
import AdminBackups from './components/AdminBackups';
import Approvals from './components/Approvals';
import UserProfile from './components/UserProfile';
import UserSettingsModal from './components/UserSettingsModal';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [docs, setDocs] = useState<Correspondence[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['documents', 'system']);

  // Restore active tab from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('mdlbeast_active_tab');
      if (savedTab && savedTab !== activeTab) {
        setActiveTab(savedTab);
      }
    }
  }, []);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mdlbeast_active_tab', activeTab);
    }
  }, [activeTab]);
  
  const [settings] = useState<SystemSettings>({
    primaryColor: '#0f172a',
    footerText: 'MDLBEAST Communications Center - جميع الحقوق محفوظة © 2026',
    showStamp: true,
    companies: []
  });

  const [globalError, setGlobalError] = useState<string | null>(null);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Documents (global list)
      const fetchedDocsRes = await apiClient.getDocuments({ limit: 50 }).catch((e) => { console.warn('Documents fetch failed', e); return { data: [] } as any })
      const fetchedDocs = fetchedDocsRes.data || []
      setPagination({ page: 1, limit: 50, total: fetchedDocsRes.meta?.total || 0 })

      const normalized = (fetchedDocs || []).map((d: any) => ({
        id: d.id,
        barcode: d.barcode || d.barcode_id || '',
        type: (String(d.type || '').toLowerCase().startsWith('in') || String(d.type) === 'وارد') ? DocType.INCOMING : DocType.OUTGOING,
        title: d.subject || d.title || '',
        sender: d.sender || '',
        receiver: d.receiver || d.recipient || '',
        recipient: d.receiver || d.recipient || '',
        referenceNumber: d.referenceNumber || '',
        internalRef: d.internalRef || '',
        documentDate: d.date || '',
        archiveDate: d.archived_at || '',
        date: d.date ? d.date.split('T')?.[0] : (d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : ''),
        subject: d.subject || '',
        description: d.description || d.notes || '',
        status: d.status || '',
        security: d.security || '',
        // Normalize DB priority labels to new frontend labels ('عادي' -> 'عاديه', 'عاجل' -> 'عاجله')
        priority: (d.priority === 'عادي') ? 'عاديه' : (d.priority === 'عاجل') ? 'عاجله' : (d.priority === 'عاجل جداً' ? 'عاجل' : (d.priority || '')),
        category: d.category || '',
        physicalLocation: d.physical_location || '',
        attachmentCount: Array.isArray(d.attachments) ? d.attachments.length : 0,
        attachments: d.attachments || [],
        signatory: d.signatory || '',
        tags: d.tags || [],
        created_at: d.created_at ? new Date(d.created_at) : new Date(),
        createdBy: d.created_by || d.createdBy || '',
        pdfFile: d.pdf || d.pdfFile || undefined,
        user_id: d.user_id || null,
        updated_at: d.updated_at ? new Date(d.updated_at) : new Date(),
        notes: d.notes || ''
      }))
      setDocs(normalized as any);


      // Users (requires admin/auth)
      const fetchedUsers = await apiClient.getUsers().catch((e) => { console.warn('Users fetch failed', e); return [] as any[] })
      setUsers(fetchedUsers);
    } catch (e) {
      console.error("Sync error", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('mdlbeast_session_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));

    // If user token exists, try to fetch current user and then load data
    const tryInit = async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const u = await apiClient.getCurrentUser().then(u => u).catch(() => null)
        if (u) {
          setCurrentUser(u)
          await loadInitialData()
        }
      } catch (_e) {
        // Ignore initialization errors
      } finally {
        setIsLoading(false)
      }
    }
    tryInit();

    // If the app is served under /archive static export and someone navigated to /archive/dashboard
    // some static hosts require /index.html to be present; auto-redirect to the index.html fallback so page loads correctly.
    try {
      if (typeof window !== 'undefined') {
        const p = window.location.pathname || ''
        if (p.endsWith('/archive/dashboard') && !p.endsWith('/index.html')) {
          window.location.replace(p + '/index.html')
        }
      }
    } catch (e) {
      // ignore
    }

    // Global error handlers to capture unexpected script/runtime errors and show a simple banner
    const onError = (ev: ErrorEvent) => {
      console.error('Global error captured', ev.error || ev.message || ev);
      setGlobalError(String(ev.message || ev.error || 'خطأ غير متوقع في الواجهة'));
      setTimeout(() => setGlobalError(null), 6000);
    }
    const onRejection = (ev: PromiseRejectionEvent) => {
      console.error('Unhandled rejection', ev.reason);
      setGlobalError(String(ev.reason?.message || ev.reason || 'خطأ غير متوقع في الواجهة'));
      setTimeout(() => setGlobalError(null), 6000);
    }
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); }
  }, []);

  const refreshDocuments = async (filters?: any) => {
    try {
      const page = filters?.page || 1
      const fetchedDocsRes = await apiClient.getDocuments({ limit: 50, page, ...filters }).catch(() => ({ data: [] } as any))
      const fetchedDocs = fetchedDocsRes.data || []
      setPagination({ page, limit: 50, total: fetchedDocsRes.meta?.total || 0 })
      
      const normalized = (fetchedDocs || []).map((d: any) => ({
        id: d.id,
        barcode: d.barcode || d.barcode_id || '',
        type: (String(d.type || '').toLowerCase().startsWith('in') || String(d.type) === 'وارد') ? DocType.INCOMING : DocType.OUTGOING,
        title: d.subject || d.title || '',
        sender: d.sender || '',
        receiver: d.receiver || d.recipient || '',
        recipient: d.receiver || d.recipient || '',
        referenceNumber: d.referenceNumber || '',
        internalRef: d.internalRef || '',
        documentDate: d.date || '',
        archiveDate: d.archived_at || '',
        date: d.date ? d.date.split('T')?.[0] : (d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : ''),
        subject: d.subject || '',
        description: d.description || d.notes || '',
        status: d.status || '',
        security: d.security || '',
        priority: (d.priority === 'عادي') ? 'عاديه' : (d.priority === 'عاجل') ? 'عاجله' : (d.priority === 'عاجل جداً' ? 'عاجل' : (d.priority || '')),
        category: d.category || '',
        physicalLocation: d.physical_location || '',
        attachmentCount: Array.isArray(d.attachments) ? d.attachments.length : 0,
        attachments: d.attachments || [],
        signatory: d.signatory || '',
        tags: d.tags || [],
        created_at: d.created_at ? new Date(d.created_at) : new Date(),
        createdBy: d.created_by || d.createdBy || '',
        pdfFile: d.pdf || d.pdfFile || undefined,
        user_id: d.user_id || null,
        updated_at: d.updated_at ? new Date(d.updated_at) : new Date(),
        notes: d.notes || ''
      }))
      setDocs(normalized as any)
    } catch (e) {
      console.error('Refresh documents failed', e)
    }
  }

  const handleSaveDoc = async (data: any) => {
    // Do not set barcode client-side; backend will generate numeric sequence.
    const docToSave = {
      ...data,
      type: data.type,
      sender: data.sender,
      receiver: data.recipient || data.receiver,
      date: data.date || data.documentDate || new Date().toISOString(),
      subject: data.title || data.subject,
      priority: data.priority || 'عادي',
      status: data.status || (data.type === DocType.INCOMING ? 'وارد' : 'صادر'),
      attachments: data.pdfFile ? [data.pdfFile] : [],
    };

    try {
      const savedDoc = await apiClient.createDocument(docToSave);
      setDocs(prev => [savedDoc, ...prev]);
      setActiveTab('list');
    } catch (err: any) {
      console.error('Failed to save document', err);
      alert('فشل حفظ المعاملة: ' + (err?.message || 'تحقق من الاتصال والصلاحيات.'));
    }
  };

  const handleExportBackup = async () => {
    alert('Export via server is restricted to admins. Use the backup endpoint on the server or contact the administrator.');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    alert('Restore via the web UI is disabled. Use the server-side migration tools or contact the administrator to restore backups.');
  };

  if (!currentUser) return <Login onLogin={(u) => { setCurrentUser(u); localStorage.setItem('mdlbeast_session_user', JSON.stringify(u)); }} logoUrl='/mdlbeast/logo.png' />;

  const NavItem = ({ id, label, icon: Icon, adminOnly = false }: any) => {
    // Show admin-only items for users whose role is 'admin' (case-insensitive)
    if (adminOnly && String(currentUser?.role || '').toLowerCase() !== 'admin') return null;
    return (
      <button 
        onClick={() => setActiveTab(id)} 
        className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-black transition-all ${activeTab === id ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
      >
        <Icon size={18} /><span>{label}</span>
      </button>
    );
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const SidebarSection = ({ id, title, icon: Icon, children }: { id: string; title: string; icon: any; children: React.ReactNode }) => {
    const isExpanded = expandedSections.includes(id);
    return (
      <div className="mb-2">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-wider"
        >
          <div className="flex items-center gap-2">
            <Icon size={14} />
            <span>{title}</span>
          </div>
          <ChevronDown 
            size={14} 
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="space-y-1 pt-1 pr-2">
            {children}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      {/* User Settings Modal */}
      {currentUser && (
        <UserSettingsModal
          user={currentUser}
          isOpen={userSettingsOpen}
          onClose={() => setUserSettingsOpen(false)}
          onUpdate={(updatedUser) => {
            setCurrentUser(updatedUser);
            localStorage.setItem('mdlbeast_session_user', JSON.stringify(updatedUser));
          }}
        />
      )}
      
      <aside className="w-72 bg-white border-l border-slate-200 flex flex-col shrink-0 z-20 shadow-sm no-print h-full">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
           <div className="flex flex-col items-center text-center w-full">
             <img src='/mdlbeast/logo.png' className="h-16 w-auto mb-3 object-contain drop-shadow-sm hover:scale-105 transition-transform duration-300" alt="Logo" />
             <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.15em] leading-relaxed">مركز الإتصالات الإدارية</div>
           </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
          <NavItem id="dashboard" label="لوحة التحكم" icon={LayoutDashboard} />
          
          <SidebarSection id="documents" title="المراسلات" icon={FolderOpen}>
            <NavItem id="incoming" label="قيد وارد جديد" icon={FilePlus} />
            <NavItem id="outgoing" label="قيد صادر جديد" icon={FileMinus} />
            <NavItem id="list" label="الأرشيف والبحث" icon={Search} />
            <NavItem id="scanner" label="تتبع الباركود" icon={Scan} />
          </SidebarSection>
          
          <SidebarSection id="workflow" title="سير العمل" icon={FileSignature}>
            <NavItem id="approvals" label="نظام الإعتمادات" icon={FileSignature} />
          </SidebarSection>
          
          <div className="h-px bg-slate-100 my-3"></div>
          
          <SidebarSection id="system" title="إدارة النظام" icon={Settings}>
            <NavItem id="users" label="إدارة المستخدمين" icon={Users} adminOnly />
            <NavItem id="backup" label="النسخ الاحتياطي" icon={Database} adminOnly />
            <NavItem id="admin-status" label="حالة النظام" icon={AlertCircle} adminOnly />
          </SidebarSection>
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button onClick={() => { localStorage.removeItem('mdlbeast_session_user'); localStorage.removeItem('auth_token'); setCurrentUser(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black text-red-600 hover:bg-red-50 transition-all mb-3"><LogOut size={16} /> تسجيل الخروج</button>
          
          <button
            onClick={() => setUserSettingsOpen(true)}
            className="w-full p-3 bg-gradient-to-l from-slate-900 to-slate-800 rounded-2xl flex items-center gap-3 text-white shadow-xl hover:shadow-2xl transition-all group cursor-pointer"
          >
             <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center font-black text-sm overflow-hidden shrink-0 group-hover:bg-slate-600 transition-colors">
               {currentUser.avatar_url ? (
                 <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
               ) : (
                 currentUser.full_name?.substring(0, 1) || 'U'
               )}
             </div>
             <div className="overflow-hidden text-right flex-1">
               <div className="text-[11px] font-black truncate leading-tight">{currentUser.full_name}</div>
               <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{currentUser.role === 'admin' ? 'مدير نظام' : currentUser.role === 'manager' ? 'مدير تنفيذي' : currentUser.role === 'supervisor' ? 'مدير مباشر' : 'مستخدم'}</div>
             </div>
             <Settings size={14} className="text-slate-400 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
          </button>
          
          <a href="https://zaco.sa" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1.5 mt-4 opacity-50 hover:opacity-100 transition-all">
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Developed By</span>
            <img src="/dev.png" className="h-6 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-500" alt="Developer" />
          </a>
        </div>
      </aside>

      <LoadingProvider>
        <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-8 lg:p-14 max-w-7xl xl:max-w-none mx-auto w-full">
          {globalError && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-xl font-bold">{globalError}</div>
          )}
          {activeTab === 'dashboard' && <Dashboard docs={docs} />}
          {activeTab === 'incoming' && <DocumentForm type={DocType.INCOMING} onSave={handleSaveDoc} companies={[]} />}
          {activeTab === 'outgoing' && <DocumentForm type={DocType.OUTGOING} onSave={handleSaveDoc} companies={[]} />}
          {activeTab === 'list' && <DocumentList docs={docs} settings={{...settings, orgName: 'MDLBEAST', logoUrl: '/mdlbeast/logo.png', orgNameEn: 'MDLBEAST'}} currentUser={currentUser} users={users} onRefresh={refreshDocuments} pagination={pagination} /> }
          {activeTab === 'scanner' && <BarcodeScanner />}
          {activeTab === 'approvals' && <Approvals currentUser={currentUser} tenantSignatureUrl='' />}
          {activeTab === 'users' && <UserManagement users={users} onUpdateUsers={async () => { loadInitialData(); }} currentUserEmail={currentUser.email || currentUser.username || ''} />}
          {activeTab === 'admin-status' && <AdminStatus />}
          {activeTab === 'backup' && <AdminBackups />}
        </div>
        
        <footer className="p-8 bg-white border-t border-slate-100 text-center no-print">
           <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">{settings.footerText}</p>
        </footer>
      </main>
      </LoadingProvider>
    </div>
  );
};

export default App;
