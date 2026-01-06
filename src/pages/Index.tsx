import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Gavel, Users, Trophy, TrendingUp, Shield, Zap } from 'lucide-react';

export default function Index() {
  const { user, role } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 lg:py-32">
          <div className="absolute inset-0 gradient-dark opacity-5" />
          <div className="container relative">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">Live Cricket Auctions</span>
              </div>
              
              <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight mb-6">
                Build Your Dream{' '}
                <span className="text-gradient-gold">Cricket Team</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Experience the thrill of real-time cricket auctions. Bid on top players, 
                manage your budget, and assemble a championship-winning squad.
              </p>
              
              <div className="flex flex-wrap items-center justify-center gap-4">
                {user ? (
                  <>
                    <Button size="lg" className="gradient-gold glow-gold" asChild>
                      <Link to="/auction">
                        <Gavel className="w-5 h-5 mr-2" />
                        Enter Auction
                      </Link>
                    </Button>
                    {role === 'admin' && (
                      <Button size="lg" variant="outline" asChild>
                        <Link to="/admin">Admin Panel</Link>
                      </Button>
                    )}
                    {role === 'owner' && (
                      <Button size="lg" variant="outline" asChild>
                        <Link to="/owner">My Team</Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button size="lg" className="gradient-gold glow-gold" asChild>
                      <Link to="/auth?mode=signup">Get Started</Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link to="/auth">Sign In</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 border-t">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl font-bold mb-4">How It Works</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Our platform makes cricket auctions simple, fair, and exciting for everyone.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="card-shadow border-0">
                <CardContent className="pt-8 text-center">
                  <div className="w-14 h-14 rounded-2xl gradient-gold flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-2">Player Categories</h3>
                  <p className="text-muted-foreground">
                    Players are organized into Platinum, Gold, Silver, and Emerging categories 
                    with different base prices.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="card-shadow border-0">
                <CardContent className="pt-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
                    <Gavel className="w-7 h-7 text-accent-foreground" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-2">Real-Time Bidding</h3>
                  <p className="text-muted-foreground">
                    Bid against other owners in real-time. See live updates of current bids 
                    and leading bidders instantly.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="card-shadow border-0">
                <CardContent className="pt-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-7 h-7 text-secondary-foreground" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-2">Build Your Team</h3>
                  <p className="text-muted-foreground">
                    Assemble a squad of 15+ players while meeting category requirements. 
                    Export your final team to Excel.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20 border-t bg-muted/30">
          <div className="container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="font-display text-4xl font-bold text-gradient-gold mb-2">4</div>
                <p className="text-muted-foreground">Player Categories</p>
              </div>
              <div className="text-center">
                <div className="font-display text-4xl font-bold text-gradient-gold mb-2">15+</div>
                <p className="text-muted-foreground">Players per Team</p>
              </div>
              <div className="text-center">
                <div className="font-display text-4xl font-bold text-gradient-gold mb-2">Live</div>
                <p className="text-muted-foreground">Real-Time Bidding</p>
              </div>
              <div className="text-center">
                <div className="font-display text-4xl font-bold text-gradient-gold mb-2">∞</div>
                <p className="text-muted-foreground">Auction Excitement</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 border-t">
          <div className="container">
            <Card className="card-shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="grid lg:grid-cols-2 gap-8">
                  <div className="p-8 lg:p-12 flex flex-col justify-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent w-fit mb-4">
                      <Shield className="w-4 h-4" />
                      <span className="text-sm font-medium">Secure & Fair</span>
                    </div>
                    <h2 className="font-display text-3xl font-bold mb-4">
                      Ready to Start Your Auction Journey?
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Join CricBid today and experience the most exciting way to build your 
                      cricket dream team. Fair bidding rules ensure everyone gets a chance.
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <Button className="gradient-gold" asChild>
                        <Link to={user ? '/auction' : '/auth?mode=signup'}>
                          {user ? 'Go to Auction' : 'Create Account'}
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="hidden lg:block gradient-gold p-8 lg:p-12 flex items-center justify-center">
                    <div className="text-center text-primary-foreground">
                      <TrendingUp className="w-24 h-24 mx-auto mb-4 opacity-80" />
                      <p className="text-lg font-medium">Smart Bidding</p>
                      <p className="opacity-80">Auto-checks for budget compliance</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center">
              <Gavel className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold">CricBid</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 CricBid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
