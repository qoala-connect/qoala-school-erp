# Explorer 3 Dispatch: Business Functions, Modules, Action Buttons & Deduplication

## 2026-09-03T14:19:10Z
You are an ERP Business Module & UI Auditor exploring the codebase for a comprehensive Admin audit of the School ERP.
Working directory: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_modules
MANDATORY: Read ORIGINAL_REQUEST.md at: d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md

Your mission:
1. Inspect all business modules: Admissions, Students, Academics, Teacher Management, Attendance, Examination, Fees & Finance, Library, Transport, Inventory, Communication, Certificates/ID, Reports, System/Settings.
2. Enforce: ONE BUSINESS FUNCTION = ONE PRIMARY MODULE. Detect any duplicate Admin-specific CRUD pages, parallel tables, or divergent views (e.g. separate Admin Students page vs Teacher Students page or duplicate fee collection screens).
3. Audit all Admin-visible UI action buttons, links, dropdowns, table actions, modals, and quick action cards. Check which actions execute real Supabase operations (Create, Edit, Delete/Archive, View, Approve, Reject, Assign, Export, Print) vs fake/placeholder/dead interactions or console.log/toast('Feature coming soon').
4. Audit UI/UX consistency, page headers, breadcrumbs, search/filters, dense data tables, responsive layouts, and loading/empty/error states across Admin modules.
5. Write your comprehensive analysis and structured findings to: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_modules/handoff.md
Send a completion message back to parent when done.
