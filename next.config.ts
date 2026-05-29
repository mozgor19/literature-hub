import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // googleapis uses Node.js streams – must run in Node.js runtime, not Edge
  serverExternalPackages: ["googleapis", "google-auth-library"],
};

export default nextConfig;
