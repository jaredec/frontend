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
          A Scorigami is a final score that has never happened before in baseball history. The term comes from Jon
          Bois&apos;s{" "}
          <a href="https://nflscorigami.com/" target="_blank" rel="noopener noreferrer" className={linkCls}>
            NFL Scorigami
          </a>
          .
        </p>
        <p style={pStyle}>
          {totals
            ? `In ${totals.games.toLocaleString("en-US")} games dating back to 1871, only ${totals.scores.toLocaleString("en-US")} different final scores have occurred.`
            : "Only 358 different final scores have occurred."}{" "}
          Just one new score has appeared since 2000.
        </p>

        <h3 style={h3Style}>How to use the grid</h3>
        <p style={pStyle}>
          Winning runs run across the top, and losing runs run down the side. Darker squares have happened more often,
          while empty squares haven&apos;t happened yet. Click any square to see its total and the most recent game that
          ended that way. Pick a team to see that franchise&apos;s grid, or narrow the results to the postseason, a
          single year, or a range of years. Double-tap the year slider to switch between a single season and a range.
          The expand button shows scores up to 40 runs, covering every game but one: the Philadelphia Athletics&apos;
          49&ndash;33 win over the Troy Haymakers in 1871.
        </p>

        <h3 style={h3Style}>Where the data comes from</h3>
        <p style={pStyle}>
          Most of the older games come from{" "}
          <a href="https://www.retrosheet.org" target="_blank" rel="noopener noreferrer" className={linkCls}>
            Retrosheet
          </a>
          , whose volunteers have spent decades piecing together baseball&apos;s history. Newer games come from the MLB
          Stats API and are updated daily. The data goes back to the National Association in 1871 and also covers the
          American, Union, Players&apos;, and Federal leagues, along with the AL and NL. Negro League games aren&apos;t
          included for now. MLB&apos;s historical game-by-game record is still being updated, and I&apos;d rather leave
          them out than show an incomplete picture.
        </p>

        <h3 style={h3Style}>Follow along</h3>
        <p style={pStyle}>
          <a href="https://x.com/MLBgami" target="_blank" rel="noopener noreferrer" className={linkCls}>
            @MLBgami
          </a>{" "}
          on X automatically posts every final score and lets you know when one is a Scorigami. Have a suggestion or
          spot a mistake? Email{" "}
          <a href="mailto:scorigami.mlb@gmail.com" className={linkCls}>
            scorigami.mlb@gmail.com
          </a>
          .
        </p>
      </div>
    </section>
  );
}
