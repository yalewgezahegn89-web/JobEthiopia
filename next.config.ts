import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/lib/securityHeaders";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [...SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
