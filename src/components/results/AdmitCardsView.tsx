import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  IdCard, 
  Search, 
  Printer, 
  Download, 
  Check, 
  QrCode, 
  MapPin, 
  Clock, 
  FileText, 
  Loader2, 
  Sparkles, 
  Barcode, 
  Award, 
  GraduationCap,
  Users,
  Eye,
  CheckSquare,
  Square,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { printRegion } from '@/lib/printRegion';
import { supabase } from '@/lib/supabase';
import { jsPDF } from 'jspdf';
import html2canvasSafe from '@/lib/html2canvasSafe';
import { useAuth } from '@/context/AuthContext';
import { isSameClass, formatClassDisplay } from '@/lib/cbseExamUtils';
import sjsLogo from '@/assets/sjs_logo_icon.jpg';
import StudentAdmitCardModal from './StudentAdmitCardModal';

export default function AdmitCardsView() {
  const { user, role, roleLabel } = useAuth();

  const [viewMode, setViewMode] = useState<'preview' | 'roster'>('roster');
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedSection, setSelectedSection] = useState('All');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState<number>(1.0);
  const [watermark, setWatermark] = useState<string>('NONE');
  
  // Selection state for batch actions
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // PDF & Print states
  const [isGeneratingSinglePdf, setIsGeneratingSinglePdf] = useState(false);
  const [isGeneratingBatchPdf, setIsGeneratingBatchPdf] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Modal Preview state
  const [previewStudent, setPreviewStudent] = useState<any | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const hiddenBatchContainerRef = useRef<HTMLDivElement>(null);

  // Database states
  const [students, setStudents] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [examSubjects, setExamSubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [examsRes, subjectsRes, studentsRes, esRes, classesRes] = await Promise.all([
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').order('subject_name'),
        supabase.from('students').select('*').eq('status', 'active').order('roll_number', { ascending: true }),
        supabase.from('exam_subjects').select('*'),
        supabase.from('classes').select('*').order('display_order', { ascending: true })
      ]);

      const examData = examsRes.data || [];
      const studentData = studentsRes.data || [];
      setExams(examData);
      setSubjects(subjectsRes.data || []);
      setStudents(studentData);
      setExamSubjects(esRes.data || []);
      setClassesList(classesRes.data || []);

      if (examData.length > 0 && !selectedExamId) {
        setSelectedExamId(examData[0].id);
      }
      if (studentData.length > 0 && !selectedStudentId) {
        setSelectedStudentId(studentData[0].id);
      }
    } catch (err) {
      console.error('Failed to load admit card data:', err);
      toast.error('Failed loading admit card records');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter students based on Class, Section & Search Query
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchClass = selectedClass === 'All' || isSameClass(s.class, selectedClass);
      const matchSection = selectedSection === 'All' || (s.section || '').toUpperCase() === selectedSection.toUpperCase();
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        (s.name || '').toLowerCase().includes(q) ||
        (s.roll_number || '').toString().includes(q) ||
        (s.admission_number || '').toLowerCase().includes(q) ||
        (s.father_name || '').toLowerCase().includes(q);
      
      return matchClass && matchSection && matchQuery;
    });
  }, [students, selectedClass, selectedSection, searchQuery]);

  useEffect(() => {
    if (filteredStudents.length > 0 && !filteredStudents.some(s => s.id === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [filteredStudents, selectedStudentId]);

  const activeStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId) || filteredStudents[0] || students[0] || null;
  }, [students, selectedStudentId, filteredStudents]);

  const activeExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId) || exams[0] || null;
  }, [exams, selectedExamId]);

  // Timetable for active exam — built only from real exam_subjects rows
  // (exam_date/start_time/duration/room, set via Datesheets). An exam with
  // no subjects scheduled yet shows an empty state rather than a fabricated
  // CBSE-style subject list with invented dates.
  const subjectTimetable = useMemo(() => {
    const matchingES = examSubjects.filter(es => es.exam_id === selectedExamId);
    return matchingES.map((es, idx) => ({
      code: es.subject_id ? es.subject_id.slice(0, 6).toUpperCase() : `SUB-0${idx + 1}`,
      name: es.subject_name,
      date: es.exam_date || 'Not scheduled',
      time: es.start_time ? `${es.start_time}${es.duration ? ` (${es.duration})` : ''}` : '—',
      room: es.room || `Desk #${activeStudent?.roll_number || idx + 1}`
    }));
  }, [examSubjects, selectedExamId, activeStudent]);

  // Handle single student PDF download
  const handleDownloadSinglePDF = async (targetStudent?: any) => {
    const st = targetStudent || activeStudent;
    if (!st) {
      toast.error('No candidate selected for admit card compilation.');
      return;
    }

    if (targetStudent && targetStudent.id !== activeStudent?.id) {
      setSelectedStudentId(targetStudent.id);
      // Wait for state render
      await new Promise(r => setTimeout(r, 100));
    }

    if (!cardRef.current) return;
    setIsGeneratingSinglePdf(true);
    const toastId = toast.loading(`Compiling official CBSE Admit Card for ${st.name}...`);
    try {
      const canvas = await html2canvasSafe(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      pdf.save(`CBSE_AdmitCard_${(st.name || 'Student').replace(/\s+/g, '_')}_Roll_${st.roll_number || '00'}.pdf`);
      toast.success(`Admit Card for ${st.name} downloaded successfully!`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to compile vector admit card.', { id: toastId });
    } finally {
      setIsGeneratingSinglePdf(false);
    }
  };

  // Toggle student selection for batch operations
  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };

  // Handle Batch Multi-Page PDF Download
  const handleDownloadBatchPDF = async (specificStudents?: any[]) => {
    const listToProcess = specificStudents || (
      selectedStudentIds.length > 0
        ? filteredStudents.filter(s => selectedStudentIds.includes(s.id))
        : filteredStudents
    );

    if (listToProcess.length === 0) {
      toast.error('No students selected for batch admit card generation.');
      return;
    }

    setIsGeneratingBatchPdf(true);
    const totalCount = listToProcess.length;
    const toastId = toast.loading(`Initiating multi-page compilation for ${totalCount} Admit Cards...`);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < totalCount; i++) {
        const student = listToProcess[i];
        setBatchProgress({ current: i + 1, total: totalCount });
        toast.loading(`Compiling Admit Card ${i + 1} of ${totalCount} (${student.name})...`, { id: toastId });

        // Set student as active and allow DOM to repaint
        setSelectedStudentId(student.id);
        await new Promise(resolve => setTimeout(resolve, 80));

        if (cardRef.current) {
          const canvas = await html2canvasSafe(cardRef.current, {
            scale: 2.2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
          });
          const imgData = canvas.toDataURL('image/png');

          if (i > 0) {
            pdf.addPage();
          }
          pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
        }
      }

      const fileName = selectedClass === 'All' 
        ? `CBSE_AdmitCards_Batch_${totalCount}_Students.pdf`
        : `CBSE_AdmitCards_Class_${selectedClass}_Sec_${selectedSection}_Batch.pdf`;

      pdf.save(fileName);
      toast.success(`Successfully downloaded ${totalCount} Admit Cards in unified multi-page PDF!`, { id: toastId });
    } catch (err) {
      console.error('Batch PDF compilation error:', err);
      toast.error('Failed to complete batch admit card compilation.', { id: toastId });
    } finally {
      setIsGeneratingBatchPdf(false);
      setBatchProgress(null);
    }
  };

  const verificationUrl = `https://sjsbarhalganj.edu.in/verify/admit-card?adm=${activeStudent?.admission_number}&roll=${activeStudent?.roll_number}&session=2026-2027`;

  return (
    <div className="space-y-5">
      {/* 1. Header & Role Access Overview */}
      <div className="bg-white rounded-[22px] border border-slate-200/80 p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <IdCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase text-slate-900 tracking-wide font-display">
                  CBSE Examination Admit Cards & Hall Tickets
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                  Role: {roleLabel || role || 'Staff'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Official St. Joseph's School Hall Ticket generation, bulk export, verification, and print center.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('roster')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === 'roster' 
                  ? "bg-white text-blue-900 shadow-xs" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Users size={13} /> Class Roster & Bulk Export ({filteredStudents.length})
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === 'preview' 
                  ? "bg-white text-blue-900 shadow-xs" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Eye size={13} /> Official Document Preview
            </button>
          </div>
        </div>

        {/* 2. Filters & Batch Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Class Filter */}
            <div className="flex flex-col min-w-[110px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Class Filter</span>
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-blue-500 focus:bg-white"
              >
                <option value="All">All Classes</option>
                {classesList.length > 0 ? (
                  classesList.map(c => (
                    <option key={c.id} value={c.class_name}>{formatClassDisplay(c.class_name)}</option>
                  ))
                ) : (
                  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'LKG'].map(c => (
                    <option key={c} value={c}>{formatClassDisplay(c)}</option>
                  ))
                )}
              </select>
            </div>

            {/* Section Filter */}
            <div className="flex flex-col min-w-[85px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Section</span>
              <select 
                value={selectedSection} 
                onChange={(e) => setSelectedSection(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-2.5 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-blue-500 focus:bg-white"
              >
                <option value="All">All Sec</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>
            </div>

            {/* Assessment Term selection */}
            <div className="flex flex-col min-w-[170px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Assessment Term</span>
              <select 
                value={selectedExamId} 
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-700 outline-none h-[36px] cursor-pointer focus:border-blue-500 focus:bg-white"
              >
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.academic_year})</option>
                ))}
              </select>
            </div>

            {/* Candidate Search Box */}
            <div className="flex flex-col min-w-[200px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">Search Candidate</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Name, Roll No, Scholar No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-800 outline-none h-[36px] focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Quick Batch Download Actions */}
          <div className="flex items-center gap-2">
            {selectedStudentIds.length > 0 && (
              <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-xl">
                {selectedStudentIds.length} Selected
              </span>
            )}

            <button
              onClick={() => handleDownloadBatchPDF()}
              disabled={isGeneratingBatchPdf || filteredStudents.length === 0}
              className="flex items-center gap-1.5 px-3.5 h-[36px] bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingBatchPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compiling {batchProgress ? `(${batchProgress.current}/${batchProgress.total})` : '...'}</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>
                    {selectedStudentIds.length > 0 
                      ? `Download Selected (${selectedStudentIds.length}) PDF`
                      : `Download Class Admit Cards (${filteredStudents.length})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. ROSTER / TABLE VIEW MODE */}
      {viewMode === 'roster' && (
        <div className="bg-white rounded-[22px] border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAllFiltered}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                  <CheckSquare size={13} className="text-blue-600" />
                ) : (
                  <Square size={13} className="text-slate-400" />
                )}
                <span>Select All ({filteredStudents.length})</span>
              </button>
              <span className="text-xs text-slate-400 font-medium">
                • Showing verified students eligible for {activeExam?.exam_name || 'CBSE Examinations'}
              </span>
            </div>

            <div className="text-xs font-bold text-slate-500">
              Exam Centre: <span className="text-blue-900 font-black">St. Joseph's Senior Wing (Barhalganj)</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={handleSelectAllFiltered}
                      className="cursor-pointer rounded-sm"
                    />
                  </th>
                  <th className="py-2.5 px-3">Roll No</th>
                  <th className="py-2.5 px-3">Candidate Name</th>
                  <th className="py-2.5 px-3">Scholar No</th>
                  <th className="py-2.5 px-3">Class & Sec</th>
                  <th className="py-2.5 px-3">Father's Name</th>
                  <th className="py-2.5 px-3 text-center">Verification Status</th>
                  <th className="py-2.5 px-3 text-right">Admit Card Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-xs font-medium">
                      No student records found matching the specified filters.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st, idx) => {
                    const isSelected = selectedStudentIds.includes(st.id);
                    return (
                      <tr 
                        key={st.id} 
                        className={cn(
                          "hover:bg-slate-50/80 transition-colors",
                          isSelected && "bg-blue-50/40"
                        )}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => handleToggleSelectStudent(st.id)}
                            className="cursor-pointer rounded-sm"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black text-blue-900">
                          #{st.roll_number || idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-black text-[10px] text-slate-600 shrink-0">
                              {st.photo_url ? (
                                <img src={st.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                st.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="font-bold text-slate-900 uppercase text-xs">{st.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{st.admission_number || 'N/A'}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-700">Class {st.class}-{st.section || 'A'}</td>
                        <td className="py-2.5 px-3 text-slate-600 uppercase text-[11px]">{st.father_name || 'N/A'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[9.5px] font-black uppercase inline-flex items-center gap-1">
                            <CheckCircle2 size={10} /> Verified Pass
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Preview Modal Button */}
                            <button
                              onClick={() => setPreviewStudent(st)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Preview Full Hall Ticket Modal"
                            >
                              <Eye size={12} /> View
                            </button>

                            {/* Download PDF Button */}
                            <button
                              onClick={() => handleDownloadSinglePDF(st)}
                              disabled={isGeneratingSinglePdf}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Download Crisp PDF Admit Card"
                            >
                              <Download size={12} /> PDF
                            </button>

                            {/* Print Button */}
                            <button
                              onClick={() => {
                                setSelectedStudentId(st.id);
                                setViewMode('preview');
                                setTimeout(() => printRegion('admit-card-print', 'Admit Card'), 200);
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Print A4 Admit Card"
                            >
                              <Printer size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. OFFICIAL DOCUMENT PREVIEW & CONTROLS MODE */}
      {viewMode === 'preview' && (
        <div className="space-y-4">
          {/* Document Toolbar */}
          <div className="bg-white rounded-[20px] border border-slate-200/80 p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Active candidate selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-500 uppercase">Selected Student:</span>
                <select 
                  value={selectedStudentId} 
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-1 px-3 text-xs font-bold text-blue-900 outline-none h-[34px] cursor-pointer"
                >
                  {filteredStudents.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name} (Roll #{st.roll_number || 'N/A'}, Class {st.class}-{st.section || 'A'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Zoom control */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase">Zoom:</span>
                <select 
                  value={zoom} 
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 text-xs font-semibold text-slate-700 h-[30px] cursor-pointer"
                >
                  <option value="0.85">85% Fit</option>
                  <option value="1.0">100% Std</option>
                  <option value="1.15">115% Large</option>
                </select>
              </div>

              {/* Watermark control */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <span className="text-[10px] font-black text-slate-400 uppercase">Watermark:</span>
                <select 
                  value={watermark} 
                  onChange={(e) => setWatermark(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 text-xs font-semibold text-slate-700 h-[30px] cursor-pointer"
                >
                  <option value="NONE">None</option>
                  <option value="OFFICIAL COPY">Official Copy</option>
                  <option value="VERIFIED ERP">Verified ERP</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleDownloadSinglePDF()}
                disabled={isGeneratingSinglePdf}
                className="flex items-center gap-1.5 px-3.5 h-[34px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isGeneratingSinglePdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download size={13} />}
                Download PDF
              </button>
              
              <button 
                onClick={() => {
                  const ok = printRegion('admit-card-print', `Admit Card — ${activeStudent?.name || 'Student'}`);
                  if (!ok) toast.error('Open a student admit card before printing.');
                }}
                className="flex items-center gap-1.5 px-3.5 h-[34px] bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Printer size={13} /> Print Slip
              </button>
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div className="max-w-4xl mx-auto bg-slate-100 p-4 sm:p-8 rounded-[28px] border border-slate-200/50 overflow-auto flex justify-center">
            <div 
              ref={cardRef}
              id="admit-card-print"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
              className="transition-transform duration-200 relative w-[210mm] min-h-[285mm] bg-white border-2 border-slate-900 p-[10mm] text-slate-900 shadow-xl font-sans"
            >
              {/* Dynamic Watermark Stamp Overlay */}
              {watermark !== 'NONE' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
                  <div className="text-[80px] font-black text-slate-400/10 uppercase tracking-widest -rotate-30 whitespace-nowrap">
                    {watermark}
                  </div>
                </div>
              )}

              {/* Inner Border */}
              <div className="border border-slate-900 p-4 flex flex-col justify-between h-full bg-white relative space-y-3">
                
                {/* Top Section */}
                <div className="space-y-3 relative z-10">
                  {/* 1. School Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
                    {/* CBSE Emblem Left */}
                    <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                      <img 
                        src="https://upload.wikimedia.org/wikipedia/en/thumb/9/95/CBSE_new_logo.svg/300px-CBSE_new_logo.svg.png" 
                        alt="CBSE Logo" 
                        className="w-14 h-14 object-contain"
                        crossOrigin="anonymous"
                      />
                    </div>

                    {/* School Details */}
                    <div className="flex-1 text-center px-2">
                      <h1 className="text-lg font-black text-slate-950 uppercase tracking-tight font-serif leading-tight">
                        ST. JOSEPH'S SCHOOL
                      </h1>
                      <p className="text-[10px] text-slate-700 font-bold tracking-wide mt-0.5">
                        Korari, Barhalganj - Gorakhpur (U.P.) - 273402
                      </p>
                      <p className="text-[8.5px] text-slate-600 font-semibold tracking-wide">
                        CBSE Affiliation No.: <span className="font-bold text-slate-900">2131498</span> | School No.: <span className="font-bold text-slate-900">70532</span> | Senior Secondary (10+2)
                      </p>
                      <p className="text-[8px] text-slate-500 font-medium">
                        Website: www.sjsbarhalganj.edu.in | Phone: +91 94508 84521
                      </p>
                    </div>

                    {/* SJS Crest Right */}
                    <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                      <img 
                        src={sjsLogo} 
                        alt="SJS Crest" 
                        className="w-14 h-14 object-contain"
                      />
                    </div>
                  </div>

                  {/* 2. Title Banner */}
                  <div className="bg-slate-900 text-white text-center py-1 px-3 border border-slate-900 shadow-2xs">
                    <span className="font-extrabold text-[11px] uppercase tracking-widest block font-sans">
                      CBSE EXAMINATION ADMIT CARD / HALL TICKET
                    </span>
                    <span className="text-[8.5px] text-slate-300 font-medium block">
                      {activeExam?.exam_name || 'CBSE ANNUAL ASSESSMENT 2026-2027'} • ACADEMIC SESSION: {activeExam?.academic_year || '2026-2027'}
                    </span>
                  </div>

                  {/* 3. Student Biodata Matrix */}
                  <div className="border border-slate-900 p-2.5 bg-slate-50/50">
                    <div className="grid grid-cols-12 gap-3 items-start">
                      
                      {/* Biodata Columns (9 cols) */}
                      <div className="col-span-9 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[9px]">
                        <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                          <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Candidate Name:</span>
                          <span className="font-black text-slate-950 uppercase text-[9.5px]">{activeStudent?.name || 'N/A'}</span>
                        </div>
                        <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                          <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Roll Number:</span>
                          <span className="font-mono font-black text-blue-900 text-[10px]">#{activeStudent?.roll_number || '12'}</span>
                        </div>

                        <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                          <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Scholar / Adm No.:</span>
                          <span className="font-mono font-bold text-slate-900">{activeStudent?.admission_number || 'N/A'}</span>
                        </div>
                        <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                          <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Class & Section:</span>
                          <span className="font-bold text-slate-900">{formatClassDisplay(activeStudent?.class)} - Section {activeStudent?.section || 'A'}</span>
                        </div>

                        <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                          <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Mother's Name:</span>
                          <span className="font-bold text-slate-900 uppercase">{activeStudent?.mother_name || 'N/A'}</span>
                        </div>
                        <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                          <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Father's Name:</span>
                          <span className="font-bold text-slate-900 uppercase">{activeStudent?.father_name || 'N/A'}</span>
                        </div>

                        <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                          <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Date of Birth:</span>
                          <span className="font-bold text-slate-900">
                            {activeStudent?.date_of_birth
                              ? new Date(activeStudent.date_of_birth).toLocaleDateString('en-IN')
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1 border-b border-slate-200 pb-0.5">
                          <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Gender / Category:</span>
                          <span className="font-bold text-slate-900">{activeStudent?.gender || 'N/A'} / Regular (CBSE)</span>
                        </div>

                        <div className="col-span-2 flex items-baseline gap-1 pt-0.5">
                          <span className="font-bold text-slate-500 uppercase text-[8px] w-28 shrink-0">Exam Centre:</span>
                          <span className="font-bold text-blue-950">
                            St. Joseph's Senior Academic Wing, Korari, Barhalganj - Gorakhpur (Center Code: 70532)
                          </span>
                        </div>
                      </div>

                      {/* Photo + QR (3 cols) */}
                      <div className="col-span-3 flex flex-col items-center justify-center space-y-1.5 border-l border-slate-300 pl-2">
                        <div className="w-22 h-26 bg-white border border-slate-900 p-0.5 shadow-2xs flex items-center justify-center">
                          {activeStudent?.photo_url ? (
                            <img 
                              src={activeStudent.photo_url} 
                              alt="" 
                              crossOrigin="anonymous"
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                              <span className="font-black text-2xl">{activeStudent?.name?.charAt(0) || 'S'}</span>
                              <span className="text-[6px] font-bold uppercase mt-1">Photo</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 bg-white border border-slate-300 p-1 rounded-xs">
                          <QRCodeSVG value={verificationUrl} size={38} />
                          <div className="text-[6.5px] font-mono text-slate-500 leading-tight">
                            <span className="font-bold text-slate-800 block">SEC-QR</span>
                            <span>Scan to Verify</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* 4. Timetable Table */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] font-black text-slate-950 uppercase tracking-wider">
                        SCHOLASTIC EXAMINATION SCHEDULE & TIMINGS
                      </span>
                      <span className="text-[7.5px] text-slate-500 font-mono">Exam Timing: 09:00 AM - 12:00 PM (IST)</span>
                    </div>

                    <table className="w-full text-left text-[8.5px] border-collapse border border-slate-900">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-900 text-[7.5px] font-black text-slate-900 uppercase">
                          <th className="py-1 px-2 border-r border-slate-900 text-center w-8">Sl.</th>
                          <th className="py-1 px-2 border-r border-slate-900 text-center w-16">Sub Code</th>
                          <th className="py-1 px-2 border-r border-slate-900">Subject Name</th>
                          <th className="py-1 px-2 border-r border-slate-900 text-center w-24">Date of Exam</th>
                          <th className="py-1 px-2 border-r border-slate-900 text-center w-36">Session Timing</th>
                          <th className="py-1 px-2 border-r border-slate-900 text-center w-24">Room / Desk</th>
                          <th className="py-1 px-2 text-center w-28">Invigilator Initial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 text-slate-800">
                        {subjectTimetable.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-400 font-bold text-[9px]">
                              No subjects scheduled yet for this exam — add them under Examination → Datesheets.
                            </td>
                          </tr>
                        ) : subjectTimetable.map((sub, idx) => (
                          <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                            <td className="py-1 px-2 border-r border-slate-900 text-center font-mono font-bold text-slate-600">{idx + 1}</td>
                            <td className="py-1 px-2 border-r border-slate-900 text-center font-mono font-bold text-slate-800">{sub.code}</td>
                            <td className="py-1 px-2 border-r border-slate-900 font-bold text-slate-950">{sub.name}</td>
                            <td className="py-1 px-2 border-r border-slate-900 text-center font-mono font-bold text-slate-800">{sub.date}</td>
                            <td className="py-1 px-2 border-r border-slate-900 text-center font-medium text-slate-700">{sub.time}</td>
                            <td className="py-1 px-2 border-r border-slate-900 text-center font-bold text-blue-900">{sub.room}</td>
                            <td className="py-1 px-2 text-center text-slate-300 font-mono text-[8px]">_____________</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 5. Candidate Instructions */}
                  <div className="border border-slate-900 p-2 bg-slate-50/60 space-y-1">
                    <span className="font-black text-slate-950 uppercase tracking-wider block text-[8px]">
                      IMPORTANT INSTRUCTIONS FOR CANDIDATES (CBSE GUIDELINES):
                    </span>
                    <ol className="list-decimal list-inside space-y-0.5 font-medium text-[7.5px] text-slate-700 leading-normal">
                      <li>Candidates must produce this original Admit Card along with their official School ID Card at the entrance of the examination hall.</li>
                      <li>Entry to the examination hall closes strictly at <strong>08:45 AM</strong> (15 minutes prior to the commencement of the exam).</li>
                      <li>Strictly prohibited items: Mobile phones, smart watches, digital calculators, Bluetooth devices, and loose paper slips.</li>
                      <li>Verify that your Roll Number and Admission Number are written accurately on the title page of the answer booklet.</li>
                      <li>15 minutes reading time (08:45 AM to 09:00 AM) is allotted strictly for reading the question paper. Writing starts at 09:00 AM.</li>
                      <li>Candidates will not be allowed to leave the examination room before the final bell at 12:00 PM.</li>
                    </ol>
                  </div>
                </div>

                {/* Bottom Signatures */}
                <div className="space-y-2 pt-2 border-t-2 border-slate-900 relative z-10">
                  <div className="grid grid-cols-4 gap-2 items-end text-center">
                    
                    {/* Candidate */}
                    <div className="flex flex-col items-center">
                      <div className="h-8 border-b border-slate-400 w-28 flex items-end justify-center pb-0.5">
                        <span className="text-[7.5px] italic text-slate-400">Candidate Signature</span>
                      </div>
                      <span className="text-[7px] font-black uppercase text-slate-600 mt-1 block">Candidate's Sign</span>
                    </div>

                    {/* Parent */}
                    <div className="flex flex-col items-center">
                      <div className="h-8 border-b border-slate-400 w-28 flex items-end justify-center pb-0.5">
                        <span className="text-[7.5px] italic text-slate-400">Parent / Guardian</span>
                      </div>
                      <span className="text-[7px] font-black uppercase text-slate-600 mt-1 block">Parent's Sign</span>
                    </div>

                    {/* Class Teacher */}
                    <div className="flex flex-col items-center">
                      <div className="h-8 border-b border-slate-400 w-28 flex items-end justify-center pb-0.5">
                        <span className="text-[7.5px] italic text-slate-400">Class Teacher</span>
                      </div>
                      <span className="text-[7px] font-black uppercase text-slate-600 mt-1 block">Class Teacher</span>
                    </div>

                    {/* Principal */}
                    <div className="flex flex-col items-center">
                      <div className="h-8 border-b border-slate-400 w-28 flex items-end justify-center pb-0.5 relative">
                        <span className="text-[7.5px] italic text-slate-400">Principal</span>
                        {/* Seal */}
                        <div className="absolute -top-3 right-0 w-11 h-11 rounded-full border border-blue-900/60 flex flex-col items-center justify-center text-[5px] text-blue-900 font-black uppercase text-center leading-none rotate-12 bg-blue-50/20 pointer-events-none">
                          <span>ST. JOSEPH'S</span>
                          <span className="text-[4px]">BARHALGANJ</span>
                          <span>SEAL</span>
                        </div>
                      </div>
                      <span className="text-[7px] font-black uppercase text-slate-900 mt-1 block font-bold">Principal / Centre Supdt.</span>
                    </div>

                  </div>

                  {/* Footer */}
                  <div className="flex justify-between items-center text-[7px] font-mono text-slate-500 pt-1 border-t border-slate-200">
                    <span>Security Hash: SJS-CBSE-ADM-{activeStudent?.admission_number || '00'}-{activeStudent?.roll_number || '00'}</span>
                    <span>Page 1 of 1 • Official CBSE Admit Card • St. Joseph's School</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. LIVE STUDENT ADMIT CARD MODAL */}
      <StudentAdmitCardModal
        isOpen={Boolean(previewStudent)}
        onClose={() => setPreviewStudent(null)}
        student={previewStudent}
        exam={activeExam}
        timetable={subjectTimetable.map(s => ({
          subject_code: s.code,
          subject_name: s.name,
          date: s.date,
          time: s.time,
          room: s.room
        }))}
      />
    </div>
  );
}
