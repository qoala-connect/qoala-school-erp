-- =====================================================================
-- A POST-shaped path for UPDATE and DELETE.
--
-- Some networks and browser extensions filter by HTTP method: GET and
-- POST pass, PATCH and DELETE are dropped before they leave the browser.
-- The app's own probe confirms it -- reads succeed while every PATCH fails
-- with "Failed to fetch" -- and nothing server-side can be changed to help,
-- because the request never arrives.
--
-- This function performs the same write over POST, so the client can fall
-- back to it when a PATCH or DELETE is blocked.
--
-- SECURITY INVOKER is essential and deliberate: the function runs as the
-- calling user, so row level security applies exactly as it would to the
-- direct PATCH. This is a different transport for the same request, never
-- a way around authorization. Do not make it SECURITY DEFINER.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rest_write(
  _table text,
  _op    text,                          -- 'update' | 'delete'
  _match jsonb,                         -- equality filter, e.g. {"id": "..."}
  _patch jsonb DEFAULT '{}'::jsonb      -- columns to set, for 'update'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  k           text;
  col_type    text;
  where_sql   text := '';
  set_cols    text := '';
  set_vals    text := '';
  sql         text;
  result      jsonb;
BEGIN
  IF _op NOT IN ('update', 'delete') THEN
    RAISE EXCEPTION 'rest_write: unsupported operation %', _op USING ERRCODE = '22023';
  END IF;

  -- The table must be a real base table in public. Rejecting anything else
  -- keeps views, other schemas and catalog tables out of reach.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = _table AND table_type = 'BASE TABLE'
  ) THEN
    RAISE EXCEPTION 'rest_write: unknown table %', _table USING ERRCODE = '42P01';
  END IF;

  IF _match IS NULL OR jsonb_typeof(_match) <> 'object' OR _match = '{}'::jsonb THEN
    RAISE EXCEPTION 'rest_write: a filter is required' USING ERRCODE = '22023';
  END IF;

  -- WHERE: every key must be a real column; values are cast to that column's
  -- own type so the comparison stays indexable, and are carried in the jsonb
  -- parameter rather than interpolated into the statement.
  FOR k IN SELECT jsonb_object_keys(_match) LOOP
    SELECT format_type(a.atttypid, a.atttypmod) INTO col_type
    FROM pg_attribute a
    WHERE a.attrelid = format('public.%I', _table)::regclass
      AND a.attname = k AND a.attnum > 0 AND NOT a.attisdropped;
    IF col_type IS NULL THEN
      RAISE EXCEPTION 'rest_write: % has no column %', _table, k USING ERRCODE = '42703';
    END IF;
    where_sql := where_sql
      || CASE WHEN where_sql = '' THEN '' ELSE ' AND ' END
      || format('t.%I = ($1 ->> %L)::%s', k, k, col_type);
  END LOOP;

  IF _op = 'delete' THEN
    sql := format(
      'WITH d AS (DELETE FROM public.%I t WHERE %s RETURNING to_jsonb(t)) '
      'SELECT COALESCE(jsonb_agg(to_jsonb), ''[]''::jsonb) FROM d',
      _table, where_sql);
    EXECUTE sql INTO result USING _match;
    RETURN result;
  END IF;

  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' OR _patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'rest_write: nothing to update' USING ERRCODE = '22023';
  END IF;

  -- SET: jsonb_populate_record coerces each value using the table's own row
  -- type, so no hand-rolled casting and no string interpolation of values.
  FOR k IN SELECT jsonb_object_keys(_patch) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = format('public.%I', _table)::regclass
        AND a.attname = k AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
      RAISE EXCEPTION 'rest_write: % has no column %', _table, k USING ERRCODE = '42703';
    END IF;
    set_cols := set_cols || CASE WHEN set_cols = '' THEN '' ELSE ', ' END || quote_ident(k);
    set_vals := set_vals || CASE WHEN set_vals = '' THEN '' ELSE ', ' END || 'p.' || quote_ident(k);
  END LOOP;

  sql := format(
    'WITH u AS ('
    '  UPDATE public.%I t SET (%s) = ('
    '    SELECT %s FROM jsonb_populate_record(NULL::public.%I, $2) p'
    '  ) WHERE %s RETURNING to_jsonb(t)'
    ') SELECT COALESCE(jsonb_agg(to_jsonb), ''[]''::jsonb) FROM u',
    _table, set_cols, set_vals, _table, where_sql);

  EXECUTE sql INTO result USING _match, _patch;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.rest_write(text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rest_write(text, text, jsonb, jsonb) TO authenticated, service_role;
