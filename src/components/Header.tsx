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
import { User, LogOut, Settings, Users, Gavel, UsersRound } from 'lucide-react';

export function Header() {
  const { user, role, owner, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg gradient-gold flex items-center justify-center">
            <Gavel className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">CricBid</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              {role === 'admin' && (
                <Button variant="ghost" asChild>
                  <Link to="/admin">
                    <Settings className="w-4 h-4 mr-2" />
                    Admin Panel
                  </Link>
                </Button>
              )}
              
              {role === 'owner' && owner && (
                <Button variant="ghost" asChild>
                  <Link to="/owner">
                    <Users className="w-4 h-4 mr-2" />
                    My Team
                  </Link>
                </Button>
              )}

              <Button variant="ghost" asChild>
                <Link to="/players">
                  <UsersRound className="w-4 h-4 mr-2" />
                  Players
                </Link>
              </Button>

              <Button variant="ghost" asChild>
                <Link to="/auction">
                  <Gavel className="w-4 h-4 mr-2" />
                  Auction
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <User className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{role || 'spectator'}</p>
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
              <Button variant="ghost" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button className="gradient-gold" asChild>
                <Link to="/auth?mode=signup">Get Started</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
