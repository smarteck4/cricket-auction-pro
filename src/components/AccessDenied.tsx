import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, Home, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AccessDeniedProps {
  /** The human readable reason access was denied. */
  reason: string;
}

/**
 * Full-page message shown when a user lacks the permissions for a route,
 * instead of silently redirecting or falling back to spectator behaviour.
 */
export function AccessDenied({ reason }: AccessDeniedProps) {
  const navigate = useNavigate();
  const { user, role } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container flex items-center justify-center px-4 py-16 sm:py-24">
        <Card className="card-shadow w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle className="font-display text-2xl">Access denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">{reason}</p>
            {user && (
              <p className="text-xs text-muted-foreground">
                Signed in as <span className="font-medium">{user.email}</span> with role{' '}
                <span className="font-medium capitalize">{role ?? 'none assigned'}</span>. If you
                believe this is a mistake, ask a Super Admin to update your role.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={() => navigate('/')} variant="default" className="gradient-gold border-0">
                <Home className="mr-2 h-4 w-4" />
                Go to Home
              </Button>
              {!user && (
                <Button onClick={() => navigate('/auth')} variant="outline">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
