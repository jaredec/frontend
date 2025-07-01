// layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  viewport: "width=device-width, initial-scale=1.0",
  title: "MLB Scorigami",
  description: "Explore the complete history of Major League Baseball final scores with an interactive heatmap. Discover which scores have never happened and when each unique score occurred.",
  // ... (keep the rest of your metadata)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      {/* We apply a cooler, more modern background color here */}
      <body className={`${inter.variable} font-sans antialiased bg-slate-50 dark:bg-gray-900`}>
        {children}
      </body>
    </html>
  );
}