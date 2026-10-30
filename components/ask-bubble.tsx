"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { MessageCircleQuestion, X } from "lucide-react";

const loadChat = () => import("@/components/ask-chat");
const AskChat = dynamic(loadChat, { ssr: false, loading: () => <div className="flex-1" /> });

const HIDDEN_ON = ["/ops"];

/** Floating "Ask" button that opens Ask Scorigami in a panel (a full-screen sheet on phones). */
export default function AskBubble({ totalGames }: { totalGames: number | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The chat stays mounted after the first open so closing the panel keeps the conversation.
  const [started, setStarted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    // On phones the sheet covers the page, so the page behind it shouldn't scroll.
    const prevOverflow = document.body.style.overflow;
    if (window.matchMedia("(max-width: 639px)").matches) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <>
      {started && (
        <div
          role="dialog"
          aria-label="Ask Scorigami"
          className={`${open ? "flex" : "hidden"} fixed z-50 inset-0 h-[100dvh] flex-col bg-[var(--page)] text-[var(--ink)] sm:inset-auto sm:bottom-[5.5rem] sm:right-6 sm:h-[min(640px,calc(100dvh-7.5rem))] sm:w-[400px] sm:border sm:border-[var(--line)] sm:shadow-[var(--shadow-pop)] sm:origin-bottom-right sm:animate-in sm:fade-in-0 sm:zoom-in-95 sm:duration-150 motion-reduce:animate-none`}
          style={{ fontFamily: "var(--v2-ui-font), system-ui, sans-serif" }}
        >
          <div className="flex h-12 flex-none items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] pl-4 pr-1.5">
            <MessageCircleQuestion aria-hidden className="size-[18px] text-[var(--ink-2)]" strokeWidth={1.75} />
            <h2 className="flex-1 text-[15px] font-semibold">Ask Scorigami</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="press grid size-9 place-items-center rounded-full text-[var(--ink-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
            >
              <X className="size-[18px]" />
            </button>
          </div>
          <AskChat totalGames={totalGames} className="flex-1" />
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setStarted(true);
          setOpen((o) => !o);
        }}
        onPointerEnter={() => void loadChat()}
        onFocus={() => void loadChat()}
        aria-expanded={open}
        aria-label={open ? "Close Ask Scorigami" : "Ask Scorigami"}
        title={open ? undefined : "Ask Scorigami"}
        className={`press fixed z-50 bottom-4 right-4 sm:bottom-6 sm:right-6 flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--pill)] text-[var(--pill-fg)] shadow-[var(--shadow-pop)] ${open ? "max-sm:hidden w-12" : "pl-4 pr-5"}`}
        style={{ fontFamily: "var(--v2-ui-font), system-ui, sans-serif" }}
      >
        {open ? (
          <X className="size-5" />
        ) : (
          <>
            <MessageCircleQuestion aria-hidden className="size-5" strokeWidth={2} />
            <span className="text-[15px] font-semibold">Ask</span>
          </>
        )}
      </button>
    </>
  );
}
