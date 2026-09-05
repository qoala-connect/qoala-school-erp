import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Home, ArrowLeft } from 'lucide-react';
import { SchoolLogo } from '@/components/SchoolLogo';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-[#f4f7fb] flex flex-col items-center justify-center p-4 font-sans text-slate-800 relative overflow-hidden select-none">
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-100/50 via-[#f4f7fb] to-blue-50/40 z-0 pointer-events-none" />

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
          
          <div className="w-14 h-14 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mx-auto border border-blue-100">
            <HelpCircle className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 font-serif">
              404: Page Not Found
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              The page you are looking for does not exist or has been moved.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link 
              to="/"
              className="w-full h-11 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-blue-900/20 active:scale-[0.99] cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Return to Homepage
            </Link>
            <Link 
              to="/dashboard"
              className="w-full h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 text-xs border border-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Go to Dashboard
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
