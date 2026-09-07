import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  allowedDevOrigins: ["*.trycloudflare.com", "localhost:3000", "127.0.0.1:3000"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@tanstack/react-query"],
  },
  async redirects() {
    return [
      {
        source: "/farm/list",
        destination: "/farm",
        permanent: false,
      },
      {
        source: "/farm/previous-tray",
        destination: "/farm",
        permanent: false,
      },
      {
        source: "/farm/waste",
        destination: "/farm",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
