import { Player, ROLE_LABELS } from '@/lib/types';
import { User } from 'lucide-react';

interface AuctionPlayerDisplayProps {
  player: Player;
  basePrice: number;
  currentBid: number;
  isActive: boolean;
}

export function AuctionPlayerDisplay({ player, basePrice, currentBid, isActive }: AuctionPlayerDisplayProps) {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'platinum':
        return 'from-purple-500 to-purple-700';
      case 'gold':
        return 'from-amber-400 to-amber-600';
      case 'silver':
        return 'from-slate-400 to-slate-500';
      case 'emerging':
        return 'from-emerald-400 to-emerald-600';
      default:
        return 'from-slate-400 to-slate-500';
    }
  };

  const getCategoryLabel = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-1">
      {/* Inner container with broadcast-style layout */}
      <div className="relative rounded-lg bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 overflow-hidden min-h-[320px]">
        
        {/* Decorative diagonal lines */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 top-0 bottom-0 w-96 bg-gradient-to-l from-white/5 to-transparent transform skew-x-12" />
          <div className="absolute -right-10 top-0 bottom-0 w-32 bg-gradient-to-l from-white/10 to-transparent transform skew-x-12" />
        </div>

        {/* LIVE indicator */}
        {isActive && (
          <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
            <div className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1 rounded-sm font-bold text-sm tracking-wider">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          </div>
        )}

        {/* BASE POINTS Banner - top center */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="relative">
            <div className="bg-gradient-to-b from-red-500 to-red-700 px-6 py-2 clip-banner shadow-lg">
              <p className="text-white/90 text-xs font-semibold tracking-wider text-center">BASE POINTS</p>
              <p className="text-white text-3xl font-bold text-center font-display">{basePrice}</p>
            </div>
            {/* Banner tail */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-800" />
          </div>
        </div>

        {/* Player Name - prominent display */}
        <div className="absolute top-24 left-6 z-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-wide drop-shadow-lg uppercase">
            {player.name}
          </h2>
        </div>

        {/* Main content area */}
        <div className="pt-36 px-6 pb-6 flex flex-col md:flex-row items-end justify-between gap-6">
          {/* Left side - Player photo and stats */}
          <div className="flex items-end gap-4">
            {/* Player Photo */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-white/30 overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 shadow-xl">
                {player.profile_picture_url ? (
                  <img
                    src={player.profile_picture_url}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-white/70" />
                  </div>
                )}
              </div>
            </div>

            {/* Player Stats Box */}
            <div className="space-y-1">
              {/* Batting Hand */}
              <div className="bg-slate-800/90 backdrop-blur px-4 py-1.5 rounded-sm border-l-4 border-blue-400">
                <span className="text-white font-semibold text-sm">
                  {player.batting_hand === 'right' ? 'Right' : 'Left'}-Hand
                </span>
              </div>
              
              {/* Role */}
              <div className="bg-slate-800/90 backdrop-blur px-4 py-1.5 rounded-sm border-l-4 border-blue-400">
                <span className="text-white font-semibold text-sm">
                  {ROLE_LABELS[player.player_role]}
                </span>
              </div>
              
              {/* Age */}
              <div className="bg-slate-800/90 backdrop-blur px-4 py-1.5 rounded-sm border-l-4 border-blue-400">
                <span className="text-white font-semibold text-sm">
                  {player.age} years old
                </span>
              </div>

              {/* Category Badge */}
              <div className={`bg-gradient-to-r ${getCategoryColor(player.category)} px-4 py-1.5 rounded-sm`}>
                <span className="text-white font-bold text-sm tracking-wider uppercase">
                  {getCategoryLabel(player.category)}
                </span>
              </div>
            </div>
          </div>

          {/* Right side - Current Bid Display */}
          <div className="relative">
            <div className="bg-gradient-to-br from-white/95 to-white/90 backdrop-blur px-6 py-4 rounded-lg shadow-xl transform skew-x-[-3deg]">
              <div className="transform skew-x-[3deg]">
                <p className="text-blue-600 text-xs font-bold tracking-wider mb-1">CURRENT BID</p>
                <p className="text-blue-800 text-4xl md:text-5xl font-bold font-display">
                  {currentBid}
                </p>
              </div>
            </div>
            {/* Decorative accent */}
            <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-1 h-12 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
          </div>
        </div>

        {/* Bottom decorative line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>
    </div>
  );
}
