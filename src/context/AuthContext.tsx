import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

/**
 * Roles are defined by the app_role enum in PostgreSQL. This union must
 * stay in step with it; see supabase_rbac_migration_02a_enum.sql.
 */
export type AppRole =
  | 'super_admin'
  | 'admin'
  | 'principal'
  | 'vice_principal'
  | 'teacher'
  | 'class_teacher'
  | 'exam_controller'
  | 'accountant'
  | 'librarian'
  | 'transport_manager'
  | 'hostel_warden'
  | 'receptionist'
  | 'office_staff'
  | 'hr'
  | 'student'
  | 'parent';

/** Human-readable labels for display only. Never used for access decisions. */
export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  principal: 'Principal',
  vice_principal: 'Vice Principal',
  teacher: 'Teacher',
  class_teacher: 'Class Teacher',
  exam_controller: 'Exam Controller',
  accountant: 'Accountant',
  librarian: 'Librarian',
  transport_manager: 'Transport Manager',
  hostel_warden: 'Hostel Warden',
  receptionist: 'Receptionist',
  office_staff: 'Office Staff',
  hr: 'HR',
  student: 'Student',
  parent: 'Parent',
};

export type AuthErrorKind = 'none' | 'no-profile' | 'network';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  roleLabel: string;
  permissions: ReadonlySet<string>;
  /**
   * Whether the signed-in user holds a permission.
   *
   * This hides controls the user cannot use. It is NOT the security
   * boundary: every permission is independently enforced by row level
   * security and by auth_has_permission() in the database, so bypassing
   * this in the browser grants nothing.
   */
  can: (permission: string) => boolean;
  isLoading: boolean;
  errorKind: AuthErrorKind;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<ReadonlySet<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<AuthErrorKind>('none');

  const loadedForUser = React.useRef<string | null>(null);

  /**
   * Loads the role and permission set from the database. Both come from
   * the server: the role from profiles, the permissions from the
   * my_permissions() function, which joins role_permissions. Nothing is
   * read from localStorage, and nothing here can be overridden client-side.
   */
  const loadAuthorization = useCallback(async (userId: string) => {
    setIsLoading(true);
    setErrorKind('none');
    try {
      const [profileResult, permissionResult] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
        supabase.rpc('my_permissions'),
      ]);

      if (profileResult.error) throw profileResult.error;

      const dbRole = profileResult.data?.role as AppRole | undefined;
      if (!dbRole) {
        // Signed in, but no profile row. Grant nothing and say why.
        console.warn('[Auth] No profile row for user', userId);
        setRole(null);
        setPermissions(new Set());
        setErrorKind('no-profile');
        return;
      }
      setRole(dbRole);

      if (permissionResult.error) {
        // Role resolved but the permission set did not. Fail closed.
        console.error('[Auth] Could not load permissions:', permissionResult.error.message);
        setPermissions(new Set());
        setErrorKind('network');
        return;
      }

      const rows = (permissionResult.data ?? []) as Array<{ permission: string }>;
      setPermissions(new Set(rows.map(r => r.permission)));
      loadedForUser.current = userId;
    } catch (err: any) {
      console.error('[Auth] Authorization load failed:', err?.message ?? err);
      setRole(null);
      setPermissions(new Set());
      setErrorKind('network');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (!isMounted) return;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        await loadAuthorization(initialSession.user.id);
      } else {
        setIsLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        if (loadedForUser.current !== nextSession.user.id) {
          await loadAuthorization(nextSession.user.id);
        }
      } else {
        loadedForUser.current = null;
        setRole(null);
        setPermissions(new Set());
        setErrorKind('none');
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadAuthorization]);

  const can = useCallback(
    (permission: string) => permissions.has('*') || permissions.has(permission),
    [permissions]
  );

  const refresh = useCallback(async () => {
    if (user?.id) {
      loadedForUser.current = null;
      await loadAuthorization(user.id);
    }
  }, [user?.id, loadAuthorization]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Auth] Sign out failed:', err);
    }
    loadedForUser.current = null;
    setUser(null);
    setSession(null);
    setRole(null);
    setPermissions(new Set());
    setErrorKind('none');
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    role,
    roleLabel: role ? ROLE_LABELS[role] ?? role : 'No role assigned',
    permissions,
    can,
    isLoading,
    errorKind,
    refresh,
    signOut,
  }), [user, session, role, permissions, can, isLoading, errorKind, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
