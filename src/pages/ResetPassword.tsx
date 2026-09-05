import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, ChevronLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { SchoolLogo } from '@/components/SchoolLogo';
import { toast, Toaster } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match. Please enter identical passwords.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setCompleted(true);
      toast.success('Your portal password has been changed successfully.');
    } catch (err: any) {
      console.error('Update password error:', err);
      toast.error(err.message || 'Failed to update password. Session may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f4f7fb] flex flex-col items-center justify-center p-4 font-sans text-slate-800 relative overflow-hidden select-none">
      <Toaster position="top-right" richColors />
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-100/50 via-[#f4f7fb] to-blue-50/40 z-0 pointer-events-none" />

      {/* Back to Login */}
      <div className="absolute top-5 left-5 z-20">
        <Link 
          to="/login" 
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-900 font-bold transition-all py-2 px-3.5 bg-white hover:bg-slate-50 rounded-xl shadow-sm border border-slate-200"
        >
          <ChevronLeft className="w-4 h-4 text-blue-800" />
          <span>Login</span>
        </Link>
      </div>

      <div className="w-full max-w-[420px] z-10 flex flex-col gap-5 items-center my-6">
        
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

        <div className="w-full bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xl shadow-slate-200/50 flex flex-col gap-4">
          
          <div className="pb-1 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 font-serif">Create New Password</h2>
            <p className="text-xs text-slate-500 mt-0.5">Choose a secure password for your portal account</p>
          </div>

          {!completed ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-800" /> New Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-11 px-3.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/10 focus:border-blue-700 focus:bg-white transition-all outline-none text-slate-900 text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-800" /> Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-11 px-3.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/10 focus:border-blue-700 focus:bg-white transition-all outline-none text-slate-900 text-sm font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-blue-900/20 active:scale-[0.99] cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Update Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Password Updated</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Your credentials have been securely updated. You can now login.
                </p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold text-xs shadow-md transition-all"
              >
                Go to Sign In
              </button>
            </div>
          )}

        </div>

        <p className="text-[11px] text-slate-400 text-center font-medium">
          © {new Date().getFullYear()} St. Joseph’s School, Barhalganj. All Rights Reserved.
        </p>

      </div>
    </div>
  );
}
