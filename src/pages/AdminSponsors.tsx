import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { SponsorsManager } from '@/components/SponsorsManager';
import { SponsorsMarquee } from '@/components/SponsorsMarquee';
import { ArrowLeft } from 'lucide-react';

export default function AdminSponsors() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-3xl px-3 py-6 sm:px-6 sm:py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Sponsors</h1>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1.5" />Admin Panel</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Sponsors added here scroll automatically on the Live Auction screen.</p>
        <SponsorsMarquee />
        <SponsorsManager className="card-shadow" />
      </main>
    </div>
  );
}
