// Generate the link-share cards (1200x630) from the freshly dumped scorigami
// data, so previews always show the current grid:
//   public/og.png                  site card (MLB Scorigami)
//   public/og/team/<code>.png      one per franchise (Red Soxigami, ...)
//   public/og-archive.png          recent first-time scores table
//   public/mlb-scorigami-heatmap.png  full-bleed heatmap (JSON-LD image)
//
// Runs after dump-scorigami-data.js in the nightly workflow (reads its
// traditional/*.json output — no extra DB queries). Fonts and team cap logos
// are vendored in scripts/og-assets so CI renders offline.
//
// Run locally: node scripts/generate-og-image.js
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const W = 1200;
const H = 630;
const PUBLIC = path.resolve(__dirname, "../public");
const ASSETS = path.resolve(__dirname, "og-assets");
const DATA = path.join(PUBLIC, "scorigami-data/traditional");

// Full-bleed heatmap image only (scorigami-heatmap.tsx darkHex). Share cards
// use the per-team palettes from lib/team-theme.mjs, same as the site.
const RAMP = [
  "#404040", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8",
  "#153bc0", "#0c248d", "#0a1d74", "#08165c", "#040a2f",
];
const INK = "#343434";
const CARD_BG = "#f2f2f2";
// The site's default accent is a blue that disappears into the blue grid.
const SITE_HIGHLIGHT = "#f38e55";

const TITLE_FONT = "Anonymous Pro";
const UI_FONT = "Source Sans 3";
const fontDirs = [
  path.join(ASSETS, "fonts"),
  path.resolve(__dirname, "../node_modules/geist/dist/fonts/geist-sans"), // archive card
];
const fontFiles = fontDirs
  .filter((d) => fs.existsSync(d))
  .flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith(".ttf")).map((f) => path.join(d, f)));

const fmt = (n) => n.toLocaleString("en-US");
const esc = (t) =>
  String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC", month: "short", day: "numeric", year: "numeric",
  });

function cellColor(occ, maxOcc, zeroColor) {
  if (occ === 0) return zeroColor;
  if (occ === 1) return RAMP[1];
  const dataColors = RAMP.slice(1);
  let ratio = Math.log1p(occ) / Math.log1p(maxOcc);
  ratio = Math.pow(ratio, 1.7);
  let idx = Math.floor(ratio * (dataColors.length - 1)) + 1;
  idx = Math.min(idx, dataColors.length - 1);
  return dataColors[idx];
}

function render(svg) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: { loadSystemFonts: false, fontFiles, defaultFontFamily: UI_FONT },
  }).render().asPng();
}

function write(rel, png) {
  const out = path.join(PUBLIC, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, png);
}

// Team "-igami" titles live in lib/mlb-data.ts; read them from there so the
// cards can't drift from the page headers.
function loadTeamIgami() {
  const src = fs.readFileSync(path.resolve(__dirname, "../lib/mlb-data.ts"), "utf8");
  const block = src.match(/TEAM_IGAMI[^{]*\{([\s\S]*?)\};/);
  if (!block) throw new Error("TEAM_IGAMI not found in lib/mlb-data.ts");
  return Object.fromEntries([...block[1].matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));
}

// Mirrors computeHeaderStats in scorigami-page.tsx for the all-years view.
function summarize(rows) {
  const occ = new Map();
  const first = new Map();
  let totalGames = 0;
  let firstYear = Infinity;
  for (const r of rows) {
    const key = `${r.score1}-${r.score2}`;
    const n = Number(r.occurrences);
    occ.set(key, (occ.get(key) || 0) + n);
    totalGames += n;
    if (r.year < firstYear) firstYear = r.year;
    const prev = first.get(key);
    if (!prev || r.year < prev.year) first.set(key, r);
  }
  let recent = null;
  for (const r of first.values()) {
    if (
      !recent ||
      r.year > recent.year ||
      (r.year === recent.year && (r.last_date || "") > (recent.last_date || ""))
    ) {
      recent = r;
    }
  }
  return {
    occ,
    first,
    totalGames,
    uniqueScores: occ.size,
    maxOcc: Math.max(...occ.values()),
    firstYear,
    recent,
  };
}

function svgDataUri(svgText) {
  return `data:image/svg+xml;base64,${Buffer.from(svgText).toString("base64")}`;
}

// Batter mark from public/logo3.svg (native viewBox 900x867pt).
function batterMarkup(x, y, size, fill, opacity = 1) {
  const raw = fs.readFileSync(path.join(PUBLIC, "logo3.svg"), "utf8");
  const inner = raw
    .slice(raw.indexOf("<g "), raw.lastIndexOf("</g>") + 4)
    .replace(/<style>[\s\S]*?<\/style>/, "");
  const s = size / 900;
  return `<g transform="translate(${x},${y}) scale(${s})" fill="${fill}" opacity="${opacity}">${inner}</g>`;
}

// --- Share card: the site above the fold. Title bar, one-line stats bar, then
// the gapless grid (scores 0–30 across, as on desktop) running off the bottom edge.
const HEADER_H = 116;
const STATS_H = 52;
const LABEL_H = 30;
const CELLS_Y = HEADER_H + STATS_H + 20 + LABEL_H;
const GRID_W = 1088; // y-axis + cells; at the default 34px cell that's columns 0–30
const MAX_CELL = 34;
const LOGO_BOX = 72;

// Cells shrink only when the last -igami sits below the default crop, so the
// highlighted cell is always on the card; extra columns keep the width filled.
function gridLayout(s) {
  const needRows = s.recent ? s.recent.score2 + 1.6 : 0;
  // Whole-pixel cells: fractional ones leave antialiased seams in the dark field.
  const CELL = Math.floor(Math.min(MAX_CELL, (H - CELLS_Y) / needRows || MAX_CELL));
  const AXIS_W = CELL;
  const COLS = Math.min(51, Math.floor((GRID_W - AXIS_W) / CELL));
  const CELLS_X = Math.round((W - (AXIS_W + COLS * CELL)) / 2) + AXIS_W;
  const ROWS = Math.ceil((H - CELLS_Y) / CELL);
  return { CELL, COLS, ROWS, CELLS_X };
}

function gridMarkup(s, theme) {
  const { CELL, COLS, ROWS, CELLS_X } = gridLayout(s);
  const tick = Math.round(CELL * 0.65);
  let out = `<g font-family="${UI_FONT}" font-size="${tick}" fill="${INK}">`;
  for (let c = 0; c < COLS; c++) {
    out += `<text x="${CELLS_X + c * CELL + CELL / 2}" y="${CELLS_Y - 8}" text-anchor="middle">${c}</text>`;
  }
  for (let r = 0; r < ROWS; r++) {
    out += `<text x="${CELLS_X - 6}" y="${CELLS_Y + r * CELL + CELL / 2 + tick * 0.35}" text-anchor="end">${r}</text>`;
  }
  out += `</g>`;

  const hl = s.recent ? `${s.recent.score1}-${s.recent.score2}` : null;
  for (let lose = 0; lose < ROWS; lose++) {
    for (let win = 0; win < COLS; win++) {
      const key = `${win}-${lose}`;
      const n = s.occ.get(key) || 0;
      const fill = win < lose
        ? theme.dark
        : key === hl ? theme.highlight : n === 0 ? "#ffffff" : theme.cellColor(n, s.maxOcc);
      const x = CELLS_X + win * CELL;
      const y = CELLS_Y + lose * CELL;
      // +0.5 overlap so antialiased edges never show the page between cells.
      out += `<rect x="${x}" y="${y}" width="${CELL + 0.5}" height="${CELL + 0.5}" fill="${fill}"/>`;
      if (key === hl) {
        out += `<rect x="${x + 5}" y="${y + 5}" width="${CELL - 10}" height="${CELL - 10}" fill="none" stroke="#ffffff" stroke-width="2.5"/>`;
      }
    }
  }
  return out;
}

function headerMarkup(logoMarkup, title) {
  // Monospace title: Anonymous Pro advance is 1118/2048 em.
  const titleSize = 54;
  const titleW = title.length * 0.546 * titleSize;
  const gap = 18;
  const left = (W - (LOGO_BOX + gap + titleW)) / 2;
  return `
  <rect width="${W}" height="${HEADER_H}" fill="#ffffff"/>
  <line x1="0" y1="${HEADER_H - 0.5}" x2="${W}" y2="${HEADER_H - 0.5}" stroke="#e2e2e2" stroke-width="1"/>
  ${logoMarkup(left, (HEADER_H - LOGO_BOX) / 2, LOGO_BOX)}
  <text x="${left + LOGO_BOX + gap}" y="${HEADER_H / 2 + titleSize * 0.33}" font-family="${TITLE_FONT}" font-weight="700" font-size="${titleSize}" fill="${INK}">${esc(title)}</text>`;
}

function statsBarMarkup(s, recentLabel, theme) {
  const b = (v) => `<tspan font-weight="600" fill="${INK}">${esc(v)}</tspan>`;
  const sep = `<tspan fill="#b5b5b5">  ·  </tspan>`;
  let line = `Games ${b(fmt(s.totalGames))}${sep}Unique scores ${b(fmt(s.uniqueScores))}`;
  if (s.recent) {
    const when = s.recent.last_date ? fmtDate(s.recent.last_date) : String(s.recent.year);
    line += `${sep}<tspan fill="${theme.dark}">${esc(recentLabel)}</tspan> ${b(`${s.recent.score1}\u2013${s.recent.score2}`)}<tspan fill="${INK}"> (${esc(when)})</tspan>`;
  }
  const y0 = HEADER_H;
  return `
  <rect y="${y0}" width="${W}" height="${STATS_H}" fill="#fafafa"/>
  <line x1="0" y1="${y0 + STATS_H - 0.5}" x2="${W}" y2="${y0 + STATS_H - 0.5}" stroke="#e2e2e2" stroke-width="1"/>
  <text x="${W / 2}" y="${y0 + STATS_H / 2 + 8}" text-anchor="middle" font-family="${UI_FONT}" font-size="23" fill="#5f5f5f" xml:space="preserve">${line}</text>`;
}

function shareCard({ s, logoMarkup, title, recentLabel, theme }) {
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${CARD_BG}"/>
  ${gridMarkup(s, theme)}
  ${headerMarkup(logoMarkup, title)}
  ${statsBarMarkup(s, recentLabel, theme)}
</svg>`;
}

async function writeShareCards(all, readRows) {
  const { getTeamTheme, rampColor } = await import("../lib/team-theme.mjs");
  const cardTheme = (code) => {
    const t = getTeamTheme(code);
    const isSite = code === "ALL";
    return {
      ...t,
      cellColor: (n, max) => rampColor(t.cardRamp, n, max),
      highlight: isSite ? SITE_HIGHLIGHT : t.accent,
    };
  };

  write("og.png", render(shareCard({
    s: all,
    logoMarkup: (x, y, size) => batterMarkup(x, y + size * 0.02, size, INK),
    title: "MLB Scorigami",
    recentLabel: "Last Scorigami",
    theme: cardTheme("ALL"),
  })));
  console.log(`og.png written — ${fmt(all.totalGames)} games, ${all.uniqueScores} scores`);

  const TEAM_IGAMI = loadTeamIgami();
  for (const [code, igami] of Object.entries(TEAM_IGAMI)) {
    const file = path.join(DATA, `${code}.json`);
    if (!fs.existsSync(file)) {
      console.warn(`skip ${code}: no ${path.relative(PUBLIC, file)}`);
      continue;
    }
    const s = summarize(readRows(code));
    const logoSvg = fs.readFileSync(path.join(ASSETS, "logos", `${code}.svg`), "utf8");
    const logoUri = svgDataUri(logoSvg);
    write(`og/team/${code.toLowerCase()}.png`, render(shareCard({
      s,
      logoMarkup: (x, y, size) => `<image href="${logoUri}" x="${x}" y="${y}" width="${size}" height="${size}"/>`,
      title: igami,
      recentLabel: `Last ${igami}`,
      theme: cardTheme(code),
    })));
  }
  console.log(`og/team/*.png written — ${Object.keys(TEAM_IGAMI).length} teams`);
}

// --- Full-bleed heatmap (JSON-LD image / on-page embedding): winning scores
// 0-35 across, losing 0-18 down. 36:19 is a hair off 1200:630 — square cells.
function writeHeatmap(all) {
  const GRID = 36;
  const BROWS = 19;
  const cw = W / GRID;
  const ch = H / BROWS;
  let bleed = "";
  for (let win = 0; win < GRID; win++) {
    for (let lose = 0; lose < BROWS && lose <= win; lose++) {
      const n = all.occ.get(`${win}-${lose}`) || 0;
      bleed += `<rect x="${(win * cw).toFixed(2)}" y="${(lose * ch).toFixed(2)}" width="${(cw + 0.5).toFixed(2)}" height="${(ch + 0.5).toFixed(2)}" fill="${cellColor(n, all.maxOcc, "#333333")}"/>`;
    }
  }
  const logoSize = 92;
  write("mlb-scorigami-heatmap.png", render(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#1e1e1e"/>
  ${bleed}
  ${batterMarkup(W - logoSize - 28, H - logoSize * (867 / 900) - 24, logoSize, "#f1f5f9", 0.9)}
</svg>`));
  console.log("mlb-scorigami-heatmap.png written");
}

// --- Archive card (og-archive.png): table of the most recent first-time scores,
// matching the /archive page's plain sharp-cornered table design.
function writeArchiveCard(all) {
  const recentFirsts = [...all.first.values()]
    .filter((r) => r.last_date)
    .sort((a, b) => String(b.last_date).localeCompare(String(a.last_date)))
    .slice(0, 5);

  const TX = 60, TW = 1080, TY = 185;
  const HEADER_H = 46, ROW_H = 66;
  const tableH = HEADER_H + recentFirsts.length * ROW_H;

  let table = `<rect x="${TX}" y="${TY}" width="${TW}" height="${tableH}" fill="#252526" stroke="#3e3e42" stroke-width="1"/>`;
  table += `<line x1="${TX}" y1="${TY + HEADER_H}" x2="${TX + TW}" y2="${TY + HEADER_H}" stroke="#3e3e42" stroke-width="1"/>`;
  const cDate = TX + 28, cScore = TX + 300, cTeams = TX + 470;
  table += `<g font-size="17" fill="#94a3b8" font-weight="600" letter-spacing="1.5">
    <text x="${cDate}" y="${TY + 30}">FIRST SCORED</text>
    <text x="${cScore}" y="${TY + 30}">SCORE</text>
    <text x="${cTeams}" y="${TY + 30}">TEAMS</text>
  </g>`;
  recentFirsts.forEach((r, i) => {
    const rowTop = TY + HEADER_H + i * ROW_H;
    const base = rowTop + 42;
    if (i > 0) table += `<line x1="${TX}" y1="${rowTop}" x2="${TX + TW}" y2="${rowTop}" stroke="#2d2d30" stroke-width="1"/>`;
    table += `<text x="${cDate}" y="${base}" font-size="22" fill="#cbd5e1">${fmtDate(r.last_date)}</text>`;
    table += `<text x="${cScore}" y="${base}" font-size="24" font-weight="600" fill="#f1f5f9">${r.score1}\u2013${r.score2}</text>`;
    table += `<text x="${cTeams}" y="${base}" font-size="22" fill="#cbd5e1">${esc(r.last_visitor_team)} vs. ${esc(r.last_home_team)}</text>`;
  });

  write("og-archive.png", render(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#1e1e1e"/>
  ${batterMarkup(60, 42, 60, "#f1f5f9", 1)}
  <g font-family="Geist">
    <text x="140" y="88" font-size="42" font-weight="700" fill="#f1f5f9">Scorigami Archive</text>
    <text x="60" y="152" font-size="24" fill="#94a3b8">${all.uniqueScores} unique final scores since 1871</text>
    ${table}
  </g>
</svg>`));
  console.log(`og-archive.png written — ${recentFirsts.length} recent firsts`);
}

async function main() {
  const { decodeYearly, yearlyForFilter } = await import("../lib/static-data.mjs");
  const readRows = (code) =>
    yearlyForFilter(decodeYearly(JSON.parse(fs.readFileSync(path.join(DATA, `${code}.json`), "utf8"))).rows, "all");
  const all = summarize(readRows("ALL"));
  await writeShareCards(all, readRows);
  writeHeatmap(all);
  writeArchiveCard(all);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
