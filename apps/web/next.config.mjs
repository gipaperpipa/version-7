import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/contracts"],
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@repo/contracts": path.join(process.cwd(), "../../packages/contracts/dist/index.js"),
    };

    return config;
  },
};

export default nextConfig;
