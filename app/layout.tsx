import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "MLB Scorigami",
  description: "Explore the complete history of Major League Baseball final scores with an interactive heatmap. Discover which scores have never happened and when each unique score occurred.",
  icons: {
    icon: { url: "/logo3.svg", type: "image/svg+xml" },
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
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased bg-slate-50 dark:bg-[#121212]`}>
        {children}
      </body>
    </html>
  );
}
