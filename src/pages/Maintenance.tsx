import React from 'react';
import { Settings, AlertTriangle } from 'lucide-react';
import { SchoolLogo } from '@/components/SchoolLogo';

export default function Maintenance() {
  return (
    <div className="min-h-screen w-full bg-[#f4f7fb] flex flex-col items-center justify-center p-4 font-sans text-slate-800 relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-100/50 via-[#f4f7fb] to-blue-50/40 z-0 pointer-events-none" />

      <div className="w-full max-w-[450px] z-10 flex flex-col gap-6 items-center">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center gap-2">
          <SchoolLogo className="w-14 h-14" />
          <div className="space-y-0.5">
            <h1 className="text-xl font-black font-serif text-blue-950 uppercase tracking-tight leading-none">
              St. Joseph’s School
            </h1>
            <p className="text-[10px] font-bold text-amber-600 tracking-wider uppercase leading-none mt-1">
              Barhalganj, Gorakhpur
            </p>
          </div>
        </div>

        <div className="w-full bg-white rounded-3xl border border-blue-100 p-6 sm:p-8 shadow-xl shadow-slate-200/50 flex flex-col gap-4 text-center">
          
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center border border-blue-100">
              <Settings className="w-8 h-8 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 border-2 border-white shadow-sm">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 font-serif">
              System Scheduled Maintenance
            </h2>
            <p className="text-[10px] text-blue-800 font-bold uppercase tracking-widest">
              Performance Optimization & Cloud Sync
            </p>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Our ERP services are undergoing routine maintenance to ensure data security and fast access. Services will resume shortly.
          </p>

          <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200/80 font-mono font-bold">
            Estimated Duration: ~10-15 minutes
          </div>

        </div>

        <p className="text-[11px] text-slate-400 text-center font-medium">
          © {new Date().getFullYear()} St. Joseph’s School, Barhalganj. All Rights Reserved.
        </p>

      </div>
    </div>
  );
}
