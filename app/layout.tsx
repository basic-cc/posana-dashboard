import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Posana Sales Dashboard",
  description: "Lead tracking map for Posana protein bars",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
