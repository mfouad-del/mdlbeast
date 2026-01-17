"use client"

/**
 * ============================================================================
 * User Management - Tree View Component
 * ============================================================================
 * 
 * واجهة إدارة المستخدمين مع عرض شجري (Tree Hierarchy)
 * 
 * المميزات:
 * - عرض المستخدمين كشجرة هرمية
 * - سحب وإفلات لتغيير التبعية
 * - صلاحيات عبر checkboxes
 * - إضافة/تعديل/حذف المستخدمين
 * 
 * @version 2.0
 * @author Mahmoud Fouad
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  UserPlus, Trash2, Edit3, Check, X, Shield, Mail, Lock, 
  UserCircle, Users, Building2, Phone, Bell,
  Loader2, GripVertical, User2, Crown, Star, FileSignature, Stamp, Upload
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { apiClient } from '../lib/api-client'
import { useToast } from '../hooks/use-toast'
import { useLanguage } from '../lib/language-context'
import type { User } from '../types'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, Position, useReactFlow, Node, Edge, ReactFlowProvider, Handle, MarkerType } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'

// ============================================================================
// TYPES
// ============================================================================

interface UserWithChildren extends User {
  children?: UserWithChildren[]
  position?: string
  department?: string
  scope?: string
  phone?: string
  is_active?: boolean
  permissions?: UserPermissions
  notify_on_document?: boolean
  notify_on_approval?: boolean
  notify_on_password_change?: boolean
  notify_on_report?: boolean
}

// ============================================================================
// هيكل الصلاحيات - مشروع الاتصالات الإدارية
// Administrative Communications Project - Permissions Structure
// ============================================================================
interface UserPermissions {
  // 1. الاتصالات الإدارية (الأرشيف - الصادر/الوارد)
  archive?: {
    view_idx?: boolean    // عرض القسم في السايدبار
    view_all?: boolean    // عرض جميع المستندات
    view_own?: boolean    // عرض المستندات الخاصة فقط
    create?: boolean      // إنشاء مستند جديد
    edit?: boolean        // تعديل المستندات
    delete?: boolean      // حذف المستندات
    stamp?: boolean       // ختم المستندات
    export?: boolean      // تصدير/طباعة المستندات
  }

  // 2. التقارير
  reports?: {
    view_idx?: boolean          // عرض القسم في السايدبار
    view_all?: boolean          // عرض جميع التقارير
    view_own?: boolean          // عرض التقارير الخاصة فقط
    create?: boolean            // إنشاء تقرير
    export?: boolean            // تصدير/طباعة التقارير
  }

  // 3. إدارة المستخدمين
  users?: {
    view_idx?: boolean          // عرض القسم في السايدبار
    view_list?: boolean         // عرض قائمة المستخدمين
    create?: boolean            // إضافة مستخدم جديد
    edit?: boolean              // تعديل بيانات المستخدمين
    delete?: boolean            // حذف المستخدمين
    manage_permissions?: boolean // إدارة الصلاحيات
    view_audit_logs?: boolean   // عرض سجل العمليات
  }

  // 4. إعدادات النظام
  system?: {
    view_idx?: boolean          // عرض القسم في السايدبار
    manage_settings?: boolean   // تعديل الإعدادات
    manage_backups?: boolean    // إدارة النسخ الاحتياطي
  }

  // 5. التواصل الداخلي
  communication?: {
    access_chat?: boolean       // الوصول للدردشة
    view_announcements?: boolean // مشاهدة الإعلانات
    moderate_chat?: boolean     // إدارة الدردشة
  }

  // 6. الموافقات والاعتمادات
  approvals?: {
    view_idx?: boolean          // عرض القسم في السايدبار
    view_own?: boolean          // عرض طلباتي
    view_pending?: boolean      // عرض الطلبات المعلقة
    action_approve?: boolean    // صلاحية الموافقة
    action_reject?: boolean     // صلاحية الرفض
  }

  __mode?: 'inherit' | 'custom'
}

interface UserManagementProps {
  users: User[]
  onUpdateUsers: (users: User[]) => void
  currentUserEmail: string
  currentUserRole?: string
}

interface CustomNode {
  id: string
  type?: string
  data: any
  position: { x: number; y: number }
  draggable?: boolean
  sourcePosition?: Position
  targetPosition?: Position
  width?: number
  height?: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

const POSITIONS = [
  { value: '', label: '-- لم يُحدد --' },
  { value: 'مدير عام', label: 'مدير عام' },
  { value: 'مدير مشاريع', label: 'مدير مشاريع' },
  { value: 'مدير قسم', label: 'مدير قسم' },
  { value: 'مشرف', label: 'مشرف' },
  { value: 'مهندس', label: 'مهندس' },
  { value: 'فني', label: 'فني' },
  { value: 'موظف', label: 'موظف' },
  { value: 'متدرب', label: 'متدرب' },
  { value: 'استشاري خارجي', label: 'استشاري خارجي' },
]

const SCOPES = [
  { value: 'self', label: 'بياناته فقط' },
  { value: 'children', label: 'المرؤوسين المباشرين' },
  { value: 'tree', label: 'كامل الفرع' },
  { value: 'all', label: 'كل النظام' },
]

// ============================================================================
// الصلاحيات الافتراضية - مشروع الاتصالات الإدارية
// ============================================================================
const DEFAULT_PERMISSIONS: UserPermissions = {
  archive: { view_idx: true, view_all: false, view_own: true, create: true, edit: false, delete: false, stamp: false, export: false },
  reports: { view_idx: true, view_all: false, view_own: true, create: false, export: false },
  users: { view_idx: false, view_list: false, create: false, edit: false, delete: false, manage_permissions: false, view_audit_logs: false },
  system: { view_idx: false, manage_settings: false, manage_backups: false },
  communication: { access_chat: true, view_announcements: true, moderate_chat: false },
  approvals: { view_idx: true, view_own: true, view_pending: false, action_approve: false, action_reject: false }
}

// الصلاحيات الافتراضية لكل دور
const ROLE_DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
  // مدير النظام - صلاحيات كاملة
  admin: {
    archive: { view_idx: true, view_all: true, view_own: true, create: true, edit: true, delete: true, stamp: true, export: true },
    reports: { view_idx: true, view_all: true, view_own: true, create: true, export: true },
    users: { view_idx: true, view_list: true, create: true, edit: true, delete: true, manage_permissions: true, view_audit_logs: true },
    system: { view_idx: true, manage_settings: true, manage_backups: true },
    communication: { access_chat: true, view_announcements: true, moderate_chat: true },
    approvals: { view_idx: true, view_own: true, view_pending: true, action_approve: true, action_reject: true }
  },
  
  // المدير - صلاحيات إدارية محدودة
  manager: {
    archive: { view_idx: true, view_all: true, view_own: true, create: true, edit: true, delete: false, stamp: true, export: true },
    reports: { view_idx: true, view_all: true, view_own: true, create: true, export: true },
    users: { view_idx: true, view_list: true, create: true, edit: true, delete: false, manage_permissions: false, view_audit_logs: true },
    system: { view_idx: false, manage_settings: false, manage_backups: false },
    communication: { access_chat: true, view_announcements: true, moderate_chat: true },
    approvals: { view_idx: true, view_own: true, view_pending: true, action_approve: true, action_reject: true }
  },
  
  // المشرف - صلاحيات تشغيلية
  supervisor: { 
    archive: { view_idx: true, view_all: true, view_own: true, create: true, edit: true, delete: false, stamp: false, export: true },
    reports: { view_idx: true, view_all: true, view_own: true, create: true, export: false },
    users: { view_idx: false, view_list: false, create: false, edit: false, delete: false, manage_permissions: false, view_audit_logs: false },
    system: { view_idx: false, manage_settings: false, manage_backups: false },
    communication: { access_chat: true, view_announcements: true, moderate_chat: false },
    approvals: { view_idx: true, view_own: true, view_pending: false, action_approve: false, action_reject: false }
  },

  // العضو العادي - صلاحيات أساسية
  member: {
    archive: { view_idx: true, view_all: false, view_own: true, create: true, edit: false, delete: false, stamp: false, export: false },
    reports: { view_idx: true, view_all: false, view_own: true, create: false, export: false },
    users: { view_idx: false, view_list: false, create: false, edit: false, delete: false, manage_permissions: false, view_audit_logs: false },
    system: { view_idx: false, manage_settings: false, manage_backups: false },
    communication: { access_chat: true, view_announcements: true, moderate_chat: false },
    approvals: { view_idx: true, view_own: true, view_pending: false, action_approve: false, action_reject: false }
  }
}

// دمج الصلاحيات (المخصصة تتجاوز الافتراضية)
function mergePermissions(base: UserPermissions, custom: Partial<UserPermissions> | null | undefined): UserPermissions {
  if (!custom) return { ...base }
  
  const merged: any = {}
  
  for (const [module, perms] of Object.entries(base)) {
    if (perms && typeof perms === 'object') {
      merged[module] = {
        ...perms,
        ...(custom as any)[module]
      }
    }
  }
  
  return merged as UserPermissions
}

// جلب الصلاحيات النهائية لمستخدم (دمج الدور + المخصصة)
function getUserMergedPermissions(role: string, customPermissions?: Partial<UserPermissions> | null): UserPermissions {
  const normalizedRole = (role || 'member').toLowerCase()
  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[normalizedRole] || ROLE_DEFAULT_PERMISSIONS.member
  return mergePermissions(roleDefaults, customPermissions)
}

// حساب الاختلافات بين الصلاحيات المعدلة والصلاحيات الافتراضية للدور
// يُرجع فقط الصلاحيات المختلفة للحفظ في قاعدة البيانات
function getPermissionDiff(role: string, currentPermissions: UserPermissions): Partial<UserPermissions> | null {
  const normalizedRole = (role || 'member').toLowerCase()
  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[normalizedRole] || ROLE_DEFAULT_PERMISSIONS.member
  
  const diff: any = {}
  let hasDiff = false
  
  for (const [module, perms] of Object.entries(currentPermissions)) {
    if (!perms || typeof perms !== 'object') continue
    
    const defaultPerms = (roleDefaults as any)[module] || {}
    const moduleDiff: any = {}
    let hasModuleDiff = false
    
    for (const [action, value] of Object.entries(perms)) {
      if (defaultPerms[action] !== value) {
        moduleDiff[action] = value
        hasModuleDiff = true
      }
    }
    
    if (hasModuleDiff) {
      diff[module] = moduleDiff
      hasDiff = true
    }
  }
  
  return hasDiff ? diff : null
}

const NODE_WIDTH = 280
const NODE_HEIGHT = 100

// ============================================================================
// LAYOUT FUNCTION
// ============================================================================

const getLayoutedElements = (nodes: CustomNode[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR'
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    node.targetPosition = isHorizontal ? Position.Left : Position.Top
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom
    node.position = {
      x: nodeWithPosition.x - NODE_WIDTH / 2,
      y: nodeWithPosition.y - NODE_HEIGHT / 2,
    }
    return node
  })

  return { nodes, edges }
}

// ============================================================================
// CUSTOM NODE COMPONENT
// ============================================================================

const UserNode = ({ data }: { data: { user: UserWithChildren, onEdit: (user: UserWithChildren) => void, onDelete: (user: UserWithChildren) => void } }) => {
  const { user, onEdit, onDelete } = data

  const getRoleIcon = (role: string) => {
    const r = String(role).toLowerCase()
    if (r === 'admin') return <Crown className="text-purple-500" size={14} /> // Slightly smaller for new layout
    if (r === 'manager') return <Star className="text-blue-500" size={14} />
    if (r === 'supervisor') return <Shield className="text-orange-500" size={14} />
    return <User2 className="text-slate-400" size={14} />
  }

  const getRoleColor = (role: string) => {
    const r = String(role).toLowerCase()
    if (r === 'admin') return 'bg-purple-50 border-purple-200'
    if (r === 'manager') return 'bg-blue-50 border-blue-200'
    if (r === 'supervisor') return 'bg-orange-50 border-orange-200'
    return 'bg-white border-slate-200'
  }

  const getRoleLabel = (role: string) => { 
      return user.role === 'admin' ? 'مدير نظام' : user.role === 'manager' ? 'مدير' : user.role === 'supervisor' ? 'مشرف' : 'مستخدم'
  }

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-xl cursor-grab active:cursor-grabbing
        transition-all duration-200 group relative border shadow-sm hover:shadow-md
        ${getRoleColor(user.role)}
        ${!user.is_active && user.is_active !== undefined ? 'opacity-60 grayscale' : ''}
      `}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white !shadow"
        style={{ top: -6 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white !shadow"
        style={{ bottom: -6 }}
      />

      {/* Drag Handle (Subtle) */}
      <div className="absolute top-2 left-2 text-slate-300 group-hover:text-slate-500">
        <GripVertical size={14} />
      </div>

      {/* Avatar - Larger & Centered Vertical Alignment */}
      <div className="shrink-0 pt-1">
        {(user as any).profile_picture_url ? (
            <img 
            src={(user as any).profile_picture_url.startsWith('http') 
                ? (user as any).profile_picture_url 
                : `/uploads/proxy?key=${(user as any).profile_picture_url}`}
            alt={user.full_name || user.username}
            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
            onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
            }}
            />
        ) : null}
        <div 
            className="w-12 h-12 rounded-full bg-slate-800 text-white items-center justify-center font-bold text-lg border-2 border-white shadow-sm"
            style={{ display: (user as any).profile_picture_url ? 'none' : 'flex' }}
        >
            {(user.full_name || user.username || '').substring(0, 2).toUpperCase()}
        </div>
      </div>
      
      {/* User Info - Expanded */}
      <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-bold text-sm text-slate-900 truncate" title={user.full_name}>
            {user.full_name || user.username}
          </span>
          {getRoleIcon(user.role)}
        </div>
        
        <div className="text-[10px] font-medium text-slate-500 truncate mb-1" title={user.email}>
          {user.position || user.email} 
        </div>

        <div className="flex items-center gap-2 mt-auto">
             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 shadow-sm inline-flex items-center`}>
                {getRoleLabel(user.role)}
            </span>
             {!user.is_active && (
                 <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">غير نشط</span>
             )}
        </div>
      </div>
      
      {/* Actions (Absolute Top Right) */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-0.5 rounded-lg backdrop-blur-sm shadow-sm border border-slate-100 nodrag">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(user) }}
          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all nodrag"
          title="تعديل"
        >
          <Edit3 size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(user) }}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all nodrag"
          title="حذف"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

const nodeTypes = {
  userNode: UserNode,
}

// ============================================================================
// PERMISSIONS EDITOR COMPONENT (Refactored: Clean, No Icons, Professional)
// ============================================================================

interface PermissionsEditorProps {
  permissions: UserPermissions
  onChange: (permissions: UserPermissions) => void
  canManagePermissions: boolean
  role: string
}

const PermissionsEditor: React.FC<PermissionsEditorProps> = ({ permissions, onChange, canManagePermissions, role }) => {
  const { t } = useLanguage()
  const updatePermission = (category: keyof UserPermissions, action: string, value: boolean) => {
    const updated = { ...permissions }
    if (!updated[category]) {
      (updated as any)[category] = {}
    }
    ;(updated[category] as any)[action] = value
    onChange(updated)
  }

  const normalizedRole = String(role || 'member').toLowerCase()
  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[normalizedRole] || ROLE_DEFAULT_PERMISSIONS.member

  const isDifferentFromRole = (category: keyof UserPermissions, action: string) => {
    const current = (permissions[category] as any)?.[action] === true
    const base = (roleDefaults as any)?.[category]?.[action] === true
    return current !== base
  }

  // Categories - مشروع الاتصالات الإدارية فقط
  const permissionCategories = [
    {
      id: 'archive_tab',
      label: 'الاتصالات الإدارية',
      description: 'إدارة المستندات والصادر والوارد والختم الإلكتروني',
      groups: [
        { title: 'الوصول', moduleId: 'archive', actions: ['view_idx', 'view_all', 'view_own'] },
        { title: 'إدارة المستندات', moduleId: 'archive', actions: ['create', 'edit', 'delete'] },
        { title: 'الأدوات', moduleId: 'archive', actions: ['stamp', 'export'] }
      ]
    },
    {
      id: 'reports_tab',
      label: 'التقارير',
      description: 'عرض وإنشاء وتصدير التقارير',
      groups: [
        { title: 'الوصول', moduleId: 'reports', actions: ['view_idx', 'view_all', 'view_own'] },
        { title: 'الإدارة', moduleId: 'reports', actions: ['create', 'export'] }
      ]
    },
    {
      id: 'users_tab',
      label: 'المستخدمين',
      description: 'إدارة المستخدمين والصلاحيات',
      groups: [
        { title: 'إدارة المستخدمين', moduleId: 'users', actions: ['view_idx', 'view_list', 'create', 'edit', 'delete'] },
        { title: 'الأمان', moduleId: 'users', actions: ['manage_permissions', 'view_audit_logs'] }
      ]
    },
    {
      id: 'system_tab',
      label: 'النظام',
      description: 'إعدادات النظام والنسخ الاحتياطي',
      groups: [
        { title: 'الإعدادات', moduleId: 'system', actions: ['view_idx', 'manage_settings', 'manage_backups'] }
      ]
    },
    {
      id: 'communication_tab',
      label: 'التواصل',
      description: 'الدردشة الداخلية والإعلانات',
      groups: [
        { title: 'الدردشة', moduleId: 'communication', actions: ['access_chat', 'view_announcements', 'moderate_chat'] }
      ]
    },
    {
      id: 'approvals_tab',
      label: 'الاعتمادات',
      description: 'الموافقات والطلبات',
      groups: [
        { title: 'العرض', moduleId: 'approvals', actions: ['view_idx', 'view_own', 'view_pending'] },
        { title: 'الإجراءات', moduleId: 'approvals', actions: ['action_approve', 'action_reject'] }
      ]
    }
  ]

  // Arabic Labels
  const actionLabels: Record<string, string> = {
    view_idx: 'عرض في السايدبار',
    view_all: 'عرض الكل',
    view_own: 'عرض الخاص فقط',
    create: 'إنشاء جديد',
    edit: 'تعديل',
    delete: 'حذف',
    stamp: 'الختم الإلكتروني',
    export: 'تصدير/طباعة',
    view_list: 'عرض القائمة',
    manage_permissions: 'إدارة الصلاحيات',
    view_audit_logs: 'سجل العمليات',
    manage_settings: 'إعدادات النظام',
    manage_backups: 'النسخ الاحتياطي',
    access_chat: 'الوصول للدردشة',
    view_announcements: 'مشاهدة الإعلانات',
    moderate_chat: 'إدارة الدردشة',
    view_pending: 'الطلبات المعلقة',
    action_approve: 'الموافقة',
    action_reject: 'الرفض'
  }

  const [activeTab, setActiveTab] = React.useState('archive_tab')
  const [currentMode, setCurrentMode] = React.useState<'inherit' | 'custom'>(permissions.__mode || 'inherit')

  const toggleMode = (newMode: 'inherit' | 'custom') => {
    setCurrentMode(newMode)
    onChange({ ...permissions, __mode: newMode })
  }

  const currentCategory = permissionCategories.find(c => c.id === activeTab) || permissionCategories[0]

  const handleBulkChange = (check: boolean) => {
    const newPerms = { ...permissions }
    currentCategory.groups.forEach(group => {
      const moduleId = group.moduleId
      if (moduleId) {
        if (!newPerms[moduleId as keyof UserPermissions]) (newPerms as any)[moduleId] = {}
        group.actions.forEach((action: string) => {
          (newPerms as any)[moduleId][action] = check
        })
      }
    })
    onChange(newPerms)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[750px]">
      
      {/* Header Area */}
      <div className="bg-white border-b border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xl font-bold text-slate-800 tracking-tight">إدارة الصلاحيات</h4>
            <p className="text-sm text-slate-500 mt-1">تحكم دقيق بصلاحيات الوصول والعمليات في النظام</p>
          </div>
          
          <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => toggleMode('inherit')}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                currentMode === 'inherit' 
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              وراثة (Role Based)
            </button>
            <button
              type="button"
              onClick={() => toggleMode('custom')}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                currentMode === 'custom' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              مخصص (Custom)
            </button>
          </div>
        </div>

        {currentMode === 'custom' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
            تنبيه: أنت الآن في الوضع المخصص. لن يتأثر هذا المستخدم بأي تحديثات مستقبلية لصلاحيات دوره الأساسي.
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Minimal Sidebar */}
        <div className="w-60 bg-slate-50/50 border-l border-slate-100 overflow-y-auto p-4 space-y-1 shrink-0">
            {permissionCategories.map(cat => {
                const isActive = activeTab === cat.id
                // Count active permissions
                let count = 0
                cat.groups.forEach((group: any) => {
                   const moduleId = group.moduleId
                   if (moduleId) {
                     group.actions.forEach((action: string) => {
                        if ((permissions[moduleId as keyof UserPermissions] as any)?.[action] === true) count++
                     })
                   }
                })

                return (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveTab(cat.id)}
                        className={`w-full text-right px-4 py-3 rounded-xl transition-all ${
                            isActive 
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-100 font-bold' 
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-medium'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm">{cat.label}</span>
                            {count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isActive ? 'bg-slate-100 text-slate-800' : 'bg-slate-200 text-slate-600'}`}>
                                    {count}
                                </span>
                            )}
                        </div>
                    </button>
                )
            })}
        </div>

        {/* Content Area - Clean Grid */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
            <div className="flex items-center justify-between mb-8">
                <div>
                     <h5 className="text-2xl font-bold text-slate-900 mb-2">{currentCategory.label}</h5>
                     <p className="text-sm text-slate-500">{currentCategory.description}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => handleBulkChange(true)}
                        disabled={!canManagePermissions}
                        className="text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                    >
                        تفعيل الجميع
                    </button>
                    <div className="w-px h-6 bg-slate-200 my-auto"></div>
                    <button
                        type="button"
                        onClick={() => handleBulkChange(false)}
                        disabled={!canManagePermissions}
                         className="text-xs font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                    >
                        إلغاء الجميع
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {currentCategory.groups.map((group, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                        <h6 className="text-sm font-black text-slate-800 mb-5 pb-3 border-b border-slate-50 flex items-center justify-between">
                            {group.title}
                        </h6>
                        <div className="space-y-4">
                            {group.actions.map(action => {
                                const moduleId = group.moduleId!
                                const isChecked = (permissions[moduleId as keyof UserPermissions] as any)?.[action] === true
                                const isDiff = isDifferentFromRole(moduleId as keyof UserPermissions, action)
                                const label = actionLabels[action] || action

                                return (
                                    <div key={action} className="flex items-center justify-between group/row">
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-medium transition-colors ${isChecked ? 'text-slate-900' : 'text-slate-500'}`}>
                                                {label}
                                            </span>
                                            {isDiff && currentMode === 'inherit' && (
                                                <span className="text-[10px] text-amber-600 mt-0.5">
                                                    * مختلف عن الدور
                                                </span>
                                            )}
                                        </div>
                                        <Switch
                                            checked={isChecked}
                                            onCheckedChange={(checked) => updatePermission(moduleId as keyof UserPermissions, action, checked)}
                                            disabled={!canManagePermissions}
                                            className="data-[state=checked]:bg-slate-900" 
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UserManagementInner: React.FC<UserManagementProps> = ({ 
  users, 
  onUpdateUsers, 
  currentUserEmail: _currentUserEmail, 
  currentUserRole 
}) => {
  const { t, language } = useLanguage()
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithChildren | null>(null)
  const [userTree, setUserTree] = useState<UserWithChildren[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draggedUser, setDraggedUser] = useState<UserWithChildren | null>(null)
  
  // Signature & Stamp upload states
  const [isUploadingSignature, setIsUploadingSignature] = useState(false)
  const [isUploadingStamp, setIsUploadingStamp] = useState(false)
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState('')
  const [stampPreviewUrl, setStampPreviewUrl] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'member' as 'member' | 'supervisor' | 'manager' | 'admin',
    parent_id: null as number | null,
    position: '',
    department: '',
    scope: 'self',
    phone: '',
    signature_url: '',
    stamp_url: '',
    notify_on_document: true,
    notify_on_approval: true,
    notify_on_password_change: true,
    notify_on_report: true,
    permissions: DEFAULT_PERMISSIONS
  })

  const { toast } = useToast()
  
  // Get current user from users array by email
  const currentUser = users.find(u => u.email === _currentUserEmail || u.username === _currentUserEmail)
    || users.find(u => u.role?.toLowerCase() === currentUserRole?.toLowerCase())
  const userPerms = currentUser?.permissions?.users || {}
  // Admin can always manage permissions, or if explicitly has manage_permissions
  const canManagePermissions = currentUser?.role?.toLowerCase() === 'admin' || userPerms.manage_permissions === true

  const reactFlowRef = useRef<HTMLDivElement>(null)
  const { getNodes } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // ============================================================================
  // BUILD TREE
  // ============================================================================

  const buildTree = useCallback((users: UserWithChildren[], parentId: number | null = null): UserWithChildren[] => {
    return users
      .filter(u => (u.parent_id || u.manager_id || null) === parentId)
      .map(u => ({
        ...u,
        children: buildTree(users, Number(u.id))
      }))
  }, [])

  useEffect(() => {
    const tree = buildTree(users as UserWithChildren[], null)
    setUserTree(tree)
  }, [users, buildTree])

  // Build nodes and edges from tree
  const buildNodesAndEdges = useCallback((tree: UserWithChildren[]): { nodes: CustomNode[], edges: Edge[] } => {
    const nodes: CustomNode[] = []
    const edges: Edge[] = []

    const recurse = (users: UserWithChildren[], parentId: string | null) => {
      users.forEach((user) => {
        const nodeId = user.id.toString()
        nodes.push({
          id: nodeId,
          type: 'userNode',
          data: {
            user,
            onEdit: handleEdit,
            onDelete: handleDelete,
          },
          position: { x: 0, y: 0 },
          draggable: true,
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        })

        if (parentId) {
          edges.push({
            id: `e${parentId}-${nodeId}`,
            source: parentId,
            target: nodeId,
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 18,
              height: 18,
              color: '#94a3b8',
            },
            style: { stroke: '#cbd5e1', strokeWidth: 2 },
          })
        }

        if (user.children) {
          recurse(user.children, nodeId)
        }
      })
    }

    recurse(tree, null)
    return { nodes, edges }
  }, [])

  useEffect(() => {
    const { nodes: initNodes, edges: initEdges } = buildNodesAndEdges(userTree)
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initNodes, initEdges, 'TB')
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [userTree, buildNodesAndEdges, setNodes, setEdges])

  // ============================================================================
  // DRAG (RE-PARENT) HANDLERS
  // ============================================================================

  const snapBackToLayout = useCallback(() => {
    const { nodes: initNodes, edges: initEdges } = buildNodesAndEdges(userTree)
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initNodes, initEdges, 'TB')
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [buildNodesAndEdges, setEdges, setNodes, userTree])

  const handleNodeDragStart = useCallback((_event: unknown, node: Node) => {
    const u = (node.data as any)?.user as UserWithChildren | undefined
    if (u) setDraggedUser(u)
  }, [])

  const handleNodeDragStop = useCallback(async (_event: unknown, node: Node) => {
    const dragged = (node.data as any)?.user as UserWithChildren | undefined
    if (!dragged) {
      snapBackToLayout()
      return
    }

    const allNodes = getNodes()
    const draggedNode = allNodes.find((n) => n.id === node.id) || node
    const w = (draggedNode as any).width || NODE_WIDTH
    const h = (draggedNode as any).height || NODE_HEIGHT
    const centerX = draggedNode.position.x + w / 2
    const centerY = draggedNode.position.y + h / 2

    const targetNode = allNodes.find((n) => {
      if (n.id === draggedNode.id) return false
      const nw = (n as any).width || NODE_WIDTH
      const nh = (n as any).height || NODE_HEIGHT
      return centerX > n.position.x && centerX < n.position.x + nw && centerY > n.position.y && centerY < n.position.y + nh
    })

    if (!targetNode) {
      setDraggedUser(null)
      snapBackToLayout()
      return
    }

    const isOwnChild = (parentId: string, childId: string): boolean => {
      const parentEdge = edges.find((e: Edge) => e.target === parentId)
      if (!parentEdge) return false
      if (parentEdge.source === childId) return true
      return isOwnChild(parentEdge.source, childId)
    }

    if (isOwnChild(targetNode.id, dragged.id.toString())) {
      toast({
        title: 'غير مسموح',
        description: 'لا يمكن نقل المستخدم تحت أحد التابعين له',
        variant: 'destructive',
      })
      setDraggedUser(null)
      snapBackToLayout()
      return
    }

    try {
      await apiClient.updateUser(dragged.id.toString(), { manager_id: Number(targetNode.id) })

      const targetData = targetNode.data as { user: UserWithChildren }
      toast({
        title: 'تم النقل',
        description: `تم نقل ${dragged.full_name} تحت ${targetData.user.full_name}`,
      })

      const updatedUsers = await apiClient.getUsers()
      onUpdateUsers(updatedUsers)
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل نقل المستخدم',
        variant: 'destructive',
      })
    } finally {
      setDraggedUser(null)
      snapBackToLayout()
    }
  }, [edges, getNodes, onUpdateUsers, snapBackToLayout, toast])

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const handleEdit = (user: UserWithChildren) => {
    setEditingUser(user)
    // دمج صلاحيات الدور مع الصلاحيات المخصصة للعرض في الـ UI
    const mergedPerms = getUserMergedPermissions(user.role, user.permissions)
    // الحفاظ على وضع الصلاحيات (inherit/custom)
    if (user.permissions && user.permissions.__mode) {
      mergedPerms.__mode = user.permissions.__mode
    } else {
      mergedPerms.__mode = 'inherit'
    }
    setFormData({
      name: user.full_name || user.username || '',
      email: user.email || '',
      password: '',
      role: user.role as any,
      parent_id: user.parent_id || user.manager_id || null,
      position: user.position || '',
      department: user.department || '',
      scope: user.scope || 'self',
      phone: user.phone || '',
      signature_url: user.signature_url || '',
      stamp_url: user.stamp_url || '',
      notify_on_document: user.notify_on_document ?? true,
      notify_on_approval: user.notify_on_approval ?? true,
      notify_on_password_change: user.notify_on_password_change ?? true,
      notify_on_report: user.notify_on_report ?? true,
      permissions: mergedPerms
    })
    // Set preview URLs for signature & stamp
    setSignaturePreviewUrl(user.signature_url || '')
    setStampPreviewUrl(user.stamp_url || '')
    setShowAddForm(true)
  }

  const handleDelete = async (user: UserWithChildren) => {
    const confirmMsg = user.children && user.children.length > 0
      ? `هل أنت متأكد من حذف "${user.full_name}"؟ لديه ${user.children.length} تابعين سيصبحون بدون مدير.`
      : `هل أنت متأكد من حذف "${user.full_name}"؟`
    
    if (!confirm(confirmMsg)) return

    try {
      await apiClient.deleteUser(String(user.id))
      
      toast({
        title: "تم الحذف",
        description: "تم حذف المستخدم بنجاح"
      })
      
      const updatedUsers = await apiClient.getUsers()
      onUpdateUsers(updatedUsers)
    } catch (err) {
      toast({
        title: "خطأ",
        description: "فشل حذف المستخدم",
        variant: "destructive"
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // إعداد الصلاحيات للحفظ بناءً على الوضع المختار
      let permissionsToSave: any = { ...formData.permissions }
      
      if (permissionsToSave.__mode === 'inherit') {
        // في وضع الوراثة، نحفظ فقط التعديلات (Diff) لكي تتأثر التغييرات المستقبلية للدور
        // لكن نحفظ __mode = 'inherit' صراحة
        const diff = getPermissionDiff(formData.role, permissionsToSave)
        permissionsToSave = diff ? { ...diff, __mode: 'inherit' } : { __mode: 'inherit' }
      }
      
      if (editingUser) {
        // Update existing user
        const updates: any = {
          full_name: formData.name,
          role: formData.role,
          parent_id: formData.parent_id,
          position: formData.position,
          department: formData.department,
          scope: formData.scope,
          phone: formData.phone,
          signature_url: formData.signature_url,
          stamp_url: formData.stamp_url,
          notify_on_document: formData.notify_on_document,
          notify_on_approval: formData.notify_on_approval,
          notify_on_password_change: formData.notify_on_password_change,
          notify_on_report: formData.notify_on_report
        }
        
        if (formData.password) {
          updates.password = formData.password
        }
        if (formData.email && canManagePermissions) {
          updates.email = formData.email
          updates.username = formData.email
        }

        await apiClient.updateUser(String(editingUser.id), updates)

        if (canManagePermissions) {
          await apiClient.updateUserPermissions(Number(editingUser.id), permissionsToSave)
        }
        
        toast({
          title: "تم التحديث",
          description: "تم تحديث بيانات المستخدم بنجاح"
        })
      } else {
        // Create new user
        const newUser = await apiClient.createUser({
          username: formData.email,
          password: formData.password,
          full_name: formData.name,
          role: formData.role,
          email: formData.email
        })

        // Update additional fields
        if (newUser && newUser.id) {
          await apiClient.updateUser(String(newUser.id), {
            manager_id: formData.parent_id,
            signature_url: formData.signature_url,
            stamp_url: formData.stamp_url
          })

          if (canManagePermissions) {
            await apiClient.updateUserPermissions(Number(newUser.id), permissionsToSave)
          }
        }

        toast({
          title: "تم الإنشاء",
          description: "تم إنشاء المستخدم الجديد بنجاح"
        })
      }

      // Refresh users
      const updatedUsers = await apiClient.getUsers()
      onUpdateUsers(updatedUsers)
      
      // Reset form
      setShowAddForm(false)
      setEditingUser(null)
      resetForm()
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err.message || "فشل حفظ المستخدم",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Signature/Stamp Upload
  const handleSignatureStampUpload = async (file: File, type: 'signature' | 'stamp') => {
    if (type === 'signature') {
      setIsUploadingSignature(true)
    } else {
      setIsUploadingStamp(true)
    }

    try {
      const result = await apiClient.uploadFile(file, 3, 'signatures')
      const uploadedUrl = result.url || result.file?.url

      if (!uploadedUrl) {
        throw new Error('لم يتم الحصول على رابط الملف')
      }

      // Get signed URL for preview
      let displayUrl = uploadedUrl
      try {
        const urlObj = new URL(uploadedUrl)
        let pathname = urlObj.pathname.replace(/^\//, '')
        const bucket = 'zaco'
        if (pathname.startsWith(bucket + '/')) {
          pathname = pathname.slice(bucket.length + 1)
        }
        displayUrl = await apiClient.getSignedUrl(pathname)
      } catch {
        // Use original URL if signed fails
      }

      if (type === 'signature') {
        setFormData(prev => ({ ...prev, signature_url: uploadedUrl }))
        setSignaturePreviewUrl(displayUrl)
      } else {
        setFormData(prev => ({ ...prev, stamp_url: uploadedUrl }))
        setStampPreviewUrl(displayUrl)
      }

      toast({
        title: "✅ تم الرفع",
        description: `تم رفع ${type === 'signature' ? 'التوقيع' : 'الختم'} بنجاح`
      })
    } catch (error: any) {
      toast({
        title: "❌ فشل الرفع",
        description: error.message || 'فشل رفع الملف',
        variant: "destructive"
      })
    } finally {
      if (type === 'signature') {
        setIsUploadingSignature(false)
      } else {
        setIsUploadingStamp(false)
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'member',
      parent_id: null,
      position: '',
      department: '',
      scope: 'self',
      phone: '',
      signature_url: '',
      stamp_url: '',
      notify_on_document: true,
      notify_on_approval: true,
      notify_on_password_change: true,
      notify_on_report: true,
      permissions: DEFAULT_PERMISSIONS
    })
    // Reset preview URLs
    setSignaturePreviewUrl('')
    setStampPreviewUrl('')
  }

  // Get flat list of users for parent selection
  const flatUsers = users.filter(u => 
    !editingUser || String(u.id) !== String(editingUser.id)
  )

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="text-blue-600" size={32} />
            إدارة المستخدمين
          </h2>
          <p className="text-slate-500 mt-2 font-medium">
            الهيكل التنظيمي وإدارة الصلاحيات
          </p>
        </div>
        
        <div className="flex gap-3">
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'tree' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'
              }`}
            >
              🌳 شجرة
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'
              }`}
            >
              📋 قائمة
            </button>
          </div>
          
          {/* Add User Button */}
          <button
            onClick={() => {
              setShowAddForm(!showAddForm)
              setEditingUser(null)
              if (!showAddForm) resetForm()
            }}
            className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 ${
              showAddForm 
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200'
            }`}
          >
            {showAddForm ? <X size={18} /> : <UserPlus size={18} />}
            {showAddForm ? 'إلغاء' : 'إضافة مستخدم'}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <form 
          onSubmit={handleSubmit} 
          className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl animate-in zoom-in-95 duration-300"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900">
              {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
            </h3>
            <button 
              type="button" 
              onClick={() => { setShowAddForm(false); setEditingUser(null); resetForm() }}
              className="text-slate-400 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Info */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                الاسم الكامل *
              </label>
              <div className="relative">
                <UserCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pr-12 p-4 bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                البريد الإلكتروني *
              </label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="email"
                  required={!editingUser}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  readOnly={Boolean(editingUser && !canManagePermissions)}
                  className={`w-full pr-12 p-4 rounded-xl outline-none font-bold transition-all ${
                    editingUser && !canManagePermissions 
                      ? 'bg-slate-100 cursor-not-allowed' 
                      : 'bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                كلمة المرور {!editingUser && '*'}
              </label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="text"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? 'اتركه فارغاً للإبقاء على القديم' : '••••••••'}
                  className="w-full pr-12 p-4 bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                الصلاحية الأساسية
              </label>
              <div className="relative">
                <Shield className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <select
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value as any
                    // عند تغيير الدور، نحدث الصلاحيات لتعكس الدور الجديد
                    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[newRole] || ROLE_DEFAULT_PERMISSIONS.member
                    setFormData({ ...formData, role: newRole, permissions: roleDefaults })
                  }}
                  className="w-full pr-12 p-4 bg-slate-50 rounded-xl outline-none font-bold transition-all appearance-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="member">مستخدم عادي</option>
                  <option value="supervisor">مشرف (صلاحيات إشراف)</option>
                  <option value="accountant">محاسب (صلاحيات مالية)</option>
                  <option value="manager">مدير (تحكم محدود)</option>
                  <option value="admin">مدير نظام (تحكم كامل)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                المنصب الإداري
              </label>
              <div className="relative">
                <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full pr-12 p-4 bg-slate-50 rounded-xl outline-none font-bold transition-all appearance-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  {POSITIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                المدير المباشر (التبعية)
              </label>
              <div className="relative">
                <UserCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <select
                  value={formData.parent_id || ''}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full pr-12 p-4 bg-slate-50 rounded-xl outline-none font-bold transition-all appearance-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- بدون مدير (أعلى الهيكل) --</option>
                  {flatUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                نطاق الرؤية
              </label>
              <select
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                className="w-full p-4 bg-slate-50 rounded-xl outline-none font-bold transition-all appearance-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              >
                {SCOPES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                رقم الهاتف
              </label>
              <div className="relative">
                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pr-12 p-4 bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                القسم
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-bold transition-all"
              />
            </div>
          </div>

          {/* Notifications */}
          <div className="mt-6 p-4 bg-slate-50 rounded-xl">
            <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
              <Bell size={16} /> إعدادات الإشعارات
            </h4>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notify_on_document}
                  onChange={(e) => setFormData({ ...formData, notify_on_document: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600">القيود</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notify_on_approval}
                  onChange={(e) => setFormData({ ...formData, notify_on_approval: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600">الاعتمادات</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notify_on_report}
                  onChange={(e) => setFormData({ ...formData, notify_on_report: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600">التقارير</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notify_on_password_change}
                  onChange={(e) => setFormData({ ...formData, notify_on_password_change: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600">تغيير كلمة المرور</span>
              </label>
            </div>
          </div>

          {/* Signature & Stamp Section - For managers/supervisors/admins */}
          {['manager', 'admin', 'supervisor'].includes(formData.role) && (
            <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <h4 className="text-sm font-black text-emerald-700 mb-4 flex items-center gap-2">
                <FileSignature size={16} /> التوقيع والختم
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Signature */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    التوقيع الشخصي
                  </div>
                  {(signaturePreviewUrl || formData.signature_url) ? (
                    <div className="bg-slate-50 p-3 rounded-lg border border-green-200 min-h-[70px] flex items-center justify-center">
                      <img
                        src={signaturePreviewUrl || formData.signature_url}
                        alt="التوقيع"
                        className="h-14 w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-lg border-2 border-dashed border-slate-300 min-h-[70px] flex items-center justify-center">
                      <p className="text-sm text-slate-400 font-bold">لا يوجد توقيع</p>
                    </div>
                  )}
                  <label className={`cursor-pointer flex items-center justify-center gap-2 p-2.5 rounded-lg font-bold text-sm transition-all ${
                    isUploadingSignature 
                      ? 'bg-slate-400 cursor-wait' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  } text-white`}>
                    <Upload size={14} className={isUploadingSignature ? 'animate-bounce' : ''} />
                    {isUploadingSignature ? 'جارٍ الرفع...' : (signaturePreviewUrl || formData.signature_url) ? 'تغيير التوقيع' : 'رفع توقيع'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingSignature}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSignatureStampUpload(file, 'signature');
                      }}
                    />
                  </label>
                </div>

                {/* Stamp */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    ختم القسم
                  </div>
                  {(stampPreviewUrl || formData.stamp_url) ? (
                    <div className="bg-slate-50 p-3 rounded-lg border border-green-200 min-h-[70px] flex items-center justify-center">
                      <img
                        src={stampPreviewUrl || formData.stamp_url}
                        alt="الختم"
                        className="h-14 w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-lg border-2 border-dashed border-slate-300 min-h-[70px] flex items-center justify-center">
                      <p className="text-sm text-slate-400 font-bold">لا يوجد ختم</p>
                    </div>
                  )}
                  <label className={`cursor-pointer flex items-center justify-center gap-2 p-2.5 rounded-lg font-bold text-sm transition-all ${
                    isUploadingStamp 
                      ? 'bg-slate-400 cursor-wait' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  } text-white`}>
                    <Stamp size={14} className={isUploadingStamp ? 'animate-bounce' : ''} />
                    {isUploadingStamp ? 'جارٍ الرفع...' : (stampPreviewUrl || formData.stamp_url) ? 'تغيير الختم' : 'رفع ختم'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingStamp}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSignatureStampUpload(file, 'stamp');
                      }}
                    />
                  </label>
                </div>
              </div>
              <p className="text-xs text-emerald-600 mt-3 text-center">
                ✨ التوقيع والختم يُستخدمان في الاعتمادات والتقارير
              </p>
            </div>
          )}

          {/* Permissions (for admin only) */}
          {canManagePermissions && (
            <div className="mt-6">
              <PermissionsEditor
                permissions={formData.permissions}
                onChange={(p) => setFormData({ ...formData, permissions: p })}
                canManagePermissions={canManagePermissions}
                role={formData.role}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSaving}
            className={`w-full mt-6 py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-2 ${
              isSaving 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                جارٍ الحفظ...
              </>
            ) : (
              <>
                <Check size={20} />
                {editingUser ? 'حفظ التغييرات' : 'إنشاء المستخدم'}
              </>
            )}
          </button>
        </form>
      )}

      {/* Tree/List View */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm" style={{ height: viewMode === 'tree' ? '600px' : 'auto' }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Loader2 size={32} className="animate-spin text-white" />
              </div>
            </div>
            <p className="text-slate-700 font-bold">جارٍ تحميل البيانات...</p>
          </div>
        ) : viewMode === 'tree' ? (
          <ReactFlow
            ref={reactFlowRef}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            nodesDraggable
            nodesConnectable={false}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#94a3b8' },
              style: { stroke: '#cbd5e1', strokeWidth: 2 },
            }}
            fitView
            minZoom={0.1}
            maxZoom={2}
          >
            <Background />
            <Controls />
          </ReactFlow>
        ) : (
          /* List View */
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('users.user')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('users.role')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('users.position')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('users.manager')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                        {(u.full_name || u.username || '').substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{u.full_name || u.username}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${
                      String(u.role).toLowerCase() === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                      String(u.role).toLowerCase() === 'manager' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      String(u.role).toLowerCase() === 'supervisor' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                      'bg-slate-50 text-slate-600 border-slate-100'
                    }`}>
                      {String(u.role).toLowerCase() === 'admin' ? t('role.admin') : 
                       String(u.role).toLowerCase() === 'manager' ? t('role.manager') : 
                       String(u.role).toLowerCase() === 'supervisor' ? t('role.supervisor') : t('role.member')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {(u as any).position || '-'}
                  </td>
                  <td className="px-6 py-4">
                    {u.manager_id ? (
                      <span className="text-sm text-slate-600">
                        {users.find(m => m.id === u.manager_id)?.full_name || '?'}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(u as UserWithChildren)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(u as UserWithChildren)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const UserManagement: React.FC<UserManagementProps> = (props) => (
  <ReactFlowProvider>
    <UserManagementInner {...props} />
  </ReactFlowProvider>
)

export default UserManagement
