"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Hash,
  History,
  ListChecks,
  ListOrdered,
  MapPin,
  RotateCcw,
  Shield,
  Sparkles,
  SquarePen,
  Star,
  Sun,
  Target,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { AskStep } from "@/lib/ask/agent";
import type { GameLink } from "@/lib/ask/queries";

const MAX_QUESTION = 300;

const KNOWS: { icon: LucideIcon; label: string }[] = [
  { icon: Hash, label: "Final scores" },
  { icon: CalendarDays, label: "Dates & matchups" },
  { icon: Timer, label: "Innings" },
  { icon: MapPin, label: "Ballparks" },
  { icon: Trophy, label: "Postseason" },
  { icon: BarChart3, label: "Averages & ranks" },
  { icon: Shield, label: "Franchises" },
  { icon: Sparkles, label: "-igami terms" },
];

const DOESNT_KNOW: { icon: LucideIcon; label: string }[] = [
  { icon: Users, label: "Players & stats" },
  { icon: Target, label: "Hits & home runs" },
  { icon: ListOrdered, label: "Standings" },
  { icon: Sun, label: "Spring training" },
  { icon: Star, label: "All-Star Games" },
  { icon: History, label: "Negro Leagues" },
];

const BOX = "rounded-[10px] border border-[var(--control-line)] bg-[var(--surface)]";
const ICON_BTN =
  "press grid size-8 place-items-center rounded-full text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-colors";

function Coverage() {
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer select-none list-none items-center gap-1 text-[13px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors group-open:text-[var(--ink)] group-open:font-semibold [&::-webkit-details-marker]:hidden">
        What can it answer?
        <ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2 grid grid-cols-2 gap-x-4">
        {KNOWS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-3 py-1.5 text-[13.5px] text-[var(--ink)]">
            <Icon aria-hidden className="size-4 flex-none text-[var(--ink-2)]" strokeWidth={1.75} />
            {label}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] font-semibold text-[var(--ink)]">Not covered</p>
      <ul className="mt-2 grid grid-cols-2 gap-x-4">
        {DOESNT_KNOW.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-3 py-1.5 text-[13.5px] text-[var(--ink-3)]">
            <Icon aria-hidden className="size-4 flex-none" strokeWidth={1.75} />
            {label}
          </li>
        ))}
      </ul>
    </details>
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

/** Cited games show as cards under the answer, so their [g123] refs are dropped from the text. */
function AnswerText({ text }: { text: string }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s*\[g\d+\]/g, "").trim();
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
              <li key={j}>{l}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.lines[0]}</p>
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
  const btn = (value: 1 | -1, Icon: LucideIcon, label: string) => (
    <button
      type="button"
      onClick={() => send(value)}
      disabled={sent !== null}
      aria-label={label}
      aria-pressed={sent === value}
      title={sent === value ? "Thanks for the feedback" : label}
      className={`${ICON_BTN} disabled:cursor-default disabled:hover:bg-transparent ${
        sent === value ? "text-[var(--ink)]" : sent ? "opacity-30" : ""
      }`}
    >
      <Icon className="size-3.5" fill={sent === value ? "currentColor" : "none"} />
    </button>
  );
  return (
    <>
      {btn(1, ThumbsUp, "Good answer")}
      {btn(-1, ThumbsDown, "Bad answer")}
    </>
  );
}

function AnswerCard({ result }: { result: Answer }) {
  const [showSteps, setShowSteps] = useState(false);
  return (
    <div>
      <div className="text-[15px] leading-relaxed text-[var(--ink)]">
        <AnswerText text={result.answer} />
      </div>

      {result.games.length > 0 && (
        <ul className="mt-2.5 grid gap-1.5">
          {result.games.map((g) => {
            const row = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-[var(--ink)]">{g.label}</span>
                  <span className="block text-[12px] tabular-nums text-[var(--ink-3)]">{formatDate(g.date)}</span>
                </span>
                {g.url && <ArrowUpRight className="size-4 flex-none text-[var(--ink-3)]" />}
              </>
            );
            const cls = `${BOX} flex items-center gap-2 px-3 py-2`;
            return (
              <li key={g.ref}>
                {g.url ? (
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Box score"
                    className={`${cls} hover:border-[var(--control-line-hover)] transition-colors`}
                  >
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

      <div className="mt-1 -ml-1.5 flex items-center">
        {result.steps.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSteps((v) => !v)}
            aria-expanded={showSteps}
            aria-label={showSteps ? "Hide steps" : "How I found this"}
            title={showSteps ? "Hide steps" : "How I found this"}
            className={`${ICON_BTN} ${showSteps ? "text-[var(--ink)]" : ""}`}
          >
            <ListChecks className="size-3.5" />
          </button>
        )}
        {result.id && <Feedback id={result.id} />}
        {result.status === "unverified" && (
          <span title="Blocked by the number check" className="ml-1 text-[var(--ink-3)]">
            <AlertCircle aria-label="Blocked by the number check" className="size-3.5" />
          </span>
        )}
      </div>

      {showSteps && (
        <ol className={`${BOX} mt-1 space-y-1 px-3 py-2 text-[12.5px] text-[var(--ink-2)]`}>
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
      )}
    </div>
  );
}

function Thinking() {
  return (
    <div role="status" className="flex h-6 items-center gap-1">
      <span className="sr-only">Searching</span>
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="size-1.5 rounded-full bg-[var(--ink-3)] animate-bounce"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  );
}

/** The Ask Scorigami conversation, shown inside the floating chat panel. */
export default function AskChat({ className = "", onClose }: { className?: string; onClose: () => void }) {
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
      <div key={i} className={`flex justify-end ${i > 0 ? "pt-3" : ""}`}>
        <p className="max-w-[85%] rounded-[12px] rounded-br-[4px] bg-[var(--pill)] px-3 py-2 text-[14.5px] leading-snug text-[var(--pill-fg)]">
          {t.text}
        </p>
      </div>
    ) : t.role === "assistant" ? (
      <AnswerCard key={i} result={t.result} />
    ) : (
      <div key={i} className={`${BOX} flex items-start gap-2 px-3 py-2.5 text-[14px] text-[var(--ink-2)]`}>
        <AlertCircle aria-hidden className="mt-0.5 size-4 flex-none text-[var(--ink-3)]" />
        <span className="min-w-0 flex-1">{t.text}</span>
        {t.retry && i === turns.length - 1 && !pending && (
          <button
            type="button"
            onClick={() => ask(t.question, turns.slice(0, -2))}
            aria-label="Try again"
            title="Try again"
            className={`${ICON_BTN} -my-1.5 -mr-1.5 flex-none`}
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>
    ),
  );

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex h-12 flex-none items-center pl-4 pr-1.5 pt-1">
        <h2
          className="flex-1 text-[19px] leading-none tracking-tight"
          style={{
            fontFamily: "var(--v2-title-font)",
            fontWeight: "var(--v2-title-weight)",
            WebkitTextStroke: "0.3px var(--ink)",
          }}
        >
          Ask Scorigami
        </h2>
        {!empty && (
          <button type="button" onClick={reset} disabled={pending} aria-label="New chat" title="New chat" className={`${ICON_BTN} size-9 disabled:opacity-40`}>
            <SquarePen className="size-[17px]" />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close" title="Close" className={`${ICON_BTN} size-9`}>
          <X className="size-[18px]" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4" aria-live="polite">
        {empty ? (
          <Coverage />
        ) : (
          <div className="space-y-2.5">
            {thread}
            {pending && <Thinking />}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="px-4 pt-1 pb-4">
        <form
          onSubmit={submit}
          className={`${BOX} flex items-end gap-2 hover:border-[var(--control-line-hover)] focus-within:border-[var(--control-line-hover)] pl-3 pr-1 py-1 shadow-[var(--shadow-soft)]`}
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
            placeholder={empty ? "Ask about a score, team, or ballpark" : "Ask a follow-up"}
            className="flex-1 resize-none bg-transparent py-1 text-[16px] leading-6 text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || pending}
            aria-label="Ask"
            className="press grid size-8 flex-none place-items-center rounded-[5px] bg-[var(--pill)] text-[var(--pill-fg)] disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </div>
  );
}
