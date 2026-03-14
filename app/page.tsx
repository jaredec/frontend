import type { Metadata } from "next";
import { getYearlyScorigami } from "@/lib/scorigami-queries";
import SWRProvider from "@/components/swr-provider";
import ScorigamiPage from "@/components/scorigami-page";

export const metadata: Metadata = {
  title: "MLB Scorigami — Every Final Score in Baseball History",
  description:
    "Interactive heatmap of every unique final score in MLB history since 1871. See which scores have never happened, filter by team or era, and explore box scores.",
  alternates: { canonical: "https://mlbscorigami.com" },
  openGraph: {
    title: "MLB Scorigami — Every Final Score in Baseball History",
    description:
      "Interactive heatmap of every unique final score in MLB history since 1871. See which scores have never happened, filter by team or era, and explore box scores.",
    url: "https://mlbscorigami.com",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "MLB Scorigami heatmap" }],
  },
};

export const revalidate = 3600;

export default async function Home() {
  const data = await getYearlyScorigami("ALL", "traditional");

  return (
    <SWRProvider
      fallback={{
        "/api/scorigami?team=ALL&type=traditional&mode=yearly": data,
      }}
    >
      <ScorigamiPage />
    </SWRProvider>
  );
}
