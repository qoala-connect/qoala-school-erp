import React from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  Award, 
  Users, 
  CheckCircle2, 
  MapPin, 
  Phone, 
  Mail, 
  HeartHandshake, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Compass,
  Building,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function AboutUs() {
  const schoolHighlights = [
    {
      title: "CBSE Affiliated Excellence",
      icon: <GraduationCap className="w-6 h-6 text-blue-600" />,
      features: [
        "Play-way learning for Kindergarten (LKG & UKG)",
        "Foundational STEM & language building (Classes I-VIII)",
        "Secondary & Senior Secondary curriculum (Classes IX-XII)",
        "Regular moral, cultural & value education sessions",
        "Individual attention with balanced teacher-student ratio"
      ]
    },
    {
      title: "Smart Infrastructure & Labs",
      icon: <Building className="w-6 h-6 text-indigo-600" />,
      features: [
        "Well-ventilated smart classrooms with Digital Board Systems",
        "High-tech computer science lab with latest software & internet",
        "Dedicated Physics, Chemistry & Biology laboratory suites",
        "Comprehensive library with 2000+ reference volumes & encyclopedias",
        "Safe & spacious outdoor athletic and sports grounds"
      ]
    },
    {
      title: "Co-Curricular & Sports",
      icon: <Award className="w-6 h-6 text-emerald-600" />,
      features: [
        "Annual cultural dance, music & choir performances",
        "Inter-house athletic meets & football/basketball championships",
        "Art, craft, elocution, quiz, and debate competitions",
        "Exhibitions showcasing student science & STEM models",
        "Leadership development through House Captains & Student Council"
      ]
    },
    {
      title: "Dedicated Faculty",
      icon: <Users className="w-6 h-6 text-amber-600" />,
      features: [
        "Qualified, passionate, & CBSE-trained educators",
        "Regular pedagogical workshops & skill upgrade programs",
        "Parent-teacher interaction meetings (PTM) after assessments",
        "Personalized student progress mentoring & remedial assistance",
        "Disciplined, compassionate, and encouraging school atmosphere"
      ]
    },
    {
      title: "Safety & Student Well-being",
      icon: <ShieldCheck className="w-6 h-6 text-sky-600" />,
      features: [
        "24/7 CCTV surveillance across all key campus areas",
        "Purified RO drinking water & modern hygienic sanitation",
        "First-aid medical room and emergency care protocols",
        "Dedicated bus conveyance network across Barhalganj routes",
        "Strict discipline and anti-bullying code of conduct"
      ]
    },
    {
      title: "Christian Minority Heritage",
      icon: <HeartHandshake className="w-6 h-6 text-rose-600" />,
      features: [
        "Administered by Catholic Diocese of Gorakhpur Education Society",
        "Estd. 2007 with a legacy of value-oriented education",
        "Inclusive admissions irrespective of caste, creed, or gender",
        "Environmental awareness, green initiatives & community drives",
        "Motto: Lead Kindly Light through Love, Justice & Service"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 selection:bg-blue-600/10 selection:text-blue-600">
      <Navbar transparent={false} />
      
      <div className="pt-28 md:pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Main Hero Header */}
          <div className="text-center mb-16 space-y-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-extrabold uppercase tracking-wider border border-blue-100"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Estd. 2007 • CBSE Affiliation No. 2131498</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-black tracking-tight text-blue-950 leading-tight"
            >
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-700 to-amber-600">St. Joseph’s School</span>
            </motion.h1>
            <p className="text-sm font-bold text-amber-600 uppercase tracking-widest">
              Barhalganj, Gorakhpur (U.P.)
            </p>
            
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="max-w-3xl mx-auto text-sm sm:text-base text-slate-600 font-medium leading-relaxed text-justify"
            >
              St. Joseph’s School, Barhalganj, affiliated to the Central Board of Secondary Education, New Delhi (Aff. No. 2131498) is an English-medium Christian minority educational institution established in 2007, administered and governed by the Catholic Diocese of Gorakhpur Education Society.
            </motion.p>
          </div>

          {/* Vision & Mission Banner */}
          <div id="vision" className="grid md:grid-cols-2 gap-8 mb-20">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center font-bold">
                <Compass className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-serif font-black text-blue-950">Our Vision</h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed text-justify">
                “Lead Kindly Light through the Values of Love, Justice & Service”. To be a center of educational excellence that fosters intellectual curiosity, moral integrity, social harmony, and global leadership in every student.
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-bold">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-serif font-black text-blue-950">Our Mission</h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed text-justify">
                To promote integral development—physical, intellectual, emotional, and spiritual—enabling our students to become responsible, patriotic, and disciplined citizens committed to the service of God and humanity.
              </p>
            </div>
          </div>

          {/* Highlights Grid */}
          <div className="mb-20">
            <div className="text-center mb-12 space-y-2">
              <span className="text-xs font-black text-blue-700 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">Why Choose Us</span>
              <h2 className="text-2xl sm:text-3xl font-serif font-black text-blue-950">Key Pillars of St. Joseph’s School</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {schoolHighlights.map((item, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-blue-900 group-hover:text-white border border-slate-100 transition-all duration-300">
                      {item.icon}
                    </div>
                    
                    <h3 className="text-lg font-serif font-bold text-slate-900 mb-4">
                      {item.title}
                    </h3>
                    
                    <ul className="space-y-3">
                      {item.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <span className="text-xs text-slate-600 font-medium leading-relaxed">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Call to Action Banner */}
          <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-blue-900 rounded-3xl p-8 sm:p-12 lg:p-16 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-400/30 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
                  Admissions Open 2026-27
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-black leading-tight">
                  Join the St. Joseph’s School Family Today
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-medium">
                  Enrol your ward for Playway, Kindergarten, Primary, Secondary, or Higher Secondary streams and provide them with an empowering CBSE foundation.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-2 text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-lg">
                    <MapPin className="w-4 h-4 text-red-400" />
                    <span>Barhalganj, Gorakhpur (UP) - 273402</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-lg">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <span>+91-8853242676</span>
                  </div>
                </div>
              </div>
              
              <div className="flex md:justify-end gap-4 flex-wrap">
                <Link 
                  to="/admissions"
                  className="px-6 py-3.5 bg-amber-500 text-slate-950 rounded-xl font-black text-xs sm:text-sm hover:bg-amber-400 transition-all flex items-center gap-2 active:scale-95 shadow-md"
                >
                  Apply for Admission <ArrowRight className="w-4 h-4" />
                </Link>
                <Link 
                  to="/"
                  className="px-6 py-3.5 border border-white/30 text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-white/10 transition-all flex items-center gap-2 active:scale-95"
                >
                  Back to Homepage
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>

      <Footer showCallout={false} />
    </div>
  );
}
