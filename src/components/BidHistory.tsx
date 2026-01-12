import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bid, Owner } from '@/lib/types';
import { History, TrendingUp, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BidWithOwner extends Bid {
  owner?: Owner;
}

interface BidHistoryProps {
  playerId: string | null;
  owners: Owner[];
}

export function BidHistory({ playerId, owners }: BidHistoryProps) {
  const [bids, setBids] = useState<BidWithOwner[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBids = async () => {
    if (!playerId) {
      setBids([]);
      return;
    }
    
    setLoading(true);
    const { data } = await supabase
      .from('bids')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    
    if (data) {
      const bidsWithOwners = data.map(bid => ({
        ...bid,
        owner: owners.find(o => o.id === bid.owner_id)
      }));
      setBids(bidsWithOwners as BidWithOwner[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBids();
  }, [playerId, owners]);

  // Real-time subscription for new bids
  useEffect(() => {
    if (!playerId) return;

    const channel = supabase
      .channel('bid-history')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'bids',
          filter: `player_id=eq.${playerId}`
        },
        (payload) => {
          const newBid = payload.new as Bid;
          const bidWithOwner: BidWithOwner = {
            ...newBid,
            owner: owners.find(o => o.id === newBid.owner_id)
          };
          setBids(prev => [bidWithOwner, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, owners]);

  if (!playerId) {
    return null;
  }

  return (
    <Card className="card-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="font-display flex items-center gap-2 text-base">
          <History className="w-4 h-4" />
          Bid History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
        ) : bids.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No bids yet. Be the first!
          </div>
        ) : (
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-3">
              {bids.map((bid, index) => (
                <div 
                  key={bid.id} 
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    index === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                  }`}
                >
                  {bid.owner?.team_logo_url ? (
                    <img
                      src={bid.owner.team_logo_url}
                      alt={bid.owner.team_name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {bid.owner?.team_name || 'Unknown'}
                      </span>
                      {index === 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                          Highest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3" />
                      <span className="font-semibold text-foreground">
                        {bid.bid_amount.toLocaleString()} pts
                      </span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(bid.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        {bids.length > 0 && (
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>Total bids: {bids.length}</span>
            <span>
              Started at: {bids.length > 0 && bids[bids.length - 1].created_at 
                ? new Date(bids[bids.length - 1].created_at).toLocaleTimeString()
                : '-'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}