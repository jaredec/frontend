"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_COLOR = { light: "#ffffff", dark: "#2a2a2a" };

function setThemeColor(dark: boolean) {
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    m.content = dark ? THEME_COLOR.dark : THEME_COLOR.light;
  }
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  setThemeColor(dark);
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // Follow the OS setting until the visitor picks one here.
  useEffect(() => {
    setThemeColor(document.documentElement.classList.contains("dark"));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!localStorage.getItem("theme")) applyTheme(mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const dark = !document.documentElement.classList.contains("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduced) applyTheme(dark);
    else document.startViewTransition(() => applyTheme(dark));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={`press group relative grid size-9 place-items-center rounded-full text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--team-accent)] ${className}`}
    >
      <Sun aria-hidden className="col-start-1 row-start-1 size-[18px] dark:hidden" strokeWidth={1.75} />
      <Moon aria-hidden className="col-start-1 row-start-1 size-[18px] hidden dark:block" strokeWidth={1.75} />
    </button>
  );
}
