import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@repo/contracts": path.join(process.cwd(), "src/generated-contracts/index.ts"),
    };

    return config;
  },
};

export default nextConfig;
