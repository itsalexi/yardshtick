import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@yard/contracts", "@yard/mock-data"],
};

export default nextConfig;
