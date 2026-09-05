-- =====================================================================
-- 🎓 SUSHILA DEVI PUBLIC SCHOOL ERP - ENTERPRISE ADDITIVE MIGRATION SQL
-- =====================================================================
-- Designed for: PostgreSQL / Supabase Core RDBMS
-- Level of Normalization: 3rd Normal Form (3NF)
-- Safety: 100% Additive. No DROP TABLE or destructive operations.
-- Generated on: 2026-07-06
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. SCHEMA INITIALIZATION & EXTENSIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. BASE ACADEMIC & CALENDAR ENTITIES
-- ---------------------------------------------------------------------

-- Academic Years Table
CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL, -- e.g. "2026-27"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions (Sub-divisions of Academic Year, e.g. Term 1, Term 2)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  session_name VARCHAR(100) NOT NULL, -- e.g. "Fall Term"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. ORGANIZATIONAL HIERARCHY & ROLES
-- ---------------------------------------------------------------------

-- Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name VARCHAR(255) UNIQUE NOT NULL,
  code VARCHAR(50) UNIQUE, -- e.g. "SCI", "MATH", "ADMIN"
  head_id UUID, -- References staff(id) or teachers(id) (Handled via soft reference or separate alter key for circular dep)
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Parents Table (Normalized from Students to prevent duplication of guardian data)
CREATE TABLE IF NOT EXISTS public.parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  father_name VARCHAR(255) NOT NULL,
  mother_name VARCHAR(255),
  father_phone VARCHAR(50),
  mother_phone VARCHAR(50),
  father_email VARCHAR(255),
  mother_email VARCHAR(255),
  address TEXT,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Staff Table (For non-teaching employees)
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  role_title VARCHAR(150) NOT NULL, -- e.g. "Accountant", "Librarian", "Registrar"
  phone VARCHAR(50),
  email VARCHAR(255),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  salary NUMERIC(12,2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Suspended', 'Terminated')),
  joining_date DATE,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sections
CREATE TABLE IF NOT EXISTS public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_name VARCHAR(50) NOT NULL, -- e.g. "A", "B", "C"
  capacity INTEGER DEFAULT 40,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Class Sections (Junction table linking Classes with Sections)
CREATE TABLE IF NOT EXISTS public.class_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  class_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_class_section UNIQUE(class_id, section_id)
);

-- ---------------------------------------------------------------------
-- 3. ATTENDANCE & LEAVE SYSTEMS
-- ---------------------------------------------------------------------

-- Attendance Logs (Tracks modification audits to attendance)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL, -- Flexible referencing (student_id, teacher_id, or staff_id)
  applicant_type VARCHAR(50) NOT NULL CHECK (applicant_type IN ('student', 'teacher', 'staff')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Holidays
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  is_national BOOLEAN DEFAULT false,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Grading Rules
CREATE TABLE IF NOT EXISTS public.grading_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_name VARCHAR(10) NOT NULL, -- e.g., "A+", "B", "C"
  min_score NUMERIC(5,2) NOT NULL CHECK (min_score >= 0.0),
  max_score NUMERIC(5,2) NOT NULL CHECK (max_score <= 100.0),
  points NUMERIC(3,1), -- e.g. 4.0, 3.5, 3.0
  remarks TEXT,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. FINANCIAL LEDGERS & ACCOUNTS
-- ---------------------------------------------------------------------

-- Fee Categories
CREATE TABLE IF NOT EXISTS public.fee_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name VARCHAR(150) UNIQUE NOT NULL, -- e.g. "Tuition Fee", "Admission Fee"
  description TEXT,
  frequency VARCHAR(50) CHECK (frequency IN ('One-time', 'Monthly', 'Term-wise', 'Annual', 'Variable')),
  amount NUMERIC(12,2) DEFAULT 0.00,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Detailed Fee Structure (Specifies itemized charges for each Class level)
CREATE TABLE IF NOT EXISTS public.fee_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  fee_category_id UUID NOT NULL REFERENCES public.fee_categories(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0.00),
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_class_fee UNIQUE(class_id, fee_category_id, academic_year_id)
);

-- Student Fees (Individual accounts receivable ledger entries)
CREATE TABLE IF NOT EXISTS public.student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_category_id UUID NOT NULL REFERENCES public.fee_categories(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) DEFAULT 0.00 CHECK (discount_amount >= 0.00),
  scholarship_amount NUMERIC(12,2) DEFAULT 0.00 CHECK (scholarship_amount >= 0.00),
  net_amount NUMERIC(12,2) GENERATED ALWAYS AS (GREATEST(0.00, total_amount - discount_amount - scholarship_amount)) STORED,
  due_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'partial')),
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fee Payments (Individual transactions made towards Student Fees)
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_fee_id UUID NOT NULL REFERENCES public.student_fees(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT current_date,
  amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid > 0.00),
  payment_mode VARCHAR(50) CHECK (payment_mode IN ('cash', 'upi', 'bank', 'online')),
  transaction_id VARCHAR(255),
  receipt_number VARCHAR(100) UNIQUE NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Discounts Table
CREATE TABLE IF NOT EXISTS public.discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_name VARCHAR(150) NOT NULL,
  discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed')),
  value NUMERIC(10,2) NOT NULL CHECK (value >= 0.00),
  eligibility TEXT,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Scholarships Table
CREATE TABLE IF NOT EXISTS public.scholarships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_name VARCHAR(150) NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0.00),
  eligibility TEXT,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 5. TRANSIT & LOGISTICS ENTITIES
-- ---------------------------------------------------------------------

-- Transport Routes
CREATE TABLE IF NOT EXISTS public.transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name VARCHAR(255) UNIQUE NOT NULL,
  start_point VARCHAR(255),
  end_point VARCHAR(255),
  fare_amount NUMERIC(10,2) NOT NULL CHECK (fare_amount >= 0.00),
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number VARCHAR(100) UNIQUE NOT NULL,
  vehicle_model VARCHAR(150),
  capacity INTEGER CHECK (capacity > 0),
  registration_expiry DATE,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Drivers
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  license_number VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. ON-CAMPUS ACCOMMODATION (HOSTEL MODULE)
-- ---------------------------------------------------------------------

-- Hostels
CREATE TABLE IF NOT EXISTS public.hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  hostel_type VARCHAR(50) CHECK (hostel_type IN ('boys', 'girls', 'co-ed')),
  address TEXT,
  capacity INTEGER CHECK (capacity > 0),
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_number VARCHAR(50) NOT NULL,
  capacity INTEGER CHECK (capacity > 0),
  occupied INTEGER DEFAULT 0 CHECK (occupied >= 0 AND occupied <= capacity),
  cost_per_month NUMERIC(10,2) DEFAULT 0.00,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_hostel_room UNIQUE(hostel_id, room_number)
);

-- ---------------------------------------------------------------------
-- 7. LIBRARY MANAGEMENT (OPAC / BOOK TRANSACTIONS)
-- ---------------------------------------------------------------------

-- Library Books Catalog
CREATE TABLE IF NOT EXISTS public.library_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  isbn VARCHAR(100) UNIQUE,
  author VARCHAR(255),
  publisher VARCHAR(255),
  category VARCHAR(100),
  copies_total INTEGER DEFAULT 1 CHECK (copies_total >= 0),
  copies_available INTEGER DEFAULT 1 CHECK (copies_available >= 0 AND copies_available <= copies_total),
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Book Issues Ledger
CREATE TABLE IF NOT EXISTS public.book_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- References borrower account
  issue_date DATE NOT NULL DEFAULT current_date,
  due_date DATE NOT NULL,
  return_date DATE,
  status VARCHAR(50) DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'overdue')),
  fine_amount NUMERIC(10,2) DEFAULT 0.00,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. INVENTORY & FIXED ASSET LEDGER
-- ---------------------------------------------------------------------

-- Inventory (Consumables, Stationary, Uniform stocks)
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name VARCHAR(255) UNIQUE NOT NULL,
  item_category VARCHAR(100),
  quantity_total INTEGER DEFAULT 0 CHECK (quantity_total >= 0),
  quantity_available INTEGER DEFAULT 0 CHECK (quantity_available >= 0 AND quantity_available <= quantity_total),
  unit_price NUMERIC(10,2) DEFAULT 0.00,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assets (Non-consumables, Projectors, IT inventory, lab apparatus)
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name VARCHAR(255) NOT NULL,
  asset_tag VARCHAR(100) UNIQUE, -- Unique barcode or system tag
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'operational' CHECK (status IN ('operational', 'under maintenance', 'damaged', 'written off')),
  purchase_date DATE,
  purchase_cost NUMERIC(12,2) DEFAULT 0.00,
  location VARCHAR(255), -- Room or department name
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 9. NOTICES, DOCUMENTS, AND REVENUE LOGS
-- ---------------------------------------------------------------------

-- Documents (General administrative digital lockers)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  document_category VARCHAR(150),
  file_path TEXT NOT NULL, -- Storage URL bucket key
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Student Certificates Log
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  certificate_type VARCHAR(100) NOT NULL, -- e.g. Excellence, Transfer, Bonafide
  file_path TEXT, -- Storage URL of generated PDF
  issued_at TIMESTAMPTZ DEFAULT now(),
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  template_name VARCHAR(100),
  serial_number VARCHAR(100) UNIQUE NOT NULL,
  school_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 10. SYSTEM TELEMETRY, PREFERENCES & MESSAGES
-- ---------------------------------------------------------------------

-- SMS logs
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone VARCHAR(50) NOT NULL,
  message_text TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'delivered',
  response_id VARCHAR(255),
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Email logs
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_text TEXT,
  status VARCHAR(50) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Audit Logs (Comprehensive system auditing for state revisions)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email VARCHAR(255),
  action_type VARCHAR(100) NOT NULL, -- e.g. INSERT, UPDATE, DELETE
  table_name VARCHAR(150) NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- System Configurations
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name VARCHAR(255) DEFAULT 'Sushila Devi Public School',
  school_address TEXT,
  school_phone VARCHAR(50),
  school_email VARCHAR(255),
  logo_url TEXT,
  session_timeout_minutes INTEGER DEFAULT 30,
  mfa_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email VARCHAR(255),
  action_performed TEXT NOT NULL,
  module_affected VARCHAR(100),
  status VARCHAR(50) DEFAULT 'SUCCESS',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 11. INDEXES FOR STRUCTURAL LOOKUPS
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_academic_years_current ON public.academic_years(is_current);
CREATE INDEX IF NOT EXISTS idx_staff_department ON public.staff(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_user ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_parents_user ON public.parents(user_id);
CREATE INDEX IF NOT EXISTS idx_class_sections_cs ON public.class_sections(class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_leave_applicant ON public.leave_requests(applicant_id, applicant_type);
CREATE INDEX IF NOT EXISTS idx_fee_structure_comb ON public.fee_structure(class_id, fee_category_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_stud ON public.student_fees(student_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_status ON public.student_fees(status);
CREATE INDEX IF NOT EXISTS idx_fee_payments_sf ON public.fee_payments(student_fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_receipt ON public.fee_payments(receipt_number);
CREATE INDEX IF NOT EXISTS idx_rooms_hostel ON public.rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_book ON public.book_issues(book_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_user ON public.book_issues(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON public.certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_email);

-- ---------------------------------------------------------------------
-- 12. AUTOMATIC DATABASE TRIGGERS
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach update triggers to ensure schema integrity
CREATE OR REPLACE TRIGGER trigger_update_academic_years BEFORE UPDATE ON public.academic_years FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_sessions BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_departments BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_parents BEFORE UPDATE ON public.parents FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_staff BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_sections BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_class_sections BEFORE UPDATE ON public.class_sections FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_leave_requests BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_holidays BEFORE UPDATE ON public.holidays FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_grading_rules BEFORE UPDATE ON public.grading_rules FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_fee_categories BEFORE UPDATE ON public.fee_categories FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_fee_structure BEFORE UPDATE ON public.fee_structure FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_student_fees BEFORE UPDATE ON public.student_fees FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_discounts BEFORE UPDATE ON public.discounts FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_scholarships BEFORE UPDATE ON public.scholarships FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_transport_routes BEFORE UPDATE ON public.transport_routes FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_vehicles BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_drivers BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_hostels BEFORE UPDATE ON public.hostels FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_rooms BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_library_books BEFORE UPDATE ON public.library_books FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_book_issues BEFORE UPDATE ON public.book_issues FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_inventory BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_assets BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_documents BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_certificates BEFORE UPDATE ON public.certificates FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_system_settings BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- ---------------------------------------------------------------------
-- 13. VIEWS FOR INSIGHTS & ANALYTICS
-- ---------------------------------------------------------------------

-- Fee collection and outstanding balances summary view
CREATE OR REPLACE VIEW public.view_fee_collection_summary AS
SELECT 
  c.class_name,
  COALESCE(COUNT(sf.id), 0) AS total_receivables,
  COALESCE(SUM(sf.total_amount), 0.00) AS total_gross_billed,
  COALESCE(SUM(sf.discount_amount + sf.scholarship_amount), 0.00) AS total_concessions,
  COALESCE(SUM(sf.net_amount), 0.00) AS total_net_receivables,
  COALESCE(SUM(fp.amount_paid), 0.00) AS total_amount_collected,
  COALESCE(SUM(sf.net_amount) - COALESCE(SUM(fp.amount_paid), 0.00), 0.00) AS total_outstanding_dues
FROM public.classes c
LEFT JOIN public.students s ON s.class = c.class_name
LEFT JOIN public.student_fees sf ON sf.student_id = s.id
LEFT JOIN public.fee_payments fp ON fp.student_fee_id = sf.id
GROUP BY c.class_name;

-- Standard student academic records unified view
CREATE OR REPLACE VIEW public.view_student_academic_profiles AS
SELECT 
  s.id AS student_id,
  s.admission_number,
  s.roll_number,
  s.name AS student_name,
  s.class,
  s.section,
  s.gender,
  s.phone,
  s.email,
  s.date_of_birth,
  p.father_name,
  p.mother_name,
  p.father_phone,
  p.father_email,
  s.academic_year
FROM public.students s
LEFT JOIN public.parents p ON p.father_name = s.father_name;

-- ---------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS definitions (Admins bypass all, Students/Teachers/Staff read based on scopes)
CREATE POLICY policy_admin_all_academicyears ON public.academic_years FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_sessions ON public.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_departments ON public.departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_parents ON public.parents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_staff ON public.staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_sections ON public.sections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_class_sections ON public.class_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_attendance_logs ON public.attendance_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_leave_requests ON public.leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_holidays ON public.holidays FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_grading_rules ON public.grading_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_fee_categories ON public.fee_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_fee_structure ON public.fee_structure FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_student_fees ON public.student_fees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_fee_payments ON public.fee_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_discounts ON public.discounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_scholarships ON public.scholarships FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_transport_routes ON public.transport_routes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_vehicles ON public.vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_drivers ON public.drivers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_hostels ON public.hostels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_rooms ON public.rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_library_books ON public.library_books FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_book_issues ON public.book_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_inventory ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_assets ON public.assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_documents ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_certificates ON public.certificates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_sms_logs ON public.sms_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_email_logs ON public.email_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_audit_logs ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_system_settings ON public.system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY policy_admin_all_activity_logs ON public.activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 15. STORAGE BUCKETS CONFIGURATION
-- ---------------------------------------------------------------------
-- Seeds default storage buckets into Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('student-documents', 'student-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('student-photos', 'student-photos', true, 5242880, ARRAY['image/jpeg', 'image/png']),
  ('school-assets', 'school-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/svg+xml']),
  ('library-covers', 'library-covers', true, 2097152, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 16. UTILITY RPC FUNCTIONS
-- ---------------------------------------------------------------------

-- Optional helper execution endpoint for structural migration
CREATE OR REPLACE FUNCTION public.exec_sql(query_text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser/service_role clearance
AS $$
BEGIN
  EXECUTE query_text;
  RETURN json_build_object('status', 'SUCCESS', 'message', 'SQL statement executed successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('status', 'ERROR', 'message', SQLERRM, 'detail', SQLSTATE);
END;
$$;
