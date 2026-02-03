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

export const CURRENT_FRANCHISE_CODES = Object.keys(TEAM_NAMES);

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

export const YEARS_FOR_DROPDOWN: string[] = ["ALL"];
const CURRENT_YEAR = new Date().getFullYear();
for (let y = CURRENT_YEAR; y >= 1871; y--) { YEARS_FOR_DROPDOWN.push(y.toString()); }