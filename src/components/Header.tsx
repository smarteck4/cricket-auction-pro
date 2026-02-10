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
import { User, LogOut, Settings, Users, Gavel, UsersRound, Trophy } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export function Header() {
  const { user, role, owner, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full glass-strong border-b border-border/30">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center neu-flat transition-all duration-300 group-hover:scale-110 group-hover:glow-gold">
            <Gavel className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">CricBid</span>
        </Link>

        <nav className="flex items-center gap-2">
          <ThemeToggle />
          
          {user ? (
            <>
              {role === 'admin' && (
                <Button variant="ghost" asChild className="hidden sm:flex">
                  <Link to="/admin">
                    <Settings className="w-4 h-4 mr-2" />
                    Admin Panel
                  </Link>
                </Button>
              )}
              
              {role === 'owner' && owner && (
                <Button variant="ghost" asChild className="hidden sm:flex">
                  <Link to="/owner">
                    <Users className="w-4 h-4 mr-2" />
                    My Team
                  </Link>
                </Button>
              )}

              <Button variant="ghost" asChild className="hidden sm:flex">
                <Link to="/players">
                  <UsersRound className="w-4 h-4 mr-2" />
                  Players
                </Link>
              </Button>

              <Button variant="ghost" asChild className="hidden sm:flex">
                <Link to="/auction">
                  <Gavel className="w-4 h-4 mr-2" />
                  Auction
                </Link>
              </Button>

              <Button variant="ghost" asChild className="hidden sm:flex">
                <Link to="/tournaments">
                  <Trophy className="w-4 h-4 mr-2" />
                  Tournaments
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full neu-flat border-0">
                    <User className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 glass-strong">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{role || 'spectator'}</p>
                    {owner && (
                      <p className="text-xs text-primary font-medium mt-1">{owner.team_name}</p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  {/* Mobile nav items */}
                  <div className="sm:hidden">
                    {role === 'admin' && (
                      <DropdownMenuItem onClick={() => navigate('/admin')}>
                        <Settings className="w-4 h-4 mr-2" /> Admin Panel
                      </DropdownMenuItem>
                    )}
                    {role === 'owner' && owner && (
                      <DropdownMenuItem onClick={() => navigate('/owner')}>
                        <Users className="w-4 h-4 mr-2" /> My Team
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate('/players')}>
                      <UsersRound className="w-4 h-4 mr-2" /> Players
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/auction')}>
                      <Gavel className="w-4 h-4 mr-2" /> Auction
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/tournaments')}>
                      <Trophy className="w-4 h-4 mr-2" /> Tournaments
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </div>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button className="gradient-gold neu-flat border-0" asChild>
                <Link to="/auth?mode=signup">Get Started</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
