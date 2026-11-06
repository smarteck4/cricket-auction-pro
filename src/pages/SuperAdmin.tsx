import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Search, UserCog, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface TeamRow {
  id: string;
  team_name: string;
  user_id: string | null;
}

const NO_TEAM = 'none';

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  show,
  onToggle,
  autoComplete = 'off',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}


export default function SuperAdmin() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [assigningUser, setAssigningUser] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserWithRole | null>(null);
  const [passwordCurrent, setPasswordCurrent] = useState('');
  const [passwordSecretKey, setPasswordSecretKey] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);



  useEffect(() => {
    if (role === 'super_admin') {
      fetchUsers();
      fetchTeams();
    }
  }, [role]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    
    // Fetch profiles (super_admin can see all via RLS policy)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name');

    if (profilesError) {
      toast.error('Failed to load users');
      setLoadingUsers(false);
      return;
    }

    // Fetch all roles (super_admin can see all via RLS policy)
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      toast.error('Failed to load roles');
      setLoadingUsers(false);
      return;
    }

    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

    const combined: UserWithRole[] = (profiles || []).map(p => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: roleMap.get(p.id) || 'spectator',
    }));

    setUsers(combined);
    setLoadingUsers(false);
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from('owners')
      .select('id, team_name, user_id')
      .order('team_name');
    if (error) {
      toast.error('Failed to load teams');
      return;
    }
    setTeams((data || []) as TeamRow[]);
  };

  // Assign a team (owners row) to a user. A team can only belong to one user, and a
  // user can only hold one team, so the previous links are cleared first.
  const handleTeamAssign = async (userId: string, teamId: string) => {
    setAssigningUser(userId);

    const previous = teams.filter(t => t.user_id === userId && t.id !== teamId);
    for (const prev of previous) {
      const { error } = await supabase.from('owners').update({ user_id: null }).eq('id', prev.id);
      if (error) {
        toast.error('Failed to release ' + prev.team_name + ': ' + error.message);
        setAssigningUser(null);
        return;
      }
    }

    if (teamId !== NO_TEAM) {
      const { error } = await supabase.from('owners').update({ user_id: userId }).eq('id', teamId);
      if (error) {
        toast.error('Failed to assign team: ' + error.message);
        setAssigningUser(null);
        return;
      }
    }

    toast.success(teamId === NO_TEAM ? 'Team unassigned' : 'Team assigned');
    await fetchTeams();
    setAssigningUser(null);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUser(userId);
    
    const { data, error } = await supabase.rpc('update_user_role', {
      p_user_id: userId,
      p_new_role: newRole as any,
    });

    if (error) {
      toast.error('Failed to update role: ' + error.message);
    } else if (data && typeof data === 'object' && 'error' in (data as any)) {
      toast.error((data as any).error);
    } else {
      toast.success('Role updated successfully');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (newRole !== 'owner') {
        // Losing the owner role releases any team held by this user.
        await handleTeamAssign(userId, NO_TEAM);
      }
    }
    
    setUpdatingUser(null);
  };

  const openPasswordDialog = (u: UserWithRole) => {
    setPasswordTarget(u);
    setPasswordCurrent('');
    setPasswordSecretKey('');
    setPasswordNew('');
    setPasswordConfirm('');
  };

  const handlePasswordUpdate = async () => {
    if (!passwordTarget) return;
    if (!passwordNew) {
      toast.error('Enter a new password');
      return;
    }
    if (passwordNew !== passwordConfirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordTarget.id === user?.id && !passwordSecretKey.trim()) {
      toast.error('Enter the secret key first');
      return;
    }
    if (passwordTarget.id === user?.id && !passwordCurrent) {
      toast.error('Enter your current password');
      return;
    }
    setSavingPassword(true);
    const { data, error } = await supabase.functions.invoke('update-user-password', {
      body: {
        targetUserId: passwordTarget.id,
        currentPassword: passwordTarget.id === user?.id ? passwordCurrent : undefined,
        newPassword: passwordNew,
        secretKey: passwordTarget.id === user?.id ? passwordSecretKey : undefined,
      },
    });
    setSavingPassword(false);
    let errMessage: string | null = null;
    if (error instanceof FunctionsHttpError) {
      const ctx = await error.context.json().catch(() => null);
      errMessage = (ctx as any)?.error || null;
    } else if (error) {
      errMessage = 'Failed to update password';
    }
    if (data && typeof data === 'object' && 'error' in (data as any)) {
      errMessage = (data as any).error;
    }
    if (errMessage) {
      toast.error(errMessage);
      return;
    }
    toast.success('Password updated for ' + passwordTarget.email);
    setPasswordTarget(null);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin': return 'destructive';
      case 'admin': return 'default';
      case 'owner': return 'secondary';
      default: return 'outline';
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || role !== 'super_admin') return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 sm:py-10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Super Admin</h1>
            <p className="text-muted-foreground text-sm">Manage user roles and permissions</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Assign roles to users. New signups default to Spectator. You can promote users to Admin or Owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {loadingUsers ? (
              <div className="text-center py-8 text-muted-foreground">Loading users...</div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">Password</TableHead>
                      <TableHead className="text-right">Change Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{u.full_name || 'No name'}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(u.role)} className="capitalize">
                              {u.role.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {u.role === 'owner' ? (
                              <Select
                                value={teams.find(t => t.user_id === u.id)?.id || NO_TEAM}
                                onValueChange={(val) => handleTeamAssign(u.id, val)}
                                disabled={assigningUser === u.id}
                              >
                                <SelectTrigger className="w-[170px]">
                                  <SelectValue placeholder="No team" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_TEAM}>No team</SelectItem>
                                  {teams
                                    .filter(t => !t.user_id || t.user_id === u.id)
                                    .map(t => (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.team_name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={'Update password for ' + u.email}
                              onClick={() => openPasswordDialog(u)}
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            {u.role === 'super_admin' || u.id === user?.id ? (
                              <span className="text-xs text-muted-foreground">Protected</span>
                            ) : (
                              <Select
                                value={u.role}
                                onValueChange={(val) => handleRoleChange(u.id, val)}
                                disabled={updatingUser === u.id}
                              >
                                <SelectTrigger className="w-[140px] ml-auto">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="spectator">Spectator</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="owner">Owner</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={fetchUsers}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!passwordTarget} onOpenChange={(open) => !open && setPasswordTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Update password
              </DialogTitle>
              <DialogDescription>
                Set a new password for {passwordTarget?.email}
                {passwordTarget?.id === user?.id && ' — enter your current password and secret key to continue.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {passwordTarget?.id === user?.id && (
                <div className="space-y-2">
                  <Label htmlFor="password-current">Current password</Label>
                  <PasswordInput
                    id="password-current"
                    value={passwordCurrent}
                    onChange={setPasswordCurrent}
                    placeholder="Enter current password"
                    show={showCurrentPassword}
                    onToggle={() => setShowCurrentPassword((v) => !v)}
                    autoComplete="current-password"
                  />
                </div>
              )}
              {passwordTarget?.id === user?.id && (
                <div className="space-y-2">
                  <Label htmlFor="password-secret-key">Secret key</Label>
                  <PasswordInput
                    id="password-secret-key"
                    value={passwordSecretKey}
                    onChange={setPasswordSecretKey}
                    placeholder="Enter secret key"
                    show={showSecretKey}
                    onToggle={() => setShowSecretKey((v) => !v)}
                  />
                </div>
              )}
                <div className="space-y-2">
                  <Label htmlFor="password-new">New password</Label>
                  <PasswordInput
                    id="password-new"
                    value={passwordNew}
                    onChange={setPasswordNew}
                    placeholder="Enter a new password"
                    show={showNewPassword}
                    onToggle={() => setShowNewPassword((v) => !v)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-confirm">Confirm password</Label>
                  <PasswordInput
                    id="password-confirm"
                    value={passwordConfirm}
                    onChange={setPasswordConfirm}
                    placeholder="Repeat the new password"
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((v) => !v)}
                    autoComplete="new-password"
                  />
                </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordTarget(null)} disabled={savingPassword}>
                Cancel
              </Button>
              <Button onClick={handlePasswordUpdate} disabled={savingPassword}>
                {savingPassword ? 'Saving...' : 'Update password'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
