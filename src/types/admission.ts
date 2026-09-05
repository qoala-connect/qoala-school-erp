export type AdmissionStatus = 
  | 'Pending' 
  | 'In Review'
  | 'Under Review' 
  | 'Interview Scheduled'
  | 'Documents Verification' 
  | 'Approved' 
  | 'Student Created' 
  | 'Rejected' 
  | 'Waitlisted'
  | 'Withdrawn' 
  | 'Cancelled';

export type EnquiryStatus = 'New' | 'Contacted' | 'Campus Tour' | 'Assessment Scheduled' | 'Converted' | 'Dropped';
export type EnquirySource = 'Walk-in' | 'Phone Call' | 'Website' | 'Social Media' | 'Parent Referral' | 'Advertisement';
export type LeadPriority = 'High' | 'Medium' | 'Low';

export interface AdmissionDocument {
  id: string;
  name: string;
  type: string;
  url?: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  remarks?: string;
  verified_at?: string;
  verified_by?: string;
}

export interface DocumentVerificationItem {
  id: string;
  name: string;
  required: boolean;
  status: 'Verified' | 'Pending' | 'Exempted' | 'Rejected';
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface EnquiryRemark {
  id: string;
  date: string;
  author: string;
  text: string;
  next_action?: string;
}

export interface AdmissionEnquiry {
  id: string;
  parent_name: string;
  child_name: string;
  phone: string;
  email?: string;
  target_class: string;
  stream?: string;
  source: EnquirySource;
  status: EnquiryStatus;
  priority: LeadPriority;
  notes: string;
  remarks_history?: EnquiryRemark[];
  follow_up_date: string;
  assigned_to: string;
  budget_range?: string;
  previous_school?: string;
  created_at: string;
}

export interface AdmissionRecord {
  id: string;
  application_number?: string;
  name: string;
  father_name: string;
  mother_name?: string | null;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other' | string;
  class: string;
  class_id?: string | null;
  section?: string | null;
  section_id?: string | null;
  stream?: 'Science' | 'Commerce' | 'Humanities' | 'General';
  academic_year: string;
  academic_year_id?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  photo_url?: string | null;
  aadhaar_last4?: string | null;
  category?: string;
  fee_category?: 'Standard' | 'Sibling Concession' | 'Merit Scholarship' | 'Staff Dependent';
  minority_status?: boolean;
  cwsn_status?: boolean;
  only_child_girl?: boolean;
  previous_school?: string | null;
  previous_class?: string | null;
  previous_marks?: string | null;
  transfer_certificate_no?: string | null;
  blood_group?: string | null;
  emergency_contact?: string | null;
  religion?: string | null;
  nationality?: string | null;
  father_occupation?: string | null;
  mother_occupation?: string | null;
  documents?: AdmissionDocument[];
  status: AdmissionStatus;
  student_id?: string | null;
  rejection_reason?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;

  // Evaluation & Assessment details
  merit_score?: number;
  entrance_score?: number;
  interview_remarks?: string;
  approval_stage?: 'Document Verification' | 'Academic Assessment' | 'Principal Review' | 'Fee Clearance' | 'Completed';
  allocated_section?: string;
  assigned_roll_number?: string;
  verified_documents?: Record<string, boolean>;
  verification_notes?: string;
  approved_by?: string;
  approved_at?: string;

  // UI / Joined fields
  students?: {
    id: string;
    admission_number: string;
    roll_number: string;
    class: string;
    section: string;
    name: string;
  } | null;
  classes?: { id: string; class_name: string } | null;
  sections?: { id: string; section_name: string } | null;
  academic_years?: { id: string; name: string } | null;
}

export interface CreateAdmissionInput {
  application_number?: string;
  name: string;
  father_name: string;
  mother_name?: string;
  date_of_birth: string;
  gender?: string;
  class: string;
  class_id?: string;
  section?: string;
  section_id?: string;
  stream?: 'Science' | 'Commerce' | 'Humanities' | 'General';
  academic_year: string;
  academic_year_id?: string;
  phone?: string;
  email?: string;
  address?: string;
  photo_url?: string;
  aadhaar_last4?: string;
  category?: string;
  fee_category?: 'Standard' | 'Sibling Concession' | 'Merit Scholarship' | 'Staff Dependent';
  minority_status?: boolean;
  cwsn_status?: boolean;
  only_child_girl?: boolean;
  previous_school?: string;
  previous_class?: string;
  previous_marks?: string;
  transfer_certificate_no?: string;
  blood_group?: string;
  emergency_contact?: string;
  religion?: string;
  nationality?: string;
  father_occupation?: string;
  mother_occupation?: string;
  documents?: AdmissionDocument[];
  notes?: string;
  status?: AdmissionStatus;
}
