import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { supabase } from '@/lib/supabase';
import { SchoolCrest } from '@/components/SchoolLogo';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your registered email address.');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Password recovery instructions sent to: ' + email);
    } catch (err: any) {
      console.error('Password reset request error:', err);
      // For security, if user not found or rate limited, still provide clear feedback
      toast.error(err.message || 'Unable to process password reset request. Please check email address.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f4f7fb] flex flex-col items-center justify-center p-4 font-sans text-slate-800 relative overflow-hidden select-none">
      <Toaster position="top-right" richColors />
      
      {/* Background Ambient Gradients */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Back to Login Button */}
      <div className="absolute top-5 left-5 z-20">
        <Link 
          to="/login" 
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-900 font-bold transition-all py-2 px-3.5 bg-white hover:bg-slate-50 rounded-xl shadow-sm border border-slate-200"
        >
          <ChevronLeft className="w-4 h-4 text-blue-800" />
          <span>Back to Login</span>
        </Link>
      </div>

      <div className="w-full max-w-[440px] z-10 flex flex-col gap-5 items-center my-6">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center gap-3">
          <Link to="/" className="group flex flex-col items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-1 bg-white shadow-md shadow-slate-200/80 border border-slate-100 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
              <img 
                src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG"
                alt="St. Joseph's School Crest"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).setAttribute('src', 'https://sjsbrlschool.edu.in/favicon.png');
                }}
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-serif text-[#061f3d] uppercase tracking-tight leading-none mt-3">
              St. Joseph’s School
            </h1>
            <p className="text-xs font-bold text-[#1a73e8] tracking-wider uppercase mt-0.5">
              Barhalganj, Gorakhpur
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-bold text-[#061f3d] mt-1">
              <ShieldCheck className="w-3 h-3 text-[#1a73e8]" /> Password Recovery Assistance
            </div>
          </Link>
        </div>

        <div className="w-full bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xl shadow-slate-200/50 flex flex-col gap-5">
          
          <div className="pb-1 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 font-serif">Reset Your Password</h2>
            <p className="text-xs text-slate-500 mt-0.5">We will send instructions to your registered email</p>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-800" /> Registered Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@sjsbrlschool.edu.in"
                  className="w-full h-11 px-3.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/10 focus:border-blue-700 focus:bg-white transition-all outline-none text-slate-900 text-sm font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-md shadow-blue-900/20 active:scale-[0.99]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Email Dispatched</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Please check your inbox at <strong className="text-slate-800">{email}</strong> for the password reset link.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-block text-xs font-bold text-blue-800 hover:underline pt-2"
              >
                Return to Login
              </Link>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-center">
            <Link to="/login" className="text-xs font-semibold text-slate-600 hover:text-blue-900">
              Remember your password? <span className="font-bold text-blue-800">Sign in</span>
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
