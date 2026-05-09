import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Owner } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  owner: Owner | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSessionData = async (nextSession: Session | null) => {
    setLoading(true);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setRole(null);
      setOwner(null);
      setLoading(false);
      return;
    }

    const nextRole = await fetchUserRole(nextSession.user.id);
    const nextOwner = await fetchOwnerData(nextSession.user.id);
    setRole(nextRole);
    setOwner(nextOwner);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void loadSessionData(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      void loadSessionData(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to load user role', error);
      return null;
    }

    const roles = (data ?? []).map((row) => row.role as AppRole);
    return (['super_admin', 'admin', 'owner', 'spectator'] as AppRole[]).find((candidate) => roles.includes(candidate)) ?? null;
  };

  const fetchOwnerData = async (userId: string): Promise<Owner | null> => {
    const { data, error } = await supabase
      .from('owners')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load owner data', error);
      return null;
    }

    return (data as Owner) ?? null;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // If sign out fails (e.g. session expired), clear local state anyway
    }
    setUser(null);
    setSession(null);
    setRole(null);
    setOwner(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, owner, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
