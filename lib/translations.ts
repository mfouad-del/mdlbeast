// Centralized translations for MDLBEAST Communications
// Default language: English

export type Language = 'en' | 'ar'

export const translations = {
  en: {
    // Common
    appName: "MDLBEAST Communications",
    company: "MDLBEAST Entertainment Company",
    copyright: "All rights reserved © 2025",
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    search: "Search",
    filter: "Filter",
    export: "Export",
    import: "Import",
    refresh: "Refresh",
    close: "Close",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    submit: "Submit",
    
    // Navigation
    dashboard: "Dashboard",
    documents: "Documents",
    incoming: "Incoming",
    outgoing: "Outgoing",
    archive: "Archive",
    reports: "Reports",
    users: "Users",
    settings: "Settings",
    logout: "Logout",
    approvals: "Approvals",
    scanner: "Scanner",
    backups: "Backups",
    systemStatus: "System Status",
    auditLogs: "Audit Logs",
    changePassword: "Change Password",
    
    // Dashboard
    totalDocuments: "Total Documents",
    incomingDocs: "Incoming",
    outgoingDocs: "Outgoing",
    pendingApprovals: "Pending Approvals",
    recentActivity: "Recent Activity",
    quickActions: "Quick Actions",
    newIncoming: "New Incoming",
    newOutgoing: "New Outgoing",
    
    // Documents
    documentNumber: "Document Number",
    subject: "Subject",
    sender: "Sender",
    receiver: "Receiver",
    date: "Date",
    priority: "Priority",
    status: "Status",
    attachments: "Attachments",
    notes: "Notes",
    barcode: "Barcode",
    classification: "Classification",
    
    // Priority levels
    urgent: "Urgent",
    high: "High",
    normal: "Normal",
    low: "Low",
    
    // Status
    active: "Active",
    archived: "Archived",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    
    // User Management
    username: "Username",
    password: "Password",
    email: "Email",
    fullName: "Full Name",
    role: "Role",
    admin: "Admin",
    manager: "Manager",
    supervisor: "Supervisor",
    member: "Member",
    
    // Messages
    saveSuccess: "Saved successfully",
    deleteSuccess: "Deleted successfully",
    errorOccurred: "An error occurred",
    confirmDelete: "Are you sure you want to delete?",
    noResults: "No results found",
    
    // Login
    login: "Login",
    loginTitle: "Secure Login",
    loggingIn: "Logging in...",
    invalidCredentials: "Invalid username or password",
    sessionExpired: "Session expired. Please login again.",
    
    // Approvals
    requestApproval: "Request Approval",
    approve: "Approve",
    reject: "Reject",
    approvalRequested: "Approval Requested",
    approvalHistory: "Approval History",
    
    // Reports
    generateReport: "Generate Report",
    reportType: "Report Type",
    dateRange: "Date Range",
    fromDate: "From Date",
    toDate: "To Date",
    
    // System
    systemSettings: "System Settings",
    organizationName: "Organization Name",
    logo: "Logo",
    primaryColor: "Primary Color",
    language: "Language",
    english: "English",
    arabic: "Arabic",
    
    // Backups
    systemBackups: "System Backups",
    backupsDescription: "Create a complete backup of the database, files and settings for restoration when needed.",
    createFullBackup: "Create Full Backup",
    fullBackupDesc: "Database + Files",
    exportJSON: "Export Data (JSON)",
    jsonExportDesc: "Data only without files",
    restoreJSON: "Restore JSON",
    restoreFull: "Restore Full (File)",
    backupList: "Backup List",
    noBackups: "No backups found",
    backupCreated: "Backup created successfully",
    backupFailed: "Failed to create backup",
    restoreSuccess: "Restoration completed successfully",
    restoreFailed: "Restoration failed",
    confirmFullBackup: "A full backup of database and files will be created. Proceed?",
    confirmJSONRestore: "JSON restore will insert/update database records. Proceed?",
    confirmFullRestore: "DANGER: Full restore will replace all data. This cannot be undone. Proceed?",
    downloadBackup: "Download",
    deleteBackup: "Delete",
    
    // System Status
    systemStatusTitle: "System Status",
    systemStatusDesc: "Overview of system health, connected services, and recent logs.",
    serverHealth: "Server Health",
    healthy: "Healthy",
    unhealthy: "Unhealthy",
    version: "Version",
    uptime: "Uptime",
    days: "days",
    hours: "hours",
    minutes: "minutes",
    connectedServices: "Connected Services",
    r2Storage: "R2 Storage",
    configured: "Configured",
    notConfigured: "Not Configured",
    backupsEnabled: "Backups Enabled",
    recentLogs: "Recent Logs",
    clearLogs: "Clear Logs",
    noLogs: "No logs available",
    fixSequences: "Fix Sequences",
    confirmFixSequences: "Are you sure? This will renumber all documents and reset sequences. This action cannot be undone.",
    fixSequencesSuccess: "Operation completed successfully",
    fixSequencesFailed: "Operation failed",
    
    // Language Settings
    languageSettings: "Language Settings",
    defaultLanguage: "Default Language",
    selectLanguage: "Select Language",
    languageSaved: "Language preference saved",
  },
  
  ar: {
    // Common
    appName: "MDLBEAST للاتصالات",
    company: "شركة MDLBEAST الترفيهية",
    copyright: "جميع الحقوق محفوظة © 2025",
    loading: "جارٍ التحميل...",
    save: "حفظ",
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    add: "إضافة",
    search: "بحث",
    filter: "تصفية",
    export: "تصدير",
    import: "استيراد",
    refresh: "تحديث",
    close: 'إغلاق',
    confirm: "تأكيد",
    back: "رجوع",
    next: "التالي",
    submit: "إرسال",
    
    // Navigation
    dashboard: "لوحة التحكم",
    documents: "المستندات",
    incoming: "الوارد",
    outgoing: "الصادر",
    archive: "الأرشيف",
    reports: "التقارير",
    users: "المستخدمون",
    settings: "الإعدادات",
    logout: "تسجيل الخروج",
    approvals: "الاعتمادات",
    scanner: "الماسح",
    backups: "النسخ الاحتياطي",
    systemStatus: "حالة النظام",
    auditLogs: "سجل التدقيق",
    changePassword: 'تغيير كلمة المرور',
    
    // Dashboard
    totalDocuments: "إجمالي المستندات",
    incomingDocs: "الوارد",
    outgoingDocs: "الصادر",
    pendingApprovals: "اعتمادات معلقة",
    recentActivity: "النشاط الأخير",
    quickActions: "إجراءات سريعة",
    newIncoming: "وارد جديد",
    newOutgoing: "صادر جديد",
    
    // Documents
    documentNumber: "رقم المستند",
    subject: 'الموضوع',
    sender: 'المرسل',
    receiver: "المستلم",
    date: 'التاريخ',
    priority: 'الأولوية',
    status: 'الحالة',
    attachments: "المرفقات",
    notes: "الملاحظات",
    barcode: 'الباركود',
    classification: "التصنيف",
    
    // Priority levels
    urgent: 'عاجل',
    high: "مرتفع",
    normal: 'عادي',
    low: "منخفض",
    
    // Status
    active: "نشط",
    archived: "مؤرشف",
    pending: "معلق",
    approved: "معتمد",
    rejected: "مرفوض",
    
    // User Management
    username: "اسم المستخدم",
    password: "كلمة المرور",
    email: 'البريد الإلكتروني',
    fullName: 'الاسم الكامل',
    role: "الدور",
    admin: "مدير",
    manager: "مشرف",
    supervisor: "منسق",
    member: "عضو",
    
    // Messages
    saveSuccess: "تم الحفظ بنجاح",
    deleteSuccess: "تم الحذف بنجاح",
    errorOccurred: "حدث خطأ",
    confirmDelete: "هل أنت متأكد من الحذف؟",
    noResults: "لا توجد نتائج",
    
    // Login
    login: "تسجيل الدخول",
    loginTitle: "دخول آمن للنظام",
    loggingIn: "جارٍ تسجيل الدخول...",
    invalidCredentials: "خطأ في اسم المستخدم أو كلمة المرور",
    sessionExpired: "انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.",
    
    // Approvals
    requestApproval: "طلب اعتماد",
    approve: "موافقة",
    reject: "رفض",
    approvalRequested: "تم طلب الاعتماد",
    approvalHistory: "سجل الاعتمادات",
    
    // Reports
    generateReport: "إنشاء تقرير",
    reportType: "نوع التقرير",
    dateRange: "نطاق التاريخ",
    fromDate: "من تاريخ",
    toDate: "إلى تاريخ",
    
    // System
    systemSettings: "إعدادات النظام",
    organizationName: "اسم المنظمة",
    logo: "الشعار",
    primaryColor: "اللون الأساسي",
    language: "اللغة",
    english: "English",
    arabic: 'العربية',
    
    // Backups
    systemBackups: "نسخ النظام الاحتياطية",
    backupsDescription: "إنشاء نسخة كاملة للقاعدة والملفات والإعدادات لاستعادتها عند الحاجة.",
    createFullBackup: "إنشاء نسخة شاملة",
    fullBackupDesc: "قاعدة بيانات + ملفات",
    exportJSON: "تصدير البيانات (JSON)",
    jsonExportDesc: "بيانات فقط بدون ملفات",
    restoreJSON: "استعادة JSON",
    restoreFull: "استعادة شاملة (ملف)",
    backupList: "قائمة النسخ",
    noBackups: "لا توجد نسخ احتياطية",
    backupCreated: "تم إنشاء النسخة بنجاح",
    backupFailed: "فشل إنشاء النسخة",
    restoreSuccess: "تمت الاستعادة بنجاح",
    restoreFailed: "فشل الاستعادة",
    confirmFullBackup: "سيتم إنشاء نسخة شاملة للقاعدة والملفات والإعدادات. موافق؟",
    confirmJSONRestore: "استعادة JSON ستقوم بإدخالات/تحديثات في قاعدة البيانات. موافق؟",
    confirmFullRestore: "تحذير: الاستعادة الشاملة ستستبدل جميع البيانات. لا يمكن التراجع. موافق؟",
    downloadBackup: "تحميل",
    deleteBackup: 'حذف',
    
    // System Status
    systemStatusTitle: "حالة النظام",
    systemStatusDesc: "نظرة عامة على صحة النظام، الخدمات المتصلة، والسجلات الأخيرة.",
    serverHealth: "صحة الخادم",
    healthy: "سليم",
    unhealthy: "غير سليم",
    version: "الإصدار",
    uptime: "وقت التشغيل",
    days: "يوم",
    hours: "ساعة",
    minutes: "دقيقة",
    connectedServices: "الخدمات المتصلة",
    r2Storage: "تخزين R2",
    configured: "مُهيأ",
    notConfigured: "غير مُهيأ",
    backupsEnabled: "النسخ الاحتياطي مُفعل",
    recentLogs: "السجلات الأخيرة",
    clearLogs: "مسح السجلات",
    noLogs: "لا توجد سجلات",
    fixSequences: "إصلاح التسلسل",
    confirmFixSequences: "هل أنت متأكد؟ سيتم إعادة ترقيم جميع المستندات. لا يمكن التراجع عن هذا الإجراء.",
    fixSequencesSuccess: "تمت العملية بنجاح",
    fixSequencesFailed: "فشلت العملية",
    
    // Language Settings
    languageSettings: "إعدادات اللغة",
    defaultLanguage: "اللغة الافتراضية",
    selectLanguage: "اختر اللغة",
    languageSaved: "تم حفظ تفضيل اللغة",
  }
}

// Helper function to get translation
export function t(key: keyof typeof translations.en, lang: Language = 'en'): string {
  return translations[lang][key] || translations.en[key] || key
}

// Get current language from localStorage
export function getCurrentLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  return (localStorage.getItem('mdlbeast_lang') as Language) || 'en'
}

// Set current language
export function setCurrentLanguage(lang: Language): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('mdlbeast_lang', lang)
  }
}

// Get direction based on language
export function getDirection(lang: Language): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr'
}
