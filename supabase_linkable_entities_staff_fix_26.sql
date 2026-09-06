-- Migration 26: fix linkable_entities() for the 'staff' entity type.
--
-- Defect: System -> User Directory -> "Link user to record" throws as soon as
-- the entity type is switched to Staff:
--   42804 structure of query does not match function result type
--
-- The function declares RETURNS TABLE(id uuid, label text, code text, detail text).
-- The teacher and student branches select name columns that are already `text`,
-- but public.staff.name is `character varying`, and PL/pgSQL's RETURN QUERY does
-- not coerce varchar to text — so only the staff branch failed. Nothing could be
-- linked to a non-teaching staff record.
--
-- Cast the staff branch's columns to text explicitly. Behaviour is otherwise
-- unchanged, including the users.manage permission check.

CREATE OR REPLACE FUNCTION public.linkable_entities(_entity_type text, _search text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, label text, code text, detail text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE q text := nullif(btrim(coalesce(_search, '')), '');
BEGIN
  IF NOT public.auth_has_permission('users.manage') THEN
    RAISE EXCEPTION 'You do not have permission to view linkable records'
      USING ERRCODE = '42501';
  END IF;

  IF _entity_type = 'teacher' THEN
    RETURN QUERY
      SELECT t.id, t.name::text, t.employee_id::text,
             coalesce(t.designation, t.department, '')::text
      FROM public.teachers t
      WHERE t.user_id IS NULL
        AND (q IS NULL OR t.name ILIKE '%'||q||'%' OR coalesce(t.employee_id,'') ILIKE '%'||q||'%')
      ORDER BY t.name LIMIT 50;
  ELSIF _entity_type = 'staff' THEN
    RETURN QUERY
      SELECT s.id, s.name::text, s.employee_id::text,
             coalesce(s.designation, s.role_title, '')::text
      FROM public.staff s
      WHERE s.user_id IS NULL
        AND (q IS NULL OR s.name ILIKE '%'||q||'%' OR coalesce(s.employee_id,'') ILIKE '%'||q||'%')
      ORDER BY s.name LIMIT 50;
  ELSIF _entity_type = 'student' THEN
    RETURN QUERY
      SELECT st.id, st.name::text, st.admission_number::text,
             (coalesce(st.class,'') || coalesce(' / ' || st.section, ''))::text
      FROM public.students st
      WHERE st.user_id IS NULL AND st.status = 'active'
        AND (q IS NULL OR st.name ILIKE '%'||q||'%' OR coalesce(st.admission_number,'') ILIKE '%'||q||'%')
      ORDER BY st.name LIMIT 50;
  ELSE
    RAISE EXCEPTION 'Unknown entity type: %', _entity_type USING ERRCODE = '22023';
  END IF;
END;
$function$;
