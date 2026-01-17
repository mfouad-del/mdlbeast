import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, FilePlus, FileMinus, Search, Scan,
  Users, Briefcase, LogOut, Trash2, Building2, Plus, Lock,
  AlertCircle, DownloadCloud, UploadCloud, Database, RefreshCcw, ShieldCheck, Edit3, X, Check, Menu, FileSignature,
  ChevronDown, ChevronLeft, ChevronRight, FolderOpen, CreditCard, FileText, BarChart3, Settings, DollarSign, Stamp, Bell
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
import NotificationCenter from './components/NotificationCenter';
import InternalCommunication from './components/InternalCommunication';
import ReportGenerator from './components/ReportGenerator';
import AuditLogs from './components/AuditLogs';
import LanguageSwitcher from './components/LanguageSwitcher';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './components/ui/dropdown-menu'
import { useI18n } from './lib/i18n-context'

const App: React.FC = () => {
  const { t, dir } = useI18n()
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
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [notificationPreview, setNotificationPreview] = useState<any[]>([]);
  const [notificationPreviewLoading, setNotificationPreviewLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
  const [authChecked, setAuthChecked] = useState(false);

  const normalizeDoc = (d: any): Correspondence => ({
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
    date: d.date ? String(d.date).split('T')?.[0] : (d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : ''),
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
  } as any)

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Documents (global list)
      const fetchedDocsRes = await apiClient.getDocuments({ limit: 50 }).catch((e) => { console.warn('Documents fetch failed', e); return { data: [] } as any })
      const fetchedDocs = fetchedDocsRes.data || []
      setPagination({ page: 1, limit: 50, total: fetchedDocsRes.meta?.total || 0 })

      const normalized = (fetchedDocs || []).map(normalizeDoc)
      setDocs(normalized as any);


      // Users (requires admin/auth)
      const fetchedUsers = await apiClient.getUsers().catch((e) => { console.warn('Users fetch failed', e); return [] as any[] })
      setUsers(fetchedUsers);
      
      // Notifications count
      try {
        const notifRes = await apiClient.getNotifications({ limit: 100, offset: 0, unreadOnly: true })
        setNotificationCount((notifRes as any)?.data?.length || 0)
      } catch (e) { /* silently ignore */ }
    } catch (e) {
      console.error("Sync error", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return
    if (!showNotificationDropdown) return
    let alive = true
    setNotificationPreviewLoading(true)
    apiClient
      .getNotifications({ limit: 5, offset: 0, unreadOnly: true })
      .then((res) => {
        if (!alive) return
        setNotificationPreview((res as any)?.data || [])
      })
      .catch(() => {
        if (!alive) return
        setNotificationPreview([])
      })
      .finally(() => {
        if (!alive) return
        setNotificationPreviewLoading(false)
      })
    return () => {
      alive = false
    }
  }, [showNotificationDropdown, currentUser?.id])

  useEffect(() => {
    const savedUser = localStorage.getItem('mdlbeast_session_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));

    // Listen for session expiry (token invalid/expired)
    apiClient.onSessionExpired(() => {
      console.warn('[App] Session expired - forcing logout')
      setCurrentUser(null)
      localStorage.removeItem('mdlbeast_session_user')
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
    })

    // If user token exists, try to fetch current user and then load data
    const tryInit = async () => {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setIsLoading(false)
        setAuthChecked(true)
        return
      }

      try {
        const u = await apiClient.getCurrentUser()
        // If successful
        if (u) {
          setCurrentUser(u)
          await loadInitialData()
        }
      } catch (err: any) {
        // Only clear session if strictly 401/403 (Auth failed)
        // Ignore 429 (Rate Limit), 500 (Server Error) etc. to prevent auto-logout during storms
        if (err?.status === 401 || err?.status === 403) {
            console.warn('[App] Token invalid - logging out', err)
            setCurrentUser(null)
            localStorage.removeItem('mdlbeast_session_user')
        } else {
            console.error('[App] Init failed but keeping session (recoverable error)', err)
            // Restore user from local storage if available for offline/error mode
            const saved = localStorage.getItem('mdlbeast_session_user')
            if (saved) setCurrentUser(JSON.parse(saved))
        }
      } finally {
        setIsLoading(false)
        setAuthChecked(true)
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
      
      const normalized = (fetchedDocs || []).map(normalizeDoc)
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
      const normalized = normalizeDoc(savedDoc)
      setDocs(prev => [normalized as any, ...prev]);
      setPagination(prev => ({ ...prev, total: (prev.total || 0) + 1 }))
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

  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('auth_token')

  // Avoid showing Login briefly on refresh when a token exists; show a loading screen until auth check finishes.
  if (!currentUser) {
    if (hasToken && !authChecked) {
      return (
        <div className="min-h-[100dvh] bg-[#F8FAFC] flex items-center justify-center">
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-8 w-full max-w-md text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black">
              MD
            </div>
            <div className="mt-4 text-slate-900 font-black">جارِ التحقق من الجلسة...</div>
            <div className="mt-2 text-xs text-slate-500 font-bold">لن تحتاج لإعادة تسجيل الدخول</div>
            <div className="mt-6 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-2 w-1/2 bg-slate-900 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      )
    }

    return (
      <Login
        onLogin={(u) => {
          setCurrentUser(u)
          localStorage.setItem('mdlbeast_session_user', JSON.stringify(u))
          setAuthChecked(true)
        }}
        logoUrl='/mdlbeast/logo.png'
      />
    )
  }

  const NavItem = ({ id, label, icon: Icon, adminOnly = false }: any) => {
    // Show admin-only items for users whose role is 'admin' (case-insensitive)
    if (adminOnly && String(currentUser?.role || '').toLowerCase() !== 'admin') return null;
    return (
      <button 
        onClick={() => setActiveTab(id)} 
        title={isSidebarCollapsed ? label : ''}
        className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-5'} py-3.5 rounded-xl text-sm font-black transition-all ${activeTab === id ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
      >
        <Icon size={isSidebarCollapsed ? 20 : 18} />
        {!isSidebarCollapsed && <span>{label}</span>}
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

    if (isSidebarCollapsed) {
      return (
        <div className="mb-2 py-2 border-t border-slate-50">
          {children}
        </div>
      )
   }

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
    <div className="flex h-[100dvh] bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
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
      
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 w-[86vw] max-w-[320px] bg-white border-l border-slate-200 flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src='/mdlbeast/logo.png' className="h-10 w-auto object-contain" alt="Logo" />
                  <div className="text-xs font-black text-slate-700">MDLBEAST</div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} className="text-slate-700" />
                </button>
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar overflow-x-hidden">
              <button onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false) }} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-black transition-all ${activeTab === 'dashboard' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                <LayoutDashboard size={18} /> {t('nav.dashboard')}
              </button>

              <div className="mt-3">
                <div className="px-4 py-2 text-[11px] font-black text-slate-400 uppercase tracking-wider">{t('sidebar.adminComms')}</div>
                {([
                  ['incoming', t('nav.incoming'), FilePlus],
                  ['outgoing', t('nav.outgoing'), FileMinus],
                  ['list', t('nav.archive'), Search],
                  ['scanner', t('nav.scanner'), Scan],
                  ['reports', t('nav.reports'), BarChart3],
                ] as any[]).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => { setActiveTab(id); setMobileMenuOpen(false) }}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-black transition-all ${activeTab === id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    <Icon size={18} /> {label}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <div className="px-4 py-2 text-[11px] font-black text-slate-400 uppercase tracking-wider">{t('sidebar.workflow')}</div>
                {([
                  ['approvals', t('nav.approvals'), FileSignature],
                  ['internal', t('nav.internal'), FileText],
                ] as any[]).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    onClick={() => { setActiveTab(id); setMobileMenuOpen(false) }}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-black transition-all ${activeTab === id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    <Icon size={18} /> {label}
                  </button>
                ))}
              </div>
            </nav>

            <div className="p-4 border-t border-slate-200">
              <button
                onClick={() => { localStorage.removeItem('mdlbeast_session_user'); localStorage.removeItem('auth_token'); setCurrentUser(null); setMobileMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <LogOut size={18} /> {t('nav.logout')}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-white ${dir === 'rtl' ? 'border-l' : 'border-r'} border-slate-200 hidden md:flex flex-col shrink-0 z-20 shadow-sm no-print h-full transition-all duration-300 relative`}>
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`absolute ${dir === 'rtl' ? '-left-3' : '-right-3'} top-20 bg-white border border-slate-200 p-1 rounded-full shadow-md text-slate-500 hover:text-slate-900 z-50`}
        >
          {isSidebarCollapsed ? (
            dir === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />
          ) : (
            dir === 'rtl' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />
          )}
        </button>

        <div className={`p-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'py-6 px-2' : 'p-4'}`}>
           <div className="flex flex-col items-center text-center w-full">
             <img src='/mdlbeast/logo.png' className={`${isSidebarCollapsed ? 'h-8 w-auto' : 'w-48 h-auto max-w-[180px]'} mb-3 object-contain drop-shadow-sm hover:scale-105 transition-all duration-300`} alt="Logo" />
             {!isSidebarCollapsed && (
               <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.12em] leading-relaxed whitespace-nowrap">{t('sidebar.systemTitle')}</div>
             )}
           </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar overflow-x-hidden">
          <NavItem id="dashboard" label={t('nav.dashboard')} icon={LayoutDashboard} />
          
          <SidebarSection id="documents" title={t('sidebar.adminComms')} icon={FolderOpen}>
            <NavItem id="incoming" label={t('nav.incoming')} icon={FilePlus} />
            <NavItem id="outgoing" label={t('nav.outgoing')} icon={FileMinus} />
            <NavItem id="list" label={t('nav.archive')} icon={Search} />
            <NavItem id="scanner" label={t('nav.scanner')} icon={Scan} />
            <NavItem id="reports" label={t('nav.reports')} icon={BarChart3} />
          </SidebarSection>
          
          <SidebarSection id="workflow" title={t('sidebar.workflow')} icon={FileSignature}>
            <NavItem id="approvals" label={t('nav.approvals')} icon={FileSignature} />
            <NavItem id="internal" label={t('nav.internal')} icon={FileText} />
          </SidebarSection>
          
          <div className="h-px bg-slate-100 my-3"></div>
          {!isSidebarCollapsed && (
            <button onClick={() => { localStorage.removeItem('mdlbeast_session_user'); localStorage.removeItem('auth_token'); setCurrentUser(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black text-red-600 hover:bg-red-50 transition-all mb-3"><LogOut size={16} /> {t('nav.logout')}</button>
          )}
        </nav>

        {/* User Profile & Footer */}
        <div className="flex flex-col p-4 w-full border-t border-slate-800/50 mt-auto">
          <button
            onClick={() => setUserSettingsOpen(true)}
            title={isSidebarCollapsed ? currentUser.full_name : ''}
            className={`w-full ${isSidebarCollapsed ? 'p-2 justify-center' : 'p-3'} bg-gradient-to-l from-slate-900 to-slate-800 rounded-2xl flex items-center gap-3 text-white shadow-xl hover:shadow-2xl transition-all group cursor-pointer`}
          >
             <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center font-black text-sm overflow-hidden shrink-0 group-hover:bg-slate-600 transition-colors">
               {currentUser.avatar_url ? (
                 <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
               ) : (
                 currentUser.full_name?.substring(0, 1) || 'U'
               )}
             </div>
             {!isSidebarCollapsed && (
               <>
                 <div className="overflow-hidden text-right flex-1">
                   <div className="text-[11px] font-black truncate leading-tight">{currentUser.full_name}</div>
                   <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{currentUser.role === 'admin' ? t('role.admin') : currentUser.role === 'manager' ? t('role.manager') : currentUser.role === 'supervisor' ? t('role.supervisor') : t('role.member')}</div>
                 </div>
                 <Settings size={14} className="text-slate-400 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
               </>
             )}
          </button>
          
          {!isSidebarCollapsed && (
             <div className="mt-4 flex flex-col items-center justify-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Developed By</span>
                <a href="https://zaco.sa" target="_blank" rel="noopener noreferrer">
                   <img src="/dev.png" alt="ZACO" className="h-6 w-auto opacity-80 hover:opacity-100 transition-all" />
                </a>
             </div>
           )}

        </div>
      </aside>

      <LoadingProvider>
        <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Navbar */}
        <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm no-print">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
              aria-label="Open menu"
            >
              <Menu size={18} className="text-slate-700" />
            </button>
            <h1 className="text-lg font-black text-slate-800">
              {activeTab === 'dashboard' && t('nav.dashboard')}
              {activeTab === 'incoming' && t('nav.incoming')}
              {activeTab === 'outgoing' && t('nav.outgoing')}
              {activeTab === 'list' && t('nav.archive')}
              {activeTab === 'scanner' && t('nav.scanner')}
              {activeTab === 'reports' && t('nav.reports')}
              {activeTab === 'audit' && t('nav.audit')}
              {activeTab === 'approvals' && t('nav.approvals')}
              {activeTab === 'notifications' && t('nav.notifications')}
              {activeTab === 'internal' && t('nav.internal')}
              {activeTab === 'users' && t('nav.users')}
              {activeTab === 'admin-status' && t('nav.admin')}
              {activeTab === 'backup' && t('nav.backup')}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <LanguageSwitcher />

            {/* Notifications Bell */}
            <DropdownMenu open={showNotificationDropdown} onOpenChange={setShowNotificationDropdown}>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all group"
                  aria-label="Notifications"
                >
                  <Bell size={18} className="text-slate-600 group-hover:text-slate-900" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[340px] rounded-2xl p-2">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>الإشعارات</span>
                  {notificationCount > 0 && (
                    <span className="text-[10px] font-black bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                      غير مقروء: {notificationCount}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {notificationPreviewLoading ? (
                  <DropdownMenuItem disabled className="opacity-70">
                    جارِ التحميل...
                  </DropdownMenuItem>
                ) : notificationPreview.length === 0 ? (
                  <DropdownMenuItem disabled className="opacity-70">
                    لا توجد إشعارات غير مقروءة
                  </DropdownMenuItem>
                ) : (
                  notificationPreview.map((n: any) => (
                    <DropdownMenuItem
                      key={String(n.id)}
                      onSelect={() => {
                        setActiveTab('notifications')
                        setShowNotificationDropdown(false)
                      }}
                      className="flex flex-col items-start gap-1"
                    >
                      <div className="text-sm font-black text-slate-900 line-clamp-1">{n.title || 'إشعار'}</div>
                      {n.message && <div className="text-xs text-slate-500 line-clamp-2">{n.message}</div>}
                    </DropdownMenuItem>
                  ))
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setActiveTab('notifications')
                    setShowNotificationDropdown(false)
                  }}
                  className="font-black"
                >
                  عرض كل الإشعارات
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* User Quick Info */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50">
              <div className="text-right">
                <div className="text-xs font-black text-slate-800">{currentUser.full_name}</div>
                <div className="text-[10px] text-slate-500 font-bold">
                  {currentUser.role === 'admin' ? t('role.admin') : currentUser.role === 'manager' ? t('role.manager') : currentUser.role === 'supervisor' ? t('role.supervisor') : t('role.member')}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-white font-black text-xs overflow-hidden">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  currentUser.full_name?.substring(0, 1) || 'U'
                )}
              </div>
            </div>
          </div>
        </nav>
        
        <div className="flex-1 overflow-y-auto p-8 lg:p-14 max-w-7xl xl:max-w-none mx-auto w-full">
          {globalError && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-xl font-bold">{globalError}</div>
          )}
          {activeTab === 'dashboard' && <Dashboard docs={docs} />}
          {activeTab === 'incoming' && <DocumentForm type={DocType.INCOMING} onSave={handleSaveDoc} companies={[]} />}
          {activeTab === 'outgoing' && <DocumentForm type={DocType.OUTGOING} onSave={handleSaveDoc} companies={[]} />}
          {activeTab === 'list' && <DocumentList docs={docs} settings={{...settings, orgName: 'MDLBEAST', logoUrl: '/mdlbeast/logo.png', orgNameEn: 'MDLBEAST'}} currentUser={currentUser} users={users} onRefresh={refreshDocuments} /> }
          {activeTab === 'scanner' && <BarcodeScanner />}
          {activeTab === 'reports' && <ReportGenerator docs={docs} settings={{orgName: 'MDLBEAST', logoUrl: '/mdlbeast/logo.png'}} />}
          {activeTab === 'audit' && <AuditLogs />}
          {activeTab === 'approvals' && <Approvals currentUser={currentUser} tenantSignatureUrl='' />}
          {activeTab === 'notifications' && <NotificationCenter />}
          {activeTab === 'internal' && <InternalCommunication currentUser={currentUser} users={users} />}
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
