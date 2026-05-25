import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 300, // cache dynamic pages in the router for 5 minutes
    },
  },
  async redirects() {
    return [
      { source: "/history", destination: "/archive", permanent: true },
    ];
  },
};

export default nextConfig;
