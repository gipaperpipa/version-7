import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/contracts"],
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
};

export default nextConfig;
