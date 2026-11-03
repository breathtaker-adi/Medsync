import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (isProd ? "/Medsync" : "");

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath ? basePath : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // StrictMode enabled for clean component lifecycle and leak detection
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "motion", "three", "gsap"],
  },
};

export default nextConfig;
