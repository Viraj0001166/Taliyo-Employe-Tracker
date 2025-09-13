
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // General performance toggles
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  compiler: {
    // Strip console.* in production builds to reduce bundle size
    removeConsole: { exclude: ['error', 'warn'] },
  },

  // Keep build unblocked by lint/ts errors (adjust to your preference)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Optimize image handling and allow our SVG illustrations
  images: {
    dangerouslyAllowSVG: true,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'source.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Reduce bundle size by transforming named icon imports
  // modularizeImports removed temporarily to avoid path mismatches during build.
  // If needed, reintroduce with kebab-case transform after a clean rebuild.

  // Set long-term cache headers for static assets from /public
  async headers() {
    return [
      {
        source: '/tech-illustrations/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/logo-:path*.svg',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/icon.svg',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // Silence optional server-only dependencies that cause noisy warnings in
  // server bundles (Genkit/OpenTelemetry) and stub modules we don't use.
  // This does not impact runtime behavior since those paths are optional.
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@opentelemetry/exporter-jaeger': false,
      '@genkit-ai/firebase': false,
      'require-in-the-middle': false,
    } as any;

    // Reduce console noise from 3rd-party dynamic requires in server bundles
    // (these are harmless and not used at runtime in our app paths)
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Critical dependency: the request of a dependency is an expression/,
      /require\.extensions is not supported by webpack/,
    ];

    return config;
  },
};

export default nextConfig;
