import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TournamentPoints } from '@/lib/tournament-types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PointsTableProps {
  points: TournamentPoints[];
}

export function PointsTable({ points }: PointsTableProps) {
  const sortedPoints = [...points].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.net_run_rate - a.net_run_rate;
  });

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-center">P</TableHead>
            <TableHead className="text-center">W</TableHead>
            <TableHead className="text-center">L</TableHead>
            <TableHead className="text-center">D</TableHead>
            <TableHead className="text-center">NR</TableHead>
            <TableHead className="text-center">Pts</TableHead>
            <TableHead className="text-center">NRR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPoints.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No teams in points table yet
              </TableCell>
            </TableRow>
          ) : (
            sortedPoints.map((entry, index) => (
              <TableRow key={entry.id} className={index < 4 ? 'bg-green-500/5' : ''}>
                <TableCell className="text-center font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={entry.team?.team_logo_url || ''} />
                      <AvatarFallback className="text-xs">
                        {entry.team?.team_name?.slice(0, 2).toUpperCase() || 'TM'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{entry.team?.team_name || 'Unknown'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">{entry.matches_played}</TableCell>
                <TableCell className="text-center text-green-600 font-medium">{entry.wins}</TableCell>
                <TableCell className="text-center text-red-500">{entry.losses}</TableCell>
                <TableCell className="text-center">{entry.draws}</TableCell>
                <TableCell className="text-center">{entry.no_results}</TableCell>
                <TableCell className="text-center font-bold text-primary">{entry.points}</TableCell>
                <TableCell className="text-center font-mono text-sm">
                  {entry.net_run_rate >= 0 ? '+' : ''}
                  {entry.net_run_rate.toFixed(3)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
