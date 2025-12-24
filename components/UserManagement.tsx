import React, { useState } from 'react';
import { UserPlus, Trash2, Mail, Lock, UserCircle, Edit3, X, Check } from 'lucide-react';
import { User } from '../types';
import { apiClient } from '../lib/api-client';

interface UserManagementProps {
  users: User[];
  onUpdateUsers: (users: User[]) => void;
  currentUserEmail: string;
}

const UserManagement: React.FC<UserManagementProps> = ({ users, onUpdateUsers, currentUserEmail }) => {
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'USER' as 'ADMIN' | 'USER' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<Partial<User>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (users.find(u => u.email === newUser.email)) {
      setMessage("هذا البريد الإلكتروني مسجل مسبقاً");
      setTimeout(() => setMessage(null), 2500);
      return;
    }
    try {
      setIsSaving(true);
      await apiClient.createUser({ username: newUser.email, password: newUser.password, full_name: newUser.name, role: newUser.role === 'ADMIN' ? 'admin' : 'user' })
      setMessage('تم إنشاء المستخدم بنجاح')
      onUpdateUsers(await apiClient.getUsers().catch(()=>[]))
      setNewUser({ name: '', email: '', password: '', role: 'USER' });
      setShowAddForm(false);
    } catch (err: any) {
      console.error(err)
      setMessage(err.message || 'فشل إنشاء المستخدم')
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    try {
      setIsSaving(true);
      await apiClient.updateUser(editingUserId, { full_name: editUser.name, role: editUser.role === 'ADMIN' ? 'admin' : 'user', password: editUser.password || undefined })
      setMessage('تم تحديث المستخدم')
      onUpdateUsers(await apiClient.getUsers().catch(()=>[]))
      setEditingUserId(null);
      setEditUser({});
    } catch (err: any) {
      console.error(err)
      setMessage(err.message || 'فشل تحديث المستخدم')
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const deleteUser = async (id: string, email: string) => {
    if (email === currentUserEmail) {
      alert("لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول");
      return;
    }
    if (confirm("هل أنت متأكد من حذف هذا المستخدم؟")) {
      try {
        await apiClient.deleteUser(id)
        alert('تم حذف المستخدم')
        onUpdateUsers([])
      } catch (err: any) {
        console.error(err)
        alert(err.message || 'فشل حذف المستخدم')
      }
    }
  };

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setEditUser({ name: user.full_name || user.name || user.username || '', email: user.email || user.username || '', password: '', role: user.role });
    setShowAddForm(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-900">إدارة صلاحيات الوصول</h2>
          <p className="text-slate-500">التحكم في مستخدمي النظام وتوزيع الأدوار الإدارية.</p>
        </div>
        <button 
          onClick={() => { setShowAddForm(!showAddForm); setEditingUserId(null); }}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-800 transition-all"
        >
          {showAddForm ? 'إلغاء' : <><UserPlus size={18} /> إضافة مستخدم جديد</>}
        </button>
      </div>

      {(showAddForm || editingUserId) && (
        <form onSubmit={editingUserId ? handleUpdateUser : handleAddUser} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl animate-in zoom-in-95 duration-300 grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="md:col-span-2 flex justify-between items-center mb-2">
             <h3 className="text-xl font-black text-slate-900">{editingUserId ? 'تعديل بيانات مستخدم' : 'إضافة مستخدم جديد'}</h3>
             {editingUserId && <button type="button" onClick={() => setEditingUserId(null)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>}
           </div>           {message && <div className="md:col-span-2 p-3 bg-green-50 text-green-700 rounded-xl font-bold">{message}</div>}           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">الاسم الكامل</label>
              <div className="relative">
                <UserCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required type="text" className="w-full pr-12 p-4 bg-slate-50 rounded-2xl outline-none focus:bg-white focus:border-slate-900 font-bold" 
                  value={editingUserId ? editUser.name : newUser.name} 
                  onChange={e => editingUserId ? setEditUser({...editUser, name: e.target.value}) : setNewUser({...newUser, name: e.target.value})} />
              </div>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="email"
                  className={editingUserId ? 'w-full pr-12 p-4 rounded-2xl outline-none focus:bg-white focus:border-slate-900 font-bold bg-slate-100 cursor-not-allowed' : 'w-full pr-12 p-4 rounded-2xl outline-none focus:bg-white focus:border-slate-900 font-bold bg-slate-50'}
                  value={editingUserId ? (editUser.email || '') : newUser.email}
                  onChange={e => editingUserId ? setEditUser({...editUser, email: e.target.value}) : setNewUser({...newUser, email: e.target.value})}
                  required={!editingUserId}
                  readOnly={!!editingUserId}
                />
                {editingUserId && (
                  <div className="text-[10px] text-slate-400 mt-2">لا يمكن تغيير البريد من هنا. لإعادة تعيين البريد تواصل مع المسؤول.</div>
                )}
              </div>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="text" placeholder="••••••••" className="w-full pr-12 p-4 bg-slate-50 rounded-2xl outline-none focus:bg-white focus:border-slate-900 font-bold" 
                  value={editingUserId ? editUser.password : newUser.password} 
                  onChange={e => editingUserId ? setEditUser({...editUser, password: e.target.value}) : setNewUser({...newUser, password: e.target.value})} />
                <div className="text-[10px] text-slate-400 mt-2">{editingUserId ? 'اترك الحقل فارغاً إذا لا تريد تغيير كلمة المرور' : ''}</div>
              </div>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">الصلاحية</label>
              <select className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" 
                value={editingUserId ? editUser.role : newUser.role} 
                onChange={e => {
                  const val = e.target.value as 'ADMIN' | 'USER';
                  editingUserId ? setEditUser({...editUser, role: val}) : setNewUser({...newUser, role: val});
                }}>
                <option value="USER">مستخدم عادي (إدخال وبحث)</option>
                <option value="ADMIN">مدير نظام (تحكم كامل)</option>
              </select>
           </div>
           <button type="submit" disabled={isSaving} className={`md:col-span-2 ${isSaving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'} bg-blue-600 text-white py-5 rounded-2xl font-black text-lg transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2`}>
             {isSaving ? 'جارٍ المعالجة...' : (editingUserId ? <><Check size={20}/> حفظ التغييرات</> : 'تفعيل حساب المستخدم')}
           </button>
        </form>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">المستخدم</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">الصلاحية</th>
              <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black uppercase">{(u.name || u.full_name || u.username || '').substring(0, 2)}</div>
                    <div>
                      <div className="font-black text-slate-900">{u.name || u.full_name || u.username || ''}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black ${u.role === "ADMIN" ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                    {u.role === "ADMIN" ? 'مدير نظام' : 'مستخدم'}
                  </span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEditing(u)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="تعديل المستخدم">
                      <Edit3 size={18} />
                    </button>
                    <button onClick={() => deleteUser(u.id, u.email)} className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition-all" title="حذف المستخدم">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
