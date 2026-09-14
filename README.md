# MLB Scorigami

Source for [mlbscorigami.com](https://mlbscorigami.com): an interactive heatmap of every unique final score in Major League Baseball history (1871–present).

Filter by team, era, or game type. Cell tooltips show frequency, the last game, and a box score. [@MLBgami](https://x.com/MLBgami) tweets after each final.

Based on [Scorigami](https://nflscorigami.com/) by Jon Bois. Historical games from [Retrosheet](https://www.retrosheet.org); modern results from the MLB Stats API. Negro League games are not included yet.

## How it is put together

This is a Next.js app. `main` deploys to Vercel.

- **Grid.** `components/scorigami-page.tsx` plus the heatmap. Default All Games data is static JSON under `public/scorigami-data/` (traditional and home/away, per franchise). Game-type filters still hit `/api/scorigami`.
- **Database.** Postgres (Supabase) holds `gamelogs` and bot records in `posted_updates`. Nightly ingest lives in the separate backend repo; a GitHub Action here dumps materialized yearly views to that static JSON and refreshes the OG image.
- **Bot.** cron-job.org calls `/api/cron/check-games` every five minutes. Finals are classified (Scorigami, Modern Era, Playoffigami, Franchisigami, Rarigami, or a normal final) and posted to X. History lookups for posting go through the Postgres pool, not PostgREST.
- **Ops.** `/ops` is a gated health page for ingest, cron, unposted Finals, and API error rate.

`.env*` is gitignored. Do not commit secrets. Local and production credentials live in `.env.local` and Vercel, respectively.

## Repo map

```
app/page.tsx                 homepage grid
app/archive/                 first-occurrence archive
app/about/                   about
app/ops/                     health dashboard
app/api/cron/check-games/    posting cron
app/api/scorigami/           yearly data API (filters / fallback)
components/                  heatmap, filters, ops UI
lib/                         queries, MLB metadata, probability
public/scorigami-data/       static yearly dumps
scripts/dump-scorigami-data.js
scripts/generate-og-image.js
```

## Local

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000). Without a `.env.local` the static grid still loads; live queries, posting, and ops will not.

```bash
node scripts/dump-scorigami-data.js
node scripts/generate-og-image.js
```
