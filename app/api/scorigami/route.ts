import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// This map translates the franchise code from the URL to the database team_id
const FRANCHISE_CODE_TO_ID_MAP: { [key: string]: number } = {
    "ANA": 8,
    "ARI": 9,
    "ATL": 21,
    "BAL": 23,
    "BOS": 41,
    "CHA": 70,
    "CHN": 73,
    "CIN": 79,
    "CLE": 86,
    "COL": 95,
    "DET": 114,
    "HOU": 131,
    "KCA": 148,
    "LAN": 157,
    "MIA": 165,
    "MIL": 167,
    "MIN": 168,
    "NYA": 199,
    "NYN": 201,
    "OAK": 203,
    "PHI": 214,
    "PIT": 219,
    "SDN": 234,
    "SEA": 237,
    "SFN": 238,
    "SLN": 249,
    "TBA": 259,
    "TEX": 260,
    "TOR": 265,
    "WAS": 271,
};

// This helper function performs the lookup
function getTeamIdFromFranchiseCode(code: string): number | null {
    return FRANCHISE_CODE_TO_ID_MAP[code] || null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const team = searchParams.get('team') || null;
  const year = searchParams.get('year') || 'ALL';
  const type = searchParams.get('type') || 'traditional';

  // Use the helper to get the numeric team_id
  const teamId = team ? getTeamIdFromFranchiseCode(team) : null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Call the powerful database function!
  const { data, error } = await supabase.rpc('get_scorigami_data', {
    p_year: year,
    p_team_id: teamId,
    p_type: type,
  });

  if (error) {
    console.error('Error fetching scorigami data from RPC function:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}