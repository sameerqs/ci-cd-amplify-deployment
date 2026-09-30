import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for S3 + CloudFront — there is no Next.js server at request
  // time, so Server Actions, Route Handlers, the Image Optimization API and
  // this file's own headers() are all unavailable. Security headers moved to
  // the CloudFront Response Headers Policy (see infra/frontend/); uploads now
  // go straight from the browser to FastAPI instead of proxying through a
  // Next server, so the old serverActions/proxyClientMaxBodySize body-size
  // ceilings (TR-57) no longer apply here either.
  output: "export",
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@tabler/icons-react",
      "recharts",
      "date-fns",
      "motion",
    ],
  },
};

export default nextConfig;
