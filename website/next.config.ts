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
  // Matches the behaviour the site was built & verified with:
  // no StrictMode double-invoke (GSAP timelines + preloader rely on it).
  reactStrictMode: false,
};

export default nextConfig;
