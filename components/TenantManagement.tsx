import React, { useState } from 'react';
import { Building2, Plus, Check, Edit3, Trash2, Briefcase, ShieldCheck } from 'lucide-react';
import AsyncButton from './ui/async-button';
import { apiClient } from '@/lib/api-client';
import { Company } from '@/types';

interface TenantManagementProps {
  companies: Company[];
  onUpdate: () => void;
}

export default function TenantManagement({ companies, onUpdate }: TenantManagementProps) {
  const [newCompany, setNewCompany] = useState({ nameAr: '', nameEn: '', logoUrl: 'https://www.zaco.sa/logo2.png' });
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  const startEditCompany = (company: Company) => {
    setEditingCompanyId(company.id);
    setNewCompany({ nameAr: company.nameAr, nameEn: company.nameEn, logoUrl: company.logoUrl });
  };

  const handleAddOrUpdateCompany = async () => {
    if (!newCompany.nameAr) return;
    try {
      const slug = newCompany.nameAr.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/--+/g, '-')
      if (editingCompanyId) {
        await apiClient.updateTenant(editingCompanyId, { name: newCompany.nameAr, slug, logo_url: newCompany.logoUrl })
        setEditingCompanyId(null)
      } else {
        await apiClient.createTenant({ name: newCompany.nameAr, slug, logo_url: newCompany.logoUrl })
      }
      setNewCompany({ nameAr: '', nameEn: '', logoUrl: 'https://www.zaco.sa/logo2.png' });
      onUpdate();
    } catch (err) {
      console.error('Tenant upsert failed', err);
      alert('فشل تحديث/إنشاء المؤسسة على الخادم');
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700 pb-20 md:pb-0">
      <div className="bg-white p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-slate-900"></div>
        
        <header className="mb-8 md:mb-14 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="bg-slate-900 p-5 rounded-[1.5rem] text-white shadow-2xl shadow-slate-200">
            <Briefcase size={32} />
          </div>
          <div>
            <h2 className="text-2xl md:text-4xl font-black text-slate-900 font-heading tracking-tight">إدارة المؤسسات</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
              <ShieldCheck size={14} className="text-green-500" /> التحكم في الجهات التابعة للنظام
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
          {/* Form Section */}
          <div className="lg:col-span-5 space-y-6 md:space-y-8">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">اسم المؤسسة (بالعربي)</label>
              <input 
                type="text" 
                placeholder="مثال: شركة زوايا الهندسية" 
                className="w-full p-4 md:p-5 bg-slate-50 border border-slate-200 rounded-2xl font-black focus:border-slate-900 outline-none transition-all text-slate-900 text-sm md:text-base" 
                value={newCompany.nameAr} 
                onChange={e => setNewCompany({...newCompany, nameAr: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Entity Name (English)</label>
              <input 
                type="text" 
                placeholder="Example: ZAWAYA ARCHITECTURE" 
                className="w-full p-4 md:p-5 bg-slate-50 border border-slate-200 rounded-2xl font-black focus:border-slate-900 outline-none transition-all text-slate-900 text-sm md:text-base" 
                value={newCompany.nameEn} 
                onChange={e => setNewCompany({...newCompany, nameEn: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">رابط الشعار</label>
              <input 
                type="text" 
                placeholder="https://..." 
                className="w-full p-4 md:p-5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs focus:border-slate-900 outline-none transition-all text-slate-900" 
                value={newCompany.logoUrl} 
                onChange={e => setNewCompany({...newCompany, logoUrl: e.target.value})} 
              />
            </div>
            <button 
              onClick={handleAddOrUpdateCompany} 
              className="w-full bg-slate-900 text-white py-4 md:py-6 rounded-[1.5rem] font-black text-base md:text-lg shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              {editingCompanyId ? <><Check size={20} /> حفظ التعديلات</> : <><Plus size={20} /> إضافة المؤسسة للأرشيف</>}
            </button>
            
            {editingCompanyId && (
              <button 
                onClick={() => { setEditingCompanyId(null); setNewCompany({ nameAr: '', nameEn: '', logoUrl: 'https://www.zaco.sa/logo2.png' }); }}
                className="w-full bg-slate-100 text-slate-500 py-3 rounded-[1rem] font-bold text-sm hover:bg-slate-200 transition-all"
              >
                إلغاء التعديل
              </button>
            )}
          </div>

          {/* List Section */}
          <div className="lg:col-span-7 bg-slate-50/50 rounded-[2.5rem] p-6 md:p-8 border border-slate-200 flex flex-col">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">المؤسسات المسجلة ({companies.length})</p>
            <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {companies.map(c => (
                <div key={c.id} className="bg-white p-4 md:p-5 rounded-[1.5rem] border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group hover:shadow-md transition-all">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 rounded-xl flex items-center justify-center p-2 border border-slate-100">
                      <img src={c.logoUrl} className="w-full h-full object-contain" alt="logo" onError={(e) => (e.target as any).src = '/placeholder-logo.png'} />
                    </div>
                    <div>
                      <div className="font-black text-sm md:text-base text-slate-900">{c.nameAr}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase mt-1">{c.nameEn}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto justify-end">
                    <button 
                      onClick={() => startEditCompany(c)} 
                      className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-all" 
                      title="تعديل"
                    >
                      <Edit3 size={18} />
                    </button>
                    <AsyncButton 
                      onClickAsync={async () => {
                        if (companies.length <= 1) {
                          alert('لا يمكن حذف المؤسسة الوحيدة في النظام');
                          return;
                        }
                        if (!confirm("هل تود حذف هذه المؤسسة نهائياً؟\nسيتم حذف جميع المستخدمين والمستندات المرتبطة بها.")) return;
                        await apiClient.deleteTenant(c.id)
                        onUpdate()
                      }} 
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition-all" 
                      title="حذف"
                    >
                      <Trash2 size={18} />
                    </AsyncButton>
                  </div>
                </div>
              ))}
              {companies.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <Building2 size={40} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-bold">لا توجد مؤسسات مسجلة</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
