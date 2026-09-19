import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spark Lab — Kids Circuit Studio",
  description: "A playful, interactive circuit builder for children learning electronics.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
