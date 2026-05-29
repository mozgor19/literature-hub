import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // googleapis uses Node.js streams – must run in Node.js runtime, not Edge
  serverExternalPackages: ["googleapis", "google-auth-library"],
  experimental: {
    // The auth proxy buffers request bodies; raise the limit for PDF uploads.
    proxyClientMaxBodySize: "64mb",
  },
};

export default nextConfig;
