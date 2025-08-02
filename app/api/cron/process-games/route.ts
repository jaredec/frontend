// /frontend/app/api/cron/process-games/route.ts (PRODUCTION - FINAL VERIFIED CODE V4)

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import TwitterApi from 'twitter-api-v2';

// --- TYPE DEFINITIONS ---
interface PostResult {
  success: boolean;
  reason?: 'rate-limit' | 'other-error';
}
// Add created_at to the type, which we'll get from Supabase
interface QueuedTweet {
    id: number;
    post_text: string;
    game_id: number;
    created_at: string;
}

// --- HELPER FUNCTIONS ---

async function recordPost(supabase: SupabaseClient, game_id: number, post_type: string, details: string): Promise<void> {
  const { error } = await supabase.from('posted_updates').insert({ game_id, post_type, details });
  if (error) console.error("Error recording post after queue processing:", error);
}

async function postToX(twitterClient: TwitterApi, text: string): Promise<PostResult> {
  const isProductionPosting = process.env.ENABLE_POSTING === 'true';
  if (!isProductionPosting) {
    console.log("✅ [QUEUE-POSTING DISABLED] WOULD TWEET:", `\n---\n${text}\n---`);
    return { success: true };
  }
  try {
    await twitterClient.v2.tweet(text);
    console.log("🚀 [QUEUE] Post sent to X successfully!");
    return { success: true };
  } catch (e) {
    const error = e as { code?: number }; 
    if (error.code === 429) {
      console.warn("🚫 [QUEUE] Rate limit still active. Tweet will remain in queue.");
      return { success: false, reason: 'rate-limit' };
    }
    console.error("[QUEUE] Failed to post to X for a non-rate-limit reason:", e);
    return { success: false, reason: 'other-error' };
  }
}

async function processTweetQueue(supabase: SupabaseClient, twitterClient: TwitterApi): Promise<string> {
  console.log('[QUEUE] Checking for queued tweets...');
  
  const { data: queuedItems, error } = await supabase
    .from('tweet_queue')
    .select('*') // Select all columns to get created_at
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error("Error fetching from tweet queue:", error);
    return 'Error fetching from queue.';
  }
  
  if (!queuedItems || queuedItems.length === 0) {
    return 'Queue is empty.';
  }

  const tweetToProcess = queuedItems[0] as QueuedTweet;
  
  // --- STALENESS CHECK LOGIC ---
  const QUEUE_EXPIRATION_HOURS = 2;
  const queuedAtTime = new Date(tweetToProcess.created_at).getTime();
  const currentTime = Date.now();
  const hoursInQueue = (currentTime - queuedAtTime) / (1000 * 60 * 60);

  if (hoursInQueue > QUEUE_EXPIRATION_HOURS) {
      console.log(`[QUEUE] Skipping tweet ${tweetToProcess.id} for game ${tweetToProcess.game_id}. It is stale (in queue for ${hoursInQueue.toFixed(1)} hours).`);
      
      // Record that we skipped it so it's not lost forever
      if (tweetToProcess.game_id) {
          await recordPost(supabase, tweetToProcess.game_id, 'Skipped_Stale_Queue', 'Final');
      }
      
      // Delete the stale tweet from the queue so we don't re-process it
      await supabase.from('tweet_queue').delete().eq('id', tweetToProcess.id);
      
      return `Skipped and deleted stale tweet ${tweetToProcess.id}.`;
  }
  // --- END OF STALENESS LOGIC ---

  console.log(`[QUEUE] Found tweet ${tweetToProcess.id}. Attempting to post...`);
  const postResult = await postToX(twitterClient, tweetToProcess.post_text);

  if (postResult.success) {
    console.log(`[QUEUE] Successfully posted queued tweet for game ${tweetToProcess.game_id}.`);
    if (tweetToProcess.game_id) {
        await recordPost(supabase, tweetToProcess.game_id, 'Final_From_Queue', 'Final');
    }
    await supabase.from('tweet_queue').delete().eq('id', tweetToProcess.id);
    return `Successfully posted queued tweet for game ${tweetToProcess.game_id}.`;
  } 
  
  console.warn(`[QUEUE] Failed to post queued tweet. Reason: ${postResult.reason || 'Unknown'}. It remains in queue.`);
  await supabase
      .from('tweet_queue')
      .update({ last_attempt_at: new Date().toISOString() })
      .eq('id', tweetToProcess.id);

  return `Failed to post queued tweet due to: ${postResult.reason}. It remains in the queue.`;
}


// --- MAIN API ROUTE HANDLER FOR THE QUEUE ---
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // ✨ FIX: Return a NextResponse object for proper typing.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const twitterClient = new TwitterApi({
    appKey: process.env.X_APP_KEY!,
    appSecret: process.env.X_APP_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_SECRET!,
  });

  const message = await processTweetQueue(supabase, twitterClient);

  return NextResponse.json({ success: true, message });
}