import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import TwitterApi from 'twitter-api-v2';
import { MLBGame } from '@/lib/types';
import { TEAM_HASHTAG_MAP } from '@/lib/mlb-data';

const TEAM_NAME_SHORTENER_MAP: { [key: string]: string } = {
  'Chicago White Sox': 'White Sox', 'Boston Red Sox': 'Red Sox', 'Toronto Blue Jays': 'Blue Jays', 'Arizona Diamondbacks': 'D-backs',
};

// --- DATABASE HELPERS ---

async function getFranchiseTeamIds(supabase: SupabaseClient, teamId: number): Promise<number[]> {
    // Queries the live 'teams' table
    const { data: franchiseData } = await supabase.from('teams').select('franchise').eq('team_id', teamId).single();
    if (!franchiseData || !franchiseData.franchise) return [teamId];

    const { data: teamIdsData } = await supabase.from('teams').select('team_id').eq('franchise', franchiseData.franchise);
    return teamIdsData?.map(t => Number(t.team_id)) || [teamId];
}

async function checkTrueScorigami(supabase: SupabaseClient, s1: number, s2: number): Promise<{ isScorigami: boolean, newCount: number }> {
    const win = Math.max(s1, s2);
    const lose = Math.min(s1, s2);
    
    // Checks the live 'gamelogs' table
    const { data } = await supabase.from('gamelogs')
        .select('game_id')
        .or(`and(home_score.eq.${win},visitor_score.eq.${lose}),and(home_score.eq.${lose},visitor_score.eq.${win})`)
        .eq('is_negro_league', false)
        .limit(1);

    if (data && data.length > 0) return { isScorigami: false, newCount: 0 };

    // Get the new total count from the live 'scorigami_summary'
    const { count } = await supabase.from('scorigami_summary')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', 0);
        
    return { isScorigami: true, newCount: (count || 0) + 1 };
}

async function isFranchiseScorigami(supabase: SupabaseClient, franchiseIds: number[], s1: number, s2: number): Promise<boolean> {
    const ids = `(${franchiseIds.join(',')})`;
    const { data } = await supabase.from('gamelogs').select('game_id').or(
      `and(home_team_id.in.${ids},home_score.eq.${s1},visitor_score.eq.${s2}),` +
      `and(visitor_team_id.in.${ids},visitor_score.eq.${s1},home_score.eq.${s2}),` +
      `and(home_team_id.in.${ids},home_score.eq.${s2},visitor_score.eq.${s1}),` +
      `and(visitor_team_id.in.${ids},visitor_score.eq.${s2},home_score.eq.${s1})`
    ).limit(1);

    return !data || data.length === 0;
}

async function getScoreHistory(supabase: SupabaseClient, s1: number, s2: number): Promise<{ occurrences: number; last_game_date: string } | null> {
    const win = Math.max(s1, s2);
    const lose = Math.min(s1, s2);
    const { count, data } = await supabase.from('gamelogs')
        .select('date', { count: 'exact' })
        .or(`and(home_score.eq.${win},visitor_score.eq.${lose}),and(home_score.eq.${lose},visitor_score.eq.${win})`)
        .eq('is_negro_league', false)
        .order('date', { ascending: false })
        .limit(1);

    if (!data || data.length === 0) return null;
    return { 
        occurrences: count || 0, 
        last_game_date: new Date(data[0].date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) 
    };
}

function getOrdinal(n: number): string {
    const s = ["th", "st", "nd", "rd"]; const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// --- MAIN HANDLER ---

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const twitterClient = new TwitterApi({
    appKey: process.env.X_APP_KEY!, appSecret: process.env.X_APP_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!, accessSecret: process.env.X_ACCESS_SECRET!,
  });

  const res = await fetch('https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1', { cache: 'no-store' });
  const scheduleData = await res.json();
  if (!scheduleData.dates || scheduleData.dates.length === 0) return NextResponse.json({ message: "No games" });

  const scheduleGames = scheduleData.dates[0].games;

  for (let g of scheduleGames) {
    if (g.status.codedGameState !== 'F' && g.status.codedGameState !== 'O') continue;

    const game_id = g.gamePk;
    const away_id = g.teams.away.team.id;
    const home_id = g.teams.home.team.id;
    const away_score = g.teams.away.score || 0;
    const home_score = g.teams.home.score || 0;
    const away_name = g.teams.away.team.name;
    const home_name = g.teams.home.team.name;

    const { data: alreadyPosted } = await supabase.from('posted_updates').select('id').eq('game_id', game_id).limit(1);
    if (alreadyPosted && alreadyPosted.length > 0) continue;

    const franchiseIdsAway = await getFranchiseTeamIds(supabase, away_id);
    const franchiseIdsHome = await getFranchiseTeamIds(supabase, home_id);

    const scorigamiResult = await checkTrueScorigami(supabase, away_score, home_score);
    
    let postText = "";
    const winnerIsAway = away_score > home_score;
    const winnerName = winnerIsAway ? (TEAM_NAME_SHORTENER_MAP[away_name] || away_name.split(' ').pop()) : (TEAM_NAME_SHORTENER_MAP[home_name] || home_name.split(' ').pop());
    const loserName = winnerIsAway ? (TEAM_NAME_SHORTENER_MAP[home_name] || home_name.split(' ').pop()) : (TEAM_NAME_SHORTENER_MAP[away_name] || away_name.split(' ').pop());
    const winnerHashtag = TEAM_HASHTAG_MAP[winnerIsAway ? away_name : home_name] || "";
    const loserHashtag = TEAM_HASHTAG_MAP[winnerIsAway ? home_name : away_name] || "";

    const header = `FINAL: ${winnerName} ${Math.max(away_score, home_score)}, ${loserName} ${Math.min(away_score, home_score)}\n${winnerHashtag} // ${loserHashtag}`;

    if (scorigamiResult.isScorigami) {
        postText = `${header}\n\n🚨 That's Scorigami!\nThe ${getOrdinal(scorigamiResult.newCount)} unique score combination in MLB history.`;
    } else {
        const isAwayS = await isFranchiseScorigami(supabase, franchiseIdsAway, away_score, home_score);
        const isHomeS = await isFranchiseScorigami(supabase, franchiseIdsHome, home_score, away_score);
        const history = await getScoreHistory(supabase, away_score, home_score);

        if (isAwayS || isHomeS) {
            const teamName = isAwayS ? away_name : home_name;
            postText = `${header}\n\n🚨 That's Franchisigami!\nThe first time this score has occurred in ${teamName} history.\n\nThis score has happened ${history?.occurrences} times in MLB history, last on ${history?.last_game_date}.`;
        } else {
            postText = `${header}\n\nNo Scorigami. This score has happened ${history?.occurrences} times in MLB history, last on ${history?.last_game_date}.`;
        }
    }

    if (process.env.ENABLE_POSTING === 'true') {
        await twitterClient.v2.tweet(postText);
    } else {
        console.log("WOULD TWEET:", postText);
    }
    
    await supabase.from('posted_updates').insert({ game_id, post_type: 'Final', details: 'Final Score', score_snapshot: `${away_score}-${home_score}` });
  }

  return NextResponse.json({ success: true });
}