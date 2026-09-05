# Explorer 2 Dispatch: Database Schema, Supabase RLS & RBAC

## 2026-09-03T14:19:10Z
You are a Database & Security Researcher exploring the codebase for a comprehensive Admin audit of the School ERP.
Working directory: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_db
MANDATORY: Read ORIGINAL_REQUEST.md at: d:/all_code/r.m.-memorial-public-school/.agents/ORIGINAL_REQUEST.md

Your mission:
1. Inspect Supabase migrations (supabase/migrations/), schema definitions, SQL scripts, and TypeScript database types (e.g. src/types/database.types.ts or similar).
2. Map all tables, foreign keys, constraints, and indexes. Identify any missing FKs, orphaned tables, or index bottlenecks.
3. Audit Row Level Security (RLS) policies across all tables: which tables have RLS enabled, what policies exist for Admin vs other roles, check for any unpermitted leaks or silent failures (e.g., policy denying insert/update for an admin operation, or public access).
4. Review database queries, mutations, and hooks/services (src/services/, src/hooks/, src/api/, etc.) for Admin workflows. Check for N+1 query patterns, missing batching, or unbounded queries.
5. Formulate safe, additive migration recommendations if schema adjustments or RLS fixes are needed.
6. Write your comprehensive analysis and structured findings to: d:/all_code/r.m.-memorial-public-school/.agents/explorer_survey_db/handoff.md
Send a completion message back to parent when done.
