import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";
import TeamLogo from "@/components/team-logo";

/** Centered logo and title with a stats line underneath; the theme toggle sits at the right. */
export default function SiteHeader({
  widthCls,
  logoCode,
  title,
  titleHref,
  children,
}: {
  widthCls: string;
  logoCode: string;
  title: string;
  titleHref?: string;
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
  const brandCls = "flex items-center gap-2.5 min-w-0 max-w-[calc(100%-5.5rem)]";

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
        <div className="absolute top-2.5 sm:top-3 bottom-0 -right-2 flex items-center">
          <ThemeToggle />
        </div>
      </div>
      {children}
    </header>
  );
}
