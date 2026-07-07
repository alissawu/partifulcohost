import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partiful Cohost - Multi-host Guest Vetting",
  description: "Coordinate guest approvals with your co-hosts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
