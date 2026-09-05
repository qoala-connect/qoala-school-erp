import React from 'react';
import { 
  Rocket, 
  ShieldCheck, 
  Zap, 
  Smartphone, 
  Users, 
  BarChart3, 
  CheckCircle2,
  ChevronRight,
  Database,
  Lock,
  IndianRupee
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function MarketingLanding() {
  const features = [
    {
      title: "Smart Fee Engine",
      description: "Automated balance calculation, installment support, and professional PDF receipts.",
      icon: <IndianRupee className="w-6 h-6 text-accent" />,
      color: "from-cyan-500/20 to-blue-500/20"
    },
    {
      title: "Instant Analytics",
      description: "Real-time summary cards for total collection, pending dues, and attendance rates.",
      icon: <BarChart3 className="w-6 h-6 text-emerald-400" />,
      color: "from-emerald-500/20 to-teal-500/20"
    },
    {
      title: "Secured by RLS",
      description: "Role-based security ensuring student data and finances are visible only to authorized staff.",
      icon: <ShieldCheck className="w-6 h-6 text-rose-400" />,
      color: "from-rose-500/20 to-pink-500/20"
    },
    {
      title: "Mobile First",
      description: "Fully responsive design that looks stunning on tablets, phones, and desktops.",
      icon: <Smartphone className="w-6 h-6 text-amber-400" />,
      color: "from-amber-500/20 to-orange-500/20"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-accent selection:text-slate-900 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-accent/20 rounded-full blur-[128px] opacity-20 animate-pulse" />
      <div className="absolute top-1/2 -right-4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] opacity-20" />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 backdrop-blur-md bg-slate-950/80 px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img 
              src="https://entab-s3-bucket1.s3.ap-south-1.amazonaws.com/SJSKBUP/public/Images/logo.png"
              alt="St. Joseph’s School"
              className="h-9 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link 
              to="/"
              className="text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              School Website
            </Link>
            <Link 
              to="/login"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95"
            >
              Portal Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-[120px] pb-24 px-8">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-8"
          >
            <Zap className="w-3 h-3 text-accent fill-accent" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Ready for Sales & Deployment</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-display font-black tracking-tight mb-8"
          >
            The Most Modern <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-blue-400 to-indigo-500">School Management</span> System
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl text-lg text-white/40 mb-12"
          >
            Stop using 2010 software. Built for modern schools, EduFlow Pro automates complex accounting, student tracking, and administration with a futuristic interface.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <Link to="/login" className="px-10 py-5 bg-accent text-slate-900 rounded-2xl font-black text-lg shadow-2xl shadow-cyan-500/20 hover:brightness-110 transition-all flex items-center gap-3 active:scale-95">
              Launch Application <ChevronRight className="w-5 h-5" />
            </Link>
            <a href="#features" className="px-10 py-5 border border-white/10 rounded-2xl font-bold bg-white/5 hover:bg-white/10 transition-all">
              Explore Tech Stack
            </a>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-8 bg-slate-900/40 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-display font-black mb-4 uppercase">Powerful Admin Capabilities</h2>
            <p className="text-white/40">Engineered to handle thousands of records with sub-millisecond response times.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -8 }}
                className={cn("frosted-card p-6 rounded-[32px] border border-white/5", feature.color)}
              >
                <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Breakdown */}
      <section className="py-24 px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-accent font-black text-xs uppercase tracking-widest mb-4 block">Engineered for Performance</span>
            <h2 className="text-4xl font-display font-black mb-6">Why Schools Choose This Software?</h2>
            
            <div className="space-y-6">
              {[
                { label: "High-Performance Cloud Infrastructure (Supabase)", icon: <Database /> },
                { label: "Atomic Transaction Logic for Financials", icon: <Lock /> },
                { label: "Centralized Student Database", icon: <Users /> }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 group hover:border-accent/40 transition-all">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent/10 border border-accent/20 group-hover:bg-accent text-accent group-hover:text-slate-900 transition-all">
                    {item.icon}
                  </div>
                  <span className="font-bold text-white/80">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-accent/20 rounded-[48px] blur-3xl" />
            <div className="relative frosted-card rounded-[48px] border border-white/10 p-2 overflow-hidden aspect-video shadow-2xl">
                <div className="w-full h-full bg-slate-950/80 p-8 rounded-[44px]">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-3 h-3 rounded-full bg-rose-500" />
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    </div>
                    <div className="space-y-4">
                        <div className="h-4 w-3/4 bg-white/10 rounded-full animate-pulse" />
                        <div className="h-4 w-1/2 bg-white/10 rounded-full animate-pulse" />
                        <div className="h-32 w-full bg-accent/5 border border-accent/20 rounded-2xl flex items-center justify-center">
                            <span className="text-accent font-mono text-xs">Previewing Application Workflow...</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-24 px-8">
        <div className="max-w-7xl mx-auto rounded-[48px] bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 p-12 sm:p-16 text-center relative overflow-hidden border border-white/10 shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent" />
          <h2 className="text-3xl sm:text-5xl font-serif font-black text-white mb-6 leading-tight">
            Institutional Excellence & Integrated ERP Management
          </h2>
          <p className="text-slate-300 max-w-xl mx-auto text-sm mb-8">
            Empowering students, teachers, and parents of St. Joseph’s School Barhalganj with modern CBSE academic management.
          </p>
          <Link to="/login" className="inline-block px-10 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/20 hover:scale-105 transition-all active:scale-95">
            Sign In to Portal
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-white/10 text-center text-slate-400 text-xs font-semibold">
        © {new Date().getFullYear()} St. Joseph’s School, Barhalganj. All Rights Reserved.
      </footer>
    </div>
  );
}
