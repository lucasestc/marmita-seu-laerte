import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        // GitHub Codespaces — matches any port-forwarded URL
        "*.app.github.dev",
      ],
    },
  },
};

export default nextConfig;
