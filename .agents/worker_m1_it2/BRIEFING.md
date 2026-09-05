# BRIEFING — 2026-09-03T16:33:22Z

## Mission
Execute Milestone 1 remediation: align DashboardLayout sidebar labels and permissions, ingest selectedTeacherId in Teachers.tsx, and fix examination shortcut in Student360Drawer.tsx.

## ?? My Identity
- Archetype: worker_m1_it2
- Roles: implementer, qa, specialist
- Working directory: d:/all_code/r.m.-memorial-public-school/.agents/worker_m1_it2
- Original parent: 0e9e073b-ea16-4a01-a740-bced5edebea4
- Milestone: Milestone 1 Remediation

## ?? Key Constraints
- Exclusive write ownership:
  1. src/components/DashboardLayout.tsx
  2. src/pages/dashboard/Teachers.tsx
  3. src/components/students/Student360Drawer.tsx
- Do not touch files outside this ownership.
- Do not cheat, fake or hardcode test strings/facades.
- Verify with 
px tsc --noEmit, 
pm run build, and 
px tsx tests/run-all.ts --feature=F4.

## Current Parent
- Conversation ID: 0e9e073b-ea16-4a01-a740-bced5edebea4
- Updated: not yet

## Task Summary
- **What to build**:
  1. DashboardLayout.tsx: Label changes ('Front Office', 'Hostel', 'Medical', 'Discipline', 'Reports') with permissions; align category permissions ('library.manage', 'transport.manage', 'inventory.manage', 'communication.manage'); item 'Issue Credentials' permission 'certificates.manage'; footer 'System' conditional on can('settings.manage').
  2. Teachers.tsx: Ingest location.state?.selectedTeacherId, display dismissible banner and filter/highlight selected teacher mirroring Employees.tsx.
  3. Student360Drawer.tsx: Update overview marks shortcut to /dashboard/examination?tab=marks.
- **Success criteria**:
  - 
px tsc --noEmit passes with 0 errors.
  - 
pm run build passes with 0 errors.
  - 
px tsx tests/run-all.ts --feature=F4 passes 100%.
- **Interface contracts**: PROJECT.md
- **Code layout**: PROJECT.md

## Key Decisions Made
- [Initial assessment]: Follow exact patterns from Employees.tsx and requirements in tests/tier1/f04_sidebar_align.test.ts.
- [Execution]: Aligned labels ('Front Office', 'Hostel', 'Medical', 'Discipline', 'Reports') and aligned category permissions ('library.manage', 'transport.manage', 'inventory.manage', 'communication.manage') in DashboardLayout.tsx. Ingested selectedTeacherId in Teachers.tsx with dismissible banner and row highlight. Updated Student360Drawer.tsx marks entry shortcut to /dashboard/examination?tab=marks.

## Artifact Index
- d:/all_code/r.m.-memorial-public-school/.agents/worker_m1_it2/handoff.md — Final handoff report

## Change Tracker
- **Files modified**:
  - `src/components/DashboardLayout.tsx`: Updated navigation labels, permissions, and gated System footer with can('settings.manage')
  - `src/pages/dashboard/Teachers.tsx`: Ingested selectedTeacherId with filter, highlight, and dismissible banner
  - `src/components/students/Student360Drawer.tsx`: Updated overview marks shortcut to /dashboard/examination?tab=marks
- **Build status**: PASS (tsc 0 errors, build 0 errors, F4 10/10 passed 100%)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (npx tsc --noEmit: 0 errors; npm run build: 0 errors; npx tsx tests/run-all.ts --feature=F4: 10/10 PASS)
- **Lint status**: 0 blockers
- **Tests added/modified**: None (10 existing F4 tests now pass 100%)

## Loaded Skills
- None
