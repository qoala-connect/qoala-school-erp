-- =====================================================================
-- FN: exam_workload_progress — entered-mark counts for the verification board
-- =====================================================================
-- The Marks Verification board needs one number per subject stream: how many
-- candidates have a mark entered. It used to get this by pulling EVERY marks
-- row for the year to the browser (6k+ rows, past PostgREST's 1000 cap, so 7
-- sequential paged reads) and counting them in JS. On a high-latency link that
-- was the bulk of the "board takes forever to load" time.
--
-- PostgREST aggregate select is disabled on this project (PGRST123), so the
-- grouping has to live in a function. This is a plain indexed GROUP BY that
-- returns ~one row per stream (~150) in a single round trip.
--
-- examinationService.getTeacherWorkload() calls this first and only falls back
-- to the paged scan when the function is absent — so deploying it is a pure
-- speed-up with no code change required.
--
-- SECURITY DEFINER: returns counts only, no marks or PII. The board itself is
-- gated on results.publish in the UI.
-- =====================================================================

create or replace function public.exam_workload_progress(_exam_ids uuid[])
returns table(exam_id uuid, subject_id uuid, entered_count bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select m.exam_id, m.subject_id, count(*)::bigint
  from public.marks m
  where m.exam_id = any(_exam_ids)
    and not (m.obtained_marks is null and coalesce(m.attendance_status, 'Present') = 'Present')
  group by m.exam_id, m.subject_id
$fn$;

grant execute on function public.exam_workload_progress(uuid[]) to authenticated, anon, service_role;

comment on function public.exam_workload_progress(uuid[]) is
  'Entered-mark counts per (exam, subject) for the marks-verification board. One indexed GROUP BY instead of paging the marks table to the client. Counts only, no PII.';

-- ---------------------------------------------------------------------
-- Verify — should return ~150 rows quickly.
-- ---------------------------------------------------------------------
-- select count(*) from public.exam_workload_progress(
--   array(select id from public.exams where academic_year_id =
--     (select id from public.academic_years where is_current) )
-- );
