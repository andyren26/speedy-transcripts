/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep M0's "build doesn't gate on types" behavior: type errors still show in the
  // editor but don't block a deploy. (Next.js 16's `next build` no longer runs ESLint,
  // so the old `eslint: { ignoreDuringBuilds }` option is gone.)
  typescript: { ignoreBuildErrors: true },
  // The PDF export reads the Noto Sans TC font from disk at request time, so tell
  // Vercel to ship it with that route's serverless function.
  outputFileTracingIncludes: {
    "/api/jobs/[id]/transcript": ["./src/assets/fonts/**/*", "./node_modules/harfbuzzjs/dist/**/*"],
  },
  // subset-font finds its HarfBuzz .wasm with require.resolve() + fs.readFile(). If the
  // bundler inlines the package, that path turns into a number and the PDF download
  // crashes ("path argument must be of type string ... Received type number"). Keep
  // these as plain node_modules requires instead.
  serverExternalPackages: ["subset-font", "harfbuzzjs", "fontverter"],
};
export default nextConfig;
