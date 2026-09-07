-- ROLLBACK for supabase_fee_collection_math_33.sql.
-- Restores the pre-33 definitions, which sum fee_payments directly and so
-- count voided receipts as collected and fan billed amounts out across
-- instalments. Only run this to get back to the previous behaviour.

BEGIN;

CREATE OR REPLACE VIEW public.dashboard_fee_view AS
SELECT
  (SELECT COALESCE(count(*), 0::bigint) FROM public.fee_payments)            AS total_receipts,
  (SELECT COALESCE(sum(student_fees.net_amount), 0.00) FROM public.student_fees) AS total_fee,
  (SELECT COALESCE(sum(fee_payments.amount_paid), 0.00) FROM public.fee_payments) AS total_collection,
  ((SELECT COALESCE(sum(student_fees.net_amount), 0.00) FROM public.student_fees)
   - (SELECT COALESCE(sum(fee_payments.amount_paid), 0.00) FROM public.fee_payments)) AS pending_amount,
  (SELECT COALESCE(count(*), 0::bigint) FROM public.student_fees WHERE student_fees.status::text = 'paid')    AS paid_students,
  (SELECT COALESCE(count(*), 0::bigint) FROM public.student_fees WHERE student_fees.status::text = 'pending') AS pending_students,
  (SELECT COALESCE(count(*), 0::bigint) FROM public.student_fees WHERE student_fees.status::text = 'partial') AS partial_students;

CREATE OR REPLACE VIEW public.dashboard_fee_monthly AS
SELECT ay.name AS academic_year,
       to_char((sf.due_date)::timestamp with time zone, 'Mon'::text) AS month,
       COALESCE(sum(sf.net_amount), 0.00) AS total_fee,
       COALESCE(sum(fp.amount_paid), 0.00) AS total_collection,
       COALESCE(sum(sf.net_amount) - sum(fp.amount_paid), 0.00) AS pending
FROM ((public.student_fees sf
  LEFT JOIN public.academic_years ay ON sf.academic_year_id = ay.id)
  LEFT JOIN public.fee_payments fp ON fp.student_fee_id = sf.id)
GROUP BY ay.name, to_char((sf.due_date)::timestamp with time zone, 'Mon'::text), EXTRACT(month FROM sf.due_date)
ORDER BY EXTRACT(month FROM sf.due_date);

CREATE OR REPLACE VIEW public.dashboard_recent_payments AS
SELECT fp.id, s.name, s.class,
       to_char((sf.due_date)::timestamp with time zone, 'Mon'::text) AS month,
       fp.amount_paid AS paid_amount, fp.payment_mode, fp.payment_date, fp.receipt_number
FROM ((public.fee_payments fp
  JOIN public.student_fees sf ON fp.student_fee_id = sf.id)
  JOIN public.students s ON sf.student_id = s.id)
ORDER BY fp.payment_date DESC NULLS LAST
LIMIT 20;

CREATE OR REPLACE VIEW public.view_fee_collection_summary AS
SELECT c.class_name,
       COALESCE(count(sf.id), 0::bigint) AS total_receivables,
       COALESCE(sum(sf.total_amount), 0.00) AS total_gross_billed,
       COALESCE(sum(sf.discount_amount + sf.scholarship_amount), 0.00) AS total_concessions,
       COALESCE(sum(sf.net_amount), 0.00) AS total_net_receivables,
       COALESCE(sum(fp.amount_paid), 0.00) AS total_amount_collected,
       COALESCE(sum(sf.net_amount) - COALESCE(sum(fp.amount_paid), 0.00), 0.00) AS total_outstanding_dues
FROM (((public.classes c
  LEFT JOIN public.students s ON s.class = c.class_name)
  LEFT JOIN public.student_fees sf ON sf.student_id = s.id)
  LEFT JOIN public.fee_payments fp ON fp.student_fee_id = sf.id)
GROUP BY c.class_name;

COMMIT;
