// In-game scorigami probability model.
//
// Final-score distribution: each team's remaining runs are modeled as an
// independent Poisson draw sized by its remaining half-innings. This replaces
// the old uniform-split model, which overweighted lopsided finishes and
// inflated scorigami odds. Tied finals are excluded (regulation can't end
// tied; the residual probability belongs to extra-inning outcomes whose
// scores this model can't see, an acceptable approximation by inning 6+).
//
// League scoring has hovered around 4.4-4.6 runs per team per 9 innings,
// so ~0.5 runs per half-inning. Blowout games skew slightly higher.
const RUNS_PER_HALF_INNING = 0.55;

const FACTORIALS: number[] = [1];
function factorial(n: number): number {
  for (let i = FACTORIALS.length; i <= n; i++) {
    FACTORIALS[i] = FACTORIALS[i - 1] * i;
  }
  return FACTORIALS[n];
}

function poisson(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export function pairKey(a: number, b: number): string {
  return `${Math.max(a, b)}-${Math.min(a, b)}`;
}

// Remaining half-innings of scoring opportunity for each side, given the
// current inning and its state ("Top" | "Middle" | "Bottom" | "End").
// A half-inning in progress counts half. When the home team leads, it
// won't bat in the bottom of the 9th, so that half-inning is removed —
// this is why a home team up 20-1 sees its odds collapse after the 8th.
// (The trailing side could still tie it up and force the bottom 9th;
// that tail is ignored.)
export function remainingHalfInnings(
  inning: number,
  inningState: string,
  homeLeading: boolean
): { away: number; home: number } {
  const rest = Math.max(0, 9 - inning);
  const s = inningState.toLowerCase();
  let away: number;
  let home: number;
  if (s.startsWith("top")) {
    away = rest + 0.5; home = rest + 1;
  } else if (s.startsWith("mid")) {
    away = rest; home = rest + 1;
  } else if (s.startsWith("bot")) {
    away = rest; home = rest + 0.5;
  } else {
    away = rest; home = rest;
  }
  if (homeLeading) home = Math.max(0, home - 1);
  return { away, home };
}

export function lambdasFor(
  inning: number,
  inningState: string,
  homeLeading: boolean
): { away: number; home: number } {
  const halves = remainingHalfInnings(inning, inningState, homeLeading);
  return { away: halves.away * RUNS_PER_HALF_INNING, home: halves.home * RUNS_PER_HALF_INNING };
}

export interface ScoreProbabilities {
  scorigami: number;
  franchisigami: number;
  mostLikelyScorigami: { win: number; lose: number; probability: number } | null;
}

// Sets contain "win-lose" keys (see pairKey) of scores that have already
// happened: everSet across all of MLB, the franchise sets per club.
export function calculateScoreProbabilities(opts: {
  awayScore: number;
  homeScore: number;
  awayLambda: number;
  homeLambda: number;
  everSet: Set<string>;
  awayFranchiseSet: Set<string>;
  homeFranchiseSet: Set<string>;
  maxAdditionalRuns?: number;
}): ScoreProbabilities {
  const K = opts.maxAdditionalRuns ?? 25;
  let scorigami = 0;
  let franchisigami = 0;
  let best: ScoreProbabilities["mostLikelyScorigami"] = null;

  for (let da = 0; da <= K; da++) {
    const pAway = poisson(opts.awayLambda, da);
    if (pAway < 1e-9 && da > opts.awayLambda) break;
    for (let dh = 0; dh <= K; dh++) {
      const p = pAway * poisson(opts.homeLambda, dh);
      if (p < 1e-10 && dh > opts.homeLambda) break;

      const away = opts.awayScore + da;
      const home = opts.homeScore + dh;
      if (away === home) continue;

      const key = pairKey(away, home);
      if (!opts.everSet.has(key)) {
        scorigami += p;
        if (!best || p > best.probability) {
          best = { win: Math.max(away, home), lose: Math.min(away, home), probability: p };
        }
      }
      if (!opts.awayFranchiseSet.has(key) || !opts.homeFranchiseSet.has(key)) {
        franchisigami += p;
      }
    }
  }

  return { scorigami, franchisigami, mostLikelyScorigami: best };
}

export function formatPct(p: number): string {
  const pct = p * 100;
  if (pct >= 99.995) return "100%";
  // Never round a non-certain probability up to "100%".
  if (pct >= 99) return "99%";
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(2)}%`;
}

// "an 8% chance" / "an 11% chance" / "an 18% chance" / "an 80% chance",
// otherwise "a". Checks the leading spoken number of the formatted percent.
export function articleForPct(pctString: string): string {
  if (/^8/.test(pctString) || /^11(\D|$)/.test(pctString) || /^18(\D|$)/.test(pctString)) {
    return "an";
  }
  return "a";
}
