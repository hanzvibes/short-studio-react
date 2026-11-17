import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Template HTML disajikan apa adanya dari public/templates/.
  // Tidak ada optimasi gambar / font eksternal yang dipakai studio.
  reactStrictMode: true,
};

export default nextConfig;
