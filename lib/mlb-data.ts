export const TEAM_NAMES: Record<string, string> = {
  LAA: "Los Angeles Angels", ARI: "Arizona Diamondbacks", ATL: "Atlanta Braves",
  BAL: "Baltimore Orioles", BOS: "Boston Red Sox", CWS: "Chicago White Sox",
  CHC: "Chicago Cubs", CIN: "Cincinnati Reds", CLE: "Cleveland Guardians",
  COL: "Colorado Rockies", DET: "Detroit Tigers", HOU: "Houston Astros",
  KC: "Kansas City Royals", LAD: "Los Angeles Dodgers", MIA: "Miami Marlins",
  MIL: "Milwaukee Brewers", MIN: "Minnesota Twins", NYY: "New York Yankees",
  NYM: "New York Mets", OAK: "Athletics", PHI: "Philadelphia Phillies",
  PIT: "Pittsburgh Pirates", SD: "San Diego Padres", SEA: "Seattle Mariners",
  SFG: "San Francisco Giants", STL: "St. Louis Cardinals", TB: "Tampa Bay Rays",
  TEX: "Texas Rangers", TOR: "Toronto Blue Jays", WSH: "Washington Nationals",
};

export const CURRENT_FRANCHISE_CODES = Object.keys(TEAM_NAMES) as Array<keyof typeof TEAM_NAMES>;
export type FranchiseCode = keyof typeof TEAM_NAMES;
export type ScorigamiType = "home_away" | "traditional";
export type GameFilter = "all" | "regular" | "playoffs" | "ws" | "lcs" | "ds" | "wc";
export const PLAYOFF_GAME_TYPES = ['W', 'L', 'D', 'F'] as const;

export const TEAM_IDS: Record<string, number> = {
  LAA: 108, ARI: 109, ATL: 144, BAL: 110, BOS: 111,
  CWS: 145, CHC: 112, CIN: 113, CLE: 114, COL: 115,
  DET: 116, HOU: 117, KC: 118, LAD: 119, MIA: 146,
  MIL: 158, MIN: 142, NYY: 147, NYM: 121, OAK: 133,
  PHI: 143, PIT: 134, SD: 135, SEA: 136, SFG: 137,
  STL: 138, TB: 139, TEX: 140, TOR: 141, WSH: 120,
};

export const getTeamLogoUrl = (code: string, isDark = false): string | null => {
  const id = TEAM_IDS[code];
  if (!id) return null;
  // Cap-on-light is the color hat mark made for light backgrounds (a few KB).
  // "primary-on-light" is often the dark-bg asset (white fills) despite the name.
  const variant = isDark ? "team-primary-on-dark" : "team-cap-on-light";
  return `https://www.mlbstatic.com/team-logos/${variant}/${id}.svg`;
};

// Per-team "-igami" title, keyed by franchise code (mirrors the bot's naming:
// Red Soxigami, White Soxigami, A'sigami, Dbacksigami, Natsigami, etc.).
export const TEAM_IGAMI: Record<string, string> = {
  LAA: "Angelsigami", ARI: "Dbacksigami", ATL: "Bravesigami",
  BAL: "Oriolesigami", BOS: "Red Soxigami", CWS: "White Soxigami",
  CHC: "Cubsigami", CIN: "Redsigami", CLE: "Guardiansigami",
  COL: "Rockiesigami", DET: "Tigersigami", HOU: "Astrosigami",
  KC: "Royalsigami", LAD: "Dodgersigami", MIA: "Marlinsigami",
  MIL: "Brewersigami", MIN: "Twinsigami", NYY: "Yankeesigami",
  NYM: "Metsigami", OAK: "A'sigami", PHI: "Philliesigami",
  PIT: "Piratesigami", SD: "Padresigami", SEA: "Marinersigami",
  SFG: "Giantsigami", STL: "Cardinalsigami", TB: "Raysigami",
  TEX: "Rangersigami", TOR: "Blue Jaysigami", WSH: "Natsigami",
};

export const TEAM_HASHTAG_MAP: Record<string, string> = {
    'Baltimore Orioles': '#Birdland', 'Boston Red Sox': '#DirtyWater', 'New York Yankees': '#RepBX', 'Tampa Bay Rays': '#RaysUp',
    'Toronto Blue Jays': '#LightsUpLetsGo', 'Cleveland Guardians': '#GuardsBall', 'Detroit Tigers': '#RepDetroit', 'Kansas City Royals': '#FountainsUp',
    'Minnesota Twins': '#MNTwins', 'Chicago White Sox': '#WhiteSox', 'Houston Astros': '#BuiltForThis', 'Los Angeles Angels': '#RepTheHalo',
    'Athletics': '#Athletics', 'Seattle Mariners': '#TridentsUp', 'Texas Rangers': '#AllForTX', 'Atlanta Braves': '#BravesCountry',
    'Miami Marlins': '#MarlinsBeisbol', 'New York Mets': '#LGM', 'Philadelphia Phillies': '#RingTheBell', 'Washington Nationals': '#NATITUDE',
    'Chicago Cubs': '#BeHereForIt', 'Cincinnati Reds': '#ATOBTTR', 'Milwaukee Brewers': '#ThisIsMyCrew', 'Pittsburgh Pirates': '#LetsGoBucs',
    'St. Louis Cardinals': '#ForTheLou', 'Arizona Diamondbacks': '#Dbacks', 'Colorado Rockies': '#Rockies', 'Los Angeles Dodgers': '#LetsGoDodgers',
    'San Diego Padres': '#ForTheFaithful', 'San Francisco Giants': '#SFGiants',
};

