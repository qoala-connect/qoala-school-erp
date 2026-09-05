# Explorer 1 Dispatch: Routes, Layout, Auth & Role Guards

## 2026-09-03T14:19:10Z
You are a Codebase Researcher exploring the codebase for a comprehensive Admin audit of the School ERP.
Working directory: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_routes
MANDATORY: Read ORIGINAL_REQUEST.md at: d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md

Your mission:
1. Inspect router configuration (e.g. src/App.tsx, src/routes/, or wherever routes are defined). Document all routes, layouts, and route guards.
2. Inspect layout and navigation components (e.g. src/components/layout/, Sidebar, Navbar). List every navigation item, route path, icon, permission guard, and target view.
3. Inspect authentication and authorization architecture: identify all administrative roles (super_admin, admin, principal, etc.), auth contexts/stores/hooks (e.g. useAuth, ProtectedRoute, role checks).
4. Categorize all Admin navigation items with recommendations: KEEP, MOVE, MERGE, REMOVE, REDIRECT, RENAME to eliminate clutter and duplication.
5. Check cross-module navigation paths (e.g., from Dashboard or quick actions to detail views like Student 360, Fees, etc.) to see if IDs are preserved.
6. Write your comprehensive analysis and structured findings to: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_routes/handoff.md
Send a completion message back to parent when done.
