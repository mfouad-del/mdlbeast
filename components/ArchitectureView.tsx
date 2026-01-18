import React from 'react';
import { Database, Shield, Zap, Printer, Box, Code, Globe, Lock } from 'lucide-react';
import { useI18n } from '../lib/i18n-context';

const ArchitectureView: React.FC = () => {
  const { t } = useI18n();
  const Feature = ({ icon: Icon, title, desc }: any) => (
    <div className="flex gap-4 p-5 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all group bg-white/50">
      <div className="bg-white p-3 rounded-xl shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors border border-slate-100">
        <Icon size={24} />
      </div>
      <div>
        <h4 className="font-black text-slate-900 mb-1">{title}</h4>
        <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-16 animate-in fade-in duration-700 pb-20">
      <div className="text-center space-y-4">
        <div className="inline-block bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">Technical Specifications v2.5</div>
        <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-tight">{t('new.key.5c1asb')}<span className="text-blue-600">Enterprise</span></h2>
        <p className="text-slate-500 text-xl max-w-3xl mx-auto leading-relaxed">{t('new.key.2h35qm')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Feature 
          icon={Box} 
          title="React 19 & Tailwind" 
          desc={t('new.key.un45ci')} 
        />
        <Feature 
          icon={Database} 
          title="UUID v7 Precision" 
          desc={t('new.key.rs4vhg')} 
        />
        <Feature 
          icon={Lock} 
          title="AES-256 Encryption" 
          desc={t('new.key.snpp95')} 
        />
        <Feature 
          icon={Globe} 
          title="RESTful Web Services" 
          desc={t('new.key.s498lo')} 
        />
        <Feature 
          icon={Printer} 
          title="High-DPI Vector Print" 
          desc={t('new.key.2a9n9x')} 
        />
        <Feature 
          icon={Shield} 
          title="RBAC Security" 
          desc={t('new.key.jla807')} 
        />
      </div>

      <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-3xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        
        <h3 className="text-3xl font-black mb-10 flex items-center gap-4 relative z-10">
          <div className="bg-blue-600 p-2 rounded-xl"><Code size={28} /></div>{t('new.key.e4e7eb')}</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
          <div className="space-y-6">
            <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-green-600 text-[10px] font-black px-2 py-1 rounded">POST</span>
                <code className="text-blue-300 font-mono text-sm">/api/v1/correspondence</code>
              </div>
              <p className="text-slate-400 text-xs mb-4">{t('new.key.a7euaz')}</p>
              <pre className="text-[10px] text-blue-100/60 bg-slate-900 p-4 rounded-xl border border-slate-700">
{`{
  "title": "طلب صيانة",
  "type": "INCOMING",
  "sender_id": "DEPT_04",
  "priority": "HIGH"
}`}
              </pre>
            </div>

            <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-blue-600 text-[10px] font-black px-2 py-1 rounded">GET</span>
                <code className="text-blue-300 font-mono text-sm">/api/v1/scan/{`{barcode}`}</code>
              </div>
              <p className="text-slate-400 text-xs mb-4">{t('new.key.vwasnw')}</p>
            </div>
          </div>

          <div className="space-y-6">
             <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-orange-600 text-[10px] font-black px-2 py-1 rounded">PUT</span>
                <code className="text-blue-300 font-mono text-sm">/api/v1/archive/{`{id}`}</code>
              </div>
              <p className="text-slate-400 text-xs mb-4">تحويل حالة المعاملة إلى t('new.key.n6d227') بعد الانتهاء.</p>
            </div>

            <div className="p-6 bg-blue-600 rounded-3xl shadow-xl shadow-blue-900/20">
              <h4 className="font-black mb-2 flex items-center gap-2 text-white">
                <Shield size={20} />{t('new.key.m02lbr')}</h4>
              <p className="text-sm text-blue-100 leading-relaxed mb-4">{t('new.key.08kved')}</p>
              <div className="text-[11px] bg-slate-900/30 p-3 rounded-xl border border-blue-400/30">
                Rate Limit: 100 req/min per user
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm text-center">
        <h3 className="text-2xl font-black mb-4">{t('new.key.gvibsj')}</h3>
        <p className="text-slate-500 mb-8 max-w-xl mx-auto">{t('new.key.uac948')}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <div className="px-6 py-3 bg-slate-100 rounded-2xl text-xs font-black text-slate-600">Dockerized Support</div>
          <div className="px-6 py-3 bg-slate-100 rounded-2xl text-xs font-black text-slate-600">CI/CD Ready</div>
          <div className="px-6 py-3 bg-slate-100 rounded-2xl text-xs font-black text-slate-600">Prometheus Monitoring</div>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureView;
