import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Gavel, Users, Trophy, TrendingUp, Shield, Zap } from 'lucide-react';
import { TiltCard } from '@/components/TiltCard';
import { ParallaxSection } from '@/components/ParallaxSection';
import { FloatingCricketScene } from '@/components/FloatingCricketScene';
import { Suspense } from 'react';

export default function Index() {
  const { user, role } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main>
        {/* Hero Section with 3D */}
        <section className="relative overflow-hidden py-24 lg:py-36">
          <Suspense fallback={null}>
            <FloatingCricketScene />
          </Suspense>
          <div className="container relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <ParallaxSection speed={0.2}>
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass neu-flat mb-8 animate-fade-in">
                  <Zap className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium">Live Cricket Auctions</span>
                </div>
              </ParallaxSection>
              
              <ParallaxSection speed={0.15}>
                <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-fade-in-up">
                  Build Your Dream{' '}
                  <span className="text-gradient-gold">Cricket Team</span>
                </h1>
              </ParallaxSection>
              
              <ParallaxSection speed={0.1}>
                <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  Experience the thrill of real-time cricket auctions. Bid on top players, 
                  manage your budget, and assemble a championship-winning squad.
                </p>
              </ParallaxSection>
              
              <ParallaxSection speed={0.05}>
                <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                  {user ? (
                    <>
                      <Button size="lg" className="gradient-gold glow-gold neu-flat border-0 text-base px-8 py-6 hover:scale-105 transition-transform" asChild>
                        <Link to="/auction">
                          <Gavel className="w-5 h-5 mr-2" />
                          Enter Auction
                        </Link>
                      </Button>
                      {role === 'admin' && (
                        <Button size="lg" variant="outline" className="neu-flat border-0 px-8 py-6 hover:scale-105 transition-transform" asChild>
                          <Link to="/admin">Admin Panel</Link>
                        </Button>
                      )}
                      {role === 'owner' && (
                        <Button size="lg" variant="outline" className="neu-flat border-0 px-8 py-6 hover:scale-105 transition-transform" asChild>
                          <Link to="/owner">My Team</Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button size="lg" className="gradient-gold glow-gold neu-flat border-0 text-base px-8 py-6 hover:scale-105 transition-transform" asChild>
                        <Link to="/auth?mode=signup">Get Started</Link>
                      </Button>
                      <Button size="lg" variant="outline" className="neu-flat border-0 px-8 py-6 hover:scale-105 transition-transform" asChild>
                        <Link to="/auth">Sign In</Link>
                      </Button>
                    </>
                  )}
                </div>
              </ParallaxSection>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 border-t border-border/30">
          <div className="container">
            <ParallaxSection speed={0.15}>
              <div className="text-center mb-16">
                <h2 className="font-display text-4xl font-bold mb-4">How It Works</h2>
                <p className="text-muted-foreground max-w-xl mx-auto text-lg">
                  Our platform makes cricket auctions simple, fair, and exciting for everyone.
                </p>
              </div>
            </ParallaxSection>
            
            <div className="grid md:grid-cols-3 gap-8">
              <ParallaxSection speed={0.1} className="h-full">
                <TiltCard className="h-full">
                  <Card className="neu-convex border-0 h-full hover:glow-primary transition-shadow duration-500">
                    <CardContent className="pt-8 text-center">
                      <div className="w-16 h-16 rounded-2xl gradient-gold flex items-center justify-center mx-auto mb-5 animate-float" style={{ animationDelay: '0s' }}>
                        <Users className="w-8 h-8 text-primary-foreground" />
                      </div>
                      <h3 className="font-display text-xl font-semibold mb-3">Player Categories</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Players are organized into Platinum, Gold, Silver, and Emerging categories 
                        with different base prices.
                      </p>
                    </CardContent>
                  </Card>
                </TiltCard>
              </ParallaxSection>
              
              <ParallaxSection speed={0.15} className="h-full">
                <TiltCard className="h-full">
                  <Card className="neu-convex border-0 h-full hover:glow-primary transition-shadow duration-500">
                    <CardContent className="pt-8 text-center">
                      <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5 animate-float" style={{ animationDelay: '1s' }}>
                        <Gavel className="w-8 h-8 text-primary-foreground" />
                      </div>
                      <h3 className="font-display text-xl font-semibold mb-3">Real-Time Bidding</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Bid against other owners in real-time. See live updates of current bids 
                        and leading bidders instantly.
                      </p>
                    </CardContent>
                  </Card>
                </TiltCard>
              </ParallaxSection>
              
              <ParallaxSection speed={0.2} className="h-full">
                <TiltCard className="h-full">
                  <Card className="neu-convex border-0 h-full hover:glow-primary transition-shadow duration-500">
                    <CardContent className="pt-8 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5 animate-float" style={{ animationDelay: '2s' }}>
                        <Trophy className="w-8 h-8 text-secondary-foreground" />
                      </div>
                      <h3 className="font-display text-xl font-semibold mb-3">Build Your Team</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Assemble a squad of 15+ players while meeting category requirements. 
                        Export your final team to Excel.
                      </p>
                    </CardContent>
                  </Card>
                </TiltCard>
              </ParallaxSection>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-24 border-t border-border/30">
          <div className="container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: '4', label: 'Player Categories', delay: '0s' },
                { value: '15+', label: 'Players per Team', delay: '0.1s' },
                { value: 'Live', label: 'Real-Time Bidding', delay: '0.2s' },
                { value: '∞', label: 'Auction Excitement', delay: '0.3s' },
              ].map((stat) => (
                <ParallaxSection key={stat.label} speed={0.1}>
                  <TiltCard tiltMax={10}>
                    <div className="text-center p-8 rounded-2xl neu-convex">
                      <div className="font-display text-5xl font-bold text-gradient-gold mb-3">{stat.value}</div>
                      <p className="text-muted-foreground font-medium">{stat.label}</p>
                    </div>
                  </TiltCard>
                </ParallaxSection>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 border-t border-border/30">
          <div className="container">
            <ParallaxSection speed={0.1}>
              <TiltCard tiltMax={5}>
                <Card className="neu-convex border-0 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="grid lg:grid-cols-2 gap-0">
                      <div className="p-10 lg:p-14 flex flex-col justify-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass w-fit mb-6">
                          <Shield className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Secure & Fair</span>
                        </div>
                        <h2 className="font-display text-4xl font-bold mb-5">
                          Ready to Start Your Auction Journey?
                        </h2>
                        <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                          Join CricBid today and experience the most exciting way to build your 
                          cricket dream team. Fair bidding rules ensure everyone gets a chance.
                        </p>
                        <div className="flex flex-wrap gap-4">
                          <Button className="gradient-gold glow-gold neu-flat border-0 px-8 py-6 text-base hover:scale-105 transition-transform" asChild>
                            <Link to={user ? '/auction' : '/auth?mode=signup'}>
                              {user ? 'Go to Auction' : 'Create Account'}
                            </Link>
                          </Button>
                        </div>
                      </div>
                      <div className="hidden lg:flex gradient-gold p-10 lg:p-14 items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute top-10 right-10 w-40 h-40 rounded-full border-2 border-white/30 animate-float" />
                          <div className="absolute bottom-10 left-10 w-24 h-24 rounded-full border-2 border-white/20 animate-float" style={{ animationDelay: '2s' }} />
                        </div>
                        <div className="text-center relative z-10">
                          <TrendingUp className="w-28 h-28 mx-auto mb-6 opacity-90 text-primary-foreground" />
                          <p className="text-xl font-semibold text-primary-foreground">Smart Bidding</p>
                          <p className="opacity-80 text-primary-foreground mt-1">Auto-checks for budget compliance</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TiltCard>
            </ParallaxSection>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-10">
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
