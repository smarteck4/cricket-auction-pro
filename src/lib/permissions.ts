import { AppRole } from '@/lib/types';

export interface PermissionCheckInput {
  /** A short identifier for where the check happens, e.g. "Admin page". */
  context: string;
  /** The current authenticated user id, if any. */
  userId?: string | null;
  /** The role currently resolved for the user. */
  currentRole: AppRole | null;
  /** The roles that are allowed to access the resource. */
  requiredRoles: AppRole[];
  /** Optional extra requirement (e.g. owner record must exist). */
  extraRequirement?: { label: string; satisfied: boolean };
}

export interface PermissionCheckResult {
  allowed: boolean;
  /** Human readable reason the access was denied (null when allowed). */
  reason: string | null;
}

/**
 * Evaluates whether the current user satisfies a role requirement and logs a
 * detailed message to the console whenever the check fails. This replaces the
 * previous behaviour where insufficient permissions silently fell back to
 * spectator/redirect with no feedback.
 */
export function checkPermission(input: PermissionCheckInput): PermissionCheckResult {
  const { context, userId, currentRole, requiredRoles, extraRequirement } = input;

  if (!userId) {
    const reason = 'You must be signed in to access this page.';
    console.warn(`[permission-denied] ${context}: not authenticated`, {
      requiredRoles,
      currentRole,
    });
    return { allowed: false, reason };
  }

  const roleSatisfied = currentRole !== null && requiredRoles.includes(currentRole);
  if (!roleSatisfied) {
    const reason =
      `You don't have permission to view this page. ` +
      `It requires the ${formatRoleList(requiredRoles)} role, ` +
      `but your current role is "${currentRole ?? 'none assigned'}".`;
    console.warn(`[permission-denied] ${context}: insufficient role`, {
      userId,
      requiredRoles,
      currentRole,
    });
    return { allowed: false, reason };
  }

  if (extraRequirement && !extraRequirement.satisfied) {
    const reason = `Access requires: ${extraRequirement.label}.`;
    console.warn(`[permission-denied] ${context}: ${extraRequirement.label} not satisfied`, {
      userId,
      currentRole,
    });
    return { allowed: false, reason };
  }

  return { allowed: true, reason: null };
}

function formatRoleList(roles: AppRole[]): string {
  if (roles.length === 1) return `"${roles[0]}"`;
  return roles.map((r) => `"${r}"`).join(' or ');
}
