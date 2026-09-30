import type { NextConfig } from "next";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // A self-contained server for the deploy/Dockerfile.web image.
  output: "standalone",
  transpilePackages: ["@nandex/ui"],
  // Read at request time by app/resume.pdf/route.ts when Drive is unavailable.
  outputFileTracingIncludes: { "/resume.pdf": ["./content/resume-fallback.pdf"] },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
