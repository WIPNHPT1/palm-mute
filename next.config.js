/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true }, // static export can't use the Next Image optimizer
  trailingSlash: true,
};

module.exports = nextConfig;
