import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldCheck 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      toast.success('Successfully logged in!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#061f3d] flex flex-col justify-between font-sans text-slate-800 relative py-3 px-4 overflow-y-auto select-none">
{/* Subtle Background Gradient Accents */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#061f3d] via-[#0b2b52] to-[#04152b] pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto py-1 flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
          <span>Back to Website</span>
        </Link>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>CBSE Affiliation: 2131498</span>
        </div>
      </header>

      {/* Main Centered Compact Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center my-auto py-4">
        <div className="w-full max-w-[390px] bg-white rounded-2xl shadow-2xl shadow-black/50 border border-slate-100 p-5 sm:p-6">
          
          {/* Authentic Real School Logo & Compact Header */}
          <div className="flex flex-col items-center text-center pb-3.5 border-b border-slate-100">
            <Link to="/" className="flex flex-col items-center group">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full p-1 bg-white shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                <img 
                  src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo_icon.JPG"
                  alt="St. Joseph’s School Crest"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).setAttribute('src', 'https://sjsbrlschool.edu.in/favicon.png');
                  }}
                />
              </div>
              <span className="font-serif font-black text-[#061f3d] text-base tracking-tight mt-1.5 leading-tight">
                ST. JOSEPH’S SCHOOL
              </span>
              <span className="text-[9.5px] font-extrabold text-[#1a73e8] tracking-wider uppercase mt-0.5">
                Barhalganj • ERP Portal Sign In
              </span>
            </Link>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3 pt-3.5">
            
            {/* Email */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@sjsbrlschool.edu.in"
                  className="w-full h-9.5 pl-8.5 pr-3 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#1a73e8] focus:ring-2 focus:ring-blue-600/10 transition-all outline-none text-slate-900 text-xs font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <Link 
                  to="/forgot-password"
                  className="text-[11px] font-semibold text-[#1a73e8] hover:text-[#061f3d] hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-9.5 pl-8.5 pr-8.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-[#1a73e8] focus:ring-2 focus:ring-blue-600/10 transition-all outline-none text-slate-900 text-xs font-medium"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-600">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#1a73e8] focus:ring-[#1a73e8]" 
                />
                <span>Keep me signed in</span>
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-[#061f3d] hover:bg-[#0a2f5c] text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-slate-900/20 active:scale-[0.99] cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

        </div>
      </main>

      {/* Clean Bottom Footer */}
      <footer className="relative z-10 w-full py-1.5 text-center text-[11px] text-slate-400">
        © {new Date().getFullYear()} St. Joseph’s School, Barhalganj • Catholic Diocese of Gorakhpur
      </footer>

    </div>
  );
}
