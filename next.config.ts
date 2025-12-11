import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Exclude auth pages from service worker caching to prevent OAuth redirect issues
  runtimeCaching: [
    {
      // Don't cache auth-related navigation requests
      urlPattern: /\/(signin|signup|auth)/,
      handler: "NetworkOnly",
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Use empty turbopack config to allow webpack plugins (next-pwa)
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
  // Add headers to fix Cross-Origin-Opener-Policy warnings during Google sign-in
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
