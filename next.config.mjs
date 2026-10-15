/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep M0's "build doesn't gate on types" behavior: type errors still show in the
  // editor but don't block a deploy. (Next.js 16's `next build` no longer runs ESLint,
  // so the old `eslint: { ignoreDuringBuilds }` option is gone.)
  typescript: { ignoreBuildErrors: true },
  // The PDF export reads the Noto Sans TC font from disk at request time, so tell
  // Vercel to ship it with that route's serverless function.
  outputFileTracingIncludes: {
    "/api/jobs/[id]/transcript": ["./src/assets/fonts/**/*"],
  },
};
export default nextConfig;
