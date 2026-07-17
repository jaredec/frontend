import type { Metadata } from "next";
import ScorigamiPage from "@/components/scorigami-page";

export const metadata: Metadata = {
  title: "MLB Scorigami | Every Final Score in Baseball History",
  description:
    "Interactive heatmap of every unique final score in MLB history since 1871. See which scores have never happened, filter by team or era, and explore box scores.",
  alternates: { canonical: "https://mlbscorigami.com" },
  openGraph: {
    title: "MLB Scorigami | Every Final Score in Baseball History",
    description:
      "Interactive heatmap of every unique final score in MLB history since 1871. See which scores have never happened, filter by team or era, and explore box scores.",
    url: "https://mlbscorigami.com",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "MLB Scorigami heatmap" }],
  },
};

export default function Home() {
  return (
    <>
      <h1 className="sr-only">
        MLB Scorigami: every unique final score in Major League Baseball history
      </h1>
      <ScorigamiPage />
    </>
  );
}
