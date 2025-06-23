import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  // ▼▼▼ ADD THIS VIEWPORT PROPERTY ▼▼▼
  viewport: "width=device-width, initial-scale=1.0",
  // ▲▲▲ THIS IS CRUCIAL FOR MOBILE ▲▲▲
  title: "MLB Scorigami - Visualizing Every Score in Baseball History",
  description: "Explore the complete history of Major League Baseball final scores with an interactive heatmap. Discover which scores have never happened and when each unique score occurred for the first time.",
  openGraph: {
    title: "MLB Scorigami",
    description: "An interactive visualization of every final score in MLB history.",
    url: "https://your-website-url.com",
    siteName: "MLB Scorigami",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MLB Scorigami",
    description: "Explore the complete history of MLB final scores with an interactive heatmap.",
    creator: "@jaredconnolly1",
    images: ["/twitter-image.png"],
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}