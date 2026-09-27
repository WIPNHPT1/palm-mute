/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true }, // static export can't use the Next Image optimizer
  trailingSlash: true,
  // Lint every source folder, not just Next's defaults (app, components, lib).
  eslint: { dirs: ["app", "components", "context", "lib", "scripts", "e2e"] },
};

module.exports = nextConfig;
