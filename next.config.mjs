/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Question payloads can include compressed WebP snippets (data URLs).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  webpack: (config) => {
    // pdfjs-dist optionally requires "canvas" in Node; never needed in the browser.
    config.resolve.alias.canvas = false;
    return config;
  },
};
export default nextConfig;
