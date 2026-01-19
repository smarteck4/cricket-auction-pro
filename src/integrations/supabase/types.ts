export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bids: {
        Row: {
          bid_amount: number
          created_at: string | null
          id: string
          owner_id: string
          player_id: string
        }
        Insert: {
          bid_amount: number
          created_at?: string | null
          id?: string
          owner_id: string
          player_id: string
        }
        Update: {
          bid_amount?: number
          created_at?: string | null
          id?: string
          owner_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      category_settings: {
        Row: {
          base_price: number
          category: Database["public"]["Enums"]["player_category"]
          created_at: string | null
          id: string
          min_required: number
          updated_at: string | null
        }
        Insert: {
          base_price?: number
          category: Database["public"]["Enums"]["player_category"]
          created_at?: string | null
          id?: string
          min_required?: number
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          category?: Database["public"]["Enums"]["player_category"]
          created_at?: string | null
          id?: string
          min_required?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      current_auction: {
        Row: {
          created_at: string | null
          current_bid: number
          current_bidder_id: string | null
          id: string
          is_active: boolean | null
          player_id: string | null
          started_at: string | null
          timer_duration: number
          timer_started_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_bid?: number
          current_bidder_id?: string | null
          id?: string
          is_active?: boolean | null
          player_id?: string | null
          started_at?: string | null
          timer_duration?: number
          timer_started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_bid?: number
          current_bidder_id?: string | null
          id?: string
          is_active?: boolean | null
          player_id?: string | null
          started_at?: string | null
          timer_duration?: number
          timer_started_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "current_auction_current_bidder_id_fkey"
            columns: ["current_bidder_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "current_auction_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_balls: {
        Row: {
          ball_number: number
          batsman_id: string | null
          bowler_id: string | null
          created_at: string | null
          extra_type: string | null
          extras: number
          fielder_id: string | null
          id: string
          innings_id: string
          is_wicket: boolean
          over_number: number
          runs_scored: number
          wicket_type: string | null
        }
        Insert: {
          ball_number: number
          batsman_id?: string | null
          bowler_id?: string | null
          created_at?: string | null
          extra_type?: string | null
          extras?: number
          fielder_id?: string | null
          id?: string
          innings_id: string
          is_wicket?: boolean
          over_number: number
          runs_scored?: number
          wicket_type?: string | null
        }
        Update: {
          ball_number?: number
          batsman_id?: string | null
          bowler_id?: string | null
          created_at?: string | null
          extra_type?: string | null
          extras?: number
          fielder_id?: string | null
          id?: string
          innings_id?: string
          is_wicket?: boolean
          over_number?: number
          runs_scored?: number
          wicket_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_balls_batsman_id_fkey"
            columns: ["batsman_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_balls_bowler_id_fkey"
            columns: ["bowler_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_balls_fielder_id_fkey"
            columns: ["fielder_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_balls_innings_id_fkey"
            columns: ["innings_id"]
            isOneToOne: false
            referencedRelation: "match_innings"
            referencedColumns: ["id"]
          },
        ]
      }
      match_innings: {
        Row: {
          batting_team_id: string
          bowling_team_id: string
          created_at: string | null
          extras: number
          id: string
          innings_number: number
          is_completed: boolean
          match_id: string
          total_overs: number
          total_runs: number
          total_wickets: number
        }
        Insert: {
          batting_team_id: string
          bowling_team_id: string
          created_at?: string | null
          extras?: number
          id?: string
          innings_number: number
          is_completed?: boolean
          match_id: string
          total_overs?: number
          total_runs?: number
          total_wickets?: number
        }
        Update: {
          batting_team_id?: string
          bowling_team_id?: string
          created_at?: string | null
          extras?: number
          id?: string
          innings_number?: number
          is_completed?: boolean
          match_id?: string
          total_overs?: number
          total_runs?: number
          total_wickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_innings_batting_team_id_fkey"
            columns: ["batting_team_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_innings_bowling_team_id_fkey"
            columns: ["bowling_team_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_innings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string | null
          format: Database["public"]["Enums"]["match_format"]
          id: string
          match_date: string
          overs_per_innings: number
          status: Database["public"]["Enums"]["match_status"]
          team1_id: string | null
          team2_id: string | null
          toss_decision: string | null
          toss_winner_id: string | null
          tournament_id: string
          updated_at: string | null
          venue_id: string | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          format: Database["public"]["Enums"]["match_format"]
          id?: string
          match_date: string
          overs_per_innings: number
          status?: Database["public"]["Enums"]["match_status"]
          team1_id?: string | null
          team2_id?: string | null
          toss_decision?: string | null
          toss_winner_id?: string | null
          tournament_id: string
          updated_at?: string | null
          venue_id?: string | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          format?: Database["public"]["Enums"]["match_format"]
          id?: string
          match_date?: string
          overs_per_innings?: number
          status?: Database["public"]["Enums"]["match_status"]
          team1_id?: string | null
          team2_id?: string | null
          toss_decision?: string | null
          toss_winner_id?: string | null
          tournament_id?: string
          updated_at?: string | null
          venue_id?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_toss_winner_id_fkey"
            columns: ["toss_winner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string | null
          id: string
          remaining_points: number
          team_logo_url: string | null
          team_name: string
          total_points: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          remaining_points?: number
          team_logo_url?: string | null
          team_name: string
          total_points?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          remaining_points?: number
          team_logo_url?: string | null
          team_name?: string
          total_points?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      player_match_stats: {
        Row: {
          balls_faced: number
          catches: number
          created_at: string | null
          fours: number
          id: string
          maidens: number
          match_id: string
          overs_bowled: number
          player_id: string
          run_outs: number
          runs_conceded: number
          runs_scored: number
          sixes: number
          stumpings: number
          team_id: string
          wickets_taken: number
        }
        Insert: {
          balls_faced?: number
          catches?: number
          created_at?: string | null
          fours?: number
          id?: string
          maidens?: number
          match_id: string
          overs_bowled?: number
          player_id: string
          run_outs?: number
          runs_conceded?: number
          runs_scored?: number
          sixes?: number
          stumpings?: number
          team_id: string
          wickets_taken?: number
        }
        Update: {
          balls_faced?: number
          catches?: number
          created_at?: string | null
          fours?: number
          id?: string
          maidens?: number
          match_id?: string
          overs_bowled?: number
          player_id?: string
          run_outs?: number
          runs_conceded?: number
          runs_scored?: number
          sixes?: number
          stumpings?: number
          team_id?: string
          wickets_taken?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_match_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          age: number
          auction_status: Database["public"]["Enums"]["auction_status"] | null
          base_price: number | null
          batting_hand: Database["public"]["Enums"]["batting_hand"]
          best_bowling: string | null
          bowling_average: number | null
          category: Database["public"]["Enums"]["player_category"]
          created_at: string | null
          economy_rate: number | null
          highest_score: number | null
          id: string
          name: string
          nationality: string
          player_role: Database["public"]["Enums"]["player_role"]
          profile_picture_url: string | null
          strike_rate: number | null
          total_matches: number | null
          total_runs: number | null
          updated_at: string | null
          wickets: number | null
        }
        Insert: {
          age: number
          auction_status?: Database["public"]["Enums"]["auction_status"] | null
          base_price?: number | null
          batting_hand?: Database["public"]["Enums"]["batting_hand"]
          best_bowling?: string | null
          bowling_average?: number | null
          category: Database["public"]["Enums"]["player_category"]
          created_at?: string | null
          economy_rate?: number | null
          highest_score?: number | null
          id?: string
          name: string
          nationality: string
          player_role: Database["public"]["Enums"]["player_role"]
          profile_picture_url?: string | null
          strike_rate?: number | null
          total_matches?: number | null
          total_runs?: number | null
          updated_at?: string | null
          wickets?: number | null
        }
        Update: {
          age?: number
          auction_status?: Database["public"]["Enums"]["auction_status"] | null
          base_price?: number | null
          batting_hand?: Database["public"]["Enums"]["batting_hand"]
          best_bowling?: string | null
          bowling_average?: number | null
          category?: Database["public"]["Enums"]["player_category"]
          created_at?: string | null
          economy_rate?: number | null
          highest_score?: number | null
          id?: string
          name?: string
          nationality?: string
          player_role?: Database["public"]["Enums"]["player_role"]
          profile_picture_url?: string | null
          strike_rate?: number | null
          total_matches?: number | null
          total_runs?: number | null
          updated_at?: string | null
          wickets?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team_players: {
        Row: {
          bought_price: number
          created_at: string | null
          id: string
          owner_id: string
          player_id: string
        }
        Insert: {
          bought_price: number
          created_at?: string | null
          id?: string
          owner_id: string
          player_id: string
        }
        Update: {
          bought_price?: number
          created_at?: string | null
          id?: string
          owner_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_players_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_points: {
        Row: {
          created_at: string | null
          draws: number
          id: string
          losses: number
          matches_played: number
          net_run_rate: number
          no_results: number
          points: number
          team_id: string
          tournament_id: string
          updated_at: string | null
          wins: number
        }
        Insert: {
          created_at?: string | null
          draws?: number
          id?: string
          losses?: number
          matches_played?: number
          net_run_rate?: number
          no_results?: number
          points?: number
          team_id: string
          tournament_id: string
          updated_at?: string | null
          wins?: number
        }
        Update: {
          created_at?: string | null
          draws?: number
          id?: string
          losses?: number
          matches_played?: number
          net_run_rate?: number
          no_results?: number
          points?: number
          team_id?: string
          tournament_id?: string
          updated_at?: string | null
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_points_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_points_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string | null
          end_date: string
          format: Database["public"]["Enums"]["match_format"]
          id: string
          name: string
          overs_per_innings: number
          start_date: string
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string | null
          venue: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          format: Database["public"]["Enums"]["match_format"]
          id?: string
          name: string
          overs_per_innings?: number
          start_date: string
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string | null
          venue?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          format?: Database["public"]["Enums"]["match_format"]
          id?: string
          name?: string
          overs_per_innings?: number
          start_date?: string
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string | null
          venue?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          capacity: number | null
          city: string
          country: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          capacity?: number | null
          city: string
          country: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          capacity?: number | null
          city?: string
          country?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_owner_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "spectator" | "admin" | "owner"
      auction_status: "pending" | "active" | "sold" | "unsold"
      batting_hand: "left" | "right"
      match_format: "T10" | "T20" | "ODI" | "Test" | "T5" | "Custom"
      match_status: "scheduled" | "live" | "completed" | "cancelled"
      player_category: "platinum" | "gold" | "silver" | "emerging"
      player_role: "batsman" | "bowler" | "all_rounder" | "wicket_keeper"
      tournament_status: "upcoming" | "ongoing" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["spectator", "admin", "owner"],
      auction_status: ["pending", "active", "sold", "unsold"],
      batting_hand: ["left", "right"],
      match_format: ["T10", "T20", "ODI", "Test", "T5", "Custom"],
      match_status: ["scheduled", "live", "completed", "cancelled"],
      player_category: ["platinum", "gold", "silver", "emerging"],
      player_role: ["batsman", "bowler", "all_rounder", "wicket_keeper"],
      tournament_status: ["upcoming", "ongoing", "completed"],
    },
  },
} as const
