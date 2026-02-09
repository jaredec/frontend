// /src/lib/types.ts

// ===================================================================
// API and Bot Specific Types
// ===================================================================

// Shape of the data returned by the MLB Stats API
export interface MLBGame {
  game_id: number;
  status: string;
  inning: number;
  inning_state_raw: string; 
  away_name: string;
  home_name: string;
  away_score: number;
  home_score: number;
  away_id: number;
  home_id: number;
}

// Full record from the gamelogs_staging table
export interface GameLog {
  game_id: number;
  date: string;
  game_type: string;
  visitor_team: string;
  home_team: string;
  visitor_score: number;
  home_score: number;
  innings: number | null;
  visitor_team_id: number | null;
  home_team_id: number | null;
  is_negro_league: boolean;
  source: string;
}

// Master Team Record
export interface Team {
  team_id: number;
  team: string;
  abbr: string | null; // Changed from abbreviation
  franchise: string | null;
  is_negro_league: boolean;
  source: string;
}

// Data returned by the Supabase RPC function (get_scorigami_data)
export interface ScorigamiSummary {
  score1: number;
  score2: number;
  occurrences: number;
  last_date: string;
  last_home_team: string;
  last_visitor_team: string;
  last_game_id: number;
  source: string;
}