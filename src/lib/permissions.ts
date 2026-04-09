/**
 * Role-based permissions for PhishGuard.
 *
 * Roles (highest to lowest):
 *   super_admin - Full control: users, orgs, settings, all actions
 *   admin       - Manage reports, domains, threat intel, view audit
 *   analyst     - Review queue, view reports, add notes
 *   viewer      - Read-only dashboard and queue access
 *
 * Legacy: `isAdmin` boolean is still respected — any user with `isAdmin: true`
 * gets at least `admin`-level permissions.
 */

export type Role = 'super_admin' | 'admin' | 'analyst' | 'viewer'

export type Permission =
  | 'dashboard.view'
  | 'queue.view'
  | 'report.view'
  | 'report.review'
  | 'domain.view'
  | 'domain.manage'
  | 'org.view'
  | 'org.manage'
  | 'user.manage'
  | 'audit.view'
  | 'analytics.view'
  | 'settings.manage'
  | 'threat_intel.sync'

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'dashboard.view', 'queue.view', 'report.view', 'report.review',
    'domain.view', 'domain.manage', 'org.view', 'org.manage',
    'user.manage', 'audit.view', 'analytics.view', 'settings.manage',
    'threat_intel.sync',
  ],
  admin: [
    'dashboard.view', 'queue.view', 'report.view', 'report.review',
    'domain.view', 'domain.manage', 'org.view',
    'audit.view', 'analytics.view', 'settings.manage',
    'threat_intel.sync',
  ],
  analyst: [
    'dashboard.view', 'queue.view', 'report.view', 'report.review',
    'domain.view', 'analytics.view',
  ],
  viewer: [
    'dashboard.view', 'queue.view', 'report.view',
    'analytics.view',
  ],
}

const ROLE_RANK: Record<Role, number> = {
  super_admin: 4,
  admin: 3,
  analyst: 2,
  viewer: 1,
}

export function effectiveRole(user: { role?: string; isAdmin?: boolean }): Role {
  const role = (user.role ?? 'viewer') as Role
  if (ROLE_RANK[role]) {
    // Legacy compat: isAdmin=true bumps to at least admin
    if (user.isAdmin && ROLE_RANK[role] < ROLE_RANK.admin) return 'admin'
    return role
  }
  return user.isAdmin ? 'admin' : 'viewer'
}

export function hasPermission(user: { role?: string; isAdmin?: boolean }, permission: Permission): boolean {
  const role = effectiveRole(user)
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasRole(user: { role?: string; isAdmin?: boolean }, minRole: Role): boolean {
  return ROLE_RANK[effectiveRole(user)] >= ROLE_RANK[minRole]
}
