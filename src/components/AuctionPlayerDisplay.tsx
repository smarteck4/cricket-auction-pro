import { Player, ROLE_LABELS } from '@/lib/types';
import { User, Trophy, Target, Zap, Award, TrendingUp } from 'lucide-react';

interface AuctionPlayerDisplayProps {
  player: Player;
  basePrice: number;
  currentBid: number;
  isActive: boolean;
}

export function AuctionPlayerDisplay({ player, basePrice, currentBid, isActive }: AuctionPlayerDisplayProps) {
  const getCategoryGradient = (category: string) => {
    switch (category) {
      case 'platinum': return 'from-violet-500 to-purple-700';
      case 'gold': return 'from-amber-400 to-amber-600';
      case 'silver': return 'from-slate-400 to-slate-500';
      case 'emerging': return 'from-emerald-400 to-emerald-600';
      default: return 'from-slate-400 to-slate-500';
    }
  };

  const getCategoryAccent = (category: string) => {
    switch (category) {
      case 'platinum': return 'border-violet-400 bg-violet-500/20';
      case 'gold': return 'border-amber-400 bg-amber-500/20';
      case 'silver': return 'border-slate-400 bg-slate-500/20';
      case 'emerging': return 'border-emerald-400 bg-emerald-500/20';
      default: return 'border-slate-400 bg-slate-500/20';
    }
  };

  const battingStats = [
    { label: 'Mat', value: player.total_matches || 0 },
    { label: 'Runs', value: player.total_runs || 0 },
    { label: 'HS', value: player.highest_score || 0 },
    { label: 'SR', value: player.strike_rate ? Number(player.strike_rate).toFixed(1) : '0.0' },
    { label: '50s', value: player.fifties || 0 },
    { label: '100s', value: player.centuries || 0 },
  ];

  const bowlingStats = [
    { label: 'Wkts', value: player.wickets || 0 },
    { label: 'Avg', value: player.bowling_average ? Number(player.bowling_average).toFixed(1) : '-' },
    { label: 'Eco', value: player.economy_rate ? Number(player.economy_rate).toFixed(1) : '-' },
    { label: 'Best', value: player.best_bowling || '-' },
  ];

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl">
      {/* Main Container - Dark premium gradient */}
      <div className="relative bg-gradient-to-br from-[hsl(var(--slate-dark))] via-[#0f1729] to-[hsl(var(--slate-dark))] overflow-hidden">
        
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 -top-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute right-0 top-0 bottom-0 w-[400px] bg-gradient-to-l from-white/[0.02] to-transparent transform skew-x-12" />
          <div className="absolute right-10 top-0 bottom-0 w-48 bg-gradient-to-l from-white/[0.04] to-transparent transform skew-x-12" />
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        {/* Top Bar: LIVE + Category + Base Price */}
        <div className="relative flex items-center justify-between px-4 sm:px-5 pt-4">
          <div className="flex items-center gap-2">
            {isActive && (
              <div className="flex items-center gap-1.5 bg-red-600/90 text-white px-3 py-1 rounded font-bold text-[11px] tracking-[0.15em] uppercase shadow-lg shadow-red-600/30">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
            )}
            <div className={`bg-gradient-to-r ${getCategoryGradient(player.category)} px-3 py-1 rounded text-white font-bold text-[11px] tracking-[0.15em] uppercase shadow-md`}>
              {player.category}
            </div>
          </div>
          {/* Base Price */}
          <div className="relative">
            <div className="bg-gradient-to-b from-red-500 to-red-700 px-5 py-1.5 rounded shadow-lg shadow-red-700/30">
              <p className="text-white/80 text-[8px] font-bold tracking-[0.2em] text-center">BASE PRICE</p>
              <p className="text-white text-2xl font-black text-center font-display leading-tight">{basePrice}</p>
            </div>
          </div>
        </div>

        {/* Main Content: Photo + Info + Bid */}
        <div className="relative px-4 sm:px-5 pt-3 pb-3 flex flex-col sm:flex-row gap-4">
          {/* Left: Photo & Name */}
          <div className="flex items-start gap-3 sm:gap-4 flex-1">
            {/* Player Photo */}
            <div className="relative flex-shrink-0">
              <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-xl border-2 ${getCategoryAccent(player.category)} overflow-hidden shadow-2xl`}>
                {player.profile_picture_url ? (
                  <img src={player.profile_picture_url} alt={player.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
                    <User className="w-10 h-10 sm:w-14 sm:h-14 text-white/40" />
                  </div>
                )}
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-primary/10 blur-xl -z-10 scale-125" />
            </div>

            {/* Name + Bio */}
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-black text-white tracking-wide uppercase truncate drop-shadow-lg">
                {player.name}
              </h2>
              
              {/* Bio Tags */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 bg-white/[0.07] backdrop-blur-sm text-white/80 px-2.5 py-1 rounded text-[11px] font-semibold border border-white/[0.06]">
                  {ROLE_LABELS[player.player_role]}
                </span>
                <span className="inline-flex items-center gap-1 bg-white/[0.07] backdrop-blur-sm text-white/80 px-2.5 py-1 rounded text-[11px] font-semibold border border-white/[0.06]">
                  {player.batting_hand === 'right' ? 'RHB' : 'LHB'}
                </span>
                <span className="inline-flex items-center gap-1 bg-white/[0.07] backdrop-blur-sm text-white/80 px-2.5 py-1 rounded text-[11px] font-semibold border border-white/[0.06]">
                  Age {player.age}
                </span>
                <span className="inline-flex items-center gap-1 bg-white/[0.07] backdrop-blur-sm text-white/80 px-2.5 py-1 rounded text-[11px] font-semibold border border-white/[0.06]">
                  🏳️ {player.nationality}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Current Bid */}
          <div className="flex-shrink-0 self-center sm:self-end">
            <div className="relative">
              <div className="bg-white/[0.95] backdrop-blur px-5 sm:px-7 py-3 sm:py-4 rounded-xl shadow-2xl shadow-black/30">
                <p className="text-blue-700 text-[9px] sm:text-[10px] font-black tracking-[0.2em] mb-0.5">CURRENT BID</p>
                <p className="text-blue-900 text-3xl sm:text-4xl md:text-5xl font-black font-display leading-none">
                  {currentBid.toLocaleString()}
                </p>
              </div>
              {/* Gold accent */}
              <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-10 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full shadow-lg shadow-amber-400/30" />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 sm:mx-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Career Stats Grid - Batting */}
        <div className="relative px-4 sm:px-5 pt-3 pb-1">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3 h-3 text-primary/70" />
            <span className="text-[9px] font-bold text-white/30 tracking-[0.2em] uppercase">Batting Career</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {battingStats.map((stat) => (
              <div key={stat.label} className="text-center bg-white/[0.04] rounded-lg py-1.5 px-1 border border-white/[0.04]">
                <p className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">{stat.label}</p>
                <p className="text-sm sm:text-base font-black text-white leading-tight">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Career Stats Grid - Bowling */}
        <div className="relative px-4 sm:px-5 pt-2 pb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3 h-3 text-destructive/60" />
            <span className="text-[9px] font-bold text-white/30 tracking-[0.2em] uppercase">Bowling Career</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {bowlingStats.map((stat) => (
              <div key={stat.label} className="text-center bg-white/[0.04] rounded-lg py-1.5 px-1 border border-white/[0.04]">
                <p className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">{stat.label}</p>
                <p className="text-sm sm:text-base font-black text-white leading-tight">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="h-1 bg-gradient-to-r from-primary/60 via-amber-400/60 to-primary/60" />
      </div>
    </div>
  );
}
