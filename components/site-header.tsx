import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import TeamLogo from "@/components/team-logo";

const ICON_BTN =
  "press grid size-9 place-items-center rounded-full text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--team-accent)]";

function NavLink({ to }: { to: "archive" | "grid" }) {
  return to === "archive" ? (
    <Link href="/archive" aria-label="Scorigami archive" title="Archive" className={ICON_BTN}>
      <List aria-hidden className="size-[19px]" strokeWidth={1.75} />
    </Link>
  ) : (
    <Link href="/" aria-label="Back to the grid" title="Grid" className={ICON_BTN}>
      <LayoutGrid aria-hidden className="size-[18px]" strokeWidth={1.75} />
    </Link>
  );
}

/**
 * Centered logo and title with a stats line underneath. The nav icon sits left of
 * the title on phones (so the title stays centered) and beside the theme toggle above.
 */
export default function SiteHeader({
  widthCls,
  logoCode,
  title,
  titleHref,
  nav,
  children,
}: {
  widthCls: string;
  logoCode: string;
  title: string;
  titleHref?: string;
  nav: "archive" | "grid";
  children?: React.ReactNode;
}) {
  const brand = (
    <>
      <TeamLogo code={logoCode} className="h-9 w-9 sm:h-11 sm:w-11 object-contain flex-none" />
      <span
        className="truncate text-[24px] sm:text-[28px] leading-none tracking-tight text-[var(--ink)]"
        style={{
          fontFamily: "var(--v2-title-font)",
          fontWeight: "var(--v2-title-weight)",
          WebkitTextStroke: "0.3px var(--ink)",
        }}
      >
        {title}
      </span>
    </>
  );
  const brandCls = "flex items-center gap-2.5 min-w-0 max-w-[calc(100%-5.5rem)] sm:max-w-[calc(100%-10rem)]";

  return (
    <header className="w-full border-b border-[var(--line)] bg-[var(--surface)]">
      <div className={`${widthCls} relative pt-2.5 sm:pt-3 flex items-center justify-center`}>
        {titleHref ? (
          <Link href={titleHref} className={brandCls}>
            {brand}
          </Link>
        ) : (
          <div className={brandCls}>{brand}</div>
        )}
        <div className="absolute top-2.5 sm:top-3 bottom-0 -left-2 flex items-center sm:hidden">
          <NavLink to={nav} />
        </div>
        <div className="absolute top-2.5 sm:top-3 bottom-0 -right-2 flex items-center gap-0.5">
          <span className="hidden sm:contents">
            <NavLink to={nav} />
          </span>
          <ThemeToggle />
        </div>
      </div>
      {children}
    </header>
  );
}
