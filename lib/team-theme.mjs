// Per-team heatmap palettes, shared by the site (scorigami-heatmap.tsx,
// scorigami-page.tsx) and the share-card generator (scripts/generate-og-image.js).
// Plain ESM so the Node script can import it without a TS toolchain.

/**
 * @typedef {{ ramp: string[]; cardRamp: string[]; dark: string; accent: string; link: string }} TeamTheme
 * ramp:   occurrence colors, rarest -> most common (9 steps)
 * cardRamp: darker ramp for share cards, which read at thumbnail size
 * dark:   impossible-score field + UI ink (dropdown highlight, tooltips)
 * accent: hovered cell, icon hovers, share-card highlight
 * link:   accent, or dark when the accent is too light to read as text
 */

/** @type {TeamTheme} */
export const DEFAULT_THEME = {
  ramp: [
    "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa",
    "#3b82f6", "#2563eb", "#1d4ed8", "#153bc0", "#0c248d",
  ],
  cardRamp: [
    "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8",
    "#153bc0", "#0c248d", "#0a1d74", "#08165c", "#040a2f",
  ],
  dark: "#0b162a",
  accent: "#2d91ff",
  link: "#2d91ff",
};

// base: the hue the ramp is built from. deep: optional hue the darkest steps
// drift toward (golds go olive in OKLab without it). dark/accent default to a
// deep shade of base and to dark, respectively. calm: tone down the pale steps
// (see CALM_CAP).
/** @type {Record<string, { base: string; deep?: string; dark?: string; accent?: string; calm?: boolean }>} */
const TEAM_COLORS = {
  LAA: { base: "#BA0021", dark: "#003263" },
  ARI: { base: "#A71930", dark: "#141414" },
  ATL: { base: "#CE1141", dark: "#13274F", accent: "#EAAA00" },
  BAL: { base: "#DF4601", dark: "#141414" },
  BOS: { base: "#BD3039", dark: "#0C2340" },
  CWS: { base: "#27251F", dark: "#000000", accent: "#000000" },
  CHC: { base: "#0E3386", accent: "#CC3433" },
  CIN: { base: "#C6011F", dark: "#141414" },
  CLE: { base: "#E50022", dark: "#00385D" },
  COL: { base: "#33006F", dark: "#131413" },
  DET: { base: "#1E4BA0", deep: "#14306E", dark: "#0C2340", accent: "#FA4616" },
  HOU: { base: "#EB6E1F", dark: "#002D62" },
  KC: { base: "#004687", accent: "#BD9B60" },
  LAD: { base: "#005A9C", accent: "#EF3E42" },
  MIA: { base: "#00A3E0", dark: "#141414", accent: "#EF3340" },
  MIL: { base: "#FFC52F", deep: "#B5651D", dark: "#12284B" },
  MIN: { base: "#002B5C", accent: "#D31145" },
  NYY: { base: "#C4CED3", deep: "#1C3F7A", dark: "#0C2340" },
  NYM: { base: "#002D72", accent: "#FF5910" },
  OAK: { base: "#2E8540", deep: "#0B4A2E", dark: "#003831", accent: "#EFB21E" },
  PHI: { base: "#E81828", dark: "#002D72" },
  PIT: { base: "#FDB827", deep: "#B5651D", dark: "#27251F" },
  SD: { base: "#FFC425", deep: "#7A4A1E", dark: "#2F241D" },
  SEA: { base: "#005C5C", dark: "#0C2C56", calm: true },
  SFG: { base: "#FD5A1E", dark: "#27251F" },
  STL: { base: "#C41E3A", dark: "#0C2340", accent: "#FEDB00" },
  TB: { base: "#8FBCE6", dark: "#092C5C", accent: "#F5D130" },
  TEX: { base: "#003278", accent: "#C0111F" },
  TOR: { base: "#134A8E", dark: "#1D2D5C", accent: "#E8291C" },
  WSH: { base: "#AB0003", dark: "#14225A" },
};

// OKLab lightness and relative chroma of each page ramp step, matching
// DEFAULT_THEME's blues: one-off scores are a pale tint, the most common ones
// the deepest shade.
const RAMP_L = [0.93, 0.88, 0.81, 0.71, 0.62, 0.55, 0.49, 0.43, 0.33];
const RAMP_C = [0.2, 0.35, 0.55, 0.8, 0.95, 1, 1, 1, 1];
// Chroma floor for the pale steps: yellows need more chroma than blues to read
// as their hue rather than beige.
const RAMP_C_FLOOR = [0.07, 0.09, 0.11, 0.13];
// calm teams skip that floor and cap chroma harder the lighter the step, for
// hues (teal/aqua) that glow neon at chroma other colors carry fine.
const CALM_CAP = (L) => 0.04 + 0.24 * (1 - L);
const CARD_RAMP_L = [0.72, 0.65, 0.58, 0.52, 0.46, 0.41, 0.36, 0.31, 0.27];
const DRIFT_TOP_L = 0.89;
const DARK_L = 0.22;

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToOklch(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: Math.atan2(B, A) };
}

function oklchToRgb(L, C, h) {
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// Largest in-gamut chroma <= C at this lightness/hue, as #rrggbb.
function oklchToHex(L, C, h) {
  const inGamut = (c) => oklchToRgb(L, c, h).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  let lo = 0, hi = C;
  if (!inGamut(hi)) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(mid)) lo = mid; else hi = mid;
    }
    hi = lo;
  }
  return (
    "#" +
    oklchToRgb(L, hi, h)
      .map((v) => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

function relativeLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @type {Record<string, TeamTheme>} */
const cache = {};

/**
 * @param {string | null | undefined} code franchise code, or "ALL"
 * @returns {TeamTheme}
 */
export function getTeamTheme(code) {
  const spec = code ? TEAM_COLORS[code] : undefined;
  if (!spec) return DEFAULT_THEME;
  if (cache[code]) return cache[code];
  const { C, h } = hexToOklch(spec.base);
  const deep = spec.deep ? hexToOklch(spec.deep) : { C, h };
  // Hue/chroma glide from base (lightest) to deep (darkest), shortest way round.
  const dh = Math.atan2(Math.sin(deep.h - h), Math.cos(deep.h - h));
  const step = (L, chromaScale = 1, chromaFloor = 0) => {
    const t = Math.min(1, Math.max(0, (DRIFT_TOP_L - L) / (DRIFT_TOP_L - CARD_RAMP_L[CARD_RAMP_L.length - 1])));
    const c = C + (deep.C - C) * t;
    if (spec.calm) return oklchToHex(L, Math.min(c * chromaScale, CALM_CAP(L)), h + dh * t);
    return oklchToHex(L, Math.max(c * chromaScale, Math.min(c, chromaFloor)), h + dh * t);
  };
  const ramp = RAMP_L.map((L, i) => step(L, RAMP_C[i], RAMP_C_FLOOR[i]));
  const cardRamp = CARD_RAMP_L.map((L) => step(L));
  const dark = spec.dark ?? oklchToHex(DARK_L, Math.min(C, 0.09), h);
  const accent = spec.accent ?? dark;
  // Text on the #f2f2f2 page needs ~3:1; light accents fall back to dark.
  const contrast = (0.887 + 0.05) / (relativeLuminance(accent) + 0.05);
  const theme = { ramp, cardRamp, dark, accent, link: contrast >= 3 ? accent : dark };
  cache[code] = theme;
  return theme;
}

/**
 * Log-scaled occurrence color, same curve the site has always used.
 * @param {string[]} ramp
 * @param {number} occurrences
 * @param {number} maxOccurrences
 */
export function rampColor(ramp, occurrences, maxOccurrences) {
  if (occurrences <= 1) return ramp[0];
  let ratio = maxOccurrences > 0 ? Math.log1p(occurrences) / Math.log1p(maxOccurrences) : 0;
  ratio = Math.pow(ratio, 1.7);
  return ramp[Math.min(Math.floor(ratio * (ramp.length - 1)) + 1, ramp.length - 1)];
}
