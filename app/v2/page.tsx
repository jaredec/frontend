"use client";

import { useEffect } from "react";
import ScorigamiPage from "@/components/scorigami-page";

// Draft: single-page, light, centered layout (bearigami-style). The rest of the
// app is pinned to dark via <html class="dark"> in the root layout; this page
// removes that class while mounted so the light-first Tailwind classes render,
// then restores it on unmount. Localhost preview only.
export default function V2Preview() {
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.remove("dark");
    const prevBodyBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#f2f2f2"; // bearigami's --bg (soft gray canvas)
    // PREVIEW ONLY: load the real "ff-nexus-typewriter" face (Adobe Fonts) so localhost
    // matches bearigami exactly. For production this needs its own Adobe Fonts kit.
    const kit = document.createElement("link");
    kit.rel = "stylesheet";
    kit.href = "https://use.typekit.net/fjz0ydu.css";
    kit.id = "typekit-preview";
    document.head.appendChild(kit);
    return () => {
      if (wasDark) root.classList.add("dark");
      document.body.style.backgroundColor = prevBodyBg;
      kit.remove();
    };
  }, []);

  return <ScorigamiPage variant="single" />;
}
