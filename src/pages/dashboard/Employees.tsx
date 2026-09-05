import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, X, Search, Edit, Trash2, Loader2, Users, UserCheck, Clock, ShieldAlert, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import StaffTable from '@/components/StaffTable';
import { AdminHeader } from '@/components/common/AdminHeader';
import { AdminStatCard } from '@/components/common/AdminStatCard';

/**
 * Employment status. Mirrors staff_status_check in the database.
 *
 * This replaced a ten-step recruitment funnel (Application, Interview,
 * Selection, ...) that the table could not store: anything other than
 * 'Resignation' was flattened to 'Active' on save and the distinction was
 * lost on reload.
 */
export type EmployeeLifecycleStatus =
  | 'Active' | 'Probation' | 'On Leave' | 'Suspended'
  | 'Resigned' | 'Retired' | 'Terminated';

export const EMPLOYEE_STATUSES: EmployeeLifecycleStatus[] =
  ['Active', 'Probation', 'On Leave', 'Suspended', 'Resigned', 'Retired', 'Terminated'];

/** Statuses that mean the person is still employed. */
const EMPLOYED = new Set<EmployeeLifecycleStatus>(['Active', 'Probation', 'On Leave']);

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  role: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  gender: string;
  blood_group: string;
  joining_date: string;
  status: EmployeeLifecycleStatus;
  employment_type: 'Full-Time' | 'Part-Time' | 'Contract' | 'Temporary';
  qualification: string;
  experience_years: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  pf_contribution: number;
  esi_contribution: number;
  tax: number;
  subjects_allocated: string[];
  class_teacher_of?: string;
  reporting_manager: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  address: string;
  dob: string;
  marital_status: string;
  nationality: string;
  photo_url?: string;
  signature_url?: string;

  cbse_teaching_level?: 'PGT' | 'TGT' | 'PRT' | '';
  ctet_qualified?: boolean;
  highest_qualification?: string;
}

export default function Employees() {
  const location = useLocation();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Partial<Employee> | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('staff').select('*');
    if (error) {
      toast.error('Failed to load employees');
    } else {
      const mapped = (data || []).map((dbEmp: any) => ({
        id: dbEmp.id,
        employee_id: dbEmp.employee_id || `EMP-${dbEmp.id.substring(0, 8).toUpperCase()}`,
        name: dbEmp.name || '',
        role: dbEmp.role_title || 'Teacher',
        department: dbEmp.department || '',
        designation: dbEmp.designation || dbEmp.role_title || '',
        email: dbEmp.email || '',
        phone: dbEmp.phone || '',
        gender: dbEmp.gender || '',
        blood_group: dbEmp.blood_group || 'Unknown',
        joining_date: dbEmp.joining_date || new Date().toISOString().split('T')[0],
        status: (dbEmp.status || 'Active') as EmployeeLifecycleStatus,
        employment_type: dbEmp.employment_type || 'Full-Time',
        qualification: dbEmp.highest_qualification || dbEmp.qualification || 'Graduation',
        experience_years: dbEmp.experience_years || 0,
        basic_salary: dbEmp.salary ? Number(dbEmp.salary) : 0,
        allowances: 0,
        deductions: 0,
        pf_contribution: 0,
        esi_contribution: 0,
        tax: 0,
        subjects_allocated: [],
        reporting_manager: 'Principal',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        address: dbEmp.address || '',
        dob: dbEmp.date_of_birth || '',
        marital_status: 'Single',
        nationality: 'Indian',
        cbse_teaching_level: dbEmp.cbse_teaching_level || '',
        ctet_qualified: dbEmp.ctet_qualified || false,
        highest_qualification: dbEmp.highest_qualification || ''
      }));
      setEmployees(mapped as Employee[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Handle incoming cross-module selection (e.g. from Global Search)
  useEffect(() => {
    const empId = location.state?.selectedEmployeeId;
    if (empId) {
      setSelectedEmployeeIds([empId]);
      setSelectedEmployeeFilter(empId);
    }
  }, [location.state?.selectedEmployeeId]);

  // Filter employees when navigated to a specific record from Global Search
  const displayedEmployees = useMemo(() => {
    if (!selectedEmployeeFilter) return employees;
    const matched = employees.filter(e => e.id === selectedEmployeeFilter || e.employee_id === selectedEmployeeFilter);
    return matched.length > 0 ? matched : employees;
  }, [employees, selectedEmployeeFilter]);

  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  /**
   * Saves an employee.
   *
   * The previous payload wrote five columns that do not exist on the staff
   * table (department, designation, cbse_teaching_level, ctet_qualified,
   * highest_qualification), so every add and edit failed with a schema
   * error that the UI reported as a generic "Insert failed". Those columns
   * now exist, and the real error is shown when something does go wrong.
   */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const errors: Record<string, string> = {};
    if (!editingEmp?.name?.trim()) errors.name = 'Name is required.';
    if (!editingEmp?.role?.trim()) errors.role = 'Role is required.';
    if (editingEmp?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingEmp.email)) errors.email = 'Enter a valid email address.';
    if (editingEmp?.phone && !/^[0-9+\-\s]{6,15}$/.test(editingEmp.phone)) errors.phone = 'Enter a valid phone number.';
    if (editingEmp?.basic_salary != null && Number(editingEmp.basic_salary) < 0) errors.basic_salary = 'Salary cannot be negative.';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error('Please correct the highlighted fields.');
      return;
    }

    const status = (editingEmp?.status ?? 'Active') as EmployeeLifecycleStatus;
    const payload = {
      name: editingEmp!.name!.trim(),
      role_title: editingEmp!.role,
      department: editingEmp?.department || null,
      designation: editingEmp?.designation || null,
      email: editingEmp?.email || null,
      phone: editingEmp?.phone || null,
      salary: editingEmp?.basic_salary ?? 0,
      joining_date: editingEmp?.joining_date || null,
      status,
      is_active: EMPLOYED.has(status),
      employment_type: editingEmp?.employment_type || null,
      experience_years: editingEmp?.experience_years ?? null,
      gender: editingEmp?.gender || null,
      date_of_birth: editingEmp?.dob || null,
      address: editingEmp?.address || null,
      cbse_teaching_level: editingEmp?.cbse_teaching_level || null,
      ctet_qualified: editingEmp?.ctet_qualified ?? false,
      highest_qualification: editingEmp?.highest_qualification || null,
    };

    setIsSaving(true);
    const { error } = editingEmp?.id
      ? await supabase.from('staff').update(payload).eq('id', editingEmp.id)
      : await supabase.from('staff').insert([payload]);
    setIsSaving(false);

    if (error) {
      console.error('[Staff] Save failed:', error);
      toast.error(
        error.code === '23505' ? 'An employee with that id or email already exists.'
        : error.code === '42501' ? 'You do not have permission to manage staff.'
        : error.message
      );
      return; // The wizard stays open with the entered values.
    }

    toast.success(editingEmp?.id ? 'Employee updated.' : 'Employee added.');
    setIsWizardOpen(false);
    setFormErrors({});
    fetchEmployees();
  };

  /**
   * Ends employment. This used to DELETE the staff row outright, which
   * erased the employment record along with anything referencing it.
   * The record is retained and the status is changed instead.
   */
  const handleDelete = async (id: string) => {
    const employee = employees.find(e => e.id === id);
    const next = window.prompt(
      `End employment for ${employee?.name ?? 'this employee'}.

` +
      `Type one of: Resigned, Retired, Terminated, Suspended, On Leave`,
      'Resigned'
    );
    if (!next) return;

    const reason = window.prompt('Reason (recorded in the audit log):') ?? null;

    const { error } = await supabase.rpc('set_staff_status', {
      _staff_id: id,
      _status: next.trim(),
      _reason: reason,
    });

    if (error) {
      console.error('[Staff] Status change failed:', error);
      toast.error(
        error.code === '42501'
          ? 'You do not have permission to change employment status.'
          : error.message
      );
      return;
    }
    toast.success(`${employee?.name ?? 'Employee'} marked as ${next.trim()}.`);
    fetchEmployees();
  };

  const toggleSelectAll = () => {
    if (selectedEmployeeIds.length === employees.length) setSelectedEmployeeIds([]);
    else setSelectedEmployeeIds(employees.map(e => e.id));
  };

  const toggleSelectEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => 
      prev.includes(id) ? prev.filter(eId => eId !== id) : [...prev, id]
    );
  };

  const activeStaff = employees.filter(e => e.status === 'Active').length;
  const probationStaff = employees.filter(e => e.status === 'Probation').length;
  const onLeaveStaff = employees.filter(e => e.status === 'On Leave').length;

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 font-sans antialiased text-slate-800">
      {/* 1. Header Toolbar */}
      <AdminHeader
        title="Staff & Employee Directory"
        subtitle="Comprehensive staff records, employment lifecycle status, designations, salary master, and audit-trailed service governance."
        badge={{
          icon: Users,
          text: 'Human Resources Registry',
          variant: 'primary'
        }}
        sessionBadge="Session: 2026-27"
        actions={
          <>
            <button 
              onClick={fetchEmployees}
              className={cn(
                "p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 rounded-xl transition-all cursor-pointer shadow-2xs",
                loading && "animate-spin text-blue-600"
              )}
              title="Refresh staff records"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setEditingEmp({}); setIsWizardOpen(true); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Plus size={16} /> Add Employee
            </button>
          </>
        }
      />

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard
          label="Total Staff"
          value={employees.length}
          subtext="Total personnel on payroll"
          icon={Users}
          variant="primary"
        />
        <AdminStatCard
          label="Active On-Duty"
          value={activeStaff}
          subtext="Currently regular service"
          icon={UserCheck}
          variant="emerald"
        />
        <AdminStatCard
          label="Under Probation"
          value={probationStaff}
          subtext="New joinee evaluation"
          icon={Clock}
          variant="amber"
        />
        <AdminStatCard
          label="On Leave / Other"
          value={onLeaveStaff}
          subtext="Temporary leave or suspended"
          icon={ShieldAlert}
          variant="violet"
        />
      </div>

      {selectedEmployeeFilter && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center justify-between text-xs text-violet-800 animate-fadeIn">
          <span className="font-semibold">
            Filtered to selected employee from Global Search.
          </span>
          <button 
            onClick={() => { setSelectedEmployeeFilter(null); setSelectedEmployeeIds([]); }} 
            className="font-bold underline text-violet-700 hover:text-violet-900 cursor-pointer"
          >
            Show All Staff
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 py-10">Loading...</div>
      ) : (
        <StaffTable 
          employees={displayedEmployees}
          selectedEmployeeIds={selectedEmployeeIds}
          onToggleSelectEmployee={toggleSelectEmployee}
          onToggleSelectAll={toggleSelectAll}
          onSelectEmployee={(emp) => { setEditingEmp(emp); setIsWizardOpen(true); }}
          onEditEmployee={(emp) => { setEditingEmp(emp); setIsWizardOpen(true); }}
          onDeleteEmployee={handleDelete}
          setIsWizardOpen={setIsWizardOpen}
        />
      )}

      {isWizardOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold">{editingEmp?.id ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setIsWizardOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input type="text" value={editingEmp?.name || ''} onChange={e => setEditingEmp({...editingEmp, name: e.target.value})} className={`w-full border rounded-lg p-2 text-sm ${formErrors.name ? 'border-rose-400 bg-rose-50/40' : ''}`} />
                  {formErrors.name && <p className="text-[11px] font-semibold text-rose-600 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input type="email" value={editingEmp?.email || ''} onChange={e => setEditingEmp({...editingEmp, email: e.target.value})} className={`w-full border rounded-lg p-2 text-sm ${formErrors.email ? 'border-rose-400 bg-rose-50/40' : ''}`} />
                  {formErrors.email && <p className="text-[11px] font-semibold text-rose-600 mt-1">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input type="text" value={editingEmp?.phone || ''} onChange={e => setEditingEmp({...editingEmp, phone: e.target.value})} className={`w-full border rounded-lg p-2 text-sm ${formErrors.phone ? 'border-rose-400 bg-rose-50/40' : ''}`} />
                  {formErrors.phone && <p className="text-[11px] font-semibold text-rose-600 mt-1">{formErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select value={editingEmp?.role || 'Teacher'} onChange={e => setEditingEmp({...editingEmp, role: e.target.value})} className="w-full border rounded-lg p-2 text-sm">
                    <option value="Teacher">Teacher</option>
                    <option value="Admin">Admin</option>
                    <option value="Principal">Principal</option>
                    <option value="Staff">Support Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                  <input type="text" value={editingEmp?.designation || ''} onChange={e => setEditingEmp({...editingEmp, designation: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Basic Salary</label>
                  <input type="number" min={0} value={editingEmp?.basic_salary || 0} onChange={e => setEditingEmp({...editingEmp, basic_salary: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
                  {formErrors.basic_salary && <p className="text-[11px] font-semibold text-rose-600 mt-1">{formErrors.basic_salary}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input type="text" value={editingEmp?.department || ''} onChange={e => setEditingEmp({...editingEmp, department: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Joining Date</label>
                  <input type="date" value={editingEmp?.joining_date || ''} onChange={e => setEditingEmp({...editingEmp, joining_date: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Status</label>
                  <select value={editingEmp?.status || 'Active'} onChange={e => setEditingEmp({...editingEmp, status: e.target.value as EmployeeLifecycleStatus})} className="w-full border rounded-lg p-2 text-sm">
                    {EMPLOYEE_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Type</label>
                  <select value={editingEmp?.employment_type || 'Full-Time'} onChange={e => setEditingEmp({...editingEmp, employment_type: e.target.value as any})} className="w-full border rounded-lg p-2 text-sm">
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Temporary">Temporary</option>
                  </select>
                </div>
              </div>

              {editingEmp?.role === 'Teacher' && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-bold mb-3 text-violet-700">CBSE Details (For Teachers)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Teaching Level</label>
                      <select value={editingEmp?.cbse_teaching_level || ''} onChange={e => setEditingEmp({...editingEmp, cbse_teaching_level: e.target.value as any})} className="w-full border rounded-lg p-2 text-sm">
                        <option value="">None</option>
                        <option value="PGT">PGT</option>
                        <option value="TGT">TGT</option>
                        <option value="PRT">PRT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Highest Qualification</label>
                      <input type="text" placeholder="e.g. M.Sc B.Ed" value={editingEmp?.highest_qualification || ''} onChange={e => setEditingEmp({...editingEmp, highest_qualification: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <input type="checkbox" id="ctet" checked={editingEmp?.ctet_qualified || false} onChange={e => setEditingEmp({...editingEmp, ctet_qualified: e.target.checked})} className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500" />
                      <label htmlFor="ctet" className="text-sm font-medium text-slate-700">CTET Qualified</label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsWizardOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Saving…' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
