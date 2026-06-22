import type { Metadata } from "next";
import NavBar from "@/components/nav-bar";
import AboutContent from "./about-content";

export const metadata: Metadata = {
  title: "About",
  description:
    "What is MLB Scorigami? Learn about the project, the heatmap, the @MLBgami bot, and how data is sourced going back to 1871.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#1e1e1e] flex flex-col">
      <NavBar />
      <AboutContent />
    </div>
  );
}
