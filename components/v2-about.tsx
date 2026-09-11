const linkCls =
  "text-[#2d91ff] underline underline-offset-2 decoration-[#2d91ff] hover:text-[#0b162a] hover:decoration-[#0b162a] transition-colors duration-200";

const h3Style = {
  fontFamily: '"dinosaur", sans-serif',
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

export default function V2About() {
  return (
    <section
      className="w-[90%] max-[900px]:w-[95%] max-w-[1150px] mx-auto mt-10 mb-0 bg-white pt-10 pb-[65px] text-center"
      style={{
        fontFamily: '"dinosaur", sans-serif',
        fontWeight: 500,
        fontStyle: "normal",
        color: "#343434",
      }}
    >
      <h2
        className="w-full text-[40px] mb-[10px] px-0"
        style={{
          fontFamily: '"ff-nexus-typewriter", var(--font-typewriter), sans-serif',
          fontWeight: 700,
          fontStyle: "normal",
          color: "#343434",
        }}
      >
        What is this?
      </h2>
      <div className="w-[65%] max-[900px]:w-[80%] mx-auto text-left">
        <p style={pStyle}>
          MLB Scorigami tracks and identifies final scores that have never previously occurred in Major League Baseball. This website is based on the original{" "}
          <a href="https://nflscorigami.com/" target="_blank" rel="noopener noreferrer" className={linkCls}>
            Scorigami
          </a>{" "}
          concept by Jon Bois.
        </p>

        <h3 style={h3Style}>What is a Scorigami?</h3>
        <p style={pStyle}>
          A Scorigami is simply a final score that has never happened before. In 155+ years of Major League Baseball, only 358 unique final scores have ever occurred. Filter to a team to see that club&apos;s own version: Cubsigami, Red Soxigami, and so on.
        </p>

        <h3 style={h3Style}>How does the grid work?</h3>
        <p style={pStyle}>
          The winning team&apos;s score is displayed along the horizontal axis, and the losing team&apos;s score is shown along the vertical axis. Darker blue cells have happened more often. White cells have never occurred. Navy cells are impossible, because a losing team cannot outscore the winner. Click any cell for the count, the most recent game, and a box score when one exists. Use the filters and year slider to explore a team, a season, or Home/Away scoring.
        </p>

        <h3 style={h3Style}>How was this created?</h3>
        <p style={{ ...pStyle, marginBottom: 16 }}>
          We consider 1871 the start of Major League Baseball. The game has changed a lot since then, and so has the recordkeeping. Early box scores were kept by hand and preserved imperfectly. What exists today is the result of decades of historical research, much of it done by volunteers.
        </p>
        <p style={{ ...pStyle, marginBottom: 16 }}>
          Historical data comes from{" "}
          <a href="https://www.retrosheet.org" target="_blank" rel="noopener noreferrer" className={linkCls}>
            Retrosheet
          </a>
          . Modern results update daily via the MLB Stats API. Coverage includes every recognized major league: NA (1871–75), NL (1876–), AA (1882–91), UA (1884), PL (1890), AL (1901–), and FL (1914–15).
        </p>
        <p style={pStyle}>
          Please note that Negro League games are currently excluded. MLB incorporated Negro League statistics into its official record in 2024, but game-level integration is still evolving. We&apos;d rather exclude them cleanly than include them incompletely.
        </p>

        <h3 style={h3Style}>Where else can I follow along?</h3>
        <p style={pStyle}>
          <a href="https://x.com/MLBgami" target="_blank" rel="noopener noreferrer" className={linkCls}>
            @MLBgami
          </a>{" "}
          posts after every MLB game: Scorigami, Playoffigami, Modern Era Scorigami, Franchisigami, Rarigami, and ordinary finals. Questions or corrections:{" "}
          <a href="mailto:scorigami.mlb@gmail.com" className={linkCls}>
            scorigami.mlb@gmail.com
          </a>
          .
        </p>
      </div>
    </section>
  );
}
