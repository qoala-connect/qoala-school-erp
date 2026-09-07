import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  Award, 
  Trophy, 
  User, 
  Calendar,
  Sparkles,
  Eye,
  Type,
  Settings,
  Palette,
  PlusCircle,
  Trash2,
  ShieldCheck,
  Printer,
  RefreshCw,
  QrCode,
  FileText,
  CheckCircle2,
  Search,
  Filter,
  Users,
  Copy,
  Layout,
  Check,
  GraduationCap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import html2canvasSafe from '../../lib/html2canvasSafe';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';
import { AdminHeader } from '@/components/common/AdminHeader';

// Types of certificates
type CertificateType = 'excellence' | 'transfer' | 'bonafide' | 'character' | 'migration' | 'study' | 'fee';

// Border themes
type BorderTheme = 'navy_gold' | 'emerald_gold' | 'maroon_silver' | 'cosmic_cyan' | 'minimal_slate';

const SCHOOL_NAME     = 'St. Joseph’s School, Barhalganj';
const SCHOOL_SHORT    = 'SJSB';
const CBSE_AFF_NO     = '2131498';
const SCHOOL_ADDRESS  = 'Barhalganj, Gorakhpur (U.P.) - 273402';

interface IssuedCertificate {
  id: string;
  certificateNo: string;
  studentName: string;
  type: CertificateType;
  classSection: string;
  issueDate: string;
  uniqueCode: string;
}

export default function CertificateGenerator() {
  const location = useLocation();
  const navStudent = location.state?.student;

  // Core Selection
  const [certType, setCertType] = useState<CertificateType>('excellence');
  const [theme, setTheme] = useState<BorderTheme>('navy_gold');
  const [layout, setLayout] = useState<'landscape' | 'portrait'>('landscape');
  
  // Custom Content Fields (pre-filled from Student 360 if available, with graceful fallbacks)
  const [studentName, setStudentName] = useState(() => navStudent?.name || navStudent?.full_name || 'Sneha Gupta');
  const [admissionNo, setAdmissionNo] = useState(() => navStudent?.admission_number || navStudent?.admissionNo || 'SD-2026-0894');
  const [rollNo, setRollNo] = useState(() => navStudent?.roll_number || navStudent?.rollNo || '24');
  const [classSection, setClassSection] = useState(() => {
    if (navStudent?.class_name) {
      return navStudent.class_name.startsWith('Class ') ? navStudent.class_name : `Class ${navStudent.class_name}`;
    }
    if (navStudent?.class) {
      return `Class ${navStudent.class}${navStudent.section ? `-${navStudent.section}` : ''}`;
    }
    return 'Class X-A';
  });
  const [fatherName, setFatherName] = useState(() => navStudent?.father_name || 'Rajesh Gupta');
  const [motherName, setMotherName] = useState(() => navStudent?.mother_name || 'Suman Gupta');
  const [dob, setDob] = useState(() => navStudent?.date_of_birth || '2011-04-12');
  const [dateOfIssue, setDateOfIssue] = useState(new Date().toISOString().split('T')[0]);
  const [academicYear, setAcademicYear] = useState('2026-27');
  
  // TC-specific CBSE fields
  const [dateOfAdmission, setDateOfAdmission] = useState('2020-04-01');
  const [dateOfLeaving, setDateOfLeaving] = useState(new Date().toISOString().split('T')[0]);
  const [lastClassStudied, setLastClassStudied] = useState('Class VIII');
  const [reasonForLeaving, setReasonForLeaving] = useState('Transfer of parent');
  const [whetherPassed, setWhetherPassed] = useState<'Passed' | 'Failed' | 'Appeared'>('Passed');

  // Specific attributes depending on type
  const [achievement, setAchievement] = useState('Annual Coding Olympiad');
  const [rank, setRank] = useState('1st Rank');
  const [feeAmount, setFeeAmount] = useState('₹45,600');
  const [customBodyText, setCustomBodyText] = useState('');
  
  // Signatories
  const [signatory1Name, setSignatory1Name] = useState('Dr. S. K. Roy');
  const [signatory1Title, setSignatory1Title] = useState('Principal');
  const [signatory2Name, setSignatory2Name] = useState('Mrs. Vineeta Sen');
  const [signatory2Title, setSignatory2Title] = useState('Class Teacher');
  const [sigStyle, setSigStyle] = useState<'cursive' | 'printed' | 'seal'>('cursive');
  
  // Layout and Design options
  const [showWatermark, setShowWatermark] = useState(true);
  const [showQrCode, setShowQrCode] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Dynamic serial number (timestamp-based, stable across refreshes within session)
  const [certSerialRef] = useState(() => `${SCHOOL_SHORT}/${new Date().getFullYear()}/${Date.now().toString(36).toUpperCase().slice(-5)}`);
  
  // Issued list state (loaded from Supabase)
  const [issuedHistory, setIssuedHistory] = useState<IssuedCertificate[]>([]);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const certRef = useRef<HTMLDivElement>(null);

  // Sync student credentials when navigated with state (e.g. from Student 360 Drawer)
  useEffect(() => {
    const s = location.state?.student;
    if (s) {
      if (s.id) setSelectedStudentId(s.id);
      if (s.name || s.full_name) setStudentName(s.name || s.full_name);
      if (s.admission_number || s.admissionNo) setAdmissionNo(s.admission_number || s.admissionNo);
      if (s.roll_number || s.rollNo) setRollNo(s.roll_number || s.rollNo);
      if (s.class_name) {
        setClassSection(s.class_name.startsWith('Class ') ? s.class_name : `Class ${s.class_name}`);
      } else if (s.class) {
        setClassSection(`Class ${s.class}${s.section ? `-${s.section}` : ''}`);
      }
      if (s.father_name) setFatherName(s.father_name);
      if (s.mother_name) setMotherName(s.mother_name);
      if (s.date_of_birth) setDob(s.date_of_birth);
      if (s.academic_year) setAcademicYear(s.academic_year);
      toast.success(`Loaded certificate details for ${s.name || s.full_name || 'selected student'}`);
    }
  }, [location.state]);

  // Load active students from Supabase
  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      if (data && data.length > 0) {
        setAvailableStudents(data);
        if (!location.state?.student) {
          const first = data[0];
          setSelectedStudentId(first.id);
          setStudentName(first.name || 'Student');
          setAdmissionNo(first.admission_number || first.admissionNo || 'N/A');
          setRollNo(first.roll_number || first.rollNo || '1');
          setClassSection(`Class ${first.class || '10'}${first.section ? `-${first.section}` : ''}`);
          if (first.father_name) setFatherName(first.father_name);
          if (first.mother_name) setMotherName(first.mother_name);
          if (first.date_of_birth) setDob(first.date_of_birth);
        }
      }
    } catch (err: any) {
      console.warn('Error loading students for certificates:', err);
    }
  };

  // Load history directly from Supabase certificates table
  const loadCertificates = async () => {
    try {
      const { data: dbCerts, error } = await supabase
        .from('certificates')
        .select('*, students(name, class, section)')
        .order('issued_at', { ascending: false });

      if (error) throw error;

      if (dbCerts) {
        const mappedCerts: IssuedCertificate[] = dbCerts.map(c => ({
          id: c.id,
          certificateNo: c.serial_number || `SJS/TC/${c.id.substring(0, 4)}`,
          studentName: c.students?.name || 'Student Member',
          type: (c.certificate_type || 'bonafide') as CertificateType,
          classSection: c.students ? `Class ${c.students.class || ''}-${c.students.section || ''}` : 'General',
          issueDate: c.issued_at ? c.issued_at.split('T')[0] : new Date().toISOString().split('T')[0],
          uniqueCode: c.template_name || `CERT-VER-${c.id.substring(0, 5).toUpperCase()}`
        }));
        setIssuedHistory(mappedCerts);
      }
    } catch (err: any) {
      console.error('Error loading certificates from database:', err);
    }
  };

  useEffect(() => {
    loadCertificates();
    loadStudents();
  }, []);

  // Save issue record to local history and sync with Supabase
  const logIssuedCertificate = async () => {
    const ts = Date.now().toString(36).toUpperCase();
    const certNo = `${SCHOOL_SHORT}/${new Date().getFullYear()}/${certType.substring(0, 3).toUpperCase()}/${ts}`;
    const uniqueVerCode = `CERT-${certType.substring(0, 3).toUpperCase()}-${ts}`;
    
    const newId = crypto.randomUUID ? crypto.randomUUID() : `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newRecord: IssuedCertificate = {
      id: newId,
      certificateNo: certNo,
      studentName,
      type: certType,
      classSection,
      issueDate: dateOfIssue,
      uniqueCode: uniqueVerCode
    };

    // Upsert to Supabase certificates table
    try {
      let studentId: string | null = selectedStudentId;
      if (!studentId) {
        const { data: matchedStudents } = await supabase
          .from('students')
          .select('id')
          .eq('name', studentName)
          .limit(1);

        if (matchedStudents && matchedStudents.length > 0) {
          studentId = matchedStudents[0].id;
        }
      }

      if (studentId) {
        await supabase
          .from('certificates')
          .insert({
            student_id: studentId,
            certificate_type: certType,
            serial_number: certNo,
            template_name: uniqueVerCode,
            issued_at: new Date(dateOfIssue).toISOString(),
          });
        await loadCertificates();
      }
    } catch (err) {
      console.warn('Supabase save error:', err);
    }
  };

  const handleCopyVerification = () => {
    const verUrl = `${window.location.origin}/dashboard/certificates?verify=${admissionNo}`;
    navigator.clipboard.writeText(verUrl);
    setIsCopied(true);
    toast.success('Verification URL copied to clipboard!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const loadRealStudent = () => {
    if (availableStudents.length === 0) {
      toast.error('No active student records found in database.');
      return;
    }

    const random = availableStudents[Math.floor(Math.random() * availableStudents.length)];
    setSelectedStudentId(random.id);
    setStudentName(random.name || '');
    setClassSection(random.class ? `Class ${random.class}${random.section ? `-${random.section}` : ''}` : '');
    setAdmissionNo(random.admission_number || '');
    setRollNo(random.roll_number || '');
    setFatherName(random.father_name || '');
    setMotherName(random.mother_name || '');
    if (random.date_of_birth) setDob(random.date_of_birth);
    toast.success(`Loaded details for ${random.name}!`);
  };

  const handleDeleteRecord = async (id: string) => {
    const filtered = issuedHistory.filter(item => item.id !== id);
    setIssuedHistory(filtered);
    toast.success('Issue record deleted from ledger.');

    // Sync deletion with Supabase
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        await supabase.from('certificates').delete().eq('id', id);
        await loadCertificates();
      }
    } catch (err) {
      console.warn('Supabase delete error:', err);
    }
  };


  const handleDownload = async () => {
    if (!certRef.current) return;
    setIsGenerating(true);
    toast.loading('Capturing high-resolution template matrix...', { id: 'pdf-gen' });
    
    try {
      const scaleVal = 3.0; // Perfect high-fidelity print quality
      const canvas = await html2canvasSafe(certRef.current, {
        scale: scaleVal,
        useCORS: true,
        allowTaint: true,
        backgroundColor: theme === 'cosmic_cyan' ? '#0b0f19' : '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const isLnd = layout === 'landscape';
      const pdf = new jsPDF({
        orientation: isLnd ? 'landscape' : 'portrait',
        unit: 'px',
        format: isLnd ? [1123, 794] : [794, 1123] // A4 standards
      });
      
      const pdfWidth = isLnd ? 1123 : 794;
      const pdfHeight = isLnd ? 794 : 1123;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Certificate_${studentName.replace(/ /g, '_')}_${certType}.pdf`);
      
      // Log after successful download
      logIssuedCertificate();
      
      toast.success('Certificate generated, logged, and downloaded successfully!', { id: 'pdf-gen' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to capture high-res canvas. Try again.', { id: 'pdf-gen' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Dynamically compile the core body content text
  const getAutoBodyText = () => {
    if (customBodyText.trim()) return customBodyText;

    switch (certType) {
      case 'excellence':
        return `This is to certify that ${studentName} of ${classSection}, bearing Roll No. ${rollNo} and Admission No. ${admissionNo}, has outstandingly distinguished themselves by securing the ${rank} in the event of "${achievement}" during the academic session ${academicYear}. We honour their grit, perseverance, and intellect.`;
      case 'transfer':
        return `This is to certify that ${studentName}, son/daughter of Mr. ${fatherName} and Mrs. ${motherName}, was a bonafide student of ${SCHOOL_NAME}. Admitted on ${dateOfAdmission} and has successfully withdrawn admission with effect from ${dateOfLeaving}. Last class studied: ${lastClassStudied}. Result: ${whetherPassed}. Reason for leaving: ${reasonForLeaving}. All school dues have been cleared. Conduct and character during tenure was exemplary.`;
      case 'bonafide':
        return `This is to certify that ${studentName}, son/daughter of Mr. ${fatherName}, is a bonafide student of ${SCHOOL_NAME} (CBSE Aff. No. ${CBSE_AFF_NO}), ${SCHOOL_ADDRESS}. The student is currently enrolled in ${classSection} during the academic session ${academicYear}. To the best of our knowledge, the student bears an outstanding moral character.`;
      case 'character':
        return `This is to certify that ${studentName} of ${classSection} has been a student of this institution. During the academic tenure, the student displayed admirable character, observed school regulations with utmost discipline, and actively participated in co-curricular and community welfare activities.`;
      case 'migration':
        return `This is to certify that the administration of ${SCHOOL_NAME} (CBSE Aff. No. ${CBSE_AFF_NO}) holds no objection to ${studentName}, Admission No. ${admissionNo}, continuing their academic career at any other affiliated board or recognized secondary institution.`;
      case 'study':
        return `This is to certify that ${studentName} has successfully completed the course of study in ${classSection} at ${SCHOOL_NAME} during the Academic Session ${academicYear}. The student studied a structured curriculum comprising Languages, Science, Mathematics, Social Science, and Information Technology.`;
      case 'fee':
        return `This is to certify that ${studentName}, studying in ${classSection} under Admission No. ${admissionNo}, has successfully paid and cleared the school tuition, activities, library, and laboratory fees amounting to ${feeAmount} for the academic session ${academicYear}.`;
    }
  };

  // Color values for themes
  const getThemeStyles = () => {
    switch (theme) {
      case 'navy_gold':
        return {
          bg: 'bg-[#FCFDFE]',
          borderColor: 'border-[#C5A85A]',
          textColor: 'text-[#0B1E36]',
          accentColor: '#C5A85A',
          subText: 'text-slate-500',
          ornament: 'rgba(197, 168, 90, 0.12)',
          buttonColor: 'bg-[#0B1E36]',
          titleFont: 'font-serif'
        };
      case 'emerald_gold':
        return {
          bg: 'bg-[#FAFCFB]',
          borderColor: 'border-[#1D7A46]',
          textColor: 'text-[#06321F]',
          accentColor: '#D4AF37',
          subText: 'text-slate-500',
          ornament: 'rgba(29, 122, 70, 0.1)',
          buttonColor: 'bg-[#1D7A46]',
          titleFont: 'font-sans'
        };
      case 'maroon_silver':
        return {
          bg: 'bg-[#FFFDFD]',
          borderColor: 'border-[#800020]',
          textColor: 'text-[#3B000F]',
          accentColor: '#A0A0A0',
          subText: 'text-slate-500',
          ornament: 'rgba(128, 0, 32, 0.08)',
          buttonColor: 'bg-[#800020]',
          titleFont: 'font-serif'
        };
      case 'cosmic_cyan':
        return {
          bg: 'bg-[#0F172A]',
          borderColor: 'border-[#00F2FE]',
          textColor: 'text-white',
          accentColor: '#00F2FE',
          subText: 'text-slate-400',
          ornament: 'rgba(0, 242, 254, 0.15)',
          buttonColor: 'bg-indigo-600',
          titleFont: 'font-mono'
        };
      case 'minimal_slate':
        return {
          bg: 'bg-white',
          borderColor: 'border-slate-300',
          textColor: 'text-slate-900',
          accentColor: '#4F46E5',
          subText: 'text-slate-500',
          ornament: 'rgba(79, 70, 229, 0.05)',
          buttonColor: 'bg-slate-900',
          titleFont: 'font-sans'
        };
    }
  };

  const themeConfig = getThemeStyles();

  // Filter issue records
  const filteredHistory = issuedHistory.filter(item => {
    const matchesSearch = item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.certificateNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.uniqueCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 font-sans text-slate-700 antialiased">
      {/* 1. Page Header */}
      <AdminHeader
        title="Certificate & Credential Generator"
        subtitle="Generate, print, and audit bonafide, character, transfer, and academic excellence credentials with CBSE compliance."
        badge={{
          icon: Award,
          text: 'Credentials Center',
          variant: 'primary'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <>
            <button 
              onClick={loadRealStudent}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Select Active Student
            </button>
            
            <button 
              onClick={handleCopyVerification}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              Verification URL
            </button>
          </>
        }
      />

      {/* 2. Primary Workspace Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: Controls & Input Parameters (5 columns) */}
        <div className="xl:col-span-5 space-y-4">
          
          {/* Section: Select Certificate Template */}
          <div className="bg-white border border-slate-200/60 rounded-[20px] p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Layout className="w-3.5 h-3.5 text-indigo-600" />
              1. Choose Standard Credential Type
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'excellence', label: 'Academic Excellence', icon: Trophy },
                { id: 'transfer', label: 'Transfer Cert (TC)', icon: FileText },
                { id: 'bonafide', label: 'Bonafide Student', icon: User },
                { id: 'character', label: 'Character Certificate', icon: ShieldCheck },
                { id: 'migration', label: 'Migration Clearance', icon: CheckCircle2 },
                { id: 'study', label: 'Study Certificate', icon: GraduationCap },
                { id: 'fee', label: 'Fee Clearance Cert', icon: FileText }
              ].map((item) => {
                const IconComp = item.icon;
                const isSelected = certType === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCertType(item.id as CertificateType);
                      setCustomBodyText(''); // Clear to load the auto template
                    }}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02]",
                      isSelected 
                        ? "bg-indigo-50/70 border-indigo-200 text-indigo-700 font-bold" 
                        : "border-slate-200/60 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <IconComp className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-indigo-600" : "text-slate-400")} />
                    <span className="text-[11px] truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Interactive Custom Builder Inputs */}
          <div className="bg-white border border-slate-200/60 rounded-[20px] p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Type className="w-3.5 h-3.5 text-indigo-600" />
              2. Custom Content details
            </h3>

            <div className="space-y-3">
              {/* Row 1: Student Name & Admission Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Student Name</label>
                  <input 
                    type="text" 
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-semibold text-xs h-[36px]"
                    placeholder="e.g. Sneha Gupta"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Admission/ID No.</label>
                  <input 
                    type="text" 
                    value={admissionNo}
                    onChange={(e) => setAdmissionNo(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-semibold text-xs h-[36px]"
                    placeholder="e.g. SD-2026-0894"
                  />
                </div>
              </div>

              {/* Row 2: Roll Number & Class/Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Roll Number</label>
                  <input 
                    type="text" 
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-semibold text-xs h-[36px]"
                    placeholder="e.g. 24"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Grade / Class & Sec</label>
                  <input 
                    type="text" 
                    value={classSection}
                    onChange={(e) => setClassSection(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-semibold text-xs h-[36px]"
                    placeholder="e.g. Class X-A"
                  />
                </div>
              </div>

              {/* Contextual Fields depending on type */}
              {certType === 'excellence' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/40">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Competition / Event</label>
                    <input 
                      type="text" 
                      value={achievement}
                      onChange={(e) => setAchievement(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-semibold text-xs h-[36px]"
                      placeholder="e.g. Coding Olympiad"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Rank achieved</label>
                    <input 
                      type="text" 
                      value={rank}
                      onChange={(e) => setRank(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-semibold text-xs h-[36px]"
                      placeholder="e.g. 1st Rank"
                    />
                  </div>
                </div>
              )}

              {certType === 'fee' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/40 space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Amount Paid & Cleared</label>
                  <input 
                    type="text" 
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-bold text-xs h-[36px]"
                    placeholder="e.g. ₹45,600"
                  />
                </div>
              )}

              {(certType === 'transfer' || certType === 'bonafide' || certType === 'character') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/40">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Father's Name</label>
                    <input 
                      type="text" 
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-semibold text-xs h-[36px]"
                      placeholder="Father's Name"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Mother's Name</label>
                    <input 
                      type="text" 
                      value={motherName}
                      onChange={(e) => setMotherName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-semibold text-xs h-[36px]"
                      placeholder="Mother's Name"
                    />
                  </div>
                </div>
              )}

              {/* CBSE Transfer Certificate Extra Fields */}
              {certType === 'transfer' && (
                <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl space-y-3">
                  <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider">CBSE Transfer Certificate Fields</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Date of Admission</label>
                      <input type="date" value={dateOfAdmission} onChange={(e) => setDateOfAdmission(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 text-slate-800 font-semibold text-xs h-[36px]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Date of Leaving</label>
                      <input type="date" value={dateOfLeaving} onChange={(e) => setDateOfLeaving(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 text-slate-800 font-semibold text-xs h-[36px]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Last Class Studied</label>
                      <input type="text" value={lastClassStudied} onChange={(e) => setLastClassStudied(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 text-slate-800 font-semibold text-xs h-[36px]" placeholder="e.g. Class VIII" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Whether Passed</label>
                      <select value={whetherPassed} onChange={(e) => setWhetherPassed(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 text-slate-800 font-semibold text-xs h-[36px]">
                        <option value="Passed">Passed</option>
                        <option value="Failed">Failed</option>
                        <option value="Appeared">Appeared (Result Awaited)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider pl-1">Reason for Leaving</label>
                    <input type="text" value={reasonForLeaving} onChange={(e) => setReasonForLeaving(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 text-slate-800 font-semibold text-xs h-[36px]" placeholder="e.g. Transfer of parent" />
                  </div>
                </div>
              )}

              {/* General dates and years */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Date of Issue</label>
                  <input 
                    type="date" 
                    value={dateOfIssue}
                    onChange={(e) => setDateOfIssue(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-semibold text-xs h-[36px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Academic Session</label>
                  <input 
                    type="text" 
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-semibold text-xs h-[36px]"
                    placeholder="e.g. 2026-27"
                  />
                </div>
              </div>

              {/* Custom Override Paragraph */}
              <div className="space-y-1">
                <div className="flex justify-between items-center pr-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Custom Override Text (Optional)</label>
                  {customBodyText && (
                    <button 
                      onClick={() => setCustomBodyText('')} 
                      className="text-[9px] text-indigo-600 hover:underline font-bold"
                    >
                      Reset to Auto-Draft
                    </button>
                  )}
                </div>
                <textarea 
                  value={customBodyText}
                  onChange={(e) => setCustomBodyText(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 text-xs h-[72px] resize-none leading-normal font-medium"
                  placeholder="Leave empty to use standard automated ERP draft template based on selected credential..."
                />
              </div>
            </div>
          </div>

          {/* Section: Designer Toolset (Backgrounds, borders, signatures) */}
          <div className="bg-white border border-slate-200/60 rounded-[20px] p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Palette className="w-3.5 h-3.5 text-indigo-600" />
              3. Visual Design Style & Signatures
            </h3>

            {/* Themes Grid */}
            <div className="space-y-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Color Canvas Theme</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'navy_gold', label: 'Navy & Gold', color: 'bg-slate-900 border-[#C5A85A]' },
                  { id: 'emerald_gold', label: 'Emerald & Gold', color: 'bg-emerald-950 border-[#D4AF37]' },
                  { id: 'maroon_silver', label: 'Imperial Maroon', color: 'bg-[#5c0617] border-slate-400' },
                  { id: 'cosmic_cyan', label: 'Cosmic Cyan', color: 'bg-[#0f172a] border-[#00F2FE]' },
                  { id: 'minimal_slate', label: 'SaaS Minimalist', color: 'bg-white border-slate-300' }
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => setTheme(th.id as BorderTheme)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border text-left text-[11px] transition-all",
                      theme === th.id 
                        ? "border-indigo-500 ring-2 ring-indigo-500/10 font-bold bg-indigo-50/10" 
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span className={cn("w-3 h-3 rounded-full border shrink-0", th.color)} />
                    <span className="truncate">{th.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Toggle, Watermark, QR Code triggers */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Page Orientation</span>
                <select
                  value={layout}
                  onChange={(e) => setLayout(e.target.value as 'landscape' | 'portrait')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none text-xs text-slate-800 font-semibold h-[36px]"
                >
                  <option value="landscape">A4 Landscape</option>
                  <option value="portrait">A4 Portrait</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Signature Font</span>
                <select
                  value={sigStyle}
                  onChange={(e) => setSigStyle(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none text-xs text-slate-800 font-semibold h-[36px]"
                >
                  <option value="cursive">Classic Cursive</option>
                  <option value="printed">Formal Printed</option>
                  <option value="seal">Official School Seal</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200/50">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showWatermark} 
                  onChange={(e) => setShowWatermark(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Watermark Logo</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showQrCode} 
                  onChange={(e) => setShowQrCode(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Dynamic QR Code</span>
              </label>
            </div>

            {/* Custom Signatories Names */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Signatory 1 (Left)</label>
                <input 
                  type="text" 
                  value={signatory1Name}
                  onChange={(e) => setSignatory1Name(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none text-slate-800 font-semibold text-xs h-[36px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Signatory 2 (Right)</label>
                <input 
                  type="text" 
                  value={signatory2Name}
                  onChange={(e) => setSignatory2Name(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none text-slate-800 font-semibold text-xs h-[36px]"
                />
              </div>
            </div>

            {/* Generation Buttons */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { if (certRef.current) { const s = document.createElement('style'); s.id = '__cert_print'; s.innerHTML = `@media print { body > *:not(#cert-print-wrap){display:none!important;} #cert-print-wrap{display:block!important;} @page{size:A4 ${layout};margin:0;} }`; document.head.appendChild(s); window.print(); setTimeout(()=>{const e=document.getElementById('__cert_print');if(e)e.remove();},1200); } }}
                className="flex-1 h-[40px] bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button 
                onClick={handleDownload}
                disabled={isGenerating}
                className={cn(
                  "flex-[2] h-[40px] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer",
                  isGenerating ? "opacity-60 cursor-not-allowed bg-slate-600" : themeConfig.buttonColor
                )}
              >
                {isGenerating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Issue &amp; Download PDF
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Real-Time Visual WYSIWYG Print Canvas (7 columns) */}
        <div className="xl:col-span-7 space-y-4">
          
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              Pre-Print WYSIWYG Proof Canvas
            </h3>
            <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full uppercase">
              {layout === 'landscape' ? 'A4 Landscape (Proof)' : 'A4 Portrait (Proof)'}
            </span>
          </div>

          <div className="overflow-x-auto p-1 bg-slate-200 rounded-[20px] shadow-inner flex justify-center">
            
            {/* The Actual Certificate Capture Node */}
            <div 
              ref={certRef}
              className={cn(
                "relative flex flex-col justify-between items-center text-center p-8 sm:p-14 border-double rounded-lg overflow-hidden shrink-0 shadow-lg select-none",
                layout === 'landscape' ? "aspect-[1.414/1] w-[680px]" : "aspect-[1/1.414] w-[480px] h-[678px]",
                themeConfig.bg,
                theme === 'cosmic_cyan' ? 'border-[#00F2FE] border-[12px]' : 'border-slate-800 border-[16px]'
              )}
              style={{ 
                borderWidth: '14px', 
                borderColor: themeConfig.accentColor,
                fontFamily: theme === 'cosmic_cyan' ? 'monospace' : 'inherit'
              }}
            >
              {/* Inner Decorative Thin Border */}
              <div 
                className="absolute inset-4 sm:inset-6 border pointer-events-none" 
                style={{ borderColor: theme === 'cosmic_cyan' ? '#00f2fe40' : 'rgba(0,0,0,0.08)', borderWidth: '1.5px' }}
              />

              {/* Background watermark logo */}
              {showWatermark && (
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0 select-none">
                  <Award className="w-96 h-96" style={{ color: themeConfig.accentColor }} />
                </div>
              )}

              {/* Header block */}
              <div className="w-full space-y-3 relative z-10">
                <div className="flex justify-center items-center gap-2.5">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: theme === 'cosmic_cyan' ? 'rgba(0,242,254,0.1)' : 'rgba(79, 70, 229, 0.06)' }}>
                    <GraduationCap className="w-6 h-6" style={{ color: themeConfig.accentColor }} />
                  </div>
                  <div className="text-left">
                    <div className={cn("text-base font-black tracking-tight leading-none uppercase", themeConfig.textColor, themeConfig.titleFont)}>
                      {SCHOOL_NAME}
                    </div>
                    <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      CBSE Affiliated • Aff. No. {CBSE_AFF_NO} • {SCHOOL_ADDRESS}
                    </div>
                  </div>
                </div>

                <div className="w-full flex justify-between items-center text-[8.5px] font-mono text-slate-400 border-b border-dashed border-slate-300 pb-1.5">
                  <span>REF NO: {certSerialRef}</span>
                  <span>DATE: {dateOfIssue}</span>
                </div>
              </div>

              {/* Core certificate title */}
              <div className="space-y-1 sm:space-y-2 relative z-10 mt-2">
                <h2 
                  className={cn("text-lg sm:text-2xl font-black uppercase tracking-[0.2em] leading-none", themeConfig.titleFont)}
                  style={{ color: theme === 'cosmic_cyan' ? '#00f2fe' : themeConfig.accentColor }}
                >
                  {certType === 'excellence' && 'Certificate of Excellence'}
                  {certType === 'transfer' && 'School Leaving Certificate'}
                  {certType === 'bonafide' && 'Bonafide Student Certificate'}
                  {certType === 'character' && 'Character Certificate'}
                  {certType === 'migration' && 'Migration Certificate'}
                  {certType === 'study' && 'Study Completion Certificate'}
                  {certType === 'fee' && 'Fee Clearance Certificate'}
                </h2>
                <div className="text-[8px] font-extrabold uppercase text-slate-400 tracking-[0.3em]">
                  Official Academic Validation Record
                </div>
              </div>

              {/* Dynamic body paragraph - Designed for Premium Academic Certificates */}
              <div className="relative z-10 px-2 sm:px-6 my-auto w-full">
                {customBodyText.trim() ? (
                  <p className={cn("text-[11px] sm:text-[12px] leading-relaxed mx-auto italic font-medium max-w-lg text-center", theme === 'cosmic_cyan' ? 'text-slate-300' : 'text-slate-700')}>
                    {customBodyText}
                  </p>
                ) : (
                  <div className="space-y-4">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-bold block">
                      This is to certify that
                    </span>
                    
                    {/* Large Student Name with elegant gold accent line underneath */}
                    <div className="max-w-md mx-auto py-1">
                      <span className={cn(
                        "text-base sm:text-2xl font-bold tracking-wide uppercase block text-center",
                        theme === 'cosmic_cyan' ? 'text-white font-mono' : 'text-slate-900 font-serif'
                      )}>
                        {studentName}
                      </span>
                      <div 
                        className="h-[1.5px] w-28 mx-auto mt-2" 
                        style={{ backgroundColor: theme === 'cosmic_cyan' ? '#00f2fe' : '#C5A85A' }} 
                      />
                    </div>

                    <p className={cn(
                      "text-[10.5px] sm:text-[11.5px] leading-relaxed mx-auto font-medium max-w-xl text-center",
                      theme === 'cosmic_cyan' ? 'text-slate-300 font-mono' : 'text-slate-600 font-sans'
                    )}>
                      {certType === 'excellence' && (
                        <>
                          of <span className="font-bold text-slate-900">{classSection}</span>, bearing Roll No. <span className="font-bold font-mono text-slate-900">#{rollNo}</span> and Admission No. <span className="font-bold font-mono text-slate-900">{admissionNo}</span>, has outstandingly distinguished themselves by securing the <span className="font-bold text-slate-900">{rank}</span> in the event of <span className="font-bold text-slate-900">"{achievement}"</span> during the academic session <span className="font-semibold text-slate-500">{academicYear}</span>. We honour their grit, perseverance, and intellect.
                        </>
                      )}
                      {certType === 'transfer' && (
                        <>
                          son/daughter of <span className="font-bold text-slate-900">Mr. {fatherName}</span> and <span className="font-bold text-slate-900">Mrs. {motherName}</span>, was a bonafide student of <span className="font-bold text-slate-900">{SCHOOL_NAME}</span>. Admitted on <span className="font-bold font-mono text-slate-900">{dateOfAdmission}</span>, left on <span className="font-bold font-mono text-slate-900">{dateOfLeaving}</span>. Last class studied: <span className="font-bold text-slate-900">{lastClassStudied}</span>. Result: <span className="font-bold text-emerald-700">{whetherPassed}</span>. Reason: {reasonForLeaving}. All dues cleared. Conduct and character was exemplary.
                        </>
                      )}
                      {certType === 'bonafide' && (
                        <>
                          son/daughter of <span className="font-bold text-slate-900">Mr. {fatherName}</span>, is a bonafide student of <span className="font-bold text-slate-900">{SCHOOL_NAME}</span> (CBSE Aff. No. {CBSE_AFF_NO}). The student is currently enrolled in <span className="font-bold text-slate-900">{classSection}</span> during the session <span className="font-semibold text-slate-500">{academicYear}</span>. To the best of our knowledge, the student bears an outstanding moral character.
                        </>
                      )}
                      {certType === 'character' && (
                        <>
                          of <span className="font-bold text-slate-900">{classSection}</span> has been a student of this institution. During the academic tenure, the student displayed admirable character, observed school regulations with utmost discipline, and actively participated in co-curricular and community welfare activities.
                        </>
                      )}
                      {certType === 'migration' && (
                        <>
                          Admission No. <span className="font-bold font-mono text-slate-900">{admissionNo}</span>, has completed the course of study. The administration of <span className="font-bold text-slate-900">{SCHOOL_NAME}</span> holds no objection to continuing academic career at any other affiliated board or recognized secondary institution.
                        </>
                      )}
                      {certType === 'study' && (
                        <>
                          has successfully completed the course of study in <span className="font-bold text-slate-900">{classSection}</span> at <span className="font-bold text-slate-900">{SCHOOL_NAME}</span> during the Academic Session <span className="font-semibold text-slate-500">{academicYear}</span>. The student studied a structured curriculum comprising Languages, Science, Mathematics, Social Science, and Information Technology.
                        </>
                      )}
                      {certType === 'fee' && (
                        <>
                          studying in <span className="font-bold text-slate-900">{classSection}</span> under Admission No. <span className="font-bold font-mono text-slate-900">{admissionNo}</span>, has successfully paid and cleared the school tuition, activities, library, and laboratory fees amounting to <span className="font-bold font-mono text-indigo-700">{feeAmount}</span> for the academic session <span className="font-semibold text-slate-500">{academicYear}</span>.
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Achievement display block for Excellence */}
              {certType === 'excellence' && (
                <div className="relative z-10 my-1">
                  <div 
                    className="text-[10px] sm:text-xs font-bold px-5 py-1.5 rounded-full inline-block border font-mono tracking-wider"
                    style={{ 
                      color: theme === 'cosmic_cyan' ? '#00f2fe' : themeConfig.accentColor,
                      background: theme === 'cosmic_cyan' ? 'rgba(0, 242, 254, 0.08)' : 'rgba(197, 168, 90, 0.05)',
                      borderColor: theme === 'cosmic_cyan' ? '#00f2fe40' : 'rgba(197, 168, 90, 0.3)'
                    }}
                  >
                    ✦ {rank || 'ACHIEVEMENT'} ✦
                  </div>
                </div>
              )}

              {/* Footer and signatories */}
              <div className="w-full flex justify-between items-end mt-4 relative z-10 pt-2 border-t border-slate-100">
                
                {/* Signatory 1 */}
                <div className="text-left space-y-1">
                  <div className="h-6 flex items-end">
                    {sigStyle === 'cursive' && (
                      <span className="font-serif italic text-xs text-indigo-500 font-bold opacity-80 pl-2">
                        {signatory1Name}
                      </span>
                    )}
                    {sigStyle === 'printed' && (
                      <span className="font-mono text-[9px] uppercase tracking-wide text-slate-700 font-bold pl-1">
                        {signatory1Name}
                      </span>
                    )}
                    {sigStyle === 'seal' && (
                      <div className="w-10 h-10 border-2 border-indigo-500/30 rounded-full flex items-center justify-center text-[7px] font-bold text-indigo-500 uppercase rotate-12 bg-indigo-50/20">
                        SD SEAL
                      </div>
                    )}
                  </div>
                  <div className="w-24 sm:w-28 h-[1px] bg-slate-300" />
                  <div className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">
                    {signatory1Title}
                  </div>
                </div>

                {/* QR Code / Barcode representation */}
                {showQrCode && (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="p-1 bg-white border border-slate-200 rounded-lg">
                      <QRCodeSVG 
                        value={`https://sjsbrlschool.edu.in/verify/${admissionNo}`}
                        size={40}
                        bgColor={"#ffffff"}
                        fgColor={"#0f172a"}
                        level={"L"}
                        includeMargin={false}
                      />
                    </div>
                    <span className="text-[6.5px] font-mono font-bold text-slate-400 uppercase">
                      VERIFY QR
                    </span>
                  </div>
                )}

                {/* Signatory 2 */}
                <div className="text-right space-y-1">
                  <div className="h-6 flex items-end justify-end">
                    {sigStyle === 'cursive' && (
                      <span className="font-serif italic text-xs text-indigo-500 font-bold opacity-80 pr-2">
                        {signatory2Name}
                      </span>
                    )}
                    {sigStyle === 'printed' && (
                      <span className="font-mono text-[9px] uppercase tracking-wide text-slate-700 font-bold pr-1">
                        {signatory2Name}
                      </span>
                    )}
                    {sigStyle === 'seal' && (
                      <div className="w-10 h-10 border-2 border-indigo-500/30 rounded-full flex items-center justify-center text-[7px] font-bold text-indigo-500 uppercase -rotate-12 bg-indigo-50/20">
                        OFFICE
                      </div>
                    )}
                  </div>
                  <div className="w-24 sm:w-28 h-[1px] bg-slate-300" />
                  <div className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">
                    {signatory2Title}
                  </div>
                </div>

              </div>
              
            </div>

          </div>

        </div>

      </div>

      {/* 3. Bottom Audit Trail / Issued Ledger History */}
      <div className="bg-white border border-slate-200/60 rounded-[24px] p-5 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Issued Credentials Ledger & Audit Trail
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wide">
              Official school registry tracking verification hash values and issue status
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text"
                placeholder="Search ledger..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-700 w-44 font-semibold"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 text-xs outline-none text-slate-600 font-bold"
            >
              <option value="all">All Types</option>
              <option value="excellence">Academic Excellence</option>
              <option value="transfer">Transfer (TC)</option>
              <option value="bonafide">Bonafide</option>
              <option value="character">Character</option>
              <option value="migration">Migration</option>
              <option value="study">Study</option>
              <option value="fee">Fee clearance</option>
            </select>
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <th className="py-2.5 px-4">Certificate No</th>
                <th className="py-2.5 px-4">Student Name</th>
                <th className="py-2.5 px-4">Class</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Issue Date</th>
                <th className="py-2.5 px-4">Verification Hash</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              <AnimatePresence mode="popLayout">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((item) => (
                    <motion.tr 
                      layout
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/40 text-slate-600 font-medium"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono text-[11px]">{item.certificateNo}</td>
                      <td className="py-3 px-4 text-slate-800 font-bold">{item.studentName}</td>
                      <td className="py-3 px-4 font-semibold text-slate-500">{item.classSection}</td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide",
                          item.type === 'excellence' && "bg-amber-50 text-amber-700 border border-amber-100",
                          item.type === 'transfer' && "bg-rose-50 text-rose-700 border border-rose-100",
                          item.type === 'bonafide' && "bg-indigo-50 text-indigo-700 border border-indigo-100",
                          item.type === 'character' && "bg-emerald-50 text-emerald-700 border border-emerald-100",
                          item.type === 'migration' && "bg-sky-50 text-sky-700 border border-sky-100",
                          item.type === 'study' && "bg-violet-50 text-violet-700 border border-violet-100",
                          item.type === 'fee' && "bg-teal-50 text-teal-700 border border-teal-100"
                        )}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-500">{item.issueDate}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400 font-semibold">{item.uniqueCode}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              // Reload details to review
                              setStudentName(item.studentName);
                              setClassSection(item.classSection);
                              setCertType(item.type);
                              setDateOfIssue(item.issueDate);
                              toast.info(`Reviewing ${item.studentName}'s template`);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-all"
                            title="Load and Review"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteRecord(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                            title="Revoke Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 font-semibold">
                      No issued certificate records match filters.
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
