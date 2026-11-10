import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { buildOutput } from './src/lib/build-output';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // bridge/ is a separate service with its own package.json and lockfile, which
  // otherwise makes Next guess the wrong workspace root and trace files from
  // outside the app. Pin it explicitly.
  outputFileTracingRoot: __dirname,
  // Saathi handles health + voice data of elders under India's DPDP Act 2023.
  // These headers are the baseline; data residency is enforced by pinning the
  // Supabase project to ap-south-1 (Mumbai) — see docs/DPDP.md.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Microphone is the one capability we genuinely need.
            value: "camera=(), geolocation=(), microphone=(self)",
          },
        ],
      },
    ];
  },
};

export default (phase: string): NextConfig => ({ ...nextConfig, distDir: buildOutput(phase === PHASE_DEVELOPMENT_SERVER) });
