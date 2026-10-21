// Shared page width for the classic layout: every section (header, stats bar,
// filters, grid, About card, footer) uses it so their edges line up. Below desktop
// the side margins are fixed and wide enough to hold the grid's row numbers, so the
// cells span the same width as the filters. On desktop the page is capped at the
// grid width where rows 0–25 of the 31-wide grid just fit below the header (with its
// stats line) and filters: 31/26 × (100svh − 221.5px) + y-axis (~22px) = 119.23svh − 242px.
export const CLASSIC_PAGE_CLS =
  "w-[calc(100%-40px)] sm:w-[calc(100%-56px)] lg:w-[90%] max-w-[1150px] lg:max-w-[min(1150px,calc(119.23svh-242px))] mx-auto";
