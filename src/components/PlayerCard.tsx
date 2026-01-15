import { Player, ROLE_LABELS } from '@/lib/types';
import { CategoryBadge } from './CategoryBadge';
import { Card, CardContent } from '@/components/ui/card';
import { User, Target, TrendingUp, Flame } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  showStats?: boolean;
}

export function PlayerCard({ player, onClick, showStats = true }: PlayerCardProps) {
  const isBowler = player.player_role === 'bowler' || player.player_role === 'all_rounder';
  const isBatsman = player.player_role === 'batsman' || player.player_role === 'all_rounder' || player.player_role === 'wicket_keeper';

  return (
    <Card 
      className="overflow-hidden card-shadow hover:card-shadow-lg transition-all duration-300 cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="relative">
          {player.profile_picture_url ? (
            <img
              src={player.profile_picture_url}
              alt={player.name}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-48 bg-muted flex items-center justify-center">
              <User className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <CategoryBadge category={player.category} />
          </div>
        </div>
        
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-display text-lg font-semibold truncate">{player.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{player.nationality}</span>
              <span>•</span>
              <span>{player.age} yrs</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{ROLE_LABELS[player.player_role]}</span>
            <span className="text-muted-foreground capitalize">{player.batting_hand} Hand</span>
          </div>

          {showStats && (
            <>
              {/* Batting Stats */}
              {isBatsman && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Batting
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Matches</p>
                      <p className="font-semibold text-sm">{player.total_matches}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Runs</p>
                      <p className="font-semibold text-sm">{player.total_runs}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">SR</p>
                      <p className="font-semibold text-sm">{player.strike_rate}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bowling Stats */}
              {isBowler && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Flame className="w-3 h-3" /> Bowling
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Wickets</p>
                      <p className="font-semibold text-sm">{player.wickets}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Best</p>
                      <p className="font-semibold text-sm">{player.best_bowling || '-'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Econ</p>
                      <p className="font-semibold text-sm">{player.economy_rate}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Show basic stats for non-specific roles */}
              {!isBatsman && !isBowler && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Matches</p>
                    <p className="font-semibold">{player.total_matches}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Runs</p>
                    <p className="font-semibold">{player.total_runs}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Wickets</p>
                    <p className="font-semibold">{player.wickets}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {player.base_price && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Base Price</span>
                <span className="font-display font-bold text-primary">{player.base_price} pts</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
