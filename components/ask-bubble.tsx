"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { MessageCircleQuestion, X } from "lucide-react";

const loadChat = () => import("@/components/ask-chat");
const AskChat = dynamic(loadChat, { ssr: false, loading: () => <div className="flex-1" /> });

const HIDDEN_ON = ["/ops"];

/** Floating "Ask" button that opens Ask Scorigami in a popup panel above it. */
export default function AskBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The chat stays mounted after the first open so closing the panel keeps the conversation.
  const [started, setStarted] = useState(false);
  // On phones the keyboard covers the bottom of the layout viewport; the panel rides above it.
  const [viewport, setViewport] = useState<{ height: number; keyboard: number } | null>(null);
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
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const sync = () =>
      setViewport({ height: vv.height, keyboard: Math.max(0, window.innerHeight - vv.height - vv.offsetTop) });
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [open]);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const keyboardOpen = (viewport?.keyboard ?? 0) > 80;

  return (
    <>
      {started && (
        <div
          role="dialog"
          aria-label="Ask Scorigami"
          className={`${open ? "flex" : "hidden"} fixed z-50 inset-x-3 bottom-[var(--ask-bottom)] h-[var(--ask-h)] flex-col overflow-hidden rounded-[12px] border border-[var(--control-line)] bg-[var(--page)] text-[var(--ink)] shadow-[var(--shadow-pop)] origin-bottom-right animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none sm:inset-x-auto sm:right-6 sm:bottom-[5.5rem] sm:h-[min(600px,calc(100dvh-7.5rem))] sm:w-[380px]`}
          style={{
            fontFamily: "var(--v2-ui-font), system-ui, sans-serif",
            ["--ask-bottom" as string]: keyboardOpen ? `${viewport!.keyboard + 12}px` : "4.75rem",
            ["--ask-h" as string]: keyboardOpen
              ? `${Math.min(560, viewport!.height - 24)}px`
              : `min(560px, calc(${viewport ? `${viewport.height}px` : "100dvh"} - 6.25rem))`,
          }}
        >
          <AskChat onClose={close} className="flex-1" />
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
        className={`press fixed z-50 bottom-3 right-3 sm:bottom-6 sm:right-6 flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--pill)] text-[var(--pill-fg)] shadow-[var(--shadow-pop)] ${open ? "w-12" : "pl-4 pr-5"}`}
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
