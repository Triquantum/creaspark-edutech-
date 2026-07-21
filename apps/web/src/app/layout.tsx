import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Creaspark™ — Empowering Future Ready Education",
  description: "Creaspark: multi-tenant School ERP & Learning Management Platform for schools, STEM academies and educational organizations across India.",
  manifest: "/manifest.webmanifest",
};

export const viewport = { themeColor: "#2F6FB8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
