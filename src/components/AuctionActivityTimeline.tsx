import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Activity, Gavel, Coins, Trophy, XCircle, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface AuctionEvent {
  id: string;
  event_type: string;
  player_id: string | null;
  owner_id: string | null;
  amount: number | null;
  points_before: number | null;
  points_after: number | null;
  message: string;
  created_at: string;
}

const EVENT_META: Record<
  string,
  { icon: typeof Gavel; label: string; className: string }
> = {
  bid: { icon: Gavel, label: 'Bid', className: 'text-primary' },
  points: { icon: Coins, label: 'Points', className: 'text-amber-400' },
  sold: { icon: Trophy, label: 'Sold', className: 'text-emerald-400' },
  unsold: { icon: XCircle, label: 'Unsold', className: 'text-destructive' },
  started: { icon: Radio, label: 'On block', className: 'text-sky-400' },
};

interface AuctionActivityTimelineProps {
  /** Max entries to keep in view. */
  limit?: number;
  className?: string;
}

/**
 * Live auction activity feed: recent bids, purse/point changes and sale results,
 * streamed in real time from the auction_events table (no page refresh needed).
 */
export function AuctionActivityTimeline({ limit = 40, className }: AuctionActivityTimelineProps) {
  const [events, setEvents] = useState<AuctionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('auction_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (data) setEvents(data as AuctionEvent[]);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('auction-activity-timeline')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auction_events' },
        (payload) => {
          const next = payload.new as AuctionEvent;
          setEvents((prev) => {
            if (prev.some((e) => e.id === next.id)) return prev;
            return [next, ...prev].slice(0, limit);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents, limit]);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base sm:text-lg">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Auction Activity
          </span>
          <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wide">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[280px] pr-2 sm:h-[340px]">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading activity…</p>
          ) : events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity yet. Bids and point changes will appear here instantly.
            </p>
          ) : (
            <ol className="relative space-y-3 border-l border-border/60 pl-4">
              {events.map((event) => {
                const meta = EVENT_META[event.event_type] ?? {
                  icon: Activity,
                  label: event.event_type,
                  className: 'text-muted-foreground',
                };
                const Icon = meta.icon;
                return (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[22px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-1 ring-border">
                      <Icon className={`h-3 w-3 ${meta.className}`} />
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 flex-1 break-words text-sm leading-snug">{event.message}</p>
                      <time
                        className="shrink-0 text-[11px] text-muted-foreground"
                        dateTime={event.created_at}
                        title={new Date(event.created_at).toLocaleString()}
                      >
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </time>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wide ${meta.className}`}>
                      {meta.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
