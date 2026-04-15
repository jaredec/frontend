import { NextRequest, NextResponse } from 'next/server';
import { FRANCHISE_CODE_TO_ID_MAP, getAggregatedHomeAway, getAggregatedTraditional, getYearlyScorigami } from '@/lib/scorigami-queries';
import type { GameFilter } from '@/lib/mlb-data';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const team = searchParams.get('team') || 'ALL';
  const type = searchParams.get('type') || 'traditional';
  const mode = searchParams.get('mode') || 'aggregated';
  const gameFilter = (searchParams.get('gameFilter') || 'all') as GameFilter;

  const teamId = team === 'ALL' ? 0 : (FRANCHISE_CODE_TO_ID_MAP[team] || 0);
  const isTraditional = type === 'traditional';

  try {
    // Yearly mode: delegate to shared function
    if (mode === 'yearly') {
      const rows = await getYearlyScorigami(team, type, gameFilter);
      return NextResponse.json(rows, { headers: CACHE_HEADERS });
    }

    // Aggregated mode (legacy): return pre-aggregated summary
    if (isTraditional) {
      const rows = await getAggregatedTraditional(teamId);
      return NextResponse.json(rows, { headers: CACHE_HEADERS });
    }

    // Home/away aggregated fallback
    const rows = await getAggregatedHomeAway(teamId);
    return NextResponse.json(rows, { headers: CACHE_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
