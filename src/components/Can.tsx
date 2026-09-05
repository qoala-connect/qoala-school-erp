import React from 'react';
import { useAuth, AppRole, ROLE_LABELS } from '@/context/AuthContext';

export type { AppRole };
export { ROLE_LABELS };

/**
 * Permission-gated rendering.
 *
 * The permission set comes from the database (role_permissions, read via
 * the my_permissions() function) and is held in memory for the session.
 * It is never read from or written to localStorage.
 *
 * IMPORTANT: this hides controls. It is not a security boundary. Every
 * action behind it is independently enforced by row level security and by
 * auth_has_permission() in PostgreSQL, so a user who edits browser state
 * to reveal a control still cannot perform the action.
 */
interface CanProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function Can({ permission, fallback = null, children }: CanProps) {
  const { can } = useAuth();
  return <>{can(permission) ? children : fallback}</>;
}

/**
 * Hook form, for permission checks outside of JSX.
 *
 * Prefer this over the removed module-level hasPermission(role, permission)
 * helper, which resolved the role from localStorage and could be forged.
 */
export function usePermission(permission: string): boolean {
  const { can } = useAuth();
  return can(permission);
}

/**
 * The full permission vocabulary, for the role management UI to offer.
 * This is a display list only. The grants themselves live in the
 * role_permissions table and are seeded by
 * supabase_rbac_migration_02b.sql.
 */
export const PERMISSION_CATALOGUE: { group: string; permissions: string[] }[] = [
  { group: 'Students', permissions: ['student.view', 'student.list', 'student.create', 'student.update', 'student.delete'] },
  { group: 'Teachers & staff', permissions: ['teacher.view', 'teacher.create', 'teacher.update', 'teacher.delete', 'staff.view'] },
  { group: 'Attendance', permissions: ['attendance.manage'] },
  { group: 'Fees', permissions: ['fees.view', 'fees.collect', 'fees.refund'] },
  { group: 'Examinations', permissions: ['results.view', 'results.publish'] },
  { group: 'Reports', permissions: ['reports.view', 'reports.export'] },
  { group: 'Academics', permissions: ['academics.manage', 'certificates.manage', 'documents.manage'] },
  { group: 'Operations', permissions: ['library.manage', 'transport.manage', 'hostel.manage', 'inventory.manage'] },
  { group: 'Administration', permissions: ['settings.manage', 'users.manage', 'audit.view', 'database.manage'] },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_CATALOGUE.flatMap(g => g.permissions);
