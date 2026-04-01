import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 300, // cache dynamic pages in the router for 5 minutes
    },
  },
};

export default nextConfig;
