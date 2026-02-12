import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Cookie } from "next/font/google";

const cookie = Cookie({ subsets: ["latin"], weight: "400", variable: "--font-cookie" });
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const SITE_URL = "https://mlbscorigami.com";
const TITLE = "MLB Scorigami — Every Final Score in Baseball History";
const DESCRIPTION =
  "Explore every final score in Major League Baseball history with an interactive heatmap. Discover which scores have never happened, filter by team and era, and find box scores for each unique result.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s | MLB Scorigami",
  },
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  keywords: [
    "scorigami",
    "MLB",
    "baseball",
    "scores",
    "heatmap",
    "baseball history",
    "final scores",
    "unique scores",
    "Major League Baseball",
  ],
  authors: [{ name: "Jared Connolly" }],
  creator: "Jared Connolly",
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "MLB Scorigami",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "MLB Scorigami heatmap" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@MLBgami",
    images: ["/og.png"],
  },
  icons: {
    icon: { url: "/logo3.svg", type: "image/svg+xml" },
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${cookie.variable} font-sans antialiased bg-slate-50 dark:bg-[#121212]`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "MLB Scorigami",
              url: SITE_URL,
              description: DESCRIPTION,
              applicationCategory: "SportsApplication",
              operatingSystem: "Any",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Person",
                name: "Jared Connolly",
              },
            }),
          }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
