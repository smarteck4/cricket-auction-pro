import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface RoleRow {
  id: string;
  user_id: string;
  role: string;
}

interface OwnerRow {
  id: string;
  team_name: string;
  user_id: string | null;
}

const ROLES_QUERY = `supabase
  .from('user_roles')
  .select('id, user_id, role')
  .eq('user_id', <auth.uid()>)`;

const OWNER_QUERY = `supabase
  .from('owners')
  .select('*')
  .eq('user_id', <auth.uid()>)
  .single()`;

const SESSION_QUERY = `supabase.auth.getSession()`;

export default function RoleDebug() {
  const { user, session, role, owner, loading } = useAuth();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [ownerRow, setOwnerRow] = useState<OwnerRow | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const runChecks = async () => {
    if (!user) return;
    const { data: rolesData, error: rolesErr } = await supabase
      .from("user_roles")
      .select("id, user_id, role")
      .eq("user_id", user.id);
    if (rolesErr) setRolesError(rolesErr.message);
    else setRoles((rolesData ?? []) as RoleRow[]);

    const { data: ownerData, error: ownerErr } = await supabase
      .from("owners")
      .select("id, team_name, user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownerErr) setOwnerError(ownerErr.message);
    else setOwnerRow((ownerData as OwnerRow) ?? null);

    setFetchedAt(new Date().toISOString());
  };

  useEffect(() => {
    runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Role Debug</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={runChecks} disabled={!user}>
              Re-run checks
            </Button>
            <Link to="/">
              <Button variant="ghost">Home</Button>
            </Link>
          </div>
        </div>

        {loading && <p className="text-muted-foreground">Loading auth…</p>}

        {!loading && !user && (
          <Card>
            <CardContent className="pt-6">
              <p className="mb-4">You are not signed in.</p>
              <Link to="/auth">
                <Button>Go to login</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {user && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm font-mono break-all">
                <div><span className="text-muted-foreground">user_id:</span> {user.id}</div>
                <div><span className="text-muted-foreground">email:</span> {user.email}</div>
                <div><span className="text-muted-foreground">aud:</span> {user.aud}</div>
                <div><span className="text-muted-foreground">expires_at:</span> {session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : "—"}</div>
                <div><span className="text-muted-foreground">fetched_at:</span> {fetchedAt ?? "—"}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active role (from useAuth)</CardTitle>
              </CardHeader>
              <CardContent>
                {role ? <Badge>{role}</Badge> : <span className="text-muted-foreground">none</span>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>user_roles rows</CardTitle>
              </CardHeader>
              <CardContent>
                {rolesError ? (
                  <p className="text-destructive font-mono text-sm">Error: {rolesError}</p>
                ) : roles.length === 0 ? (
                  <p className="text-muted-foreground">No roles found for this user.</p>
                ) : (
                  <ul className="space-y-1 font-mono text-sm">
                    {roles.map((r) => (
                      <li key={r.id}>
                        <Badge variant="secondary" className="mr-2">{r.role}</Badge>
                        <span className="text-muted-foreground">id={r.id}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>owners row</CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-sm">
                {ownerError ? (
                  <p className="text-destructive">Error: {ownerError}</p>
                ) : ownerRow ? (
                  <pre className="whitespace-pre-wrap">{JSON.stringify(ownerRow, null, 2)}</pre>
                ) : (
                  <p className="text-muted-foreground">No owner record (expected unless role=owner).</p>
                )}
                {owner && (
                  <div className="mt-2 text-muted-foreground">
                    useAuth.owner.team_name: {owner.team_name}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exact queries used</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">1. Session lookup (on mount in useAuth)</div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{SESSION_QUERY}</pre>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">2. Role lookup (fetchUserRole in useAuth)</div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{ROLES_QUERY}</pre>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">3. Owner lookup (fetchOwnerData in useAuth)</div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{OWNER_QUERY}</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                  RLS: <code>user_roles</code> "Users can view own role" → <code>auth.uid() = user_id</code>.
                  <code>owners</code> "Scoped view owners" → owner can see row where <code>user_id = auth.uid()</code>.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
