import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loads its .wasm file from its own package folder at runtime, so it can't be bundled.
  serverExternalPackages: ["libpg-query"],
  experimental: {
    staleTimes: {
      dynamic: 300, // cache dynamic pages in the router for 5 minutes
    },
  },
  async redirects() {
    return [
      { source: "/archive", destination: "/", permanent: true },
      { source: "/history", destination: "/", permanent: true },
      { source: "/v2", destination: "/", permanent: true },
      { source: "/about", destination: "/#about", permanent: true },
    ];
  },
};

export default nextConfig;
