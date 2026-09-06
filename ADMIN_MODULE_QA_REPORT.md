# Admin Module QA — Data Entry & Submit Button Audit

**Date:** 2026-09-06
**Scope:** Every admin module, page by page — Admissions, Students, Academics,
Examination, Fees, Staff & Faculty, Attendance, Operations (Library / Transport /
Inventory / Hostel / Communication / Certificates / Online Classes / Calendar),
and System.

**Result: 171 checks, 171 passing. 16 defects found, all fixed.**

---

## 1. How this was tested

There is no browser automation in this project, so instead of clicking buttons I
drove **the exact write path each submit button uses**: a real Supabase session
created by logging in as `admin@school.com` with the anon key — the same client,
the same RLS context, and the same RPCs and payloads the browser sends.

Every payload in the harness is copied verbatim from the page's own submit
handler. A failure in the harness is therefore a failure of that page's button.

```
scripts/qa/
  _harness.mjs      session handling, assertions, fixtures, cleanup registry
  sql.mjs           SQL runner (Supabase Management API)
  run.mjs           runner:  node scripts/qa/run.mjs [module ...]
  t_admissions.mjs  t_students.mjs   t_academics.mjs  t_examination.mjs
  t_fees.mjs        t_staff.mjs      t_attendance.mjs t_operations.mjs
  t_system.mjs
```

Run everything, or one module:

```bash
node scripts/qa/run.mjs
node scripts/qa/run.mjs examination fees
```

Every row the suite creates is registered for teardown and deleted on exit, so
the run leaves no residue. Reference data it must touch (the current academic
year, the seeded teacher's role and status, system settings) is restored to its
prior value. Reports are written to `scripts/out/qa-*.json`.

---

## 2. Defects found and fixed

### Completely non-functional Save buttons (9 pages)

These pages posted keys that had no matching column. PostgREST rejects the whole
row on an unknown key, so **nothing was ever saved** — in several cases the page
still showed a green success toast, because the handler never checked the error.

| Page | Symptom | Fix |
|---|---|---|
| Medical Management → Save health card | `PGRST204 … 'emergency_contact'` | added `height_cm`, `weight_kg`, `emergency_contact`, `medical_conditions`, `remarks` (m21) |
| Discipline Management → Log incident | `PGRST204 … 'demerit_points'` | added `demerit_points` (m21) |
| Library → Add book | `PGRST204 … 'available_copies'` | code → `copies_total` / `copies_available`; added `rack_number` (m24) |
| Transport → Add route | `PGRST204 … 'stops_count'` | added `stops_count` (m24) |
| Transport → Add driver | `PGRST204 … 'status'` | added `status` (m24) |
| Inventory → Add asset | `PGRST204 … 'asset_code'` | code → `asset_tag`; added `condition` (m24) |
| Inventory → Add stock item | `PGRST204 … 'min_quantity'` | code → `quantity_total`/`quantity_available`; added `min_quantity`, `status` (m24) |
| Hostel → Add hostel / room | `PGRST204 … 'type'` | code → `hostel_type`, `cost_per_month`; added `warden_name`, `warden_phone`, `room_type`, `status` (m24) |
| Communication → Publish notice / Send SMS | `PGRST204 … 'content'` / `'message'` | code → `description`, `message_text` (+ required `recipient_phone`); added `target_audience`, `publish_date`, `is_active`, `type`, `recipient_count` (m24) |
| School Calendar → Add event | `PGRST204 … 'academic_year'` | code → `title` / `start_date`; added `event_type` (m24) |

### Dropdown options the database rejected

Options offered in the UI that failed with `23514 check constraint`:

- **Admissions pipeline** — the Kanban board and status filter offer 11 stages,
  but only `Pending` / `Approved` / `Rejected` were permitted. Every intermediate
  stage-change button failed. Constraint widened to the full `AdmissionStatus`
  vocabulary (m20).
- **Student 360 → Link document** — all six options in the dropdown were rejected;
  only the legacy slugs `aadhaar` / `tc` / `marksheet` were allowed (m21).
- **Fees → Billing Frequency** — `Quarterly` and `Term` were rejected. This also
  broke the built-in default-category seeder, whose "Examination Fee" ships with
  frequency `Term` (m23).
- **Hostel → Hostel Type** — all four options rejected: the constraint wanted
  lowercase `boys|girls|co-ed`, and `Staff` / `Mixed` had no counterpart (m25).
- **Library book status** — the UI wrote `Issued` / `Returned`, the constraint
  wanted lowercase. Both "Issue book" and "Mark returned" failed. Fixed in code.
- **Inventory asset status** — the UI hardcoded `Active`; the vocabulary is
  `operational | under maintenance | damaged | written off`. Fixed in code.

### Silent data loss

- **Students → Add Student.** `create_student` returns
  `TABLE(student_id, admission_number, roll_number)`, but the form read
  `res.data[0].id`. That is always `undefined`, so the follow-up update was
  skipped and **photo, Aadhaar, minority/CWSN status, CBSE registration number
  and house were discarded on every new admission** — with no error shown, since
  the student itself was created. Fixed in `StudentFormModal.tsx`.
- **School Calendar.** The six event types were squashed into one boolean, so
  five of the six were lost on save and every event read back as either "Meeting"
  or "Holiday". Now stored in `event_type`.
- **Medical Management.** The vaccination field was collected in the form but
  never sent, and read back as the hardcoded string `'Complete'`. Now persisted
  to `vaccination_status`.
- **Hostel rooms.** Current occupancy was collected but never sent. Now persisted.
- **Communication.** SMS and email lists were ordered and dated by `created_at`,
  which does not exist on those tables — they carry `sent_at`. Fixed.

### Permissions

- **Examination → Delete exam was broken for every admin.**
  `deleteExam()` starts with `delete from marks where exam_id = …`, which failed
  with `42501 permission denied for table marks`, aborting the whole method — the
  exam was never deleted. The RLS policies on `marks` and `attendance` were
  already written `FOR ALL`, so deletes were always intended; only the table-level
  `GRANT` was missing, so PostgreSQL rejected the statement before RLS was ever
  consulted. Every other examination table already granted DELETE to
  `authenticated`. Granted (m22) — this does not widen who may delete, since RLS
  still restricts rows to admins / `results.publish` holders and correctly-scoped
  teachers, and students/parents hold SELECT-only policies.

### Broken function

- **System → User Directory → Link user to record** threw
  `42804 structure of query does not match function result type` as soon as the
  entity type was set to Staff. `linkable_entities()` declares
  `RETURNS TABLE(… label text …)`, but `staff.name` is `varchar` and PL/pgSQL's
  `RETURN QUERY` does not coerce it. Only the staff branch was affected, so no
  user could be linked to a non-teaching staff record. Columns cast explicitly (m26).

---

## 3. Migrations added

| File | Contents |
|---|---|
| `supabase_admissions_status_pipeline_20.sql` | full 11-stage admissions status vocabulary |
| `supabase_students_module_fixes_21.sql` | medical columns, `demerit_points`, document-type vocabulary |
| `supabase_marks_attendance_delete_grant_22.sql` | `GRANT DELETE` on `marks`, `attendance` |
| `supabase_fee_category_frequency_23.sql` | `Quarterly` / `Term` billing frequencies |
| `supabase_operations_module_fixes_24.sql` | 16 columns across 9 operations tables |
| `supabase_hostel_type_vocabulary_25.sql` | hostel-type vocabulary |
| `supabase_linkable_entities_staff_fix_26.sql` | `linkable_entities()` staff branch |

All are additive or constraint-widening. Existing values stay valid in every case
(legacy lowercase slugs and `Term-wise` are retained alongside the new ones), so
no data was migrated or lost.

---

## 4. Guards confirmed working

Checks that assert a *rejection*, to make sure the safety rails are not decorative:

- Locked marks reject further edits.
- Audit log entries are immutable.
- An admin cannot suspend their own account.
- Attendance cannot be recorded for a future date.
- Re-saving attendance for the same day overwrites rather than duplicating.
- Only one active class teacher per class-section.
- One transport allotment per student.
- Fee receipt numbers are unique per payment.
- Voiding a payment rolls the student's ledger back by exactly the voided amount.

---

## 5. Known issue not fixed

`activity_logs` has an RLS policy `activity_logs_admin_all` for `authenticated`
that can never fire, because the table grants nothing to that role. No page reads
the table — it is written by database triggers only — so this is latent, not a
live break. I left it alone rather than widen access with no caller to justify it.
Worth deciding deliberately: either grant SELECT and surface it in Security &
Governance, or drop the dead policy.
