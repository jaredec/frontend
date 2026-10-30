import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Cookie, Source_Sans_3, Anonymous_Pro } from "next/font/google";

const cookie = Cookie({ subsets: ["latin"], weight: "400", variable: "--font-cookie" });
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source-sans",
});
const anonymousPro = Anonymous_Pro({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-anonymous-pro",
});
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AskBubble from "@/components/ask-bubble";
import { allTimeTotals } from "@/lib/unique-scores";
import "./globals.css";

const SITE_URL = "https://mlbscorigami.com";
const TITLE = "MLB Scorigami";
const DESCRIPTION =
  "Explore every final score in Major League Baseball history with an interactive heatmap. Discover which scores have never happened, filter by team and era, and find box scores for each unique result.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s | MLB Scorigami",
  },
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
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
    images: [{ url: "/og.png?v=3", width: 1200, height: 630, alt: "MLB Scorigami heatmap" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@MLBgami",
    images: ["/og.png?v=3"],
  },
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#2a2a2a" },
  ],
};

// Runs before first paint so a dark-mode visitor never sees the light page flash.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("theme");var d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${anonymousPro.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${cookie.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "MLB Scorigami",
                url: SITE_URL,
                description: DESCRIPTION,
                image: `${SITE_URL}/mlb-scorigami-heatmap.png`,
                author: { "@type": "Person", name: "Jared Connolly" },
                potentialAction: {
                  "@type": "SearchAction",
                  target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/team/{team}` },
                  "query-input": "required name=team",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "MLB Scorigami",
                url: SITE_URL,
                description: DESCRIPTION,
                image: `${SITE_URL}/mlb-scorigami-heatmap.png`,
                applicationCategory: "SportsApplication",
                operatingSystem: "Any",
                offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                author: { "@type": "Person", name: "Jared Connolly" },
              },
            ]),
          }}
        />
        {children}
        <AskBubble totalGames={allTimeTotals()?.games ?? null} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
