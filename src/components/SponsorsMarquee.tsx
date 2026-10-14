import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Sponsor {
  id: string;
  name: string;
  logo_url: string;
  sort_order: number;
}

export function useSponsors() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const load = async () => {
    const { data } = await supabase.from('sponsors').select('*').order('sort_order').order('created_at');
    setSponsors((data as Sponsor[]) || []);
  };
  useEffect(() => {
    load();
    const ch = supabase
      .channel('sponsors-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);
  return { sponsors, reload: load };
}

/** Continuously scrolling row of sponsor logos shown on the live auction screen. */
export function SponsorsMarquee({ className = '' }: { className?: string }) {
  const { sponsors } = useSponsors();
  if (sponsors.length === 0) return null;
  // Repeat so the strip is always wider than the screen, then duplicate for a seamless loop.
  const base = Array.from({ length: Math.max(1, Math.ceil(8 / sponsors.length)) }, () => sponsors).flat();
  const loop = [...base, ...base];
  const duration = Math.max(20, base.length * 4);

  return (
    <div className={`group relative overflow-hidden rounded-xl border border-border/50 bg-card/60 backdrop-blur py-2 ${className}`}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-card to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-card to-transparent" />
      <div
        className="flex w-max items-center gap-6 sm:gap-10 animate-sponsor-marquee group-hover:[animation-play-state:paused]"
        style={{ animationDuration: `${duration}s` }}
      >
        {loop.map((s, i) => (
          <div key={`${s.id}-${i}`} className="flex shrink-0 items-center gap-2 px-2">
            <img src={s.logo_url} alt={s.name} loading="lazy" className="h-8 sm:h-10 w-auto max-w-[120px] object-contain" />
            <span className="hidden sm:inline text-xs font-semibold text-muted-foreground whitespace-nowrap">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
