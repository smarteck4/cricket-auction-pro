import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { User, LogOut, Settings, Users, Gavel, UsersRound, Trophy, BarChart3, Menu, Shield } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useState } from 'react';

export function Header() {
  const { user, role, owner, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleLabel = loading ? 'Loading role…' : role ?? 'No role assigned';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navItems = [
    ...(role === 'super_admin' ? [{ to: '/super-admin', icon: Shield, label: 'Super Admin' }] : []),
    ...(role === 'admin' || role === 'super_admin' ? [{ to: '/admin', icon: Settings, label: 'Admin Panel' }] : []),
    ...(role === 'owner' && owner ? [{ to: '/owner', icon: Users, label: 'My Team' }] : []),
    { to: '/players', icon: UsersRound, label: 'Players' },
    { to: '/auction', icon: Gavel, label: 'Auction' },
    { to: '/tournaments', icon: Trophy, label: 'Tournaments' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full glass-strong border-b border-border/30">
      <div className="container flex h-14 sm:h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl gradient-gold flex items-center justify-center neu-flat transition-all duration-300 group-hover:scale-110 group-hover:glow-gold">
            <Gavel className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg sm:text-xl font-bold">CricBid</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          
          {user ? (
            <>
              {/* Desktop nav */}
              <div className="hidden lg:flex items-center gap-1">
                {navItems.map((item) => (
                  <Button key={item.to} variant="ghost" size="sm" asChild>
                    <Link to={item.to}>
                      <item.icon className="w-4 h-4 mr-1.5" />
                      {item.label}
                    </Link>
                  </Button>
                ))}
              </div>

              {/* Mobile hamburger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 pt-12">
                  <div className="flex flex-col gap-1">
                    {user && (
                      <div className="px-3 py-3 mb-2 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium truncate">{user.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">{roleLabel}</p>
                        {owner && <p className="text-xs text-primary font-medium mt-0.5">{owner.team_name}</p>}
                      </div>
                    )}
                    {navItems.map((item) => (
                      <Button
                        key={item.to}
                        variant="ghost"
                        className="justify-start h-11"
                        onClick={() => { navigate(item.to); setMobileOpen(false); }}
                      >
                        <item.icon className="w-4 h-4 mr-3" />
                        {item.label}
                      </Button>
                    ))}
                    <div className="border-t my-2" />
                    <Button variant="ghost" className="justify-start h-11 text-destructive" onClick={() => { handleSignOut(); setMobileOpen(false); }}>
                      <LogOut className="w-4 h-4 mr-3" />
                      Sign Out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              {/* User dropdown (desktop only) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full neu-flat border-0 hidden lg:flex">
                    <User className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 glass-strong">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{roleLabel}</p>
                    {owner && (
                      <p className="text-xs text-primary font-medium mt-1">{owner.team_name}</p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button size="sm" className="gradient-gold neu-flat border-0" asChild>
                <Link to="/auth?mode=signup">Get Started</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
