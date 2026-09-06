import React, { useState, useEffect, useMemo } from 'react';
import { 
  Grid, 
  Users, 
  MapPin, 
  Shuffle, 
  Printer, 
  UserCheck, 
  Trash2, 
  Plus, 
  Save, 
  Check, 
  AlertCircle,
  Clock,
  ShieldAlert,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { printRegion } from '@/lib/printRegion';

interface Hall {
  id: string;
  name: string;
  capacity: number;
  rows: number;
  cols: number;
}

interface SeatedStudent {
  id: string;
  name: string;
  roll: string;
  className: string;
  section: string;
  seatNo: string;
  row: number;
  col: number;
}

interface Invigilator {
  id: string;
  name: string;
  hallId: string;
  shift: string;
  date: string;
}

export default function SeatingPlanView({ initialTab }: { initialTab?: 'seating' | 'halls' | 'invigilators' } = {}) {
  const [activeTab, setActiveTab] = useState<'seating' | 'halls' | 'invigilators'>(initialTab || 'seating');
  const [selectedHall, setSelectedHall] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [alternateClass, setAlternateClass] = useState('');
  const [enableAntiCheating, setEnableAntiCheating] = useState(true);

  // Database / Local states
  const [halls, setHalls] = useState<Hall[]>([]);
  const [dbClasses, setDbClasses] = useState<string[]>([]);

  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [seatingAssignments, setSeatingAssignments] = useState<Record<string, SeatedStudent[]>>({});
  const [invigilatorDuties, setInvigilatorDuties] = useState<Invigilator[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<{ row: number; col: number } | null>(null);

  // Load real students and teachers from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [stdRes, teacherRes] = await Promise.all([
          supabase.from('students').select('id, name, roll_number, class, section, class_id').eq('status', 'active').order('roll_number', { ascending: true }),
          supabase.from('teachers').select('id, name, designation, department').eq('status', 'Active').order('name')
        ]);

        const studentData = stdRes.data || [];
        const teacherData = teacherRes.data || [];
        setStudents(studentData);
        setTeachers(teacherData);

        // Extract unique class names
        const uniqueClasses = [...new Set(studentData.map(s => s.class).filter(Boolean))].sort();
        setDbClasses(uniqueClasses);
        if (uniqueClasses.length > 0) {
          setSelectedClass(uniqueClasses[0]);
          setAlternateClass(uniqueClasses.length > 1 ? uniqueClasses[1] : uniqueClasses[0]);
        }
      } catch (err) {
        console.error('Failed to load seating plan data:', err);
        toast.error('Failed to load student and teacher data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeHallObj = useMemo(() => {
    return halls.find(h => h.id === selectedHall) || halls[0];
  }, [halls, selectedHall]);

  const activeAssignments = useMemo(() => {
    return seatingAssignments[selectedHall] || [];
  }, [seatingAssignments, selectedHall]);

  // Automatic Seating Arrangement Generator (Anti-Cheating Alternation)
  const generateAutomaticSeating = () => {
    const classAStudents = students.filter(s => s.class === selectedClass);
    const classBStudents = students.filter(s => s.class === alternateClass);
    
    if (classAStudents.length === 0) {
      toast.error(`No students found for primary class Grade ${selectedClass}`);
      return;
    }

    const assigned: SeatedStudent[] = [];
    let idxA = 0;
    let idxB = 0;

    const rows = activeHallObj.rows;
    const cols = activeHallObj.cols;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seatNo = `R${r + 1}-C${c + 1}`;
        let chosenStudent: any = null;

        if (enableAntiCheating) {
          // Alternate seat distribution to avoid two adjacent classmates
          if ((r + c) % 2 === 0) {
            if (idxA < classAStudents.length) {
              chosenStudent = classAStudents[idxA++];
            } else if (idxB < classBStudents.length) {
              chosenStudent = classBStudents[idxB++];
            }
          } else {
            if (idxB < classBStudents.length) {
              chosenStudent = classBStudents[idxB++];
            } else if (idxA < classAStudents.length) {
              chosenStudent = classAStudents[idxA++];
            }
          }
        } else {
          // Sequential layout fill
          if (idxA < classAStudents.length) {
            chosenStudent = classAStudents[idxA++];
          } else if (idxB < classBStudents.length) {
            chosenStudent = classBStudents[idxB++];
          }
        }

        if (chosenStudent) {
          assigned.push({
            id: chosenStudent.id,
            name: chosenStudent.name,
            roll: chosenStudent.roll_number || chosenStudent.roll || 'N/A',
            className: chosenStudent.class,
            section: chosenStudent.section || 'A',
            seatNo,
            row: r,
            col: c
          });
        }
      }
    }

    setSeatingAssignments(prev => ({
      ...prev,
      [selectedHall]: assigned
    }));

    toast.success(`Seating layout generated successfully for ${assigned.length} students!`);
  };

  const handleSeatClick = (row: number, col: number) => {
    const existing = activeAssignments.find(a => a.row === row && a.col === col);
    if (existing) {
      setSelectedSeat({ row, col });
    } else {
      setSelectedSeat({ row, col });
    }
  };

  const handleManualSeatAllocation = (studentId: string) => {
    if (!selectedSeat) return;
    const { row, col } = selectedSeat;
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Check if student is already seated elsewhere in this hall
    const cleanAssignments = activeAssignments.filter(a => a.id !== studentId && !(a.row === row && a.col === col));
    
    const seatNo = `R${row + 1}-C${col + 1}`;
    const newItem: SeatedStudent = {
      id: student.id,
      name: student.name,
      roll: student.roll_number || student.roll || 'N/A',
      className: student.class,
      section: student.section || 'A',
      seatNo,
      row,
      col
    };

    setSeatingAssignments(prev => ({
      ...prev,
      [selectedHall]: [...cleanAssignments, newItem]
    }));

    setSelectedSeat(null);
    toast.success(`Allocated ${student.name} manually to Seat ${seatNo}`);
  };

  const handleClearSeating = () => {
    setSeatingAssignments(prev => ({
      ...prev,
      [selectedHall]: []
    }));
    toast.success('Seating assignments cleared for this hall.');
  };

  const handleSaveSeatingPlan = async () => {
    if (activeAssignments.length === 0) {
      toast.error('No seating assignments to save for this hall.');
      return;
    }
    setIsSaving(true);
    try {
      // Seating plans are session-based layouts — logged for reference in audit_logs.
      // Full persistence would require a dedicated seating_allocations table.
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        user_id: user?.id || null,
        user_email: user?.email || null,
        action_type: 'SEATING_PLAN_COMMITTED',
        table_name: 'seating_plan',
        record_id: selectedHall,
        new_values: {
          hall_id: selectedHall,
          hall_name: activeHallObj?.name,
          student_count: activeAssignments.length,
          committed_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      });
      toast.success(`Seating plan for "${activeHallObj?.name}" committed. ${activeAssignments.length} students allocated.`);
    } catch (err) {
      toast.error('Failed to commit seating plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentInvigilators = useMemo(() => {
    return invigilatorDuties.filter(inv => inv.hallId === selectedHall);
  }, [invigilatorDuties, selectedHall]);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <div className="w-7 h-7 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">Loading student and teacher roster...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'seating', label: 'Interactive Seating Grid', icon: Grid },
          { id: 'halls', label: 'Exam Halls Management', icon: MapPin },
          { id: 'invigilators', label: 'Invigilator Assignments', icon: UserCheck }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition-all",
              activeTab === tab.id 
                ? "border-violet-600 text-violet-600" 
                : "border-transparent text-slate-400 hover:text-slate-800"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'seating' && halls.length === 0 && (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 bg-white border border-slate-200/60 rounded-2xl">
          <MapPin className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-bold text-slate-700">No Exam Halls Configured</p>
          <p className="text-xs text-slate-400 max-w-xs">
            Go to the <strong>Exam Halls Management</strong> tab to add examination venues before generating seating arrangements.
          </p>
          <button
            onClick={() => setActiveTab('halls')}
            className="mt-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all"
          >
            Configure Exam Halls →
          </button>
        </div>
      )}

      {activeTab === 'seating' && halls.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Seating Parameters & Generator Panel */}
          <div className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] p-6 space-y-5 h-fit">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800">Auto-Seating Configuration</h4>
              <p className="text-slate-400 text-xs mt-0.5">Define spacing rules and execute auto-arrangement algorithm</p>
            </div>

            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Examination Hall</label>
                <select 
                  value={selectedHall}
                  onChange={(e) => {
                    setSelectedHall(e.target.value);
                    setSelectedSeat(null);
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer outline-none"
                >
                  {halls.map(h => (
                    <option key={h.id} value={h.id}>{h.name} (Cap: {h.capacity})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Primary Grade</label>
                  <select 
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer outline-none"
                    disabled={dbClasses.length === 0}
                  >
                    {dbClasses.length === 0 && <option value="">No classes found</option>}
                    {dbClasses.map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Alternating Grade</label>
                  <select 
                    value={alternateClass}
                    onChange={(e) => setAlternateClass(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer outline-none"
                    disabled={dbClasses.length === 0}
                  >
                    {dbClasses.length === 0 && <option value="">No classes found</option>}
                    {dbClasses.map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Spacing & anti cheat checkbox */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/40 hover:bg-violet-50/10 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={enableAntiCheating}
                  onChange={(e) => setEnableAntiCheating(e.target.checked)}
                  className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4"
                />
                <div>
                  <span className="block font-bold text-slate-800">Alternate Class Spacing</span>
                  <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">Places students from Class A and Class B in checkerboard tiles</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button 
                onClick={handleClearSeating}
                className="py-2.5 bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-bold text-xs transition-all"
              >
                Clear Hall
              </button>
              <button 
                onClick={generateAutomaticSeating}
                className="py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-violet-500/10 flex items-center justify-center gap-1.5"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Auto Arrange
              </button>
            </div>

            {/* Capacity check info */}
            <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Hall Arrangement Metrics
              </div>
              <div className="text-[10px] text-slate-500 font-semibold space-y-1">
                <div className="flex justify-between">
                  <span>Selected Hall Capacity:</span>
                  <span className="font-bold text-slate-800">{activeHallObj.capacity} Seats</span>
                </div>
                <div className="flex justify-between">
                  <span>Assigned Occupancy:</span>
                  <span className="font-bold text-violet-700">{activeAssignments.length} Students</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining Seats:</span>
                  <span className="font-bold text-slate-800">{activeHallObj.capacity - activeAssignments.length} Available</span>
                </div>
              </div>
            </div>

            {/* Active Invigilator listing for current hall */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Assigned Invigilators</span>
              {currentInvigilators.length === 0 ? (
                <div className="text-[10px] text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100/50 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> No supervisors assigned to this hall shift yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {currentInvigilators.map(inv => (
                    <div key={inv.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{inv.name}</span>
                      <span className="text-[9px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded font-black uppercase border border-violet-100">{inv.shift.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Print Seating Button */}
            <button 
              onClick={() => {
                const ok = printRegion('seating-layout-print', `Seating Layout — ${activeHallObj.name}`);
                if (!ok) toast.error('Could not open the seating layout for printing.');
              }}
              className="w-full mt-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> Print Layout Chart
            </button>
          </div>

          {/* Interactive Seating Layout Canvas */}
          <div id="seating-layout-print" className="lg:col-span-2 bg-white border border-slate-200/60 shadow-sm rounded-[24px] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-extrabold text-slate-900">{activeHallObj.name} Grid Map</h4>
                <p className="text-slate-400 text-xs mt-0.5">Interactive display. Front of exam room is situated at the top.</p>
              </div>
              <button 
                onClick={handleSaveSeatingPlan}
                disabled={isSaving}
                className="flex items-center gap-1 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/10"
              >
                {isSaving ? 'Saving...' : 'Lock Assignments'}
              </button>
            </div>

            {/* Front of room whiteboard banner */}
            <div className="w-full bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest text-center py-2.5 rounded-xl border border-dashed border-slate-200">
              BOARD / PROJECTOR MAIN SCREEN
            </div>

            {/* Interactive Grid Canvas */}
            <div className="p-4 bg-slate-50/30 rounded-2xl border border-slate-150 overflow-x-auto">
              <div 
                className="grid gap-3 mx-auto"
                style={{ 
                  gridTemplateColumns: `repeat(${activeHallObj.cols}, minmax(80px, 1fr))`,
                  width: `${activeHallObj.cols * 95}px`
                }}
              >
                {Array.from({ length: activeHallObj.rows }).map((_, rIdx) => (
                  Array.from({ length: activeHallObj.cols }).map((_, cIdx) => {
                    const student = activeAssignments.find(a => a.row === rIdx && a.col === cIdx);
                    const isSelected = selectedSeat?.row === rIdx && selectedSeat?.col === cIdx;
                    
                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        onClick={() => handleSeatClick(rIdx, cIdx)}
                        className={cn(
                          "h-20 rounded-xl border p-2 flex flex-col justify-between text-left transition-all duration-300 relative group cursor-pointer",
                          isSelected 
                            ? "border-violet-600 ring-4 ring-violet-500/15" 
                            : student 
                              ? student.className === selectedClass
                                ? "bg-violet-50/55 border-violet-200 hover:border-violet-300"
                                : "bg-emerald-50/55 border-emerald-200 hover:border-emerald-300"
                              : "bg-white border-slate-200/80 border-dashed hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <span className="text-[8px] font-bold text-slate-400 block leading-none">
                          R{rIdx + 1}-C{cIdx + 1}
                        </span>

                        {student ? (
                          <div className="mt-1">
                            <span className="text-[10px] font-black text-slate-900 block truncate leading-tight uppercase">
                              {student.name.split(' ')[0]}
                            </span>
                            <span className={cn(
                              "text-[8px] font-black rounded-sm px-1 py-0.2 uppercase mt-1 inline-block",
                              student.className === selectedClass 
                                ? "bg-violet-100 text-violet-700" 
                                : "bg-emerald-100 text-emerald-700"
                            )}>
                              Gr {student.className}-{student.section}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] font-semibold text-slate-300 italic block mt-1">
                            Empty Seat
                          </span>
                        )}

                        {student && (
                          <span className="absolute top-1.5 right-1.5 text-[8px] font-mono text-slate-400 font-bold">
                            #{student.roll.substring(student.roll.length - 4)}
                          </span>
                        )}
                      </button>
                    );
                  })
                ))}
              </div>
            </div>

            {/* Manual seat reallocation drawer or pane (conditional on selection) */}
            {selectedSeat && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-fadeIn space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <h5 className="text-xs font-extrabold text-slate-800">
                    Seat Allocation Console (R{selectedSeat.row + 1}-C{selectedSeat.col + 1})
                  </h5>
                  <button 
                    onClick={() => setSelectedSeat(null)} 
                    className="text-xs text-slate-400 hover:text-slate-600 font-bold uppercase"
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">Assign Student:</span>
                  <select 
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none cursor-pointer text-slate-600 font-semibold"
                    onChange={(e) => {
                      if (e.target.value) handleManualSeatAllocation(e.target.value);
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>Choose active roster cadet...</option>
                    {students.map(st => (
                      <option key={st.id} value={st.id}>{st.name} (Grade {st.class})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Halls Management tab view */}
      {activeTab === 'halls' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200/60 shadow-sm rounded-[24px] p-6 space-y-4">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800">Authorized Examination Venues</h4>
              <p className="text-slate-400 text-xs">Define layout parameters (rows and columns) for automated seat generator grids</p>
            </div>

            {halls.length === 0 ? (
              <div className="py-12 text-center space-y-2 text-slate-400">
                <MapPin className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No Examination Halls Added</p>
                <p className="text-[11px]">Use the form on the right to register your first examination venue.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-3 px-4">Hall Venue</th>
                      <th className="py-3 px-4 text-center">Row Spans</th>
                      <th className="py-3 px-4 text-center">Col Spans</th>
                      <th className="py-3 px-4 text-center">Capacity Floor</th>
                      <th className="py-3 px-4 text-right pr-6 w-[80px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60 text-slate-700 font-medium">
                    {halls.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{h.name}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-500">{h.rows} Rows</td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-500">{h.cols} Columns</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {h.capacity} Max Seats
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right pr-6">
                          <button 
                            onClick={() => {
                              setHalls(halls.filter(x => x.id !== h.id));
                              if (selectedHall === h.id) setSelectedHall(halls.filter(x => x.id !== h.id)[0]?.id || '');
                              toast.success('Examination venue removed.');
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const target = e.target as any;
              const name = target.hallName.value;
              const r = Number(target.hallRows.value);
              const c = Number(target.hallCols.value);
              if (!name) return;

              const newHall = {
                id: Math.random().toString(36).slice(2),
                name,
                rows: r,
                cols: c,
                capacity: r * c
              };
              setHalls(prev => {
                const updated = [...prev, newHall];
                return updated;
              });
              // Auto-select if no hall selected
              if (!selectedHall) setSelectedHall(newHall.id);
              target.reset();
              toast.success(`Exam hall "${name}" added (${r * c} seats).`);
            }}
            className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] p-6 space-y-4 h-fit"
          >
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Register Hall Venue</h4>
            
            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Venue Title</label>
                <input 
                  type="text" 
                  name="hallName"
                  placeholder="e.g. Science block Annex 3"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-violet-500 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Rows Count</label>
                  <input 
                    type="number" 
                    name="hallRows"
                    defaultValue={5}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                    required
                  />
                </div>
                <div className="flex flex-col">
                  <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Columns Count</label>
                  <input 
                    type="number" 
                    name="hallCols"
                    defaultValue={6}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full h-[38px] bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition-all mt-4"
            >
              Add Venue Hall
            </button>
          </form>
        </div>
      )}

      {/* Invigilators assignment duty list */}
      {activeTab === 'invigilators' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div id="invigilator-duty-print" className="lg:col-span-2 bg-white border border-slate-200/60 shadow-sm rounded-[24px] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">Teacher Invigilator Assignments</h4>
                <p className="text-slate-400 text-xs mt-0.5">Manage supervisor duties per hall to avoid double-bookings during test slots</p>
              </div>
              <button 
                data-print-hide
                onClick={() => {
                  const ok = printRegion('invigilator-duty-print', 'Invigilator Duty List');
                  if (!ok) toast.error('Could not open the duty list for printing.');
                }}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold transition-all hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Duty List
              </button>
            </div>

            {invigilatorDuties.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <UserCheck className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No Invigilator Duties Assigned</p>
                <p className="text-[11px]">Use the form on the right to assign teacher duties per hall and shift.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-3 px-4">Supervisor Teacher</th>
                      <th className="py-3 px-4">Hall Venue</th>
                      <th className="py-3 px-4 text-center">Duty Shift</th>
                      <th className="py-3 px-4 text-center">Duty Date</th>
                      <th className="py-3 px-4 text-right pr-6 w-[80px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60 text-slate-700 font-medium">
                    {invigilatorDuties.map((inv) => {
                      const hall = halls.find(h => h.id === inv.hallId);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-900">{inv.name}</td>
                          <td className="py-3 px-4 text-slate-600">{hall ? hall.name : inv.hallId}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">
                              {inv.shift}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-500 font-bold">{inv.date}</td>
                          <td className="py-3 px-4 text-right pr-6">
                            <button 
                              onClick={() => {
                                setInvigilatorDuties(invigilatorDuties.filter(x => x.id !== inv.id));
                                toast.success('Invigilator duty revoked.');
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Form to assign invigilator */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const target = e.target as any;
              const teacherId = target.invTeacherId.value;
              const hallId = target.invHall.value;
              const shift = target.invShift.value;
              const date = target.invDate.value;
              
              if (!teacherId || !hallId || !date) return;

              const teacher = teachers.find(t => t.id === teacherId);
              const teacherName = teacher?.name || teacherId;

              // Double booking preventive check
              const isDoubleBooked = invigilatorDuties.some(inv => inv.id === teacherId && inv.date === date && inv.shift === shift);
              if (isDoubleBooked) {
                toast.error(`Double-booking prevented! ${teacherName} is already assigned on ${date} during ${shift}.`);
                return;
              }

              setInvigilatorDuties([...invigilatorDuties, {
                id: `${teacherId}-${Date.now()}`,
                name: teacherName,
                hallId,
                shift,
                date
              }]);
              target.reset();
              toast.success(`${teacherName} assigned as invigilator.`);
            }}
            className="bg-white border border-slate-200/60 shadow-sm rounded-[24px] p-6 space-y-4 h-fit"
          >
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Assign Supervision Duty</h4>
            
            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Teacher</label>
                <select 
                  name="invTeacherId"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer outline-none"
                  required
                >
                  <option value="">— Choose teacher —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.designation ? ` (${t.designation})` : ''}</option>
                  ))}
                </select>
                {teachers.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">No active teachers found in database.</p>
                )}
              </div>

              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Venue Mapping</label>
                <select 
                  name="invHall"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer outline-none"
                  required
                >
                  <option value="">— Choose hall —</option>
                  {halls.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                {halls.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">No halls added yet. Go to "Exam Halls Management" tab to add halls first.</p>
                )}
              </div>

              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Shift Period</label>
                <select 
                  name="invShift"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer outline-none"
                  required
                >
                  <option value="Morning (09:00 AM)">Morning (09:00 AM)</option>
                  <option value="Afternoon (01:30 PM)">Afternoon (01:30 PM)</option>
                  <option value="Evening (05:00 PM)">Evening (05:00 PM)</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">Duty Date</label>
                <input 
                  type="date" 
                  name="invDate"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 cursor-pointer"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full h-[38px] bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition-all mt-4"
            >
              Confirm duty assignment
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
