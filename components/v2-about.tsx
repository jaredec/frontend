"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { AllTimeTotals } from "@/lib/unique-scores";

const linkCls = "text-[var(--team-link)] hover:text-[var(--team-ink)] transition-colors duration-200";

function Faq({
  question,
  children,
  detailsRef,
  defaultOpen,
}: {
  question: string;
  children: React.ReactNode;
  detailsRef?: React.Ref<HTMLDetailsElement>;
  defaultOpen?: boolean;
}) {
  return (
    <details
      ref={detailsRef}
      open={defaultOpen}
      className="group rounded-[12px] border border-[var(--control-line)] bg-[var(--surface)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[12px] px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <h3 className="text-[16px] sm:text-[17px] font-semibold leading-[1.35]">{question}</h3>
        <ChevronDown
          aria-hidden
          className="size-5 flex-none text-[var(--ink-2)] transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-[15.5px] sm:text-[16.5px] leading-[1.6] text-[var(--ink-2)]">
        {children}
      </div>
    </details>
  );
}

/** FAQ dropdowns with the first open; /#about (where /about redirects) reopens it and scrolls to it. `className` overrides the default width classes. */
export default function V2About({
  className = "w-[90%] max-[900px]:w-[95%] max-w-[1150px] mx-auto",
  totals,
}: { className?: string; totals?: AllTimeTotals | null }) {
  const firstRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (window.location.hash === "#about" && firstRef.current) {
      firstRef.current.open = true;
      firstRef.current.scrollIntoView();
    }
  }, []);

  return (
    <section
      id="about"
      className={`${className} mt-8 sm:mt-10 space-y-2 text-[var(--ink)]`}
      style={{ fontFamily: "var(--v2-ui-font), system-ui, sans-serif", fontWeight: 500, fontStyle: "normal" }}
    >
      <Faq question="What is a Scorigami?" detailsRef={firstRef} defaultOpen>
        <p>
          A Scorigami is a final score that has never happened before. Jon Bois{" "}
          <a href="https://www.youtube.com/watch?v=9l5C8cGMueY&t=0s" target="_blank" rel="noopener noreferrer" className={linkCls}>
            created the term
          </a>{" "}
          for the NFL, we made one for MLB.{" "}
          {totals
            ? `Across ${totals.games.toLocaleString("en-US")} games in MLB history, only ${totals.scores.toLocaleString("en-US")} unique final scores have occurred,`
            : "Only 358 unique final scores have occurred,"}{" "}
          with just one Scorigami since 2000. Because true Scorigamis are so rare, we also track other
          &apos;gami&apos; types, including Franchisigamis (team-level), which happen several times a season.
        </p>
      </Faq>

      <Faq question="How do I use the grid?">
        <p>
          Each square is a final score, with the winning score along the x-axis and the losing score along the y-axis. Darker squares have happened more often,
          while empty squares haven&apos;t happened yet. Tap any square to see how many times that score has happened and the
          most recent game to end with that score. Filters narrow the grid to a single team, the postseason, a single
          season, or a range of years. Double-tap the year slider to switch between a single season and a range.
          The expand button shows scores up to 40 runs, covering every game but one: the Philadelphia Athletics&apos;
          49&ndash;33 win over the Troy Haymakers in 1871.
        </p>
      </Faq>

      <Faq question="Where does the data come from?">
        <p>
          Most of the older games come from Retrosheet, whose volunteers have spent decades piecing together
          baseball&apos;s history. Newer games come from the MLB Stats API and are updated daily. The data goes back to
          the National Association in 1871 and also covers the American, Union, Players&apos;, and Federal leagues,
          along with the AL and NL. Negro League games aren&apos;t included for now.
        </p>
      </Faq>

      <Faq question="How can I follow along?">
        <p>
          <a href="https://x.com/MLBgami" target="_blank" rel="noopener noreferrer" className={linkCls}>
            @MLBgami
          </a>{" "}
          on X automatically posts every final score and lets you know when a game is a Scorigami. Have a suggestion or
          spot a mistake? Email scorigami.mlb@gmail.com.
        </p>
      </Faq>
    </section>
  );
}
