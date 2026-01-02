import React, { useState } from 'react';
import { UserPlus, Trash2, Edit3, Check, X, Shield, Mail, Lock, UserCircle, Upload, FileSignature, Stamp } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useToast } from '../hooks/use-toast';
import { User } from '../types';

interface UserManagementProps {
  users: User[];
  onUpdateUsers: (users: User[]) => void;
  currentUserEmail: string;
  currentUserRole?: string;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, onUpdateUsers, currentUserEmail, currentUserRole }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | string | null>(null);
  
  const [newUser, setNewUser] = useState<{
    name: string, 
    email: string, 
    password: string, 
    role: 'member' | 'supervisor' | 'manager' | 'admin',
    manager_id?: number | null,
    signature_url?: string,
    stamp_url?: string
  }>({ name: '', email: '', password: '', role: 'member', manager_id: null });
  
  const [editUser, setEditUser] = useState<{
    name: string, 
    email: string, 
    password: string, 
    role: 'member' | 'supervisor' | 'manager' | 'admin',
    manager_id?: number | null,
    signature_url?: string,
    stamp_url?: string
  }>({ name: '', email: '', password: '', role: 'member', manager_id: null });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  const isAdmin = (currentUserRole || '').toLowerCase() === 'admin';

  // Filter potential managers (anyone with role manager, admin, or supervisor, excluding the user being edited)
  const potentialManagers = users.filter(u => {
    const r = String(u.role || '').toLowerCase();
    return (r === 'manager' || r === 'admin' || r === 'supervisor') && 
    (editingUserId ? String(u.id) !== String(editingUserId) : true);
  });

  const handleFileUpload = async (file: File, type: 'signature' | 'stamp', isEdit: boolean) => {
    setIsUploading(true);
    try {
      const result = await apiClient.uploadFile(file, 3, 'signatures');
      const url = result.url || result.file?.url;
      
      if (isEdit) {
        setEditUser(prev => ({ ...prev, [type === 'signature' ? 'signature_url' : 'stamp_url']: url }));
      } else {
        setNewUser(prev => ({ ...prev, [type === 'signature' ? 'signature_url' : 'stamp_url']: url }));
      }
      
      toast({ title: "تم الرفع", description: "تم رفع الصورة بنجاح" });
    } catch (error: any) {
      toast({ title: "خطأ", description: "فشل رفع الملف", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    
    try {
      const createdUser = await apiClient.createUser({
        username: newUser.email,
        password: newUser.password,
        full_name: newUser.name,
        role: newUser.role
      });

      if (createdUser && createdUser.id && (newUser.manager_id || newUser.signature_url || newUser.stamp_url)) {
        await apiClient.updateUser(createdUser.id, {
          manager_id: newUser.manager_id,
          signature_url: newUser.signature_url,
          stamp_url: newUser.stamp_url
        });
      }
      
      setMessage('تم إضافة المستخدم بنجاح');
      setNewUser({ name: '', email: '', password: '', role: 'member', manager_id: null });
      setShowAddForm(false);
      
      // Refresh users list via parent
      const updatedUsers = await apiClient.getUsers();
      onUpdateUsers(updatedUsers);

      toast({
        title: "تم بنجاح",
        description: "تم إضافة المستخدم الجديد",
      });
    } catch (error: any) {
      console.error('Error adding user:', error);
      setMessage('فشل إضافة المستخدم: ' + (error.response?.data?.error || error.message));
      toast({
        title: "خطأ",
        description: "فشل إضافة المستخدم",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setEditUser({
      name: user.full_name || user.username || '',
      email: user.email || '',
      password: '',
      role: user.role as any,
      manager_id: user.manager_id,
      signature_url: user.signature_url,
      stamp_url: user.stamp_url
    });
    setShowAddForm(false);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    
    setIsSaving(true);
    setMessage('');
    
    try {
      const updates: any = {
        full_name: editUser.name,
        role: editUser.role,
        manager_id: editUser.manager_id,
        signature_url: editUser.signature_url,
        stamp_url: editUser.stamp_url
      };
      
      if (editUser.password) {
        updates.password = editUser.password;
      }
      
      if (editUser.email) {
        updates.email = editUser.email;
      }

      await apiClient.updateUser(String(editingUserId), updates);
      
      setMessage('تم تحديث بيانات المستخدم بنجاح');
      setEditingUserId(null);
      
      // Refresh users list via parent
      const updatedUsers = await apiClient.getUsers();
      onUpdateUsers(updatedUsers);

      toast({
        title: "تم بنجاح",
        description: "تم تحديث بيانات المستخدم",
      });
    } catch (error: any) {
      console.error('Error updating user:', error);
      setMessage('فشل تحديث المستخدم: ' + (error.response?.data?.error || error.message));
      toast({
        title: "خطأ",
        description: "فشل تحديث المستخدم",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${name}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    
    try {
      await apiClient.deleteUser(id);
      
      // Refresh users list via parent
      const updatedUsers = await apiClient.getUsers();
      onUpdateUsers(updatedUsers);

      toast({
        title: "تم الحذف",
        description: "تم حذف المستخدم بنجاح",
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "خطأ",
        description: "فشل حذف المستخدم",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">إدارة المستخدمين</h2>
          <p className="text-slate-500 mt-2 font-medium">إضافة وتعديل صلاحيات المستخدمين للنظام</p>
        </div>
        <button 
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingUserId(null);
          }}
          className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 ${showAddForm ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200'}`}
        >
          {showAddForm ? 'إلغاء' : <><UserPlus size={18} /> إضافة مستخدم جديد</>}
        </button>
      </div>

      {(showAddForm || editingUserId) && (
        <form onSubmit={editingUserId ? handleUpdateUser : handleAddUser} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl animate-in zoom-in-95 duration-300 grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="md:col-span-2 flex justify-between items-center mb-2">
             <h3 className="text-xl font-black text-slate-900">{editingUserId ? 'تعديل بيانات مستخدم' : 'إضافة مستخدم جديد'}</h3>
             {editingUserId && <button type="button" onClick={() => setEditingUserId(null)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>}
           </div>
           
           {message && <div className="md:col-span-2 p-3 bg-green-50 text-green-700 rounded-xl font-bold">{message}</div>}
           
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">الاسم الكامل</label>
              <div className="relative">
                <UserCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required type="text" className="w-full pr-12 p-4 bg-slate-50 rounded-2xl outline-none focus:bg-white focus:border-slate-900 font-bold transition-all" 
                  value={editingUserId ? (editUser as any).name : newUser.name} 
                  onChange={e => editingUserId ? setEditUser({...editUser, name: e.target.value}) : setNewUser({...newUser, name: e.target.value})} />
              </div>
           </div>
           
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="email"
                  className={editingUserId ? `w-full pr-12 p-4 rounded-2xl outline-none focus:bg-white focus:border-slate-900 font-bold transition-all ${isAdmin ? 'bg-slate-50' : 'bg-slate-100 cursor-not-allowed'}` : 'w-full pr-12 p-4 rounded-2xl outline-none focus:bg-white focus:border-slate-900 font-bold bg-slate-50 transition-all'}
                  value={editingUserId ? (editUser.email || '') : newUser.email}
                  onChange={e => editingUserId ? setEditUser({...editUser, email: e.target.value}) : setNewUser({...newUser, email: e.target.value})}
                  required={!editingUserId}
                  readOnly={editingUserId ? !isAdmin : false}
                />
                {editingUserId && !isAdmin && (
                  <div className="text-[10px] text-slate-400 mt-2">لا يمكن تغيير البريد من هنا. لإعادة تعيين البريد تواصل مع مدير النظام.</div>
                )}
              </div>
           </div>
           
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="text" placeholder="••••••••" className="w-full pr-12 p-4 bg-slate-50 rounded-2xl outline-none focus:bg-white focus:border-slate-900 font-bold transition-all" 
                  value={editingUserId ? editUser.password : newUser.password} 
                  onChange={e => editingUserId ? setEditUser({...editUser, password: e.target.value}) : setNewUser({...newUser, password: e.target.value})} />
                <div className="text-[10px] text-slate-400 mt-2">{editingUserId ? 'اترك الحقل فارغاً إذا لا تريد تغيير كلمة المرور' : ''}</div>
              </div>
           </div>
           
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">الصلاحية</label>
              <div className="relative">
                <Shield className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <select className="w-full pr-12 p-4 bg-slate-50 rounded-2xl outline-none font-bold transition-all focus:bg-white focus:border-slate-900 appearance-none" 
                  value={editingUserId ? editUser.role : newUser.role} 
                  onChange={e => {
                    const val = e.target.value as 'member' | 'supervisor' | 'manager' | 'admin';
                    editingUserId ? setEditUser({...editUser, role: val}) : setNewUser({...newUser, role: val});
                  }}>
                  <option value="member">مستخدم عادي (إدخال وبحث)</option>
                  <option value="supervisor">مدير مباشر (صلاحيات إعتماد)</option>
                  <option value="manager">مدير تنفيذي (تحكم محدود)</option>
                  <option value="admin">مدير نظام (تحكم كامل)</option>
                </select>
              </div>
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">المدير المباشر</label>
              <div className="relative">
                <UserCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <select className="w-full pr-12 p-4 bg-slate-50 rounded-2xl outline-none font-bold transition-all focus:bg-white focus:border-slate-900 appearance-none" 
                  value={editingUserId ? (editUser.manager_id || '') : (newUser.manager_id || '')} 
                  onChange={e => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    editingUserId ? setEditUser({...editUser, manager_id: val}) : setNewUser({...newUser, manager_id: val});
                  }}>
                  <option value="">-- لا يوجد مدير --</option>
                  {potentialManagers.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name || m.username}</option>
                  ))}
                </select>
              </div>
           </div>

           {/* Signature & Stamp Upload - Only for Managers/Admins/Supervisors */}
           {['manager', 'admin', 'supervisor'].includes(String(editingUserId ? editUser.role : newUser.role).toLowerCase()) && (
             <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">التوقيع (صورة شفافة)</label>
                 <div className="flex items-center gap-4">
                   {(editingUserId ? editUser.signature_url : newUser.signature_url) && (
                     <img src={editingUserId ? editUser.signature_url : newUser.signature_url} alt="Signature" className="h-12 object-contain border border-slate-200 rounded-lg bg-white" />
                   )}
                   <label className="cursor-pointer flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors">
                     <FileSignature size={16} />
                     {isUploading ? 'جارٍ الرفع...' : 'رفع توقيع'}
                     <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'signature', !!editingUserId)} />
                   </label>
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">الختم (صورة شفافة)</label>
                 <div className="flex items-center gap-4">
                   {(editingUserId ? editUser.stamp_url : newUser.stamp_url) && (
                     <img src={editingUserId ? editUser.stamp_url : newUser.stamp_url} alt="Stamp" className="h-12 object-contain border border-slate-200 rounded-lg bg-white" />
                   )}
                   <label className="cursor-pointer flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors">
                     <Stamp size={16} />
                     {isUploading ? 'جارٍ الرفع...' : 'رفع ختم'}
                     <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'stamp', !!editingUserId)} />
                   </label>
                 </div>
               </div>
             </div>
           )}
           
           <button type="submit" disabled={isSaving} className={`md:col-span-2 ${isSaving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'} bg-blue-600 text-white py-5 rounded-2xl font-black text-lg transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 mt-4`}>
             {isSaving ? 'جارٍ المعالجة...' : (editingUserId ? <><Check size={20}/> حفظ التغييرات</> : 'تفعيل حساب المستخدم')}
           </button>
        </form>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">المستخدم</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">الصلاحية</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">المدير المباشر</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black uppercase shadow-md shadow-slate-100">
                      {(u.full_name || u.username || '').substring(0, 2)}
                    </div>
                    <div>
                      <div className="font-black text-slate-900">{u.full_name || u.username || ''}</div>
                      <div className="text-xs text-slate-400 font-medium">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className={`px-4 py-2 rounded-xl text-[10px] font-black border ${
                    String(u.role).toLowerCase() === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-100' : 
                    String(u.role).toLowerCase() === 'manager' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                    String(u.role).toLowerCase() === 'supervisor' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                    'bg-slate-50 text-slate-600 border-slate-100'
                  }`}>
                    {String(u.role).toLowerCase() === 'admin' ? 'مدير نظام (تحكم كامل)' : String(u.role).toLowerCase() === 'manager' ? 'مدير تنفيذي (تحكم محدود)' : String(u.role).toLowerCase() === 'supervisor' ? 'مدير مباشر' : 'مستخدم عادي'}
                  </span>
                </td>
                <td className="px-8 py-6">
                  {u.manager_id ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                        {users.find(m => m.id === u.manager_id)?.full_name?.substring(0, 1) || '?'}
                      </div>
                      <span className="text-xs font-bold text-slate-600">
                        {users.find(m => m.id === u.manager_id)?.full_name || 'غير معروف'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 font-bold">-</span>
                  )}
                </td>
                <td className="px-8 py-6">
                  <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditing(u)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="تعديل المستخدم">
                      <Edit3 size={18} />
                    </button>
                    <button onClick={() => deleteUser(String(u.id), u.email || u.username)} className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="حذف المستخدم">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-8 py-12 text-center text-slate-400 font-medium">
                  لا يوجد مستخدمين حالياً
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
