/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep M0's "build doesn't gate on types" behavior: type errors still show in the
  // editor but don't block a deploy. (Next.js 16's `next build` no longer runs ESLint,
  // so the old `eslint: { ignoreDuringBuilds }` option is gone.)
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
