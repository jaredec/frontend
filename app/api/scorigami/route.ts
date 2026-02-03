import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const FRANCHISE_CODE_TO_ID_MAP: Record<string, number> = {
    "LAA": 108, "ARI": 109, "ATL": 144, "BAL": 110, "BOS": 111,
    "CWS": 145, "CHC": 112, "CIN": 113, "CLE": 114, "COL": 115,
    "DET": 116, "HOU": 117, "KC":  118, "LAD": 119, "MIA": 146,
    "MIL": 158, "MIN": 142, "NYY": 147, "NYM": 121, "OAK": 133,
    "PHI": 143, "PIT": 134, "SD":  135, "SEA": 136, "SFG": 137,
    "STL": 138, "TB":  139, "TEX": 140, "TOR": 141, "WSH": 120,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const team = searchParams.get('team') || 'ALL';
  const year = searchParams.get('year') || 'ALL';
  const type = searchParams.get('type') || 'traditional';

  const teamId = team === 'ALL' ? 0 : (FRANCHISE_CODE_TO_ID_MAP[team] || 0);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc('get_scorigami_data', {
    p_year: year,
    p_team_id: teamId,
    p_type: type,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}