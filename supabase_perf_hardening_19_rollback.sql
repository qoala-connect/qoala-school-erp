-- =====================================================================
-- ROLLBACK — PERF HARDENING 19
-- =====================================================================
-- The RLS-policy re-wrapping only changes how a call is scheduled, not
-- what it returns, so there is nothing to undo there. The dropped
-- indexes were exact duplicates of another index on the same columns,
-- so re-creating them would just re-introduce the redundancy — omitted.
--
-- This drops only the covering indexes 19 added.
-- =====================================================================

DROP INDEX IF EXISTS public.idx_teacher_assignments_class;
DROP INDEX IF EXISTS public.idx_teacher_assignments_section;
DROP INDEX IF EXISTS public.idx_teacher_assignments_subject;
DROP INDEX IF EXISTS public.idx_teacher_assignments_lookup;
DROP INDEX IF EXISTS public.idx_timetable_class;
DROP INDEX IF EXISTS public.idx_timetable_section;
DROP INDEX IF EXISTS public.idx_timetable_day_period;
DROP INDEX IF EXISTS public.idx_students_section;
DROP INDEX IF EXISTS public.idx_students_class_section_stat;
DROP INDEX IF EXISTS public.idx_attendance_year;
DROP INDEX IF EXISTS public.idx_attendance_date;
DROP INDEX IF EXISTS public.idx_class_subjects_year;
DROP INDEX IF EXISTS public.idx_class_subjects_section;
DROP INDEX IF EXISTS public.idx_exams_year;
DROP INDEX IF EXISTS public.idx_exams_class;
DROP INDEX IF EXISTS public.idx_exam_results_class;
DROP INDEX IF EXISTS public.idx_exam_results_year;
DROP INDEX IF EXISTS public.idx_exam_subjects_class;
DROP INDEX IF EXISTS public.idx_exam_subjects_section;
DROP INDEX IF EXISTS public.idx_exam_subjects_teacher;
DROP INDEX IF EXISTS public.idx_marks_updated_by;
