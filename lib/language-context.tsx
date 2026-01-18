"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// ============================================================================
// LANGUAGE CONTEXT - نظام اللغات (عربي/إنجليزي)
// ============================================================================

export type Language = 'ar' | 'en'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  toggleLanguage: () => void
  t: (key: string) => string
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// ============================================================================
// TRANSLATIONS
// ============================================================================

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Authentication
    'systemName': 'زوايا البناء للاستشارات الهندسية',
    'systemSubtitle': 'منصة ادارة المشاريع والاتصالات الاداريه',
    'username': 'اسم المستخدم',
    'password': 'كلمة المرور',
    'rememberMe': 'تذكرني',
    'login': 'تسجيل الدخول',
    'loading': 'جاري التحميل...',
    'login.title': 'تسجيل الدخول',
    'login.subtitle': 'نظام إدارة المشاريع والأرشفة',
    'login.username': 'اسم المستخدم',
    'login.password': 'كلمة المرور',
    'login.remember': 'تذكرني',
    'login.forgot': 'نسيت كلمة المرور؟',
    'login.submit': 'تسجيل الدخول',
    'login.loading': 'جاري التحميل...',
    'login.error': 'خطأ في تسجيل الدخول',
    'login.invalid': 'اسم المستخدم أو كلمة المرور غير صحيحة',
    
    // Dashboard / Sidebar Keys (Aliases)
    'overview': 'نظرة عامة',
    'approvals': 'الموافقات',
    'archive': 'الأرشيف',
    'adminComm': 'الاتصالات الإدارية',
    'newIncoming': 'وارد جديد',
    'newOutgoing': 'صادر جديد',
    'searchArchive': 'بحث في الأرشيف',
    'barcodeScanner': 'ماسح الباركود',
    'reportsCenter': 'مركز التقارير',
    'projects': 'المشاريع',
    'projectsList': 'قائمة المشاريع',
    'paymentRequests': 'طلبات الدفع',
    'changeOrders': 'أوامر التغيير',
    'projectReports': 'تقارير المشاريع',
    'finance': 'المالية',
    'payments': 'المدفوعات',
    'communication': 'التواصل',
    'zawayaTalk': 'زوايا توك',
    'systemSettings': 'إعدادات النظام',
    'users': 'المستخدمين',
    'tenants': 'إدارة المؤسسات',
    'auditLogs': 'مراقبة التفاعل',
    'emailSettings': 'إعدادات البريد',
    'backup': 'النسخ الاحتياطي',
    'systemStatus': 'حالة النظام',
    'allTenants': 'كل الجهات',
    'retry': 'إعادة المحاولة',
    'refresh': 'تحديث',
    'loadingSlow': 'التحميل يستغرق وقتاً أطول من المعتاد...',
    'accessDenied': 'لا تملك صلاحية الوصول',
    'logout': 'تسجيل الخروج',
    
    // Roles
    'admin': 'مدير النظام',
    'manager': 'مدير',
    'editor': 'مستخدم',
    'accountant': 'محاسب',
    'supervisor': 'مشرف',
    'member': 'عضو',
    
    // Companies/Tenants
    'companies': 'إدارة المؤسسات',
    'manageTenants': 'إدارة المؤسسات',
    'tenantName': 'اسم المؤسسة',
    'logoUrl': 'رابط الشعار',
    'tenantSignature': 'توقيع المؤسسة',
    'optional': 'اختياري',

    // Navigation & Sidebar
    'nav.dashboard': 'لوحة التحكم',
    'nav.projects': 'المشاريع',
    'nav.archive': 'الأرشيف',
    'nav.finance': 'المالية',
    'nav.payments': 'المدفوعات',
    'nav.payment_requests': 'طلبات الدفع',
    'nav.my_payments': 'طلبات دفعي',
    'nav.reports': 'التقارير',
    'nav.supervision': 'تقارير الإشراف',
    'nav.internal_reports': 'التقارير الداخلية',
    'nav.users': 'المستخدمين',
    'nav.clients': 'العملاء',
    'nav.approvals': 'الاعتمادات',
    'nav.communication': 'التواصل',
    'nav.chat': 'الشات',
    'nav.settings': 'الإعدادات',
    'nav.system': 'النظام',
    'nav.backups': 'النسخ الاحتياطي',
    'nav.audit': 'سجل العمليات',
    'nav.logout': 'تسجيل الخروج',
    'nav.profile': 'الملف الشخصي',
    
    // Common Actions
    'action.save': 'حفظ',
    'action.cancel': 'إلغاء',
    'action.delete': 'حذف',
    'action.edit': 'تعديل',
    'action.view': 'عرض',
    'action.create': 'إنشاء',
    'action.add': 'إضافة',
    'action.search': 'بحث',
    'action.filter': 'تصفية',
    'action.export': 'تصدير',
    'action.import': 'استيراد',
    'action.print': 'طباعة',
    'action.download': 'تحميل',
    'action.upload': 'رفع',
    'action.refresh': 'تحديث',
    'action.back': 'رجوع',
    'action.next': 'التالي',
    'action.previous': 'السابق',
    'action.submit': 'إرسال',
    'action.approve': 'اعتماد',
    'action.reject': 'رفض',
    'action.close': 'إغلاق',
    'action.confirm': 'تأكيد',
    
    // Status
    'status.pending': 'قيد الانتظار',
    'status.pending_approval': 'بانتظار الاعتماد',
    'status.approved': 'معتمد',
    'status.rejected': 'مرفوض',
    'status.completed': 'مكتمل',
    'status.active': 'نشط',
    'status.inactive': 'غير نشط',
    'status.draft': 'مسودة',
    'status.collected': 'تم التحصيل',
    'status.paid': 'مدفوع',
    
    // Projects
    'projects.title': 'إدارة المشاريع',
    'projects.new': 'مشروع جديد',
    'projects.name': 'اسم المشروع',
    'projects.number': 'رقم المشروع',
    'projects.client': 'العميل',
    'projects.location': 'الموقع',
    'projects.contract_value': 'قيمة العقد',
    'projects.completion': 'نسبة الإنجاز',
    'projects.status': 'الحالة',
    'projects.start_date': 'تاريخ البداية',
    'projects.end_date': 'تاريخ النهاية',
    
    // Payments
    'payments.title': 'المدفوعات',
    'payments.request': 'طلب دفع',
    'payments.amount': 'المبلغ',
    'payments.description': 'الوصف',
    'payments.urgency': 'الأهمية',
    'payments.date': 'التاريخ',
    'payments.status': 'الحالة',
    'payments.requester': 'مقدم الطلب',
    'payments.bank': 'البنك',
    'payments.transfer': 'رقم التحويل',
    
    // Reports
    'reports.title': 'التقارير',
    'reports.supervision': 'تقرير إشراف',
    'reports.new': 'تقرير جديد',
    'reports.number': 'رقم التقرير',
    'reports.date': 'تاريخ الزيارة',
    'reports.engineer': 'المهندس المشرف',
    'reports.phase': 'المرحلة',
    'reports.work_description': 'وصف الأعمال',
    'reports.recommendations': 'التوصيات',
    'reports.notes': 'الملاحظات',
    'reports.attachments': 'المرفقات',
    'reports.signatures': 'التوقيعات',
    
    // Users
    'users.title': 'إدارة المستخدمين',
    'users.user': 'المستخدم',
    'users.position': 'المنصب',
    'users.manager': 'المدير',
    'common.actions': 'إجراءات',
    'users.new': 'مستخدم جديد',
    'users.name': 'الاسم',
    'users.username': 'اسم المستخدم',
    'users.email': 'البريد الإلكتروني',
    'users.phone': 'الهاتف',
    'users.role': 'الصلاحية / الدور',
    'users.permissions': 'الصلاحيات',
    'users.active': 'نشط',

    // Chat
    'chat.title': 'زوايا توك',
    'chat.search': 'بحث في الرسائل...',
    'chat.attachments_only': 'مرفقات فقط',
    'chat.start': 'ابدأ محادثة جديدة',
    'chat.typing': 'يكتب الآن...',
    'chat.private': 'رسالة خاصة',
    'chat.locked': 'رسالة محجوبة',
    'chat.type_message': 'اكتب رسالتك...',    'chat.only_me': 'فقط',
    'common.preview': 'معاينة',
    'common.open': 'فتح',
    'common.remove': 'إزالة',
    'common.cancel': 'إلغاء',
    'common.save': 'حفظ',
    'common.delete': 'حذف',
    'chat.no_permission': 'لا تملك صلاحية إرسال رسائل',
    'chat.select_recipient': 'يرجى اختيار مستلم واحد على الأقل من القائمة',
    'common.attachment': 'مرفق',
    'common.image': 'صورة',
    'common.file': 'ملف',    'chat.send': 'إرسال',
    'chat.reply': 'رد',
    'chat.edit': 'تعديل',
    'chat.delete': 'حذف',
    'chat.pin': 'تثبيت',
    'chat.unpin': 'إلغاء تثبيت',
    'chat.star': 'تمييز بنجمة',
    'chat.starred': 'رسائل مميزة',
    'chat.online': 'متصل',
    'chat.offline': 'غير متصل',
    'chat.audience': 'الكل',
    'chat.all': 'الجميع',
    'chat.search_placeholder': 'بحث في الرسائل...',
    'chat.audience_select': 'توجيه الرسالة إلى',
    'chat.private_to': 'خاص بـ',
    
    // Roles
    'role.admin': 'مدير نظام',
    'role.manager': 'مدير',
    'role.supervisor': 'مشرف',
    'role.accountant': 'محاسب',
    'role.member': 'مستخدم',
    'role.engineer': 'مهندس',

    // Clients
    'clients.title': 'إدارة العملاء',
    'clients.new': 'عميل جديد',
    'clients.name': 'اسم العميل',
    'clients.contact': 'جهة الاتصال',
    
    // Archive
    'archive.title': 'الأرشيف',
    'archive.documents': 'المستندات',
    'archive.upload': 'رفع مستند',
    'archive.stamp': 'ختم',
    
    // Settings
    'settings.title': 'الإعدادات',
    'settings.general': 'عام',
    'settings.email': 'البريد الإلكتروني',
    'settings.backup': 'النسخ الاحتياطي',
    'settings.language': 'اللغة',
    
    // Messages
    'msg.success': 'تمت العملية بنجاح',
    'msg.error': 'حدث خطأ',
    'msg.confirm_delete': 'هل أنت متأكد من الحذف؟',
    'msg.no_data': 'لا توجد بيانات',
    'msg.loading': 'جاري التحميل...',
    'msg.saving': 'جاري الحفظ...',
    
    // Time
    'time.today': 'اليوم',
    'time.yesterday': 'أمس',
    'time.this_week': 'هذا الأسبوع',
    'time.this_month': 'هذا الشهر',
    'time.all': 'الكل',
    
    // Misc
    'misc.sar': 'ريال',
    'misc.yes': 'نعم',
    'misc.no': 'لا',
    'misc.or': 'أو',
    'misc.and': 'و',
    'misc.all': 'الكل',
    'misc.none': 'لا شيء',
    'misc.select': 'اختر...',
    'misc.required': 'مطلوب',
    'misc.optional': 'اختياري',

    // Login Page Additional
    'login.captcha_required': 'يرجى التحقق من أنك لست روبوت',
    'login.having_trouble': 'تواجه مشكلة؟',
    'login.download_android': 'تحميل تطبيق الأندرويد',
    'login.copyright': 'جميع الحقوق محفوظه زوايا البناء للإستشارات الهندسيه',
    'login.encrypted_session': 'جلسة مشفرة',
    
    // Dashboard Additional
    'dashboard.title': 'لوحة التحكم',
    'dashboard.welcome': 'مرحباً',
    'dashboard.total_projects': 'إجمالي المشاريع',
    'dashboard.active_projects': 'المشاريع النشطة',
    'dashboard.pending_payments': 'المدفوعات المعلقة',
    'dashboard.total_documents': 'إجمالي المستندات',
    'dashboard.recent_activities': 'النشاطات الأخيرة',
    'dashboard.quick_actions': 'إجراءات سريعة',
    'dashboard.statistics': 'الإحصائيات',
    'dashboard.monthly_overview': 'نظرة شهرية',
    
    // Document Types
    'document.incoming': 'وارد',
    'document.outgoing': 'صادر',
    'document.internal': 'داخلي',
    'document.contract': 'عقد',
    'document.invoice': 'فاتورة',
    'document.report': 'تقرير',
    'document.letter': 'خطاب',
    'document.memo': 'مذكرة',
    
    // Notifications
    'notification.title': 'الإشعارات',
    'notification.mark_read': 'تحديد كمقروء',
    'notification.mark_all_read': 'تحديد الكل كمقروء',
    'notification.no_notifications': 'لا توجد إشعارات جديدة',
    'notification.view_all': 'عرض الكل',
    
    // Profile
    'profile.title': 'الملف الشخصي',
    'profile.change_password': 'تغيير كلمة المرور',
    'profile.current_password': 'كلمة المرور الحالية',
    'profile.new_password': 'كلمة المرور الجديدة',
    'profile.confirm_password': 'تأكيد كلمة المرور',
    'profile.update': 'تحديث الملف',
    
    // Errors
    'error.generic': 'حدث خطأ',
    'error.network': 'خطأ في الشبكة، يرجى المحاولة مرة أخرى',
    'error.unauthorized': 'غير مصرح لك بهذا الإجراء',
    'error.not_found': 'العنصر غير موجود',
    'error.server': 'خطأ في الخادم، يرجى المحاولة لاحقاً',
    'error.validation': 'يرجى التحقق من البيانات المدخلة',
    
    // Confirmation
    'confirm.delete_title': 'تأكيد الحذف',
    'confirm.delete_message': 'هل أنت متأكد من حذف هذا العنصر؟',
    'confirm.logout_title': 'تأكيد تسجيل الخروج',
    'confirm.logout_message': 'هل أنت متأكد من تسجيل الخروج؟',
    'confirm.yes': 'نعم',
    'confirm.no': 'لا',
    
    // Table
    'table.showing': 'عرض',
    'table.of': 'من',
    'table.entries': 'سجل',
    'table.no_data': 'لا توجد بيانات',
    'table.loading': 'جاري التحميل...',
    'table.search': 'بحث...',
    'table.per_page': 'لكل صفحة',
    
    // Forms
    'form.required_field': 'هذا الحقل مطلوب',
    'form.invalid_email': 'البريد الإلكتروني غير صحيح',
    'form.password_mismatch': 'كلمتا المرور غير متطابقتين',
    'form.min_length': 'الحد الأدنى {0} أحرف',
    'form.max_length': 'الحد الأقصى {0} أحرف',
    
    // User Management - Positions
    'position.not_specified': '-- لم يُحدد --',
    'position.general_manager': 'مدير عام',
    'position.project_manager': 'مدير مشروع',
    'position.department_manager': 'مدير إدارة',
    'position.supervisor': 'مشرف',
    'position.engineer': 'مهندس',
    'position.technician': 'فني',
    'position.employee': 'موظف',
    'position.trainee': 'متدرب',
    'position.external_consultant': 'استشاري خارجي',
    
    // User Management - Scopes
    'scope.self_only': 'بياناته فقط',
    'scope.direct_reports': 'المرؤوسين المباشرين',
    'scope.full_branch': 'كامل الفرع',
    'scope.all_system': 'كل النظام',
    
    // User Management - Actions
    'user.edit': 'تعديل',
    'user.delete': 'حذف',
    'user.inactive_status': 'غير نشط',
    'user.team_member_assigned': 'تم التعيين',
    'user.member_added_success': 'تم إضافة العضو للفريق بنجاح',
    'user.failed_assign_user': 'فشل تعيين المستخدم',
    'user.confirm_remove_member': 'هل أنت متأكد من إزالة هذا العضو من الفريق؟',
    'user.deleted': 'تم الحذف',
    'user.member_removed': 'تم إزالة العضو من الفريق',
    
    // Team Management
    'team.work_team': 'فريق العمل',
    'team.manage_project_access': 'إدارة صلاحيات الوصول للمشروع',
    'team.add_new_member': 'إضافة عضو جديد',
    'team.select_user': 'اختر مستخدم...',
    'team.add': 'إضافة',
    'team.current_members': 'الأعضاء الحاليين',
    'team.no_team_members': 'لا يوجد أعضاء في الفريق حالياً',
    'team.assignment_date': 'تاريخ التعيين',
    'team.remove': 'إزالة',
    'team.close': 'إغلاق',
    
    // Team Roles
    'team.role.lead_engineer': 'مهندس رئيسي',
    'team.role.supervisor': 'مشرف',
    'team.role.site_engineer': 'مهندس موقع',
    'team.role.engineer': 'مهندس',
    'team.role.accountant': 'محاسب',
    'team.role.assistant': 'مساعد',
    
    // Project Management
    'project.engineering_projects_management': 'إدارة المشاريع الهندسية',
    'project.status.active': 'جاري',
    'project.status.paused': 'متوقف',
    'project.status.completed': 'منتهي',
    'project.project_unit': 'مشروع',
    'project.clients': 'العملاء',
    'project.refresh': 'تحديث',
    'project.view_mode': 'عرض',
    'project.new_project': 'مشروع جديد',
    'project.danger_zone': '⚠️ منطقة الخطر ⚠️',
    'project.confirm_delete_project': 'أنت على وشك حذف مشروع...',
    'project.project_name_mismatch': 'اسم المشروع غير مطابق',
    'project.action_irreversible': 'لا يمكن التراجع عن هذا الإجراء',
    'project.deleted': 'تم الحذف',
    'project.project_deleted_success': 'تم حذف المشروع بنجاح',
    'project.updated': 'تم التحديث',
    'project.project_updated_success': 'تم تحديث بيانات المشروع بنجاح',
    'project.created': 'تم الإنشاء',
    'project.project_created_success': 'تم إنشاء المشروع بنجاح',
    'project.failed_fetch_project_details': 'فشل في جلب تفاصيل المشروع',
    
    // Document Form
    'doc.new_incoming_entry': 'قيد وارد جديد',
    'doc.new_outgoing_entry': 'قيد صادر جديد',
    'doc.institution_name': 'المؤسسة المستقلة: زوايا البناء',
    'doc.transaction_number_note': 'ملاحظة: سيُولد رقم المعاملة تلقائياً...',
    'doc.transaction_subject': 'موضوع المعاملة',
    'doc.from_entity': 'من جهة',
    'doc.select_entity': 'اختر جهة',
    'doc.to_entity': 'إلى جهة',
    'doc.outgoing_incoming_date': 'تاريخ الصادر/الوارد',
    'doc.attachments': 'المرفقات',
    'doc.example_attachment': 'مثال: 1 اسطوانة',
    'doc.security_classification': 'تصنيف السرية',
    'doc.normal_public': 'عادي - متاح للجميع',
    'doc.confidential_restricted': 'سري - محدود الوصول',
    'doc.transaction_priority': 'أهمية المعاملة',
    'doc.normal_processing': 'معالجة اعتيادية',
    'doc.urgent_processing': 'معالجة عاجلة',
    'doc.statement_optional': 'البيان (اختياري)',
    'doc.attachment_page_count': 'عدد صفحات المرفق',
    'doc.upload_original_for_stamping': 'رفع المستند الأصلي لدمغه بالباركود',
    'doc.pdf_format_only': 'تنسيق PDF فقط',
    'doc.select_pdf_file': 'اختيار ملف PDF',
    'doc.generate_unified_barcode': 'توليد الباركود الرقمي الموحد',
    
    // Document List
    'doc.quick_search': 'بحث سريع',
    'doc.search_placeholder': 'الباركود، الموضوع، الجهة...',
    'doc.from_date': 'من تاريخ',
    'doc.to_date': 'إلى تاريخ',
    'doc.entry_type': 'نوع القيد',
    'doc.all': 'الكل',
    'doc.incoming': 'وارد',
    'doc.outgoing': 'صادر',
    'doc.reset_filters': 'إعادة تعيين الفلاتر',
    'doc.extract_report': 'استخراج تقرير',
    'doc.unified_identifier': 'المعرف الموحد',
    'doc.entry_details': 'تفاصيل القيد',
    'doc.additional_data': 'البيانات الإضافية',
    'doc.actions': 'الإجراءات',
    'doc.from': 'من:',
    'doc.to': 'إلى:',
    'doc.entry_by': 'القيد بواسطة:',
    'doc.attachments_label': 'المرفقات:',
    'doc.view_attachment': 'عرض المرفق',
    'doc.confirm_delete_attachment': 'هل تريد حذف المرفق',
    'doc.add_attachment': 'إضافة مرفق',
    'doc.stamp_document': 'ختم المستند',
    
    // Dashboard
    'dashboard.dashboard': 'لوحة البيانات',
    'dashboard.comprehensive_system_overview': 'نظرة شاملة على حركة النظام والإحصائيات',
    'dashboard.total': 'الإجمالي',
    'dashboard.registered_transactions': 'معاملة مسجلة',
    'dashboard.incoming_transactions': 'معاملات واردة',
    'dashboard.outgoing_transactions': 'معاملات صادرة',
    'dashboard.urgent': 'عاجل',
    'dashboard.requires_attention': 'تتطلب اهتمام',
    'dashboard.projects': 'المشاريع',
    'dashboard.active': 'نشط',
    'dashboard.completed': 'مكتمل',
    'dashboard.finance': 'المالية',
    'dashboard.pending_invoices': 'فواتير معلقة',
    'dashboard.users': 'المستخدمين',
    'dashboard.admin_user_counts': 'مدير - مستخدم',
    'dashboard.institutions': 'المؤسسات',
    'dashboard.registered_institution': 'مؤسسة مسجلة',
    'dashboard.activity_trends': 'اتجاهات الحركة',
    'dashboard.compare_incoming_outgoing': 'مقارنة الوارد والصادر خلال الفترة المحددة',
    'dashboard.daily': 'يومي',
    'dashboard.weekly': 'أسبوعي',
    'dashboard.monthly': 'شهري',
    
    // Payments Management
    'payment.financial_payments': 'المدفوعات المالية',
    'payment.manage_payment_requests': 'إدارة ومتابعة طلبات الدفع والتدفقات المالية للمشاريع',
    'payment.total_contracts': 'إجمالي العقود',
    'payment.pending_requests': 'طلبات معلقة',
    'payment.collected': 'تم التحصيل',
    'payment.collection_rate': 'نسبة التحصيل',
    'payment.very_urgent': 'عاجل جداً',
    'payment.high': 'عالي',
    'payment.medium': 'متوسط',
    'payment.normal': 'عادي',
    'payment.all_requests': 'جميع الطلبات',
    'payment.pending': 'قيد الانتظار',
    'payment.must_attach_invoice': 'يجب إرفاق صورة الفاتورة',
    'payment.must_attach_transfer_receipt': 'يجب إرفاق إيصال التحويل',
    'payment.must_write_collection_note': 'يجب كتابة ملاحظة على التحصيل',
    
    // Payment Center
    'payment.payment_center': 'مركز الدفعات',
    'payment.manage_project_payment_requests': 'إدارة طلبات الدفع للمشروع',
    'payment.request_due_payment': 'طلب دفعة مستحقة',
    'payment.contract_value': 'قيمة العقد',
    'payment.total_collected': 'إجمالي المحصّل',
    'payment.remaining': 'المتبقي',
    'payment.create_payment_disbursement': 'إنشاء طلب صرف مبلغ مالي',
    'payment.cancel': 'إلغاء',
    'payment.send_request': 'إرسال الطلب',
    'payment.requested_amount': 'المبلغ المطلوب',
    'payment.sar': 'ريال',
    'payment.request_description': 'وصف الطلب',
    'payment.explain_payment_reason': 'اشرح سبب طلب الدفعة...',
    'payment.priority_level': 'درجة الأولوية',
    
    // My Payment Requests
    'payment.my_payment_requests': 'طلبات الدفع الخاصة بي',
    'payment.view_all_submitted_requests': 'عرض جميع طلبات الدفع التي قدمتها في كل المشاريع',
    'payment.total_requests': 'إجمالي الطلبات',
    'payment.total': 'الإجمالي',
    'payment.no_requests': 'لا توجد طلبات',
    'payment.no_submitted_requests_yet': 'لم تقم بتقديم أي طلبات دفع بعد',
    'payment.request_details': 'تفاصيل الطلب',
    'payment.collection_data': 'بيانات التحصيل',
    
    // Change Orders
    'change_order.change_orders': 'أوامر التغيير',
    'change_order.manage_change_orders_modifications': 'إدارة أوامر التغيير والتعديلات على المشاريع',
    'change_order.new_change_order': 'أمر تغيير جديد',
    'change_order.financial_impact': 'التأثير المالي',
    'change_order.all_projects': 'كل المشاريع',
    'change_order.no_change_orders': 'لا توجد أوامر تغيير',
    'change_order.create_first_change_order': 'قم بإنشاء أمر تغيير جديد للبدء',
    'change_order.time_impact': 'التأثير الزمني',
    'change_order.no_impact': 'بدون تأثير',
    
    // Clients Management
    'client.clients_management': 'إدارة العملاء',
    'client.x_clients': '{0} عميل',
    'client.new_client': 'عميل جديد',
    'client.search_by_name_company': 'بحث بالاسم / الشركة / الهاتف / البريد...',
    'client.loading_clients': 'جارٍ تحميل العملاء...',
    'client.cannot_delete_client_with_projects': 'لا يمكن حذف عميل مرتبط بمشاريع',
    'client.edit_client': 'تعديل العميل',
    'client.add_client': 'إضافة عميل',
    'client.basic_client_data': 'بيانات العميل الأساسية',
    'client.name': 'الاسم',
    'client.company': 'الشركة',
    'client.phone': 'الهاتف',
    'client.email': 'البريد',
    'client.address': 'العنوان',
    'client.notes': 'ملاحظات',
    
    // Communication (Chat)
    'comm.direct_message_to': 'توجيه الرسالة إلى',
    'comm.select_recipients': 'اختر المستلمين لرؤية الرسالة',
    'comm.all': 'الكل',
    'comm.typing': 'يكتب...',
    'comm.send_failed_check_connection': 'فشل الإرسال: تحقق من الاتصال',
    
    // Internal Reports
    'internal_report.internal_reports': 'التقارير الداخلية',
    'internal_report.project_reports': 'تقارير المشروع:',
    'internal_report.new_report': 'تقرير جديد',
    'internal_report.loading_reports': 'جارٍ تحميل التقارير...',
    'internal_report.no_internal_reports': 'لا توجد تقارير داخلية',
    'internal_report.create_first_internal_report': 'قم بإنشاء تقرير داخلي جديد للبدء',
    'internal_report.add_first_report': 'إضافة أول تقرير',
    'internal_report.untitled_report': 'تقرير بدون عنوان',
    'internal_report.new': 'جديد',
    'internal_report.notes': 'ملاحظات:',
    'internal_report.attachments': 'المرفقات',
    'internal_report.attachment': 'مرفق',
    'internal_report.comments': 'التعليقات',
    'internal_report.add_comment': 'أضف تعليق...',
    
    // Supervision Reports Form
    'supervision.create_supervision_report': 'إنشاء تقرير إشراف جديد',
    'supervision.edit_supervision_report': 'تعديل تقرير إشراف',
    'supervision.save_report': 'حفظ التقرير',
    'supervision.report_revision_required': 'مطلوب تعديل التقرير',
    'supervision.with_note': 'بملاحظة:',
    'supervision.visit_project_data': 'بيانات الزيارة والمشروع',
    'supervision.visit_date': 'تاريخ الزيارة',
    'supervision.visit_time': 'وقت الزيارة',
    'supervision.completion_percentage': 'نسبة الإنجاز %',
    'supervision.current_work_phase': 'مرحلة العمل الحالية',
    'supervision.phase_example': 'مثال: أعمال الحفر، صب القواعد...',
    'supervision.work_details_notes': 'تفاصيل الأعمال والملاحظات',
    'supervision.executed_work_description': 'وصف الأعمال المنفذة',
    'supervision.precise_work_description': 'وصف دقيق للأعمال التي تم استلامها',
    'supervision.write_detailed_description': 'اكتب وصفاً تفصيلياً للأعمال التي تمت...',
    'supervision.consultant_recommendations': 'توصيات الاستشاري',
    'supervision.write_consultant_recommendations': 'اكتب توصيات الاستشاري للمقاول...',
    'supervision.additional_recommendations': 'التوصيات والملاحظات الإضافية',
    'supervision.any_recommendations': 'أي توصيات أو ملاحظات للمقاول...',
    'supervision.next_visit_plan': 'خطة العمل للزيارة القادمة',
    'supervision.expected_work': 'ما هي الأعمال المتوقع تنفيذها...',
    'supervision.attachments_photos': 'المرفقات والصور',
    'supervision.photo_caption': 'تعليق الصورة',
    'supervision.write_photo_description': 'اكتب وصفاً أو تعليقاً على هذه الصورة...',
    'supervision.add_photo': 'إضافة صورة',
    'supervision.click_to_upload': 'اضغط لرفع صورة',
    'supervision.must_upload_high_quality_photos': 'يجب رفع صور عالية الدقة لتوثيق الأعمال',
    
    // Supervision Reports List
    'supervision.supervision_reports': 'تقارير الإشراف',
    'supervision.pending_approval': 'بانتظار الموافقة',
    'supervision.revision_requested': 'مطلوب تعديل',
    'supervision.no_supervision_reports': 'لا توجد تقارير إشراف',
    'supervision.create_first_supervision_report': 'قم بإنشاء تقرير إشراف جديد للبدء',
    'supervision.phase': 'المرحلة',
    'supervision.supervising_engineer': 'المهندس المشرف',
    'supervision.exported': 'تم التصدير',
    'supervision.reports_exported_success': 'تم تصدير التقارير بنجاح',
    
    // Approvals
    'approval.approvals_system': 'نظام الإعتمادات',
    'approval.manage_requests_approvals': 'إدارة الطلبات والموافقات الرسمية',
    'approval.my_requests': 'طلباتي',
    'approval.for_approval': 'للاعتماد',
    'approval.new_request': 'طلب جديد',
    
    // Login - Additional
    'login.loading_verification_system': 'جاري تحميل نظام التحقق...',
    'login.verification_failed': 'فشل التحقق، يرجى المحاولة مرة أخرى',
    'login.invalid_username_password': 'خطأ في اسم المستخدم أو كلمة المرور',
    
    // User Profile
    'profile.fill_all_fields': 'الرجاء ملء جميع الحقول',
    'profile.password_min_length': 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل',
    'profile.passwords_dont_match': 'كلمة المرور الجديدة غير متطابقة',
    'profile.password_changed': 'تم تغيير كلمة المرور',
    'profile.password_changed_success': 'تم تغيير كلمة المرور بنجاح',
    'profile.session_expired': 'انتهت صلاحية الجلسة',
    'profile.current_password_incorrect': 'كلمة المرور الحالية غير صحيحة',
    'profile.settings_saved': 'تم حفظ الإعدادات',
    'profile.notification_preferences_saved': 'تم حفظ تفضيلات الإشعارات بنجاح',
    'profile.failed_get_file_url': 'لم يتم الحصول على رابط الملف',
    'profile.image_updated': '✅ تم تحديث الصورة',
    'profile.profile_image_uploaded_success': 'تم رفع صورة البروفايل بنجاح',
    'profile.upload_failed': '❌ فشل الرفع',
    'profile.profile_image_upload_failed': 'فشل رفع صورة البروفايل',
    
    // Project Documents Tab
    'project_doc.file_too_large': 'حجم الملف كبير جداً',
    'project_doc.moved': 'تم النقل',
    'project_doc.document_moved_success': 'تم نقل المستند بنجاح',
    'project_doc.move_failed': 'فشل نقل المستند',
    'project_doc.done': 'تم',
    'project_doc.folder_created_success': 'تم إنشاء المجلد بنجاح',
    'project_doc.folder_creation_failed': 'فشل إنشاء المجلد',
    
    // Permissions Module Names
    'permission.module.projects': 'المشاريع والعملاء',
    'permission.module.archive': 'الأرشيف والاتصالات',
    'permission.module.finance': 'المالية والمدفوعات',
    'permission.module.reports': 'التقارير',
    'permission.module.communication': 'التواصل',
    'permission.module.users': 'المستخدمين',
    'permission.module.system': 'النظام',
  },
  
  en: {
    // Authentication
    'systemName': 'Zwaya Construction',
    'systemSubtitle': 'Integrated Project Management Platform',
    'username': 'Username',
    'password': 'Password',
    'rememberMe': 'Remember me',
    'login': 'Login',
    'loading': 'Loading...',
    'login.title': 'Login',
    'login.subtitle': 'Project Management & Archive System',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.remember': 'Remember me',
    'login.forgot': 'Forgot password?',
    'login.submit': 'Login',
    'login.loading': 'Loading...',
    'login.error': 'Login Error',
    'login.invalid': 'Invalid username or password',

    // Dashboard / Sidebar Keys (Aliases)
    'overview': 'Overview',
    'approvals': 'Approvals',
    'archive': 'Archive',
    'adminComm': 'Admin Communications',
    'newIncoming': 'New Incoming',
    'newOutgoing': 'New Outgoing',
    'searchArchive': 'Search Archive',
    'barcodeScanner': 'Barcode Scanner',
    'reportsCenter': 'Reports Center',
    'projects': 'Projects',
    'projectsList': 'Projects List',
    'paymentRequests': 'Payment Requests',
    'changeOrders': 'Change Orders',
    'projectReports': 'Project Reports',
    'finance': 'Finance',
    'payments': 'Payments',
    'communication': 'Communication',
    'zawayaTalk': 'Zawaya Talk',
    'systemSettings': 'System Settings',
    'users': 'Users',
    'tenants': 'Organizations Management',
    'auditLogs': 'Audit Logs',
    'emailSettings': 'Email Settings',
    'backup': 'Backup',
    'systemStatus': 'System Status',
    'allTenants': 'All Tenants',
    'retry': 'Retry',
    'refresh': 'Refresh',
    'loadingSlow': 'Loading is taking longer than usual...',
    'accessDenied': 'Access Denied',
    'logout': 'Logout',
    
    // Roles
    'admin': 'Administrator',
    'manager': 'Manager',
    'editor': 'Editor',
    'accountant': 'Accountant',
    'supervisor': 'Supervisor',
    'member': 'Member',
    
    // Companies/Tenants
    'companies': 'Organizations Management',
    'manageTenants': 'Manage Organizations',
    'tenantName': 'Organization Name',
    'logoUrl': 'Logo URL',
    'tenantSignature': 'Organization Signature',
    'optional': 'Optional',
    
    // Navigation & Sidebar
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Projects',
    'nav.archive': 'Archive',
    'nav.finance': 'Finance',
    'nav.payments': 'Payments',
    'nav.payment_requests': 'Payment Requests',
    'nav.my_payments': 'My Payment Requests',
    'nav.reports': 'Reports',
    'nav.supervision': 'Supervision Reports',
    'nav.internal_reports': 'Internal Reports',
    'nav.users': 'Users',
    'nav.clients': 'Clients',
    'nav.approvals': 'Approvals',
    'nav.communication': 'Communication',
    'nav.chat': 'Chat',
    'nav.settings': 'Settings',
    'nav.system': 'System',
    'nav.backups': 'Backups',
    'nav.audit': 'Audit Logs',
    'nav.logout': 'Logout',
    'nav.profile': 'Profile',
    
    // Common Actions
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.view': 'View',
    'action.create': 'Create',
    'action.add': 'Add',
    'action.search': 'Search',
    'action.filter': 'Filter',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.print': 'Print',
    'action.download': 'Download',
    'action.upload': 'Upload',
    'action.refresh': 'Refresh',
    'action.back': 'Back',
    'action.next': 'Next',
    'action.previous': 'Previous',
    'action.submit': 'Submit',
    'action.approve': 'Approve',
    'action.reject': 'Reject',
    'action.close': 'Close',
    'action.confirm': 'Confirm',
    
    // Status
    'status.pending': 'Pending',
    'status.pending_approval': 'Pending Approval',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.completed': 'Completed',
    'status.active': 'Active',
    'status.inactive': 'Inactive',
    'status.draft': 'Draft',
    'status.collected': 'Collected',
    'status.paid': 'Paid',
    
    // Projects
    'projects.title': 'Project Management',
    'projects.new': 'New Project',
    'projects.name': 'Project Name',
    'projects.number': 'Project Number',
    'projects.client': 'Client',
    'projects.location': 'Location',
    'projects.contract_value': 'Contract Value',
    'projects.completion': 'Completion %',
    'projects.status': 'Status',
    'projects.start_date': 'Start Date',
    'projects.end_date': 'End Date',
    
    // Payments
    'payments.title': 'Payments',
    'payments.request': 'Payment Request',
    'payments.amount': 'Amount',
    'payments.description': 'Description',
    'payments.urgency': 'Urgency',
    'payments.date': 'Date',
    'payments.status': 'Status',
    'payments.requester': 'Requester',
    'payments.bank': 'Bank',
    'payments.transfer': 'Transfer Number',
    
    // Reports
    'reports.title': 'Reports',
    'reports.supervision': 'Supervision Report',
    'reports.new': 'New Report',
    'reports.number': 'Report Number',
    'reports.date': 'Visit Date',
    'reports.engineer': 'Supervising Engineer',
    'reports.phase': 'Phase',
    'reports.work_description': 'Work Description',
    'reports.recommendations': 'Recommendations',
    'reports.notes': 'Notes',
    'reports.attachments': 'Attachments',
    'reports.signatures': 'Signatures',
    
    // Users
    'users.title': 'User Management',
    'users.user': 'User',
    'users.position': 'Position',
    'users.manager': 'Manager',
    'common.actions': 'Actions',
    'users.new': 'New User',
    'users.name': 'Name',
    'users.username': 'Username',
    'users.email': 'Email',
    'users.phone': 'Phone',
    'users.role': 'Role',
    'users.permissions': 'Permissions',
    'users.active': 'Active',

    // Chat
    'chat.title': 'Zwaya Talk',
    'chat.search': 'Search messages...',
    'chat.attachments_only': 'Attachments Only',
    'chat.start': 'Start new conversation',
    'chat.typing': 'is typing...',
    'chat.private': 'Private Message',
    'chat.locked': 'Locked Message',
    'chat.type_message': 'Type a message...',
    'chat.only_me': 'Only',
    'common.preview': 'Preview',
    'common.open': 'Open',
    'common.remove': 'Remove',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'chat.no_permission': 'You do not have permission to send messages',
    'chat.select_recipient': 'Please select at least one recipient',
    'common.attachment': 'Attachment',
    'common.image': 'Image',
    'common.file': 'File',
    'chat.send': 'Send',
    'chat.reply': 'Reply',
    'chat.edit': 'Edit',
    'chat.delete': 'Delete',
    'chat.pin': 'Pin',
    'chat.unpin': 'Unpin',
    'chat.star': 'Star',
    'chat.starred': 'Starred Messages',
    'chat.online': 'Online',
    'chat.offline': 'Offline',
    'chat.audience': 'Audience',
    'chat.all': 'Everyone',
    'chat.search_placeholder': 'Search messages...',
    'chat.audience_select': 'Direct message to',

    // Roles
    'role.admin': 'Admin',
    'role.manager': 'Manager',
    'role.supervisor': 'Supervisor',
    'role.accountant': 'Accountant',
    'role.member': 'Member',
    'role.engineer': 'Engineer',

    // Clients
    'clients.title': 'Client Management',
    'clients.new': 'New Client',
    'clients.name': 'Client Name',
    'clients.contact': 'Contact',
    
    // Archive
    'archive.title': 'Archive',
    'archive.documents': 'Documents',
    'archive.upload': 'Upload Document',
    'archive.stamp': 'Stamp',
    
    // Settings
    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.email': 'Email',
    'settings.backup': 'Backup',
    'settings.language': 'Language',
    
    // Messages
    'msg.success': 'Operation successful',
    'msg.error': 'An error occurred',
    'msg.confirm_delete': 'Are you sure you want to delete?',
    'msg.no_data': 'No data available',
    'msg.loading': 'Loading...',
    'msg.saving': 'Saving...',
    
    // Time
    'time.today': 'Today',
    'time.yesterday': 'Yesterday',
    'time.this_week': 'This Week',
    'time.this_month': 'This Month',
    'time.all': 'All',
    
    // Misc
    'misc.sar': 'SAR',
    'misc.yes': 'Yes',
    'misc.no': 'No',
    'misc.or': 'or',
    'misc.and': 'and',
    'misc.all': 'All',
    'misc.none': 'None',
    'misc.select': 'Select...',
    'misc.required': 'Required',
    'misc.optional': 'Optional',

    // Login Page Additional
    'login.captcha_required': 'Please verify that you are not a robot',
    'login.having_trouble': 'Having trouble?',
    'login.download_android': 'Download Android App',
    'login.copyright': 'All Rights Reserved - Zwaya Construction Engineering Consultants',
    'login.encrypted_session': 'Enterprise Encrypted Session',
    
    // Dashboard Additional
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Welcome',
    'dashboard.total_projects': 'Total Projects',
    'dashboard.active_projects': 'Active Projects',
    'dashboard.pending_payments': 'Pending Payments',
    'dashboard.total_documents': 'Total Documents',
    'dashboard.recent_activities': 'Recent Activities',
    'dashboard.quick_actions': 'Quick Actions',
    'dashboard.statistics': 'Statistics',
    'dashboard.monthly_overview': 'Monthly Overview',
    
    // Document Types
    'document.incoming': 'Incoming',
    'document.outgoing': 'Outgoing',
    'document.internal': 'Internal',
    'document.contract': 'Contract',
    'document.invoice': 'Invoice',
    'document.report': 'Report',
    'document.letter': 'Letter',
    'document.memo': 'Memo',
    
    // Notifications
    'notification.title': 'Notifications',
    'notification.mark_read': 'Mark as read',
    'notification.mark_all_read': 'Mark all as read',
    'notification.no_notifications': 'No new notifications',
    'notification.view_all': 'View all',
    
    // Profile
    'profile.title': 'Profile',
    'profile.change_password': 'Change Password',
    'profile.current_password': 'Current Password',
    'profile.new_password': 'New Password',
    'profile.confirm_password': 'Confirm Password',
    'profile.update': 'Update Profile',
    
    // Errors
    'error.generic': 'An error occurred',
    'error.network': 'Network error, please try again',
    'error.unauthorized': 'You are not authorized to perform this action',
    'error.not_found': 'Item not found',
    'error.server': 'Server error, please try again later',
    'error.validation': 'Please check the entered data',
    
    // Confirmation
    'confirm.delete_title': 'Confirm Delete',
    'confirm.delete_message': 'Are you sure you want to delete this item?',
    'confirm.logout_title': 'Confirm Logout',
    'confirm.logout_message': 'Are you sure you want to logout?',
    'confirm.yes': 'Yes',
    'confirm.no': 'No',
    
    // Table
    'table.showing': 'Showing',
    'table.of': 'of',
    'table.entries': 'entries',
    'table.no_data': 'No data available',
    'table.loading': 'Loading...',
    'table.search': 'Search...',
    'table.per_page': 'Per page',
    
    // Forms
    'form.required_field': 'This field is required',
    'form.invalid_email': 'Invalid email address',
    'form.password_mismatch': 'Passwords do not match',
    'form.min_length': 'Minimum {0} characters required',
    'form.max_length': 'Maximum {0} characters allowed',
    
    // User Management - Positions
    'position.not_specified': 'Not Specified',
    'position.general_manager': 'General Manager',
    'position.project_manager': 'Project Manager',
    'position.department_manager': 'Department Manager',
    'position.supervisor': 'Supervisor',
    'position.engineer': 'Engineer',
    'position.technician': 'Technician',
    'position.employee': 'Employee',
    'position.trainee': 'Trainee',
    'position.external_consultant': 'External Consultant',
    
    // User Management - Scopes
    'scope.self_only': 'Own Data Only',
    'scope.direct_reports': 'Direct Reports',
    'scope.full_branch': 'Full Branch',
    'scope.all_system': 'All System',
    
    // User Management - Actions
    'user.edit': 'Edit User',
    'user.delete': 'Delete User',
    'user.inactive_status': 'Inactive',
    'user.team_member_assigned': 'Assigned',
    'user.member_added_success': 'Member added to team successfully',
    'user.failed_assign_user': 'Failed to assign user',
    'user.confirm_remove_member': 'Are you sure you want to remove this member from the team?',
    'user.deleted': 'Deleted',
    'user.member_removed': 'Member removed from team',
    
    // Team Management
    'team.work_team': 'Work Team',
    'team.manage_project_access': 'Manage Project Access Permissions',
    'team.add_new_member': 'Add New Member',
    'team.select_user': 'Select User...',
    'team.add': 'Add',
    'team.current_members': 'Current Members',
    'team.no_team_members': 'No team members currently',
    'team.assignment_date': 'Assignment Date',
    'team.remove': 'Remove',
    'team.close': 'Close',
    
    // Team Roles
    'team.role.lead_engineer': 'Lead Engineer',
    'team.role.supervisor': 'Supervisor',
    'team.role.site_engineer': 'Site Engineer',
    'team.role.engineer': 'Engineer',
    'team.role.accountant': 'Accountant',
    'team.role.assistant': 'Assistant',
    
    // Project Management
    'project.engineering_projects_management': 'Engineering Projects Management',
    'project.status.active': 'Active',
    'project.status.paused': 'Paused',
    'project.status.completed': 'Completed',
    'project.project_unit': 'Project',
    'project.clients': 'Clients',
    'project.refresh': 'Refresh',
    'project.view_mode': 'View',
    'project.new_project': 'New Project',
    'project.danger_zone': '⚠️ Danger Zone ⚠️',
    'project.confirm_delete_project': 'You are about to delete a project...',
    'project.project_name_mismatch': 'Project name does not match',
    'project.action_irreversible': 'This action cannot be undone',
    'project.deleted': 'Deleted',
    'project.project_deleted_success': 'Project deleted successfully',
    'project.updated': 'Updated',
    'project.project_updated_success': 'Project data updated successfully',
    'project.created': 'Created',
    'project.project_created_success': 'Project created successfully',
    'project.failed_fetch_project_details': 'Failed to fetch project details',
    
    // Document Form
    'doc.new_incoming_entry': 'New Incoming Entry',
    'doc.new_outgoing_entry': 'New Outgoing Entry',
    'doc.institution_name': 'Independent Institution: Zwaya Construction',
    'doc.transaction_number_note': 'Note: Transaction number will be generated automatically...',
    'doc.transaction_subject': 'Transaction Subject',
    'doc.from_entity': 'From Entity',
    'doc.select_entity': 'Select Entity',
    'doc.to_entity': 'To Entity',
    'doc.outgoing_incoming_date': 'Outgoing/Incoming Date',
    'doc.attachments': 'Attachments',
    'doc.example_attachment': 'Example: 1 CD',
    'doc.security_classification': 'Security Classification',
    'doc.normal_public': 'Normal - Available to Everyone',
    'doc.confidential_restricted': 'Confidential - Restricted Access',
    'doc.transaction_priority': 'Transaction Priority',
    'doc.normal_processing': 'Normal Processing',
    'doc.urgent_processing': 'Urgent Processing',
    'doc.statement_optional': 'Statement (Optional)',
    'doc.attachment_page_count': 'Attachment Page Count',
    'doc.upload_original_for_stamping': 'Upload original document for barcode stamping',
    'doc.pdf_format_only': 'PDF format only',
    'doc.select_pdf_file': 'Select PDF File',
    'doc.generate_unified_barcode': 'Generate Unified Digital Barcode',
    
    // Document List
    'doc.quick_search': 'Quick Search',
    'doc.search_placeholder': 'Barcode, Subject, Entity...',
    'doc.from_date': 'From Date',
    'doc.to_date': 'To Date',
    'doc.entry_type': 'Entry Type',
    'doc.all': 'All',
    'doc.incoming': 'Incoming',
    'doc.outgoing': 'Outgoing',
    'doc.reset_filters': 'Reset Filters',
    'doc.extract_report': 'Extract Report',
    'doc.unified_identifier': 'Unified Identifier',
    'doc.entry_details': 'Entry Details',
    'doc.additional_data': 'Additional Data',
    'doc.actions': 'Actions',
    'doc.from': 'From:',
    'doc.to': 'To:',
    'doc.entry_by': 'Entry by:',
    'doc.attachments_label': 'Attachments:',
    'doc.view_attachment': 'View Attachment',
    'doc.confirm_delete_attachment': 'Do you want to delete the attachment',
    'doc.add_attachment': 'Add Attachment',
    'doc.stamp_document': 'Stamp Document',
    
    // Dashboard
    'dashboard.dashboard': 'Dashboard',
    'dashboard.comprehensive_system_overview': 'Comprehensive System Overview and Statistics',
    'dashboard.total': 'Total',
    'dashboard.registered_transactions': 'Registered Transactions',
    'dashboard.incoming_transactions': 'Incoming Transactions',
    'dashboard.outgoing_transactions': 'Outgoing Transactions',
    'dashboard.urgent': 'Urgent',
    'dashboard.requires_attention': 'Requires Attention',
    'dashboard.projects': 'Projects',
    'dashboard.active': 'Active',
    'dashboard.completed': 'Completed',
    'dashboard.finance': 'Finance',
    'dashboard.pending_invoices': 'Pending Invoices',
    'dashboard.users': 'Users',
    'dashboard.admin_user_counts': 'Admin - User',
    'dashboard.institutions': 'Institutions',
    'dashboard.registered_institution': 'Registered Institution',
    'dashboard.activity_trends': 'Activity Trends',
    'dashboard.compare_incoming_outgoing': 'Compare incoming and outgoing during selected period',
    'dashboard.daily': 'Daily',
    'dashboard.weekly': 'Weekly',
    'dashboard.monthly': 'Monthly',
    
    // Payments Management
    'payment.financial_payments': 'Financial Payments',
    'payment.manage_payment_requests': 'Manage and Track Payment Requests and Project Cash Flows',
    'payment.total_contracts': 'Total Contracts',
    'payment.pending_requests': 'Pending Requests',
    'payment.collected': 'Collected',
    'payment.collection_rate': 'Collection Rate',
    'payment.very_urgent': 'Very Urgent',
    'payment.high': 'High',
    'payment.medium': 'Medium',
    'payment.normal': 'Normal',
    'payment.all_requests': 'All Requests',
    'payment.pending': 'Pending',
    'payment.must_attach_invoice': 'Must attach invoice image',
    'payment.must_attach_transfer_receipt': 'Must attach transfer receipt',
    'payment.must_write_collection_note': 'Must write collection note',
    
    // Payment Center
    'payment.payment_center': 'Payment Center',
    'payment.manage_project_payment_requests': 'Manage Project Payment Requests',
    'payment.request_due_payment': 'Request Due Payment',
    'payment.contract_value': 'Contract Value',
    'payment.total_collected': 'Total Collected',
    'payment.remaining': 'Remaining',
    'payment.create_payment_disbursement': 'Create Payment Disbursement Request',
    'payment.cancel': 'Cancel',
    'payment.send_request': 'Send Request',
    'payment.requested_amount': 'Requested Amount',
    'payment.sar': 'SAR',
    'payment.request_description': 'Request Description',
    'payment.explain_payment_reason': 'Explain reason for payment request...',
    'payment.priority_level': 'Priority Level',
    
    // My Payment Requests
    'payment.my_payment_requests': 'My Payment Requests',
    'payment.view_all_submitted_requests': 'View all payment requests submitted in all projects',
    'payment.total_requests': 'Total Requests',
    'payment.total': 'Total',
    'payment.no_requests': 'No Requests',
    'payment.no_submitted_requests_yet': 'You have not submitted any payment requests yet',
    'payment.request_details': 'Request Details',
    'payment.collection_data': 'Collection Data',
    
    // Change Orders
    'change_order.change_orders': 'Change Orders',
    'change_order.manage_change_orders_modifications': 'Manage Change Orders and Project Modifications',
    'change_order.new_change_order': 'New Change Order',
    'change_order.financial_impact': 'Financial Impact',
    'change_order.all_projects': 'All Projects',
    'change_order.no_change_orders': 'No Change Orders',
    'change_order.create_first_change_order': 'Create a new change order to get started',
    'change_order.time_impact': 'Time Impact',
    'change_order.no_impact': 'No Impact',
    
    // Clients Management
    'client.clients_management': 'Clients Management',
    'client.x_clients': '{0} Clients',
    'client.new_client': 'New Client',
    'client.search_by_name_company': 'Search by name / company / phone / email...',
    'client.loading_clients': 'Loading clients...',
    'client.cannot_delete_client_with_projects': 'Cannot delete client linked to projects',
    'client.edit_client': 'Edit Client',
    'client.add_client': 'Add Client',
    'client.basic_client_data': 'Basic Client Data',
    'client.name': 'Name',
    'client.company': 'Company',
    'client.phone': 'Phone',
    'client.email': 'Email',
    'client.address': 'Address',
    'client.notes': 'Notes',
    
    // Communication (Chat)
    'comm.direct_message_to': 'Direct Message To',
    'comm.select_recipients': 'Select recipients to see the message',
    'comm.all': 'All',
    'comm.typing': 'typing...',
    'comm.send_failed_check_connection': 'Send failed: Check connection',
    
    // Internal Reports
    'internal_report.internal_reports': 'Internal Reports',
    'internal_report.project_reports': 'Project Reports:',
    'internal_report.new_report': 'New Report',
    'internal_report.loading_reports': 'Loading reports...',
    'internal_report.no_internal_reports': 'No Internal Reports',
    'internal_report.create_first_internal_report': 'Create a new internal report to get started',
    'internal_report.add_first_report': 'Add First Report',
    'internal_report.untitled_report': 'Untitled Report',
    'internal_report.new': 'New',
    'internal_report.notes': 'Notes:',
    'internal_report.attachments': 'Attachments',
    'internal_report.attachment': 'Attachment',
    'internal_report.comments': 'Comments',
    'internal_report.add_comment': 'Add comment...',
    
    // Supervision Reports Form
    'supervision.create_supervision_report': 'Create New Supervision Report',
    'supervision.edit_supervision_report': 'Edit Supervision Report',
    'supervision.save_report': 'Save Report',
    'supervision.report_revision_required': 'Report Revision Required',
    'supervision.with_note': 'With Note:',
    'supervision.visit_project_data': 'Visit and Project Data',
    'supervision.visit_date': 'Visit Date',
    'supervision.visit_time': 'Visit Time',
    'supervision.completion_percentage': 'Completion Percentage %',
    'supervision.current_work_phase': 'Current Work Phase',
    'supervision.phase_example': 'Example: Excavation, Foundation Pouring...',
    'supervision.work_details_notes': 'Work Details and Notes',
    'supervision.executed_work_description': 'Executed Work Description',
    'supervision.precise_work_description': 'Precise description of work received',
    'supervision.write_detailed_description': 'Write detailed description of work completed...',
    'supervision.consultant_recommendations': 'Consultant Recommendations',
    'supervision.write_consultant_recommendations': 'Write consultant recommendations to contractor...',
    'supervision.additional_recommendations': 'Additional Recommendations and Notes',
    'supervision.any_recommendations': 'Any recommendations or notes to contractor...',
    'supervision.next_visit_plan': 'Next Visit Work Plan',
    'supervision.expected_work': 'What work is expected to be completed...',
    'supervision.attachments_photos': 'Attachments and Photos',
    'supervision.photo_caption': 'Photo Caption',
    'supervision.write_photo_description': 'Write description or comment on this photo...',
    'supervision.add_photo': 'Add Photo',
    'supervision.click_to_upload': 'Click to Upload Photo',
    'supervision.must_upload_high_quality_photos': 'Must upload high-quality photos to document work',
    
    // Supervision Reports List
    'supervision.supervision_reports': 'Supervision Reports',
    'supervision.pending_approval': 'Pending Approval',
    'supervision.revision_requested': 'Revision Requested',
    'supervision.no_supervision_reports': 'No Supervision Reports',
    'supervision.create_first_supervision_report': 'Create a new supervision report to get started',
    'supervision.phase': 'Phase',
    'supervision.supervising_engineer': 'Supervising Engineer',
    'supervision.exported': 'Exported',
    'supervision.reports_exported_success': 'Reports exported successfully',
    
    // Approvals
    'approval.approvals_system': 'Approvals System',
    'approval.manage_requests_approvals': 'Manage Requests and Official Approvals',
    'approval.my_requests': 'My Requests',
    'approval.for_approval': 'For Approval',
    'approval.new_request': 'New Request',
    
    // Login - Additional
    'login.loading_verification_system': 'Loading verification system...',
    'login.verification_failed': 'Verification failed, please try again',
    'login.invalid_username_password': 'Invalid username or password',
    
    // User Profile
    'profile.fill_all_fields': 'Please fill all fields',
    'profile.password_min_length': 'New password must be at least 6 characters',
    'profile.passwords_dont_match': 'New passwords do not match',
    'profile.password_changed': 'Password Changed',
    'profile.password_changed_success': 'Password changed successfully',
    'profile.session_expired': 'Session expired',
    'profile.current_password_incorrect': 'Current password is incorrect',
    'profile.settings_saved': 'Settings Saved',
    'profile.notification_preferences_saved': 'Notification preferences saved successfully',
    'profile.failed_get_file_url': 'Failed to get file URL',
    'profile.image_updated': '✅ Image Updated',
    'profile.profile_image_uploaded_success': 'Profile image uploaded successfully',
    'profile.upload_failed': '❌ Upload Failed',
    'profile.profile_image_upload_failed': 'Profile image upload failed',
    
    // Project Documents Tab
    'project_doc.file_too_large': 'File size is too large',
    'project_doc.moved': 'Moved',
    'project_doc.document_moved_success': 'Document moved successfully',
    'project_doc.move_failed': 'Move failed',
    'project_doc.done': 'Done',
    'project_doc.folder_created_success': 'Folder created successfully',
    'project_doc.folder_creation_failed': 'Folder creation failed',
    
    // Permissions Module Names
    'permission.module.projects': 'Projects & Clients',
    'permission.module.archive': 'Archive & Communications',
    'permission.module.finance': 'Finance & Payments',
    'permission.module.reports': 'Reports',
    'permission.module.communication': 'Communication',
    'permission.module.users': 'Users',
    'permission.module.system': 'System',
  }
}

// ============================================================================
// PROVIDER
// ============================================================================

interface LanguageProviderProps {
  children: ReactNode
  defaultLanguage?: Language
}

export function LanguageProvider({ children, defaultLanguage = 'ar' }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage)
  
  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('app_language') as Language | null
    if (stored && (stored === 'ar' || stored === 'en')) {
      setLanguageState(stored)
    }
  }, [])
  
  // Update document attributes when language changes
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])
  
  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('app_language', lang)
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }
  
  const toggleLanguage = () => {
    const newLang = language === 'ar' ? 'en' : 'ar'
    setLanguage(newLang)
  }
  
  const t = (key: string): string => {
    return translations[language][key] || translations['ar'][key] || key
  }
  
  const isRTL = language === 'ar'
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    // Return default values for SSR or when used outside provider
    return {
      language: 'ar' as Language,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: string) => key,
      isRTL: true
    }
  }
  return context
}

// ============================================================================
// LANGUAGE SWITCHER COMPONENT
// ============================================================================

interface LanguageSwitcherProps {
  variant?: 'button' | 'dropdown' | 'minimal'
  className?: string
}

export function LanguageSwitcher({ variant = 'button', className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage()
  
  if (variant === 'minimal') {
    return (
      <button
        onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
        className={`p-2 rounded-lg hover:bg-slate-100 transition-colors text-sm font-bold ${className}`}
        title={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
      >
        {language === 'ar' ? 'EN' : 'عربي'}
      </button>
    )
  }
  
  if (variant === 'dropdown') {
    return (
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className={`px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      >
        <option value="ar">{'العربية'}</option>
        <option value="en">English</option>
      </select>
    )
  }
  
  // Default button variant
  return (
    <div className={`flex items-center gap-1 bg-slate-100 rounded-xl p-1 ${className}`}>
      <button
        onClick={() => setLanguage('ar')}
        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
          language === 'ar' 
            ? 'bg-white text-blue-600 shadow-sm' 
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        عربي
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
          language === 'en' 
            ? 'bg-white text-blue-600 shadow-sm' 
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        EN
      </button>
    </div>
  )
}

export default { LanguageProvider, useLanguage, LanguageSwitcher }

