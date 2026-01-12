export type AppRole = 'spectator' | 'admin' | 'owner';
export type PlayerCategory = 'platinum' | 'gold' | 'silver' | 'emerging';
export type PlayerRole = 'batsman' | 'bowler' | 'all_rounder' | 'wicket_keeper';
export type BattingHand = 'left' | 'right';
export type AuctionStatus = 'pending' | 'active' | 'sold' | 'unsold';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Owner {
  id: string;
  user_id: string | null;
  team_name: string;
  team_logo_url: string | null;
  total_points: number;
  remaining_points: number;
  created_at: string;
  updated_at: string;
}

export interface CategorySetting {
  id: string;
  category: PlayerCategory;
  base_price: number;
  min_required: number;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  nationality: string;
  profile_picture_url: string | null;
  category: PlayerCategory;
  player_role: PlayerRole;
  batting_hand: BattingHand;
  total_matches: number;
  total_runs: number;
  highest_score: number;
  strike_rate: number;
  wickets: number;
  bowling_average: number;
  economy_rate: number;
  best_bowling: string | null;
  auction_status: AuctionStatus;
  base_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface CurrentAuction {
  id: string;
  player_id: string | null;
  current_bid: number;
  current_bidder_id: string | null;
  is_active: boolean;
  started_at: string | null;
  timer_duration: number;
  timer_started_at: string | null;
  created_at: string;
  updated_at: string;
  player?: Player;
  current_bidder?: Owner;
}

export interface Bid {
  id: string;
  player_id: string;
  owner_id: string;
  bid_amount: number;
  created_at: string;
}

export interface TeamPlayer {
  id: string;
  owner_id: string;
  player_id: string;
  bought_price: number;
  created_at: string;
  player?: Player;
}

export const CATEGORY_COLORS = {
  platinum: {
    bg: 'bg-category-platinum-bg',
    text: 'text-category-platinum',
    border: 'border-category-platinum',
  },
  gold: {
    bg: 'bg-category-gold-bg',
    text: 'text-category-gold',
    border: 'border-category-gold',
  },
  silver: {
    bg: 'bg-category-silver-bg',
    text: 'text-category-silver',
    border: 'border-category-silver',
  },
  emerging: {
    bg: 'bg-category-emerging-bg',
    text: 'text-category-emerging',
    border: 'border-category-emerging',
  },
} as const;

export const ROLE_LABELS: Record<PlayerRole, string> = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  all_rounder: 'All-Rounder',
  wicket_keeper: 'Wicket Keeper',
};

export const CATEGORY_LABELS: Record<PlayerCategory, string> = {
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  emerging: 'Emerging',
};

export const MIN_TEAM_REQUIREMENTS = {
  total: 15,
  platinum: 2,
  gold: 4,
  silver: 3,
  emerging: 2,
};
