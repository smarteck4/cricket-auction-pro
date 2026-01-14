import { Player, Owner, CurrentAuction, ROLE_LABELS } from '@/lib/types';
import { User, Users, Minimize2, Timer } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface FullscreenAuctionProps {
  player: Player;
  auction: CurrentAuction;
  currentBidder: Owner | null;
  timeRemaining: number;
  onExit: () => void;
}

export function FullscreenAuction({ 
  player, 
  auction, 
  currentBidder, 
  timeRemaining, 
  onExit 
}: FullscreenAuctionProps) {
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

  const getTimerColor = () => {
    if (timeRemaining <= 5) return 'text-red-500';
    if (timeRemaining <= 10) return 'text-amber-400';
    return 'text-white';
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-700/20 via-transparent to-transparent" />
        <div className="absolute -right-40 top-0 bottom-0 w-[500px] bg-gradient-to-l from-white/5 to-transparent transform skew-x-12" />
        <div className="absolute -right-20 top-0 bottom-0 w-64 bg-gradient-to-l from-white/10 to-transparent transform skew-x-12" />
        {/* Animated grid lines */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
          <div className="absolute top-2/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
          <div className="absolute top-3/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        </div>
      </div>

      {/* Exit Button */}
      <button
        onClick={onExit}
        className="absolute top-6 right-6 z-20 p-3 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg transition-colors"
      >
        <Minimize2 className="w-6 h-6 text-white" />
      </button>

      {/* LIVE Indicator */}
      {auction.is_active && (
        <div className="absolute top-6 left-6 z-20">
          <div className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-md font-bold text-lg tracking-wider shadow-lg">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative h-full flex flex-col p-8">
        {/* Top Section - Base Price & Timer */}
        <div className="flex items-start justify-between mb-8">
          {/* Base Price Banner */}
          <div className="flex-1 flex justify-center">
            <div className="relative">
              <div className="bg-gradient-to-b from-red-500 to-red-700 px-10 py-4 shadow-2xl">
                <p className="text-white/90 text-sm font-semibold tracking-widest text-center mb-1">BASE POINTS</p>
                <p className="text-white text-6xl font-bold text-center font-display">
                  {player.base_price || 100}
                </p>
              </div>
              <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[20px] border-r-[20px] border-t-[12px] border-l-transparent border-r-transparent border-t-red-800" />
            </div>
          </div>
        </div>

        {/* Timer Section */}
        {auction.timer_started_at && (
          <div className="mb-8 max-w-2xl mx-auto w-full">
            <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Timer className={`w-8 h-8 ${getTimerColor()} ${timeRemaining <= 5 ? 'animate-pulse' : ''}`} />
                  <span className="text-white/80 text-lg font-medium">Time Remaining</span>
                </div>
                <span className={`font-display text-5xl font-bold ${getTimerColor()} ${timeRemaining <= 5 ? 'animate-pulse' : ''}`}>
                  {timeRemaining}s
                </span>
              </div>
              <Progress 
                value={(timeRemaining / auction.timer_duration) * 100} 
                className={`h-4 ${timeRemaining <= 5 ? '[&>div]:bg-red-500' : timeRemaining <= 10 ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
              />
            </div>
          </div>
        )}

        {/* Player Name - Large Display */}
        <div className="text-center mb-8">
          <h1 className="font-display text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-wider drop-shadow-2xl uppercase">
            {player.name}
          </h1>
          <p className="text-white/60 text-xl mt-2">{player.nationality}</p>
        </div>

        {/* Center Content - Photo, Stats, Bid */}
        <div className="flex-1 flex items-center justify-center gap-16">
          {/* Left - Player Photo & Stats */}
          <div className="flex items-center gap-8">
            {/* Player Photo */}
            <div className="relative">
              <div className="w-48 h-48 md:w-56 md:h-56 rounded-full border-8 border-white/30 overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 shadow-2xl">
                {player.profile_picture_url ? (
                  <img
                    src={player.profile_picture_url}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-24 h-24 text-white/70" />
                  </div>
                )}
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-2xl -z-10 scale-110" />
            </div>

            {/* Player Stats */}
            <div className="space-y-3">
              <div className="bg-slate-800/90 backdrop-blur px-8 py-3 rounded-md border-l-4 border-blue-400 shadow-lg">
                <span className="text-white font-semibold text-xl">
                  {player.batting_hand === 'right' ? 'Right' : 'Left'}-Hand
                </span>
              </div>
              
              <div className="bg-slate-800/90 backdrop-blur px-8 py-3 rounded-md border-l-4 border-blue-400 shadow-lg">
                <span className="text-white font-semibold text-xl">
                  {ROLE_LABELS[player.player_role]}
                </span>
              </div>
              
              <div className="bg-slate-800/90 backdrop-blur px-8 py-3 rounded-md border-l-4 border-blue-400 shadow-lg">
                <span className="text-white font-semibold text-xl">
                  {player.age} years old
                </span>
              </div>

              <div className={`bg-gradient-to-r ${getCategoryColor(player.category)} px-8 py-3 rounded-md shadow-lg`}>
                <span className="text-white font-bold text-xl tracking-wider uppercase">
                  {getCategoryLabel(player.category)}
                </span>
              </div>
            </div>
          </div>

          {/* Right - Current Bid & Bidder */}
          <div className="flex flex-col items-center gap-6">
            {/* Current Bid Display */}
            <div className="relative">
              <div className="bg-gradient-to-br from-white to-gray-100 px-12 py-8 rounded-2xl shadow-2xl transform skew-x-[-3deg]">
                <div className="transform skew-x-[3deg] text-center">
                  <p className="text-blue-600 text-lg font-bold tracking-widest mb-2">CURRENT BID</p>
                  <p className="text-blue-800 text-7xl md:text-8xl font-bold font-display">
                    {auction.current_bid}
                  </p>
                </div>
              </div>
              {/* Decorative accent */}
              <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-2 h-24 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
              {/* Glow */}
              <div className="absolute inset-0 bg-amber-400/20 blur-3xl -z-10 scale-110" />
            </div>

            {/* Current Bidder */}
            {currentBidder && (
              <div className="bg-slate-900/70 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <p className="text-white/60 text-sm font-medium tracking-wider mb-3 text-center">LEADING BIDDER</p>
                <div className="flex items-center gap-4">
                  {currentBidder.team_logo_url ? (
                    <img
                      src={currentBidder.team_logo_url}
                      alt={currentBidder.team_name}
                      className="w-16 h-16 rounded-xl object-cover ring-4 ring-amber-400/50 shadow-lg animate-pulse"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center ring-4 ring-amber-400/50 shadow-lg animate-pulse">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                  )}
                  <span className="font-display font-bold text-2xl text-white">{currentBidder.team_name}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Stats Bar */}
        <div className="mt-auto">
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <div className="grid grid-cols-6 gap-4 text-center">
              <div>
                <p className="text-white/50 text-sm mb-1">Matches</p>
                <p className="font-display text-3xl font-bold text-white">{player.total_matches || 0}</p>
              </div>
              <div>
                <p className="text-white/50 text-sm mb-1">Runs</p>
                <p className="font-display text-3xl font-bold text-white">{player.total_runs || 0}</p>
              </div>
              <div>
                <p className="text-white/50 text-sm mb-1">Highest</p>
                <p className="font-display text-3xl font-bold text-white">{player.highest_score || 0}</p>
              </div>
              <div>
                <p className="text-white/50 text-sm mb-1">Strike Rate</p>
                <p className="font-display text-3xl font-bold text-white">{player.strike_rate || 0}</p>
              </div>
              <div>
                <p className="text-white/50 text-sm mb-1">Wickets</p>
                <p className="font-display text-3xl font-bold text-white">{player.wickets || 0}</p>
              </div>
              <div>
                <p className="text-white/50 text-sm mb-1">Economy</p>
                <p className="font-display text-3xl font-bold text-white">{player.economy_rate || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom decorative line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
    </div>
  );
}
