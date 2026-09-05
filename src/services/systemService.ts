import { supabase } from '@/lib/supabase';
import { AppRole } from '@/context/AuthContext';

export interface SystemOverviewData {
  users: {
    total: number;
    active: number;
    invited: number;
    suspended: number;
    disabled: number;
    archived: number;
    never_signed_in: number;
    signed_in_7d: number;
  };
  roles: {
    in_use: number;
    administrators: number;
    super_admins: number;
  };
  permissions: {
    grants: number;
    roles_granted: number;
    distinct: number;
  };
  audit: {
    total: number;
    last_24h: number;
    last_7d: number;
    security_7d: number;
    newest: string | null;
  };
  academic_year: {
    id: string;
    name: string;
    status: string;
  } | null;
  linkage: {
    teachers_total: number;
    teachers_linked: number;
    students_total: number;
    students_linked: number;
    staff_total: number;
    staff_linked: number;
  };
}

export type AccountStatus = 'invited' | 'active' | 'suspended' | 'disabled' | 'archived';

export interface UserDirectoryItem {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
  status: AccountStatus;
  status_reason: string | null;
  status_changed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  linked_type: 'teacher' | 'student' | 'staff' | null;
  linked_id: string | null;
  linked_label: string | null;
  linked_code: string | null;
  total_count: number;
}

export interface LinkableEntity {
  id: string;
  label: string;
  code: string;
  detail: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  actor_name: string | null;
  action_type: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
  total_count: number;
}

export interface AuditLogFacets {
  actions: string[];
  tables: string[];
  actors: Array<{
    id: string;
    email: string;
    name: string | null;
  }>;
}

export interface SystemSettings {
  id: string;
  school_name: string;
  school_address: string | null;
  school_phone: string | null;
  school_email: string | null;
  school_code: string | null;
  school_website: string | null;
  principal_name: string | null;
  logo_url: string | null;
  affiliation_board: string | null;
  affiliation_number: string | null;
  brand_primary_color: string | null;
  brand_accent_color: string | null;
  document_header_note: string | null;
  document_footer_note: string | null;
  timezone: string | null;
  date_format: string | null;
  currency_code: string | null;
  locale: string | null;
  default_page_size: number | null;
  session_timeout_minutes: number | null;
  mfa_enabled: boolean | null;
  updated_at?: string;
  updated_by?: string | null;
}

/**
 * Fetch the complete system administration overview metrics.
 */
export async function fetchSystemOverview(): Promise<SystemOverviewData> {
  const { data, error } = await supabase.rpc('system_overview');
  if (error) throw error;
  return data as SystemOverviewData;
}

/**
 * Fetch user directory with server-side pagination, search, and filtering.
 */
export async function fetchUserDirectory(params: {
  search?: string;
  role?: string;
  status?: string;
  linked?: string;
  limit?: number;
  offset?: number;
}): Promise<{ users: UserDirectoryItem[]; totalCount: number }> {
  const { data, error } = await supabase.rpc('admin_user_directory', {
    _search: params.search || null,
    _role: params.role && params.role !== 'all' ? params.role : null,
    _status: params.status && params.status !== 'all' ? params.status : null,
    _linked: params.linked && params.linked !== 'all' ? params.linked : null,
    _limit: params.limit ?? 25,
    _offset: params.offset ?? 0,
  });

  if (error) throw error;
  const list = (data ?? []) as UserDirectoryItem[];
  const totalCount = list.length > 0 ? Number(list[0].total_count) : 0;
  return { users: list, totalCount };
}

/**
 * Change a user's role safely via set_user_role RPC.
 */
export async function changeUserRole(userId: string, nextRole: AppRole): Promise<void> {
  const { error } = await supabase.rpc('set_user_role', {
    _user_id: userId,
    _role: nextRole,
  });
  if (error) throw error;
}

/**
 * Change account lifecycle status safely via set_user_status RPC.
 */
export async function changeUserStatus(
  userId: string,
  nextStatus: AccountStatus,
  reason?: string
): Promise<void> {
  const { error } = await supabase.rpc('set_user_status', {
    _user_id: userId,
    _status: nextStatus,
    _reason: reason || null,
  });
  if (error) throw error;
}

/**
 * Link an authenticated user profile to an existing business entity (teacher, staff, student).
 */
export async function linkUserToEntity(
  userId: string,
  entityType: 'teacher' | 'staff' | 'student',
  entityId: string
): Promise<void> {
  const { error } = await supabase.rpc('link_user_to_entity', {
    _user_id: userId,
    _entity_type: entityType,
    _entity_id: entityId,
  });
  if (error) throw error;
}

/**
 * Unlink a user profile from a business entity without deleting either record.
 */
export async function unlinkUserFromEntity(
  entityType: 'teacher' | 'staff' | 'student',
  entityId: string
): Promise<void> {
  const { error } = await supabase.rpc('unlink_user_from_entity', {
    _entity_type: entityType,
    _entity_id: entityId,
  });
  if (error) throw error;
}

/**
 * Search unlinked candidate business records (teachers, staff, students).
 */
export async function fetchLinkableEntities(
  entityType: 'teacher' | 'staff' | 'student',
  search?: string
): Promise<LinkableEntity[]> {
  const { data, error } = await supabase.rpc('linkable_entities', {
    _entity_type: entityType,
    _search: search || null,
  });
  if (error) throw error;
  return (data ?? []) as LinkableEntity[];
}

/**
 * Fetch role permission grants matrix from role_permissions table.
 */
export async function fetchRolePermissions(): Promise<Record<string, Set<string>>> {
  const { data, error } = await supabase.from('role_permissions').select('role, permission');
  if (error) throw error;
  const result: Record<string, Set<string>> = {};
  for (const row of (data ?? []) as { role: string; permission: string }[]) {
    (result[row.role] ??= new Set()).add(row.permission);
  }
  return result;
}

/**
 * Toggle a single permission for a role via set_role_permission RPC.
 */
export async function toggleRolePermission(
  role: AppRole,
  permission: string,
  granted: boolean
): Promise<void> {
  const { error } = await supabase.rpc('set_role_permission', {
    _role: role,
    _permission: permission,
    _granted: granted,
  });
  if (error) throw error;
}

/**
 * Fetch the singleton school settings row.
 */
export async function fetchSystemSettings(): Promise<SystemSettings> {
  const { data, error } = await supabase.from('system_settings').select('*').limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('System settings row is missing');
  return data as SystemSettings;
}

/**
 * Update system settings via update_system_settings RPC.
 */
export async function updateSystemSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
  const { data, error } = await supabase.rpc('update_system_settings', {
    _patch: patch,
  });
  if (error) throw error;
  return data as SystemSettings;
}

/**
 * Search and page the append-only audit trail with server-side filtering.
 */
export async function searchAuditLogs(params: {
  search?: string;
  action?: string;
  table?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLogRow[]; totalCount: number }> {
  const { data, error } = await supabase.rpc('audit_log_search', {
    _search: params.search || null,
    _action: params.action && params.action !== 'all' ? params.action : null,
    _table: params.table && params.table !== 'all' ? params.table : null,
    _user_id: params.userId || null,
    _from: params.from || null,
    _to: params.to || null,
    _limit: params.limit ?? 50,
    _offset: params.offset ?? 0,
  });

  if (error) throw error;
  const list = (data ?? []) as AuditLogRow[];
  const totalCount = list.length > 0 ? Number(list[0].total_count) : 0;
  return { logs: list, totalCount };
}

/**
 * Fetch live audit log filter facets (distinct actions, tables, actors).
 */
export async function fetchAuditLogFacets(): Promise<AuditLogFacets> {
  const { data, error } = await supabase.rpc('audit_log_facets');
  if (error) throw error;
  return data as AuditLogFacets;
}
