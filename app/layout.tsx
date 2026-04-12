import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Watch History",
  description: "A timeline-first home for what you watched this week, month, and year."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

