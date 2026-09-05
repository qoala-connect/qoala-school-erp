export type StudentStatus = 'active' | 'inactive' | 'transferred' | 'graduated' | 'withdrawn';

export interface Student {
  id: string;
  admission_number: string;
  roll_number: string;
  name: string;
  father_name: string;
  mother_name?: string | null;
  date_of_birth: string;
  gender: string;
  class: string;
  section: string;
  class_id?: string | null;
  section_id?: string | null;
  academic_year: string;
  academic_year_id?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  category?: string | null;
  status: StudentStatus;
  status_changed_at?: string | null;
  aadhaar_last4?: string | null;
  photo_url?: string | null;
  user_id?: string | null;
  family_id?: string | null;
  minority_status?: boolean | null;
  cwsn_status?: boolean | null;
  cwsn_type?: string | null;
  only_child_girl?: boolean | null;
  cbse_registration_no?: string | null;
  house_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StudentParentInfo {
  father_name?: string | null;
  father_phone?: string | null;
  father_email?: string | null;
  father_occupation?: string | null;
  mother_name?: string | null;
  mother_phone?: string | null;
  mother_email?: string | null;
  mother_occupation?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_relation?: string | null;
  address?: string | null;
}

export interface StudentAttendanceSummary {
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  leave_days: number;
  half_days: number;
  percentage: number;
  recent_records: {
    id: string;
    attendance_date: string;
    status: string;
    remarks?: string | null;
  }[];
}

export interface StudentFeeSummary {
  total_billed: number;
  total_paid: number;
  total_discount: number;
  total_outstanding: number;
  status: 'paid' | 'pending' | 'partial';
  ledgers: {
    id: string;
    fee_category_name: string;
    total_amount: number;
    discount_amount: number;
    net_amount: number;
    amount_paid: number;
    due_date: string;
    status: string;
    receipts: {
      id: string;
      receipt_number: string;
      amount_paid: number;
      payment_date: string;
      payment_mode: string;
    }[];
  }[];
}

export interface StudentExamSummary {
  results: {
    id: string;
    exam_name: string;
    total_marks: number;
    percentage: number;
    grade?: string | null;
    division?: string | null;
    result_status?: string | null;
  }[];
  subject_marks: {
    id: string;
    exam_name: string;
    subject_name: string;
    max_marks: number;
    obtained_marks: number;
    grade?: string;
    is_absent?: boolean;
  }[];
}

export interface StudentTransportInfo {
  id: string;
  route_name: string;
  vehicle_no: string;
  boarding_point: string;
  pickup_time: string;
  driver_name: string;
  driver_phone: string;
}

export interface StudentLibraryBorrowing {
  id: string;
  book_title: string;
  author: string;
  isbn?: string;
  issue_date: string;
  due_date: string;
  return_date?: string | null;
  status: string;
  fine_amount?: number;
}

export interface StudentDocumentRecord {
  id: string;
  student_id: string;
  document_type: string;
  file_url: string;
  created_at: string;
}

export interface StudentMedicalRecord {
  id: string;
  blood_group?: string | null;
  allergies?: string | null;
  medical_history?: string | null;
  doctor_name?: string | null;
  doctor_phone?: string | null;
  vaccination_status?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

export interface StudentDisciplineRecord {
  id: string;
  incident_type: string;
  severity: string;
  incident_date: string;
  description: string;
  action_taken?: string | null;
  reported_by?: string | null;
  status: string;
}

export interface StudentPromotionHistory {
  id: string;
  from_class: string;
  to_class: string;
  from_section?: string | null;
  to_section?: string | null;
  from_academic_year: string;
  to_academic_year: string;
  promoted_at: string;
  status?: string | null;
}

export interface StudentActivityLog {
  id: string;
  activity_type: string;
  description: string;
  performed_by?: string | null;
  created_at: string;
}

export interface StudentStaffNote {
  id: string;
  note: string;
  created_by?: string | null;
  created_at: string;
}

export type Student360Tab =
  | 'overview'
  | 'personal'
  | 'academic'
  | 'attendance'
  | 'fees'
  | 'examination'
  | 'transport'
  | 'library'
  | 'documents'
  | 'medical'
  | 'discipline'
  | 'activity';
