-- Dashboard KPI views 500 for teacher (and any non-admin) users.
--
-- Commit 6a63053 set security_invoker=on on these 4 views as part of
-- teacher data-isolation. But they are school-wide AGGREGATE views
-- (attendance %, fee totals, a 20-row top-scorers leaderboard, per-class
-- attendance counts) with no row-level PII exposure. Running them as the
-- invoker forces per-row RLS helper calls (teacher_teaches_student /
-- teacher_teaches_student_subject) across whole tables -> statement
-- timeout -> HTTP 500. It also makes a teacher's dashboard show only a
-- slice of the school instead of the intended school-wide numbers.
--
-- Fix: run these aggregate views with definer rights again. Row-level
-- isolation still applies to every direct table query and every
-- non-aggregate view.

ALTER VIEW public.dashboard_attendance_view        SET (security_invoker = false);
ALTER VIEW public.dashboard_attendance_class_view  SET (security_invoker = false);
ALTER VIEW public.dashboard_fee_view               SET (security_invoker = false);
ALTER VIEW public.dashboard_top_students           SET (security_invoker = false);
