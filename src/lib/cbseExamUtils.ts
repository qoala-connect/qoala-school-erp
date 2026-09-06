/**
 * CBSE Examination & Assessment Utility Library
 * Centralized business logic for grading, division, rank calculation, teacher assignment workflows, and class normalization.
 */

export interface CBSEComponentMarks {
  periodic_test_marks?: number;
  multiple_assessment_marks?: number;
  portfolio_marks?: number;
  subject_enrichment_marks?: number;
  annual_exam_marks?: number;
  is_absent?: boolean;
}

export type MarksWorkflowStatus = 
  | 'draft' 
  | 'in_progress' 
  | 'submitted' 
  | 'returned' 
  | 'verified' 
  | 'approved' 
  | 'published' 
  | 'locked';

export interface ExamWorkflowStep {
  step: number;
  id: string;
  title: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  tab: string;
  subtext: string;
  actionText: string;
}

export const EXAM_WORKFLOW_PIPELINE: ExamWorkflowStep[] = [
  {
    step: 1,
    id: 'setup',
    title: 'Academic Year & Exam Setup',
    role: 'ADMIN',
    tab: 'exams',
    subtext: 'Create academic session & initialize examination term in database',
    actionText: 'Configure Term'
  },
  {
    step: 2,
    id: 'subjects',
    title: 'Classes, Subjects & Max Marks',
    role: 'ADMIN',
    tab: 'exams',
    subtext: 'Set subject components, theory/practical & pass criteria',
    actionText: 'Map Subjects'
  },
  {
    step: 3,
    id: 'schedule',
    title: 'Exam Schedule & Faculty Assignment',
    role: 'ADMIN',
    tab: 'schedule',
    subtext: 'Datesheets, room allocation & evaluator teacher assignments',
    actionText: 'Set Schedule'
  },
  {
    step: 4,
    id: 'evaluation',
    title: 'Teacher Marks Entry & Draft Submission',
    role: 'TEACHER',
    tab: 'tasks',
    subtext: 'Faculty marks evaluation, attendance recording & submit for review',
    actionText: 'Enter Marks'
  },
  {
    step: 5,
    id: 'verification',
    title: 'Admin Verification & Result Processing',
    role: 'ADMIN',
    tab: 'results',
    subtext: 'Audit scores, return for corrections, approve, lock & compute CBSE ranks',
    actionText: 'Process Results'
  },
  {
    step: 6,
    id: 'publishing',
    title: 'Publish Results & Report Cards',
    role: 'STUDENT',
    tab: 'reports',
    subtext: 'Publish live to Student Portal and print official CBSE Marksheets',
    actionText: 'View Report Cards'
  }
];

export interface TeacherExamTask {
  id: string; // unique assignment identifier (e.g. exam_id + subject_id)
  exam_id: string;
  exam_name: string;
  short_name?: string;
  exam_type?: string;
  class_name: string;
  class_id?: string;
  section?: string;
  academic_year?: string;
  academic_year_id?: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  teacher_email?: string;
  total_students: number;
  entered_count: number;
  max_marks: number;
  pass_marks: number;
  component_name?: string;
  status: MarksWorkflowStatus;
  deadline?: string;
  due_date?: string;
  submitted_at?: string;
  verified_at?: string;
  reopen_reason?: string;
  locked?: boolean;
}

/**
 * Normalizes class strings to facilitate robust comparison across ERP modules.
 * Examples: "Class 10" -> "10", "10th" -> "10", "Grade 10" -> "10", "Class 1" -> "1".
 */
export function normalizeClassName(className: string | undefined | null): string {
  if (!className) return '';
  const cleaned = className
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^class\s*/i, '')
    .replace(/^grade\s*/i, '')
    .replace(/th$/i, '')
    .replace(/st$/i, '')
    .replace(/nd$/i, '')
    .replace(/rd$/i, '')
    .trim();
  return cleaned;
}

/**
 * Checks if two class strings refer to the same class level.
 */
export function isSameClass(classA: string | undefined | null, classB: string | undefined | null): boolean {
  if (!classA || !classB) return false;
  if (classA === classB) return true;
  return normalizeClassName(classA) === normalizeClassName(classB);
}

/**
 * Formats a normalized class into user-facing display name e.g. "Class 10".
 */
export function formatClassDisplay(className: string | undefined | null): string {
  if (!className) return 'N/A';
  const norm = normalizeClassName(className);
  return norm ? `Class ${norm}` : className;
}

/**
 * CBSE 8-Point Secondary Grading Scale:
 * A1 (91-100), A2 (81-90), B1 (71-80), B2 (61-70), C1 (51-60), C2 (41-50), D (33-40), E/F (Below 33)
 */
export function calculateCBSEGrade(percentage: number | null): {
  grade: string;
  points: number;
  remarks: string;
  isPass: boolean;
} {
  if (percentage === null || isNaN(percentage)) {
    return { grade: '—', points: 0, remarks: 'Not Evaluated', isPass: false };
  }
  const p = Number(percentage);
  if (p >= 91) return { grade: 'A1', points: 10.0, remarks: 'Outstanding', isPass: true };
  if (p >= 81) return { grade: 'A2', points: 9.0, remarks: 'Excellent', isPass: true };
  if (p >= 71) return { grade: 'B1', points: 8.0, remarks: 'Very Good', isPass: true };
  if (p >= 61) return { grade: 'B2', points: 7.0, remarks: 'Good', isPass: true };
  if (p >= 51) return { grade: 'C1', points: 6.0, remarks: 'Above Average', isPass: true };
  if (p >= 41) return { grade: 'C2', points: 5.0, remarks: 'Average', isPass: true };
  if (p >= 33) return { grade: 'D', points: 4.0, remarks: 'Passing Standard', isPass: true };
  return { grade: 'E', points: 0.0, remarks: 'Needs Improvement / Remedial Required', isPass: false };
}

/**
 * Calculates student academic division based on aggregate score.
 */
export function calculateCBSEDivision(percentage: number, isPass: boolean): string {
  if (!isPass) return 'Essential Repeat';
  const p = Number(percentage) || 0;
  if (p >= 75) return 'First Division with Distinction';
  if (p >= 60) return 'First Division';
  if (p >= 45) return 'Second Division';
  if (p >= 33) return 'Third Division';
  return 'Essential Repeat';
}

/**
 * Sums the 5 CBSE components into the total obtained mark if legacy format is used.
 */
export function computeComponentTotal(marks: Partial<CBSEComponentMarks> | undefined): number {
  if (!marks || marks.is_absent) return 0;
  const pt = Number(marks.periodic_test_marks) || 0;
  const ma = Number(marks.multiple_assessment_marks) || 0;
  const pf = Number(marks.portfolio_marks) || 0;
  const se = Number(marks.subject_enrichment_marks) || 0;
  const ae = Number(marks.annual_exam_marks) || 0;
  return Math.min(100, Math.round((pt + ma + pf + se + ae) * 100) / 100);
}

/**
 * Maps workflow status to styling colors and friendly badges
 */
export function getWorkflowBadge(status: MarksWorkflowStatus | string): { label: string; color: string } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'in_progress':
      return { label: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'submitted':
      return { label: 'Submitted for Review', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'returned':
      return { label: 'Returned for Correction', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'verified':
      return { label: 'Verified by Coordinator', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'approved':
      return { label: 'Approved by Admin', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'published':
      return { label: 'Published Live', color: 'bg-teal-50 text-teal-700 border-teal-200' };
    case 'locked':
      return { label: 'Locked & Protected', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    default:
      return { label: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}
