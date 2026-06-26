import { ReactNode } from 'react';
import { Header } from '@/components/Header';
import { AccessDenied } from '@/components/AccessDenied';
import { useAuth } from '@/hooks/useAuth';
import { checkPermission } from '@/lib/permissions';
import { AppRole } from '@/lib/types';

interface RequireRoleProps {
  /** Roles permitted to mount the wrapped route. */
  roles: AppRole[];
  /** When true, the user must also have an associated owner record. */
  requireOwner?: boolean;
  /** A label used in console logs to identify the guarded route. */
  context: string;
  children: ReactNode;
}

/**
 * Single route-level permission guard. The wrapped page component is never
 * mounted unless the current user satisfies the required roles — while auth is
 * resolving a spinner is shown, and on failure a clear AccessDenied message is
 * rendered (and the failing check is logged to the console).
 */
export function RequireRole({ roles, requireOwner, context, children }: RequireRoleProps) {
  const { user, role, owner, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center text-muted-foreground">Verifying permissions…</div>
      </div>
    );
  }

  const result = checkPermission({
    context,
    userId: user?.id,
    currentRole: role,
    requiredRoles: roles,
    extraRequirement: requireOwner
      ? { label: 'a team must be assigned to your account', satisfied: !!owner }
      : undefined,
  });

  if (!result.allowed) {
    return <AccessDenied reason={result.reason ?? 'You do not have permission to view this page.'} />;
  }

  return <>{children}</>;
}
