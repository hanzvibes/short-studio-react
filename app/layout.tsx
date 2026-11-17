import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Short Studio",
  description:
    "Short Studio — editor NLE untuk paket threejs-cinematic-short: pilih template, preview 9:16, scrub timeline, ubah teks, ekspor MP4.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
