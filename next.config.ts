import type { NextConfig } from "next";

const supabaseHostname = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const supabaseCspHttpsSources = [
  "https://*.supabase.co",
  ...(supabaseHostname ? [`https://${supabaseHostname}`] : []),
];

const supabaseCspWssSources = [
  "wss://*.supabase.co",
  ...(supabaseHostname ? [`wss://${supabaseHostname}`] : []),
];

const isPlaywrightLocalHttp = process.env.PLAYWRIGHT_LOCAL_HTTP === "1";

const baseSecurityHeaders = [
  ...(!isPlaywrightLocalHttp ? [{
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  }] : []),
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      ["script-src 'self' 'unsafe-inline'", ...supabaseCspHttpsSources, "https://*.vercel-storage.com", "https://vercel.live"].join(' '),
      "style-src 'self' 'unsafe-inline'",
      ["img-src 'self' data: blob:", ...supabaseCspHttpsSources, "https://*.vercel-storage.com", "https://i.ytimg.com"].join(' '),
      "font-src 'self' data:",
      ["connect-src 'self'", ...supabaseCspHttpsSources, ...supabaseCspWssSources, "https://*.vercel-storage.com", "https://blob.vercel-storage.com", "https://api.resend.com", "https://api.openai.com", "https://generativelanguage.googleapis.com", "https://api.tavily.com"].join(' '),
      ["media-src 'self' blob: data:", ...supabaseCspHttpsSources, "https://*.vercel-storage.com"].join(' '),
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      ...(!isPlaywrightLocalHttp ? ["upgrade-insecure-requests"] : []),
    ].join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
];

const defaultPermissionsPolicy = 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()';
const recorderPermissionsPolicy = 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()';

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  typescript: {
    // Ignore typescript errors during build because we check types pre-push/locally.
    // This dramatically reduces memory usage and build times in VPS/Docker environments.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignore lint errors during build for the same reason.
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Disable separate build worker process to avoid spawning two memory-heavy Node processes.
    webpackBuildWorker: false,
    // Enable webpack memory optimizations to lower peak memory usage.
    webpackMemoryOptimizations: true,
  },
  // fluent-ffmpeg shells out to the operator-supplied FFmpeg executable.
  serverExternalPackages: ["fluent-ffmpeg", "happy-dom"],
  // Belt-and-braces: even if something slips past .vercelignore, the file
  // tracer won't drag it into the serverless function bundles. Keeps Lambda
  // cold-start size down and prevents docs/tests/scripts from inflating
  // every API route. "**" matches all routes.
  outputFileTracingExcludes: {
    "**": [
      "./docs/**",
      "./plans/**",
      "./tests/**",
      "./qa/**",
      "./scripts/**",
      "./launch-campaign/**",
      "./marketing-videos/**",
      "./supabase/**",
      "./playwright-report/**",
      "./test-results/**",
      "./lighthouse-report/**",
      "./.next/cache/**",
      "./node_modules/@types/**",
      "./node_modules/typescript/**",
      "./node_modules/eslint/**",
      "./node_modules/eslint-config-next/**",
      "./node_modules/@eslint/**",
      "./node_modules/@playwright/**",
      "./node_modules/playwright/**",
      "./node_modules/playwright-core/**",
      "./node_modules/shadcn/**",
      "./node_modules/@tailwindcss/postcss/**",
      "./node_modules/tw-animate-css/**",
    ],
  },
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [{
            protocol: "https" as const,
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          }]
        : []),
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/((?!dashboard/recorder(?:/)?$).*)',
        headers: [
          ...baseSecurityHeaders,
          {
            key: 'Permissions-Policy',
            value: defaultPermissionsPolicy,
          },
        ],
      },
      {
        source: '/dashboard/recorder',
        headers: [
          ...baseSecurityHeaders,
          {
            key: 'Permissions-Policy',
            value: recorderPermissionsPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
