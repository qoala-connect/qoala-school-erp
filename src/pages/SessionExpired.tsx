import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, LogIn } from 'lucide-react';
import { SchoolLogo } from '@/components/SchoolLogo';

export default function SessionExpired() {
  return (
    <div className="min-h-screen w-full bg-[#f4f7fb] flex flex-col items-center justify-center p-4 font-sans text-slate-800 relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-100/50 via-[#f4f7fb] to-amber-50/40 z-0 pointer-events-none" />

      <div className="w-full max-w-[420px] z-10 flex flex-col gap-5 items-center">
        
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

        <div className="w-full bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xl shadow-slate-200/50 flex flex-col gap-4 text-center">
          
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 font-serif">
              Session Expired
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Please sign in again to continue accessing your dashboard
            </p>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            For security, your active session was refreshed due to inactivity.
          </p>

          <Link 
            to="/login"
            className="w-full h-11 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-blue-900/20 active:scale-[0.99] cursor-pointer mt-1"
          >
            <LogIn className="w-4 h-4" />
            Sign In to Portal
          </Link>

        </div>

        <p className="text-[11px] text-slate-400 text-center font-medium">
          © {new Date().getFullYear()} St. Joseph’s School, Barhalganj. All Rights Reserved.
        </p>

      </div>
    </div>
  );
}
