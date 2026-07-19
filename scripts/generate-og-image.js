// Generate public/og.png (1200x630) from the freshly dumped scorigami data,
// so link-share cards always show the current grid.
//
// Runs after dump-scorigami-data.js in the nightly workflow (reads its
// traditional/ALL.json output — no extra DB queries).
//
// Run locally: node scripts/generate-og-image.js
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const W = 1200;
const H = 630;
const GRID = 36; // scores 0-35, same as the site's default view

// Same dark ramp the heatmap uses (scorigami-heatmap.tsx darkHex)
const RAMP = [
  "#404040", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8",
  "#153bc0", "#0c248d", "#0a1d74", "#08165c", "#040a2f",
];
const BG = "#1e1e1e";

function cellColor(occ, maxOcc) {
  if (occ === 0) return "#333333"; // never happened — slightly dimmer than the site so blue pops
  if (occ === 1) return RAMP[1];
  const dataColors = RAMP.slice(1);
  let ratio = Math.log1p(occ) / Math.log1p(maxOcc);
  ratio = Math.pow(ratio, 1.7);
  let idx = Math.floor(ratio * (dataColors.length - 1)) + 1;
  idx = Math.min(idx, dataColors.length - 1);
  return dataColors[idx];
}

// Aggregate yearly rows -> occurrences per (win, lose)
const rows = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../public/scorigami-data/traditional/ALL.json"), "utf8")
);
const occ = new Map();
let totalGames = 0;
for (const r of rows) {
  const key = `${r.score1}-${r.score2}`;
  occ.set(key, (occ.get(key) || 0) + Number(r.occurrences));
  totalGames += Number(r.occurrences);
}
const uniqueScores = occ.size;
const maxOcc = Math.max(...occ.values());

// Grid geometry: fill the left side
const PAD = 45;
const cell = Math.floor((H - 2 * PAD) / GRID); // 15px
const gridSize = cell * GRID;
const gx = PAD;
const gy = Math.floor((H - gridSize) / 2);

let cells = "";
for (let win = 0; win < GRID; win++) {
  for (let lose = 0; lose <= win && lose < GRID; lose++) {
    const n = occ.get(`${win}-${lose}`) || 0;
    const x = gx + win * cell;
    const y = gy + lose * cell;
    cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${cellColor(n, maxOcc)}"/>`;
  }
}

const tx = gx + gridSize + 70; // text block left edge
const fmt = (n) => n.toLocaleString("en-US");

// Batter logo, extracted from public/logo3.svg for corner watermarking.
function logoMarkup(x, y, size, fill, opacity) {
  const raw = fs.readFileSync(path.resolve(__dirname, "../public/logo3.svg"), "utf8");
  const inner = raw
    .slice(raw.indexOf("<g "), raw.lastIndexOf("</g>") + 4)
    .replace(/<style>[\s\S]*?<\/style>/, "");
  // Native viewBox is 900x867pt; scale to requested pixel size.
  const s = size / 900;
  return `<g transform="translate(${x},${y}) scale(${s})" fill="${fill}" opacity="${opacity}">${inner}</g>`;
}

// Default: full-bleed grid (the OG card). Pass --card for the text/stats
// layout, kept around for banners or other uses.
const gridOnly = !process.argv.includes("--card");

let svg;
if (gridOnly) {
  // Full-bleed crop: winning scores 0-35 across, losing scores 0-18 down.
  // 36:19 is within a hair of the 1200:630 card ratio — square cells.
  const ROWS = 19;
  const cw = W / GRID;
  const ch = H / ROWS;
  let bleed = "";
  for (let win = 0; win < GRID; win++) {
    for (let lose = 0; lose < ROWS; lose++) {
      if (lose > win) continue; // impossible region stays background
      const n = occ.get(`${win}-${lose}`) || 0;
      bleed += `<rect x="${(win * cw).toFixed(2)}" y="${(lose * ch).toFixed(2)}" width="${(cw + 0.5).toFixed(2)}" height="${(ch + 0.5).toFixed(2)}" fill="${cellColor(n, maxOcc)}"/>`;
    }
  }
  const logoSize = 92;
  svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${bleed}
  ${logoMarkup(W - logoSize - 28, H - logoSize * (867 / 900) - 24, logoSize, "#f1f5f9", 0.9)}
</svg>`;
} else {
  svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${cells}
  ${logoMarkup(tx, 118, 64, "#f1f5f9", 1)}
  <g font-family="Geist, 'DejaVu Sans', Arial, sans-serif">
    <text x="${tx + 84}" y="164" font-size="44" font-weight="700" fill="#f1f5f9">MLB Scorigami</text>
    <text x="${tx}" y="285" font-size="25" fill="#94a3b8">Every final score in baseball history</text>
    <text x="${tx}" y="382" font-size="40" font-weight="600" fill="#60a5fa">${fmt(totalGames)}</text>
    <text x="${tx}" y="414" font-size="22" fill="#94a3b8">games since 1871</text>
    <text x="${tx}" y="480" font-size="40" font-weight="600" fill="#60a5fa">${fmt(uniqueScores)}</text>
    <text x="${tx}" y="512" font-size="22" fill="#94a3b8">unique final scores</text>
  </g>
</svg>`;
}

const fontFiles = [];
const geistDir = path.resolve(__dirname, "../node_modules/geist/dist/fonts/geist-sans");
if (fs.existsSync(geistDir)) {
  for (const f of fs.readdirSync(geistDir)) {
    if (f.endsWith(".ttf") || f.endsWith(".otf") || f.endsWith(".woff2")) {
      fontFiles.push(path.join(geistDir, f));
    }
  }
}

const png = new Resvg(svg, {
  fitTo: { mode: "width", value: W },
  font: { loadSystemFonts: true, fontFiles, defaultFontFamily: "Geist" },
}).render().asPng();

const outName = gridOnly ? "og.png" : "og-card.png";
fs.writeFileSync(path.resolve(__dirname, `../public/${outName}`), png);
if (gridOnly) {
  // Same image under a descriptive filename for on-page embedding / image SEO.
  fs.writeFileSync(path.resolve(__dirname, "../public/mlb-scorigami-heatmap.png"), png);
}
console.log(`${outName} written (${(png.length / 1024).toFixed(0)} KB) — ${fmt(totalGames)} games, ${uniqueScores} scores`);

// --- Archive card (og-archive.png): table of the most recent first-time scores,
// matching the /archive page's plain sharp-cornered table design.
if (gridOnly) {
  const firstByPair = new Map();
  for (const r of rows) {
    const key = `${r.score1}-${r.score2}`;
    const cur = firstByPair.get(key);
    if (!cur || r.year < cur.year) firstByPair.set(key, r);
  }
  const recentFirsts = [...firstByPair.values()]
    .filter((r) => r.last_date)
    .sort((a, b) => String(b.last_date).localeCompare(String(a.last_date)))
    .slice(0, 5);

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString("en-US", {
      timeZone: "UTC", month: "short", day: "numeric", year: "numeric",
    });
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

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

  const archiveSvg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${logoMarkup(60, 42, 60, "#f1f5f9", 1)}
  <g font-family="Geist, 'DejaVu Sans', Arial, sans-serif">
    <text x="140" y="88" font-size="42" font-weight="700" fill="#f1f5f9">Scorigami Archive</text>
    <text x="60" y="152" font-size="24" fill="#94a3b8">${uniqueScores} unique final scores since 1871</text>
    ${table}
  </g>
</svg>`;

  const archivePng = new Resvg(archiveSvg, {
    fitTo: { mode: "width", value: W },
    font: { loadSystemFonts: true, fontFiles, defaultFontFamily: "Geist" },
  }).render().asPng();
  fs.writeFileSync(path.resolve(__dirname, "../public/og-archive.png"), archivePng);
  console.log(`og-archive.png written (${(archivePng.length / 1024).toFixed(0)} KB) — ${recentFirsts.length} recent firsts`);
}
