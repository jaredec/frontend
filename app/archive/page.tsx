import type { Metadata } from "next";
import PageFooter from "@/components/page-footer";
import SiteHeader from "@/components/site-header";
import { CLASSIC_PAGE_CLS } from "@/lib/classic-layout";
import { getScorigamiArchive, PAGE_SIZE } from "@/lib/archive-queries";
import ArchiveTable from "./archive-table";

export const metadata: Metadata = {
  title: "Scorigami Archive",
  description:
    "Every unique final score in MLB history: the date it first occurred, the teams involved, and the ballpark where it happened.",
  alternates: { canonical: "/archive" },
  openGraph: {
    images: [{ url: "/og-archive.png", width: 1200, height: 630, alt: "Scorigami Archive: the most recent first-time final scores in MLB history" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-archive.png"],
  },
};

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { rows, total } = await getScorigamiArchive(page);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden team-scope bg-[var(--page)] text-[var(--ink)]"
      style={{ fontFamily: "var(--v2-ui-font), system-ui, sans-serif" }}
    >
      <SiteHeader widthCls={CLASSIC_PAGE_CLS} logoCode="ALL" title="MLB Scorigami" titleHref="/" nav="grid">
        <div
          className={`${CLASSIC_PAGE_CLS} h-8 flex items-center justify-center gap-x-2 sm:gap-x-2.5 whitespace-nowrap overflow-hidden text-[12.5px] sm:text-[13.5px] text-[var(--ink-2)]`}
        >
          <span className="text-[var(--team-ink)]">Scorigami Archive</span>
          <span className="text-[var(--ink-faint)]" aria-hidden>·</span>
          <span>
            <b className="font-semibold tabular-nums text-[var(--ink)]">{total.toLocaleString()}</b> scores, newest first
          </span>
        </div>
      </SiteHeader>

      <ArchiveTable
        className={`${CLASSIC_PAGE_CLS} flex-1 pt-4 sm:pt-6 pb-2 space-y-3`}
        rows={rows}
        total={total}
        currentPage={page}
        totalPages={totalPages}
      />

      <PageFooter light className={CLASSIC_PAGE_CLS} />
    </div>
  );
}
