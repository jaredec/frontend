// /src/lib/types.ts

// ===================================================================
// API and Bot Specific Types
// ===================================================================

// Shape of the data we care about from the MLB Stats API
export interface MLBGame {
  game_id: number;
  status: string;
  inning: number;
  inning_state_raw: string; // e.g., "Top", "Bottom"
  away_name: string;
  home_name: string;
  away_score: number;
  home_score: number;
  away_id: number; // This is the team_id from the MLB API
  home_id: number; // This is the team_id from the MLB API
}


// ===================================================================
// Database Table Types (Matching your Supabase Schema)
// ===================================================================

// Correctly matches your `gamelogs` table
export interface GameLog {
  game_id: number; // bigint in DB, number in TS
  visitor_team: string; // text in DB, string in TS
  home_team: string; // text in DB, string in TS
  visitor_score: number; // bigint in DB, number in TS
  home_score: number; // bigint in DB, number in TS
  date: string; // date in DB, string in TS (e.g., '2023-10-27')
  visitor_team_id: number | null; // bigint in DB, number or null in TS
  home_team_id: number | null; // bigint in DB, number or null in TS
}

// Matches your `teams` table
export interface Team {
  team_id: number;
  team: string;
  league: string | null;
  city: string | null;
  nickname: string | null;
  first: number | null;
  last: string | null;
  franchise: string | null;
}

// Matches your `scorigami_summary` table
export interface ScorigamiSummary {
  team_id: number;
  score1: number;
  score2: number;
  occurrences: number;
  first_game_id: number;
  last_game_id: number;
}