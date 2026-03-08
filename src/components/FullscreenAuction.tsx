import { Player, Owner, CurrentAuction, ROLE_LABELS } from '@/lib/types';
import { User, Users, Minimize2, Timer, TrendingUp, Target } from 'lucide-react';
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
  const getCategoryGradient = (category: string) => {
    switch (category) {
      case 'platinum': return 'from-violet-500 to-purple-700';
      case 'gold': return 'from-amber-400 to-amber-600';
      case 'silver': return 'from-slate-400 to-slate-500';
      case 'emerging': return 'from-emerald-400 to-emerald-600';
      default: return 'from-slate-400 to-slate-500';
    }
  };

  const getTimerColor = () => {
    if (timeRemaining <= 5) return 'text-red-500';
    if (timeRemaining <= 10) return 'text-amber-400';
    return 'text-white';
  };

  const battingStats = [
    { label: 'Matches', value: player.total_matches || 0 },
    { label: 'Runs', value: player.total_runs || 0 },
    { label: 'Highest', value: player.highest_score || 0 },
    { label: 'Strike Rate', value: player.strike_rate ? Number(player.strike_rate).toFixed(1) : '0.0' },
    { label: 'Fifties', value: player.fifties || 0 },
    { label: 'Centuries', value: player.centuries || 0 },
  ];

  const bowlingStats = [
    { label: 'Wickets', value: player.wickets || 0 },
    { label: 'Average', value: player.bowling_average ? Number(player.bowling_average).toFixed(1) : '-' },
    { label: 'Economy', value: player.economy_rate ? Number(player.economy_rate).toFixed(1) : '-' },
    { label: 'Best', value: player.best_bowling || '-' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#060d1e] overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,_rgba(59,130,246,0.12),_transparent)]" />
        <div className="absolute -right-60 top-0 bottom-0 w-[600px] bg-gradient-to-l from-white/[0.02] to-transparent transform skew-x-12" />
        <div className="absolute -right-30 top-0 bottom-0 w-80 bg-gradient-to-l from-white/[0.04] to-transparent transform skew-x-12" />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* Animated glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/[0.03] rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Exit Button */}
      <button
        onClick={onExit}
        className="absolute top-6 right-6 z-20 p-3 bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl transition-all border border-white/5"
      >
        <Minimize2 className="w-6 h-6 text-white/60" />
      </button>

      {/* LIVE Indicator */}
      {auction.is_active && (
        <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
          <div className="flex items-center gap-2 bg-red-600/90 text-white px-5 py-2 rounded-lg font-bold text-base tracking-[0.15em] shadow-2xl shadow-red-600/30 border border-red-500/30">
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            LIVE AUCTION
          </div>
          <div className={`bg-gradient-to-r ${getCategoryGradient(player.category)} px-4 py-2 rounded-lg text-white font-bold text-sm tracking-[0.1em] uppercase shadow-lg`}>
            {player.category}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative h-full flex flex-col p-6 lg:p-8">
        {/* Top: Base Price Banner */}
        <div className="flex justify-center mt-14 mb-6">
          <div className="relative">
            <div className="bg-gradient-to-b from-red-500 to-red-700 px-10 py-3 rounded-lg shadow-2xl shadow-red-700/30 border border-red-400/20">
              <p className="text-white/80 text-xs font-bold tracking-[0.25em] text-center">BASE PRICE</p>
              <p className="text-white text-5xl lg:text-6xl font-black text-center font-display leading-tight">
                {player.base_price || 100}
              </p>
            </div>
          </div>
        </div>

        {/* Timer */}
        {auction.timer_started_at && (
          <div className="mb-6 max-w-2xl mx-auto w-full">
            <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Timer className={`w-7 h-7 ${getTimerColor()} ${timeRemaining <= 5 ? 'animate-pulse' : ''}`} />
                  <span className="text-white/50 text-base font-medium tracking-wide">TIME REMAINING</span>
                </div>
                <span className={`font-display text-5xl font-black ${getTimerColor()} ${timeRemaining <= 5 ? 'animate-pulse' : ''}`}>
                  {timeRemaining}s
                </span>
              </div>
              <Progress 
                value={(timeRemaining / auction.timer_duration) * 100} 
                className={`h-3 rounded-full ${timeRemaining <= 5 ? '[&>div]:bg-red-500' : timeRemaining <= 10 ? '[&>div]:bg-amber-500' : '[&>div]:bg-primary'}`}
              />
            </div>
          </div>
        )}

        {/* Center Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16 max-w-6xl w-full">
            
            {/* Left: Player Photo + Identity */}
            <div className="flex flex-col items-center gap-5 lg:min-w-[300px]">
              {/* Photo */}
              <div className="relative">
                <div className="w-44 h-44 lg:w-56 lg:h-56 rounded-2xl border-3 border-white/10 overflow-hidden shadow-2xl shadow-black/50 bg-gradient-to-br from-slate-700 to-slate-900">
                  {player.profile_picture_url ? (
                    <img src={player.profile_picture_url} alt={player.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-20 h-20 text-white/20" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-3xl -z-10 scale-125" />
              </div>

              {/* Name */}
              <div className="text-center">
                <h1 className="font-display text-4xl lg:text-5xl xl:text-6xl font-black text-white tracking-wider drop-shadow-2xl uppercase">
                  {player.name}
                </h1>
                <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
                  {[
                    ROLE_LABELS[player.player_role],
                    player.batting_hand === 'right' ? 'Right-Hand Bat' : 'Left-Hand Bat',
                    `Age ${player.age}`,
                    player.nationality,
                  ].map((tag) => (
                    <span key={tag} className="bg-white/[0.06] text-white/60 px-3 py-1 rounded-lg text-sm font-medium border border-white/[0.05]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Bid + Bidder */}
            <div className="flex flex-col items-center gap-6">
              {/* Current Bid */}
              <div className="relative">
                <div className="bg-white/[0.95] backdrop-blur px-10 lg:px-14 py-6 lg:py-8 rounded-2xl shadow-2xl shadow-black/40">
                  <p className="text-blue-700 text-sm lg:text-base font-black tracking-[0.25em] mb-1 text-center">CURRENT BID</p>
                  <p className="text-blue-900 text-6xl lg:text-7xl xl:text-8xl font-black font-display text-center leading-none">
                    {auction.current_bid.toLocaleString()}
                  </p>
                </div>
                <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-20 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full shadow-lg shadow-amber-400/40" />
                <div className="absolute inset-0 bg-amber-400/10 blur-3xl -z-10 scale-110 rounded-2xl" />
              </div>

              {/* Current Bidder */}
              {currentBidder && (
                <div className="bg-white/[0.04] backdrop-blur-sm rounded-xl p-5 border border-white/[0.06] min-w-[280px]">
                  <p className="text-white/30 text-[10px] font-bold tracking-[0.25em] mb-3 text-center uppercase">Leading Bidder</p>
                  <div className="flex items-center justify-center gap-4">
                    {currentBidder.team_logo_url ? (
                      <img
                        src={currentBidder.team_logo_url}
                        alt={currentBidder.team_name}
                        className="w-14 h-14 rounded-xl object-cover ring-3 ring-amber-400/40 shadow-lg animate-pulse"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center ring-3 ring-amber-400/40 shadow-lg animate-pulse">
                        <Users className="w-7 h-7 text-white" />
                      </div>
                    )}
                    <span className="font-display font-bold text-2xl text-white">{currentBidder.team_name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: Full Career Stats */}
        <div className="mt-auto">
          <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl p-5 lg:p-6 border border-white/[0.06] max-w-5xl mx-auto w-full">
            {/* Batting */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary/60" />
                <span className="text-[10px] font-bold text-white/25 tracking-[0.2em] uppercase">Batting Career</span>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {battingStats.map((stat) => (
                  <div key={stat.label} className="text-center bg-white/[0.03] rounded-xl py-3 px-2 border border-white/[0.04]">
                    <p className="text-white/35 text-xs font-semibold mb-1 tracking-wide">{stat.label}</p>
                    <p className="font-display text-2xl lg:text-3xl font-black text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bowling */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-destructive/50" />
                <span className="text-[10px] font-bold text-white/25 tracking-[0.2em] uppercase">Bowling Career</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {bowlingStats.map((stat) => (
                  <div key={stat.label} className="text-center bg-white/[0.03] rounded-xl py-3 px-2 border border-white/[0.04]">
                    <p className="text-white/35 text-xs font-semibold mb-1 tracking-wide">{stat.label}</p>
                    <p className="font-display text-2xl lg:text-3xl font-black text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 via-amber-400/70 to-primary/50" />
    </div>
  );
}
