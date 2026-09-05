import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { SchoolLogo } from '@/components/SchoolLogo';

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-[#f4f7fb] flex flex-col items-center justify-center p-4 font-sans text-slate-800 relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-100/50 via-[#f4f7fb] to-rose-50/30 z-0 pointer-events-none" />

      <div className="w-full max-w-[440px] z-10 flex flex-col gap-5 items-center">
        
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

        <div className="w-full bg-white rounded-3xl border border-rose-100 p-6 sm:p-8 shadow-xl shadow-slate-200/50 flex flex-col gap-4 text-center">
          
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 font-serif">
              403: Access Restricted
            </h2>
            <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">
              Permission Required
            </p>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[320px] mx-auto">
            Your current account role does not possess permissions to view this ERP module. Please contact the administrator if you need access.
          </p>

          <div className="pt-2 border-t border-slate-100 flex gap-2">
            <button 
              onClick={() => navigate(-1)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 cursor-pointer flex items-center justify-center gap-1 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Go Back
            </button>
            <Link 
              to="/dashboard"
              className="flex-1 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1 transition-all shadow-sm"
            >
              <Home className="w-3.5 h-3.5" />
              Dashboard
            </Link>
          </div>

        </div>

        <p className="text-[11px] text-slate-400 text-center font-medium">
          © {new Date().getFullYear()} St. Joseph’s School, Barhalganj. All Rights Reserved.
        </p>

      </div>
    </div>
  );
}
