import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config: any) => {
    config.externals = [...(config.externals || []), "socket.io"];
    return config;
  },
};

export default nextConfig;
