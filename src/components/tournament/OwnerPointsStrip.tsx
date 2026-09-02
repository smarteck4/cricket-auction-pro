import { Owner } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Users } from 'lucide-react';

interface OwnerPointsStripProps {
  owners: Owner[];
  /** Owner id currently holding the highest bid (highlighted). */
  leadingOwnerId?: string | null;
}

/** Broadcast-style purse strip: every team's logo, total and remaining points. */
export function OwnerPointsStrip({ owners, leadingOwnerId }: OwnerPointsStripProps) {
  if (owners.length === 0) return null;

  return (
    <Card className="card-shadow">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-2 px-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Team purses ({owners.length})
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {owners.map((o) => {
            const spent = Math.max(0, o.total_points - o.remaining_points);
            const usedPct = o.total_points > 0 ? (spent / o.total_points) * 100 : 0;
            const leading = o.id === leadingOwnerId;
            return (
              <div
                key={o.id}
                className={`min-w-[190px] flex-1 rounded-xl border p-3 transition-colors ${
                  leading ? 'border-primary bg-primary/10' : 'border-border/50 bg-muted/30'
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  {o.team_logo_url ? (
                    <img
                      src={o.team_logo_url}
                      alt={`${o.team_name} logo`}
                      loading="lazy"
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {o.team_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{o.team_name}</p>
                    {leading && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Leading bid</p>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                    <p className="font-display text-lg font-bold tabular-nums text-gradient-gold">
                      {o.remaining_points.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="text-sm font-semibold tabular-nums">{o.total_points.toLocaleString()}</p>
                  </div>
                </div>

                <Progress value={usedPct} className="mt-2 h-1.5" />
                <p className="mt-1 text-[10px] text-muted-foreground">Spent {spent.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
