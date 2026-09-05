# BRIEFING — 2026-09-03T14:52:00Z

## Mission
Formulate exact, concrete, line-by-line edit instructions for src/App.tsx for the Worker to implement Route Security, Permission Guards & App.tsx Deduplication (Feature F1, F2).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesizer
- Working directory: d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_routes
- Original parent: 0e9e073b-ea16-4a01-a740-bced5edebea4
- Milestone: M1_Routes (Feature F1, F2)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Communicate all proposals via handoff report with exact before/after snippets and line numbers
- Output files only in working directory

## Current Parent
- Conversation ID: 0e9e073b-ea16-4a01-a740-bced5edebea4
- Updated: 2026-09-03T14:41:51Z

## Investigation State
- **Explored paths**: `src/App.tsx`, `src/components/DashboardLayout.tsx`, `src/components/Can.tsx`, `src/context/AuthContext.tsx`, `src/pages/dashboard/*`, `supabase_rbac_migration_02b.sql`
- **Key findings**:
  - Baseline `npm run lint` (`tsc --noEmit`) and `npm run build` pass with 0 errors.
  - 11 operations routes in `src/App.tsx` have unguarded `<ProtectedRoute>` wrappers lacking `allowedPermission`.
  - Legacy shims `ExamManagement.tsx` and `MarksEntry.tsx` duplicate routes and can be replaced with direct redirects to `/dashboard/examination`.
  - 7 unused imports in `src/App.tsx` (`ExamManagement`, `Settings`, `MarksEntry`, `GoogleFormsManager`, `GoogleClassroomManager`, `DatabaseManager`, `RoleAndUserManager`).
  - 5 obsolete files can be safely deleted (`Settings.tsx`, `RoleAndUserManager.tsx`, `DatabaseManager.tsx`, `ExamManagement.tsx`, `MarksEntry.tsx`) with zero broken dependencies across the codebase.
- **Unexplored areas**: None for M1 routes scope.

## Key Decisions Made
- Formulate 3 distinct replacement chunks for `src/App.tsx` for clean Worker execution.
- Group file retirement instructions with safety verification proof.
- Document `Can.tsx` and database permission mapping notes for M2 alignment.

## Artifact Index
- d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_routes/DISPATCH.md — dispatch record
- d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_routes/progress.md — liveness and progress log
- d:/all_code/r.m.-memorial-public-school/.agents/explorer_m1_routes/handoff.md — final handoff report
