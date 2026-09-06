-- =====================================================================
-- Reassigning a class teacher must hand the role over, not fail.
--
-- teacher_assignments carries a partial unique index,
-- uq_single_active_class_teacher, allowing one active class_teacher/both
-- row per (academic_year, class, section). saveAssignment() only ever
-- inserted, so naming a new class teacher for a section that already had
-- one raised 23505 and the admin was stuck: the UI warned who the
-- incumbent was but gave no way to replace them.
--
-- The hand-over has to be atomic -- stand the incumbent down and install
-- the successor in one transaction -- otherwise a failure between the two
-- leaves the section with no class teacher at all. PostgREST cannot span
-- statements, so it lives here.
--
-- An incumbent holding 'both' is demoted to 'subject_teacher' rather than
-- deactivated, so handing over the class teacher role does not silently
-- strip the subject they teach.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.save_teacher_assignment(
  _teacher_id        uuid,
  _academic_year_id  uuid,
  _class_id          uuid,
  _section_id        uuid,
  _subject_id        uuid    DEFAULT NULL,
  _assignment_type   text    DEFAULT 'subject_teacher',
  _assignment_id     uuid    DEFAULT NULL
)
RETURNS TABLE (
  assignment_id     uuid,
  replaced_teacher  text,
  replaced_action   text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id        uuid;
  v_prev      record;
  v_repl_name text := NULL;
  v_repl_act  text := NULL;
BEGIN
  -- Same authority the table's own RLS policy demands for writes.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'You do not have permission to change teaching assignments.'
      USING ERRCODE = '42501';
  END IF;

  IF _assignment_type NOT IN
     ('subject_teacher','class_teacher','both','assistant_teacher','examiner') THEN
    RAISE EXCEPTION 'Unknown responsibility type: %', _assignment_type
      USING ERRCODE = '22023';
  END IF;

  -- ---- 1. Hand over the class teacher role, if this is one ----
  IF _assignment_type IN ('class_teacher','both') THEN
    FOR v_prev IN
      SELECT ta.id, ta.assignment_type, t.name AS teacher_name
      FROM teacher_assignments ta
      JOIN teachers t ON t.id = ta.teacher_id
      WHERE ta.academic_year_id = _academic_year_id
        AND ta.class_id         = _class_id
        AND ta.section_id       = _section_id
        AND ta.assignment_type IN ('class_teacher','both')
        AND ta.is_active
        AND ta.teacher_id <> _teacher_id
        AND (_assignment_id IS NULL OR ta.id <> _assignment_id)
    LOOP
      IF v_prev.assignment_type = 'both' THEN
        -- Keep them teaching their subject; only the class teacher role moves.
        UPDATE teacher_assignments
           SET assignment_type = 'subject_teacher', updated_at = now()
         WHERE id = v_prev.id;
        v_repl_act := 'kept as subject teacher';
      ELSE
        UPDATE teacher_assignments
           SET is_active = false, updated_at = now()
         WHERE id = v_prev.id;
        v_repl_act := 'stood down';
      END IF;
      v_repl_name := v_prev.teacher_name;
    END LOOP;
  END IF;

  -- ---- 2. Install the new assignment ----
  IF _assignment_id IS NOT NULL THEN
    UPDATE teacher_assignments
       SET teacher_id       = _teacher_id,
           academic_year_id = _academic_year_id,
           class_id         = _class_id,
           section_id       = _section_id,
           subject_id       = _subject_id,
           assignment_type  = _assignment_type,
           is_active        = true,
           updated_at       = now()
     WHERE id = _assignment_id
     RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'That assignment no longer exists.' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    -- Reuse the identical row if it already exists (possibly inactive)
    -- rather than tripping uq_teacher_assignment_subject.
    SELECT id INTO v_id
    FROM teacher_assignments
    WHERE teacher_id        = _teacher_id
      AND academic_year_id  = _academic_year_id
      AND class_id          = _class_id
      AND section_id        = _section_id
      AND subject_id IS NOT DISTINCT FROM _subject_id
      AND assignment_type   = _assignment_type
    LIMIT 1;

    IF v_id IS NOT NULL THEN
      UPDATE teacher_assignments
         SET is_active = true, updated_at = now()
       WHERE id = v_id;
    ELSE
      INSERT INTO teacher_assignments (
        teacher_id, academic_year_id, class_id, section_id,
        subject_id, assignment_type, is_active, created_by
      ) VALUES (
        _teacher_id, _academic_year_id, _class_id, _section_id,
        _subject_id, _assignment_type, true, auth.uid()
      )
      RETURNING id INTO v_id;
    END IF;
  END IF;

  RETURN QUERY SELECT v_id, v_repl_name, v_repl_act;
END;
$$;

REVOKE ALL ON FUNCTION public.save_teacher_assignment(uuid,uuid,uuid,uuid,uuid,text,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_teacher_assignment(uuid,uuid,uuid,uuid,uuid,text,uuid)
  TO authenticated, service_role;
