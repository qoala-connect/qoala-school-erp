-- ---------------------------------------------------------------------
-- 42. AI DAILY DIGEST — real scheduled data for the "Actionable Smart
-- Insights" tab, replacing the hardcoded fake insights it shipped with.
-- ---------------------------------------------------------------------
-- AIAssistant.tsx's Insights tab has always shown three hand-written mock
-- objects (a fabricated "22% fee default risk", a fabricated teacher named
-- "Dr. Anand Kumar" who doesn't exist) as if they were live AI output. A
-- new /api/cron/daily-digest route (Vercel Cron, see vercel.json) now runs
-- the school's existing, already-verified AI tools once a day and stores
-- the result here; the Insights tab reads the latest row instead of the
-- mock array.
--
-- One row per calendar day. The cron route upserts on digest_date, so a
-- manual re-trigger the same day updates in place rather than duplicating.

CREATE TABLE IF NOT EXISTS public.ai_daily_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_date DATE NOT NULL UNIQUE,
  daily_brief JSONB,
  at_risk_students JSONB,
  cashflow_forecast JSONB,
  summary_text TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_daily_digests ENABLE ROW LEVEL SECURITY;

-- Read-only for admins/principal — this is institutional KPI/risk data, not
-- something students, parents, or teachers should see. Written exclusively
-- by the cron route's service-role client, which bypasses RLS, so no
-- insert/update policy is needed for any authenticated role.
DROP POLICY IF EXISTS ai_daily_digests_admin_read ON public.ai_daily_digests;
CREATE POLICY ai_daily_digests_admin_read
  ON public.ai_daily_digests
  FOR SELECT
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_ai_daily_digests_digest_date ON public.ai_daily_digests(digest_date DESC);
