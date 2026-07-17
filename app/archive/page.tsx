import type { Metadata } from "next";
import PageFooter from "@/components/page-footer";
import NavBar from "@/components/nav-bar";
import { getScorigamiArchive, PAGE_SIZE } from "@/lib/archive-queries";
import ArchiveTable from "./archive-table";

export const metadata: Metadata = {
  title: "Scorigami Archive",
  description:
    "Every unique final score in MLB history: the date it first occurred, the teams involved, and how many times it has happened since.",
  alternates: { canonical: "/archive" },
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#1e1e1e] flex flex-col">
      <NavBar />

      <ArchiveTable
        rows={rows}
        total={total}
        currentPage={page}
        totalPages={totalPages}
      />

      <PageFooter />
    </div>
  );
}
