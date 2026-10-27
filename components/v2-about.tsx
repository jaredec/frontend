import type { AllTimeTotals } from "@/lib/unique-scores";

const linkCls =
  "text-[var(--team-link)] underline underline-offset-2 decoration-[var(--team-link)] hover:text-[var(--team-ink)] hover:decoration-[var(--team-ink)] transition-colors duration-200";

const h3Style = {
  fontFamily: "var(--v2-ui-font), system-ui, sans-serif",
  fontWeight: 700,
  fontStyle: "normal" as const,
  fontSize: 24,
  margin: "35px 0 10px",
};
const pStyle = {
  fontSize: 17,
  margin: 0,
  fontWeight: 500,
};

/** `className` overrides the default width classes. */
export default function V2About({
  className = "w-[90%] max-[900px]:w-[95%] max-w-[1150px] mx-auto",
  totals,
}: { className?: string; totals?: AllTimeTotals | null }) {
  return (
    <section
      id="about"
      className={`${className} mt-6 sm:mt-10 mb-0 bg-[var(--surface)] text-[var(--ink)] pt-10 pb-[65px] text-center`}
      style={{
        fontFamily: "var(--v2-ui-font), system-ui, sans-serif",
        fontWeight: 500,
        fontStyle: "normal",
      }}
    >
      <h2
        className="w-full text-[40px] mb-[10px] px-0"
        style={{
          fontFamily: "var(--v2-title-font)",
          fontWeight: "var(--v2-title-weight)",
          fontStyle: "normal",
        }}
      >
        What is this?
      </h2>
      <div className="w-[65%] max-[900px]:w-[80%] mx-auto text-left">
        <p style={{ ...pStyle, marginBottom: 16 }}>
          A Scorigami is a final score that&apos;s never happened before. The term comes from Jon Bois, who coined it
          for the{" "}
          <a href="https://nflscorigami.com/" target="_blank" rel="noopener noreferrer" className={linkCls}>
            NFL
          </a>
          .
        </p>
        <p style={{ ...pStyle, marginBottom: 16 }}>
          This grid has every final score in MLB history, going back to 1871.
          {totals &&
            ` That's ${totals.games.toLocaleString("en-US")} games, but only ${totals.scores.toLocaleString("en-US")} different scores.`}{" "}
          Winning runs go across the top and losing runs go down the side. The bolder the square, the more often that
          score has happened, and the empty ones haven&apos;t happened yet. Click a square to see how many times
          it&apos;s happened and the last game that ended that way.
        </p>
        <p style={pStyle}>
          Pick a team to see its own grid, or narrow it down to the postseason or certain years. Double-tap the year
          slider to switch between a single season and a range. The expand button opens the grid up to 40 runs, which
          covers every game but one: the Philadelphia Athletics&apos; 49&ndash;33 win over the Troy Haymakers in 1871.
        </p>

        <h3 style={h3Style}>Where the data comes from</h3>
        <p style={pStyle}>
          Historical games come from{" "}
          <a href="https://www.retrosheet.org" target="_blank" rel="noopener noreferrer" className={linkCls}>
            Retrosheet
          </a>
          , a volunteer project that has spent decades piecing together old box scores. Recent games come from the
          MLB Stats API and update daily. Along with the NL and AL, that covers the five other leagues MLB recognizes
          as major, like the 1870s National Association and the 1914&ndash;15 Federal League. Negro League games
          aren&apos;t included yet, since their game-by-game records are still being filled in.
        </p>

        <h3 style={h3Style}>Follow along</h3>
        <p style={pStyle}>
          <a href="https://x.com/MLBgami" target="_blank" rel="noopener noreferrer" className={linkCls}>
            @MLBgami
          </a>{" "}
          on X posts every final and calls out each new Scorigami. Spot a mistake? Email{" "}
          <a href="mailto:scorigami.mlb@gmail.com" className={linkCls}>
            scorigami.mlb@gmail.com
          </a>
          .
        </p>
      </div>
    </section>
  );
}
