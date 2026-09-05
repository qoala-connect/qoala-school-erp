# Execution Plan — School ERP Admin Audit & Overhaul

## Mission
Comprehensive enterprise-grade audit, verification, deduplication, RBAC/RLS tightening, navigation alignment, database validation, and quality overhaul of the School ERP from the primary perspective of the Admin role.

## Phase 0: Full Codebase Survey (Parallel Explorers)
- Explorer 1: Routes, Layout, Sidebar, Role Guards, Auth flow, Administrative Roles.
- Explorer 2: Database Schema, Foreign Keys, Indexes, Constraints, Supabase RLS Policies, Migrations.
- Explorer 3: Business Modules, Navigation Audit (KEEP/MOVE/MERGE/REMOVE/REDIRECT/RENAME), Button & Action Audit, Canonical Single Source of Truth mapping (ONE BUSINESS FUNCTION = ONE PRIMARY MODULE).
- Synthesize findings into `PROJECT.md` with full Feature Inventory, Architecture, and Milestone contracts.

## Phase 1: Dual Track Launch
- Track A: E2E Testing Track (test harness, Tiers 1-4 opaque-box tests covering all inventory features).
- Track B: Implementation Milestones:
  - Milestone 1: Navigation Alignment & Business Module Deduplication (Eliminate duplicate admin CRUD, fix canonical links & route redirects, ensure ID preservation).
  - Milestone 2: Database, Schema, RBAC & RLS Security Hardening (Additive migrations, FK validation, correct role policies, no silent failures).
  - Milestone 3: UI/UX Consistency, Action Buttons & Performance (Actionable buttons/handlers, error/loading/empty states, responsiveness, query optimization).
  - Milestone 4: Verification, Quality Gate, and Comprehensive Final Audit Report (Sections A-L, Scorecard 0-10, Production Readiness).
