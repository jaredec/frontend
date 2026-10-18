// Shared page width for the classic layout: every section (header, stats bar,
// filters, grid, About card, footer) uses it so their edges line up. On desktop the
// page is capped at the grid width where rows 0–25 of the 31-wide grid just fit
// below the header, stats bar and filters: 31/26 × (100svh − 238px) + y-axis
// (~22px) = 119.23svh − 262px.
export const CLASSIC_PAGE_CLS =
  "w-[90%] max-[900px]:w-[95%] max-w-[1150px] lg:max-w-[min(1150px,calc(119.23svh-262px))] mx-auto";
