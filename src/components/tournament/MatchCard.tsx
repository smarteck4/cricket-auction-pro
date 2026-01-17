import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Match, STATUS_COLORS } from '@/lib/tournament-types';
import { Owner } from '@/lib/types';
import { format } from 'date-fns';
import { Calendar, MapPin } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  team1?: Owner;
  team2?: Owner;
  onClick?: () => void;
}

export function MatchCard({ match, team1, team2, onClick }: MatchCardProps) {
  const statusColors = STATUS_COLORS[match.status];

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        match.status === 'live' ? 'ring-2 ring-green-500 animate-pulse-slow' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Badge className={`${statusColors.bg} ${statusColors.text}`}>
            {match.status === 'live' ? '🔴 LIVE' : match.status.toUpperCase()}
          </Badge>
          <span className="text-sm text-muted-foreground">{match.format}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Team 1 */}
          <div className="flex-1 text-center">
            <Avatar className="h-12 w-12 mx-auto mb-2">
              <AvatarImage src={team1?.team_logo_url || ''} />
              <AvatarFallback>{team1?.team_name?.slice(0, 2).toUpperCase() || 'T1'}</AvatarFallback>
            </Avatar>
            <p className="font-medium text-sm truncate">{team1?.team_name || 'TBD'}</p>
          </div>

          <div className="text-2xl font-bold text-muted-foreground">vs</div>

          {/* Team 2 */}
          <div className="flex-1 text-center">
            <Avatar className="h-12 w-12 mx-auto mb-2">
              <AvatarImage src={team2?.team_logo_url || ''} />
              <AvatarFallback>{team2?.team_name?.slice(0, 2).toUpperCase() || 'T2'}</AvatarFallback>
            </Avatar>
            <p className="font-medium text-sm truncate">{team2?.team_name || 'TBD'}</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(match.match_date), 'PPp')}
          </div>
          {match.venue && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {match.venue.name}, {match.venue.city}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
