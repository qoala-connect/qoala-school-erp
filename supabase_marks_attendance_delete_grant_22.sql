-- Migration 22: grant DELETE on marks and attendance to authenticated.
--
-- Defect: Examination -> "Delete exam" was broken for every admin.
-- ExaminationService.deleteExam() runs, in order:
--     delete from marks         where exam_id = ...
--     delete from exam_results  where exam_id = ...
--     delete from exam_subjects where exam_id = ...
--     delete from exams         where id      = ...
-- The first statement failed with
--     42501 permission denied for table marks
-- which aborts the whole method, so the exam was never deleted.
--
-- The RLS policies on both tables were already written FOR ALL — i.e. deletes
-- were always meant to be allowed for admins (marks_admin_all,
-- attendance_admin_all / attendance_office_staff_all) and for teachers within
-- their own scope (marks_teacher_scoped, attendance_teacher_scoped). Only the
-- table-level GRANT was missing, so PostgreSQL rejected the statement before
-- RLS was ever consulted. Every other examination table already grants DELETE
-- to authenticated; marks and attendance were the outliers.
--
-- Granting DELETE does not widen who can delete: RLS still restricts rows to
-- admins / results.publish holders and correctly-scoped teachers. Students and
-- parents only hold SELECT policies (marks_owner_select, attendance_owner_select),
-- so a DELETE from them still matches no rows.

GRANT DELETE ON TABLE public.marks      TO authenticated;
GRANT DELETE ON TABLE public.attendance TO authenticated;
