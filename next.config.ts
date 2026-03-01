import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Prevent webpack from trying to bundle native Node.js binaries.
  // @huggingface/transformers uses onnxruntime-node which ships platform-specific
  // .node binaries — these must run in the Node.js process, not through webpack.
  serverExternalPackages: [
    '@huggingface/transformers',
    'onnxruntime-node',
    'sharp',
  ],
};

export default nextConfig;
