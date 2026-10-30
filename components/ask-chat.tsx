"use client";

import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import type { AskStep } from "@/lib/ask/agent";
import type { GameLink } from "@/lib/ask/queries";

const EXAMPLES = [
  "When did the Cubs last lose 14-2?",
  "Has a World Series game ever ended 13-12?",
  "What's the most common final score at Coors Field?",
  "What was the last scorigami?",
];

const MAX_QUESTION = 300;

const KNOWS = [
  "Final scores, winners and losers for every MLB game since 1871",
  "Dates, home and away teams, and how many innings each game lasted",
  "Ballparks, under the name each park had at the time (Oracle Park only goes back to 2019)",
  "Postseason rounds: World Series from 1903, LCS from 1969, Division Series from 1981, Wild Card from 2012",
  "Averages and rankings by ballpark, season or decade, like runs per game or a team's record",
  "Franchise histories, so the Brooklyn Dodgers count as the Dodgers",
  "The site's terms: Scorigami, Rarigami, Socloseigami, Franchisigami and the rest",
];

const DOESNT_KNOW = [
  "Players, lineups or individual stats",
  "Hits, errors, home runs or inning-by-inning scoring, only final scores",
  "Standings, streaks, attendance, weather or betting odds",
  "Spring training, exhibitions or All-Star Games",
  "Negro League games (1920–1948), unless you ask for them",
];

function Coverage() {
  const list = (items: string[]) => (
    <ul className="mt-1.5 space-y-1 pl-4 list-disc marker:text-[var(--ink-faint)]">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
  const heading = "text-[12px] uppercase tracking-wider font-semibold text-[var(--ink-3)]";
  return (
    <div className="grid gap-4 text-[13px] leading-snug text-[var(--ink-2)]">
      <div>
        <p className={heading}>What it knows</p>
        {list(KNOWS)}
      </div>
      <div>
        <p className={heading}>What it doesn&apos;t</p>
        {list(DOESNT_KNOW)}
      </div>
    </div>
  );
}

type Answer = {
  id: string | null;
  status: "answered" | "unverified";
  answer: string;
  games: GameLink[];
  steps: AskStep[];
};

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; result: Answer }
  | { role: "error"; text: string; question: string; retry: boolean };

class AskError extends Error {
  constructor(
    message: string,
    readonly retry: boolean,
  ) {
    super(message);
  }
}

let memoryClientId: string | null = null;

/** Random per-browser id so rate limits apply per person, not per shared IP. Not tied to anything else. */
function clientId(): string {
  try {
    let id = localStorage.getItem("ask-client-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ask-client-id", id);
    }
    return id;
  } catch {
    memoryClientId ??= crypto.randomUUID();
    return memoryClientId;
  }
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Turns [g123] citations into box score links; unknown refs disappear. */
function Inline({ text, games }: { text: string; games: Map<string, GameLink> }) {
  return (
    <>
      {text.split(/(\[g\d+\])/g).map((part, i) => {
        const ref = /^\[(g\d+)\]$/.exec(part)?.[1];
        if (!ref) return <Fragment key={i}>{part}</Fragment>;
        const game = games.get(ref);
        if (!game?.url) return null;
        return (
          <a
            key={i}
            href={game.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Box score: ${game.label}, ${formatDate(game.date)}`}
            aria-label={`Box score: ${game.label}, ${formatDate(game.date)}`}
            className="inline-flex align-[-1px] ml-0.5 text-[var(--ink-3)] hover:text-[var(--team-link)] transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        );
      })}
    </>
  );
}

function AnswerText({ text, games }: { text: string; games: GameLink[] }) {
  const byRef = new Map(games.map((g) => [g.ref, g]));
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const isItem = /^[-•*]\s+/.test(line);
    const prev = blocks[blocks.length - 1];
    const content = line.replace(/^[-•*]\s+/, "");
    if (prev && prev.list === isItem && isItem) prev.lines.push(content);
    else blocks.push({ list: isItem, lines: [content] });
  }
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i} className="space-y-1 pl-4 list-disc marker:text-[var(--ink-faint)]">
            {b.lines.map((l, j) => (
              <li key={j}>
                <Inline text={l} games={byRef} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Inline text={b.lines[0]} games={byRef} />
          </p>
        ),
      )}
    </div>
  );
}

function Feedback({ id }: { id: string }) {
  const [sent, setSent] = useState<1 | -1 | null>(null);
  const send = (value: 1 | -1) => {
    if (sent) return;
    setSent(value);
    fetch("/api/ask/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, value }),
    }).catch(() => {});
  };
  const btn = "press grid size-7 place-items-center rounded-full transition-colors disabled:cursor-default";
  if (sent) return <span className="text-xs text-[var(--ink-3)]">Thanks for the feedback</span>;
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" onClick={() => send(1)} aria-label="Good answer" title="Good answer" className={`${btn} text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]`}>
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => send(-1)} aria-label="Bad answer" title="Bad answer" className={`${btn} text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]`}>
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AnswerCard({ result }: { result: Answer }) {
  return (
    <div className="border border-[var(--line)] bg-[var(--surface)]">
      <div className="px-3.5 pt-3.5 pb-3 text-[15px] leading-relaxed text-[var(--ink)]">
        <AnswerText text={result.answer} games={result.games} />
      </div>

      {result.games.length > 0 && (
        <ul className="border-t border-[var(--line)] divide-y divide-[var(--line)]">
          {result.games.map((g) => {
            const row = (
              <>
                <span className="w-[86px] flex-none tabular-nums text-[var(--ink-3)]">{formatDate(g.date)}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{g.label}</span>
                {g.url && <ArrowUpRight className="w-3 h-3 flex-none text-[var(--ink-faint)]" />}
              </>
            );
            const cls = "flex items-center gap-3 px-3.5 py-2 text-[12.5px]";
            return (
              <li key={g.ref}>
                {g.url ? (
                  <a href={g.url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:bg-[var(--surface-hover)] transition-colors`}>
                    {row}
                  </a>
                ) : (
                  <div className={cls}>{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-3.5 py-1.5 min-h-10">
        {result.steps.length > 0 ? (
          <details className="group min-w-0 flex-1 text-[12.5px] sm:text-[13px]">
            <summary className="cursor-pointer select-none list-none py-1 text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">How I found this</span>
              <span className="hidden group-open:inline">Hide steps</span>
              <span className="text-[var(--ink-faint)]"> · {result.steps.length} {result.steps.length === 1 ? "lookup" : "lookups"}</span>
            </summary>
            <ol className="mt-1 mb-1.5 space-y-1 text-[var(--ink-2)]">
              {result.steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex-none w-4 text-right tabular-nums text-[var(--ink-faint)]">{i + 1}</span>
                  <span className="min-w-0">
                    {s.label}
                    {s.result && <span className="text-[var(--ink-3)]"> → {s.result}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        ) : (
          <span className="text-[12.5px] text-[var(--ink-3)]">{result.status === "unverified" ? "Blocked by the number check" : ""}</span>
        )}
        {result.id && <Feedback id={result.id} />}
      </div>
    </div>
  );
}

function Thinking({ totalGames }: { totalGames: number | null }) {
  return (
    <div className="relative border border-[var(--line)] bg-[var(--surface)] overflow-hidden" role="status">
      <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden">
        <div className="h-full w-full bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--team-accent)_45%,transparent),transparent)] animate-shimmer" />
      </div>
      <p className="px-3.5 py-3.5 text-[15px] text-[var(--ink-3)]">
        Searching {totalGames ? `${totalGames.toLocaleString()} games` : "every game since 1871"}…
      </p>
    </div>
  );
}

/** The Ask Scorigami conversation, shown inside the floating chat panel. */
export default function AskChat({ className = "", totalGames }: { className?: string; totalGames: number | null }) {
  const inputId = useId();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useCallback(
    async (question: string, prior: Turn[]) => {
      const q = question.trim().slice(0, MAX_QUESTION);
      if (!q || pending) return;
      const thread: Turn[] = [...prior, { role: "user", text: q }];
      setTurns(thread);
      setInput("");
      setPending(true);

      const messages = thread.flatMap((t): { role: "user" | "assistant"; content: string }[] =>
        t.role === "user"
          ? [{ role: "user", content: t.text }]
          : t.role === "assistant" && t.result.status === "answered"
            ? [{ role: "assistant", content: t.result.answer }]
            : [],
      );
      // An unanswered question can't sit in the history without a reply.
      const cleaned = messages.filter((m, i) => !(m.role === "user" && messages[i + 1]?.role === "user"));

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Ask-Client": clientId() },
          body: JSON.stringify({ messages: cleaned }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new AskError(data.error || "Something went wrong. Please try again.", !data.limited);
        setTurns([...thread, { role: "assistant", result: data as Answer }]);
      } catch (err) {
        const retry = err instanceof AskError ? err.retry : true;
        const text = err instanceof AskError ? err.message : "Couldn't reach Ask Scorigami. Check your connection and try again.";
        setTurns([...thread, { role: "error", text, question: q, retry }]);
      } finally {
        setPending(false);
      }
    },
    [pending],
  );

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    // Refocusing on touch devices would pop the keyboard over the answer.
    if (!pending && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [turns, pending]);

  // Grow the textarea with its content, up to about five lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    ask(input, turns);
  };

  const reset = () => {
    setTurns([]);
    setInput("");
  };

  const empty = turns.length === 0;

  const thread = turns.map((t, i) =>
    t.role === "user" ? (
      <p key={i} className={`text-[15.5px] font-semibold leading-snug text-[var(--ink)] ${i > 0 ? "pt-3" : ""}`}>
        {t.text}
      </p>
    ) : t.role === "assistant" ? (
      <AnswerCard key={i} result={t.result} />
    ) : (
      <div
        key={i}
        className="flex items-center justify-between gap-3 border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-[14.5px] text-[var(--ink-2)]"
      >
        <span>{t.text}</span>
        {t.retry && i === turns.length - 1 && !pending && (
          <button
            type="button"
            onClick={() => ask(t.question, turns.slice(0, -2))}
            className="press flex-none text-[13px] text-[var(--ink)] hover:text-[var(--team-link)]"
          >
            Try again
          </button>
        )}
      </div>
    ),
  );

  const form = (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 border border-[var(--control-line)] focus-within:border-[var(--control-line-hover)] bg-[var(--surface)] pl-3.5 pr-1.5 py-1.5 shadow-[var(--shadow-soft)]"
    >
      <label htmlFor={inputId} className="sr-only">
        Your question
      </label>
      <textarea
        id={inputId}
        ref={inputRef}
        rows={1}
        value={input}
        maxLength={MAX_QUESTION}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={empty ? "Ask about any score, team, or ballpark…" : "Ask a follow-up…"}
        className="flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-6 text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none"
      />
      <button
        type="submit"
        disabled={!input.trim() || pending}
        aria-label="Ask"
        className="press grid size-9 flex-none place-items-center rounded-full bg-[var(--pill)] text-[var(--pill-fg)] disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ArrowUp className="w-4 h-4" strokeWidth={2.25} />
      </button>
    </form>
  );

  const examples = (
    <ul className="grid gap-2">
      {EXAMPLES.map((q) => (
        <li key={q}>
          <button
            type="button"
            onClick={() => ask(q, [])}
            className="press w-full text-left border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] px-3.5 py-2.5 text-[14px] text-[var(--ink-2)] hover:text-[var(--ink)]"
          >
            {q}
          </button>
        </li>
      ))}
    </ul>
  );

  const footnote = (
    <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-[var(--ink-3)]">
      <span>Answers can still be wrong. Check the box scores.</span>
      <button type="button" onClick={reset} disabled={pending} className="press inline-flex flex-none items-center gap-1 hover:text-[var(--ink)] disabled:opacity-40">
        <RotateCcw className="w-3 h-3" />
        New question
      </button>
    </div>
  );

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {empty ? (
          <>
            <p className="text-[14.5px] leading-relaxed text-[var(--ink-2)]">
              Ask anything about MLB final scores. Answers come from{" "}
              {totalGames ? `${totalGames.toLocaleString()} games` : "every game"} since 1871, and every number is checked against the data.
            </p>
            <div className="mt-4">{examples}</div>
            <details className="group mt-4">
              <summary className="cursor-pointer select-none list-none text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">What can it answer?</span>
                <span className="hidden group-open:inline">Hide</span>
              </summary>
              <div className="mt-3">
                <Coverage />
              </div>
            </details>
          </>
        ) : (
          <div className="space-y-3.5">
            {thread}
            {pending && <Thinking totalGames={totalGames} />}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-[var(--line)] bg-[var(--page)] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {form}
        {!empty && footnote}
      </div>
    </div>
  );
}
