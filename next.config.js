/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  // ffmpeg-static's binary is resolved at runtime via a computed path, which
  // Next's automatic serverless file tracing can miss — explicitly include
  // it for the upload route so video transcoding works once deployed.
  experimental: {
    outputFileTracingIncludes: {
      "/api/upload": ["./node_modules/ffmpeg-static/**"],
    },
  },
};

module.exports = nextConfig;
