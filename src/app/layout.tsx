import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Skylark Command Center",
  description: "Evidence-backed, read-only monday.com business intelligence for leaders.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
