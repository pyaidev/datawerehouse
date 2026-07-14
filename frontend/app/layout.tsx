import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DWH Operations Console",
  description: "Next.js frontend for the real Data Warehouse API pipeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
