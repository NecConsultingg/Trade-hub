/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Configure webpack to handle @react-pdf/renderer properly
  webpack: (config, { isServer }) => {
    // Handle ESM modules properly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
      topLevelAwait: true,
    };

    // Exclude @react-pdf/renderer from server-side bundling
    if (isServer) {
      config.externals = [
        ...config.externals,
        '@react-pdf/renderer',
      ];
    }

    return config;
  },
  // Transpile the ESM package
  transpilePackages: ['@react-pdf/renderer'],
};

export default nextConfig;
