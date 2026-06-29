/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // Don't let a lint warning fail the production build on the host.
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
