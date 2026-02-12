import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TEAM_NAMES, CURRENT_FRANCHISE_CODES, FranchiseCode } from "@/lib/mlb-data";
import ScorigamiPage from "@/components/scorigami-page";

interface TeamPageProps {
  params: Promise<{ code: string }>;
}

export async function generateStaticParams() {
  return CURRENT_FRANCHISE_CODES.map((code) => ({ code: code.toLowerCase() }));
}

export async function generateMetadata({ params }: TeamPageProps): Promise<Metadata> {
  const { code } = await params;
  const upper = code.toUpperCase();
  const name = TEAM_NAMES[upper];
  if (!name) return {};

  const title = `${name} Scorigami — Every Final Score in Franchise History`;
  const description = `Explore every unique final score in ${name} history. See which scores have never happened, when each result last occurred, and browse box scores.`;

  return {
    title,
    description,
    alternates: { canonical: `/team/${code.toLowerCase()}` },
    openGraph: {
      title,
      description,
      url: `https://mlbscorigami.com/team/${code.toLowerCase()}`,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: `${name} Scorigami heatmap` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { code } = await params;
  const upper = code.toUpperCase();

  if (!TEAM_NAMES[upper]) {
    notFound();
  }

  return <ScorigamiPage initialClub={upper as FranchiseCode} />;
}
