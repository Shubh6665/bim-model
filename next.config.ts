import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Avoid requiring 'canvas' in server bundle via pdfjs-dist
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('canvas');
      }
    }
    // Fallback to ignore 'canvas' resolution in client build as well
    config.resolve = config.resolve || {} as any;
    (config.resolve.fallback ||= {}).canvas = false as any;
    return config;
  },
};

export default nextConfig;
