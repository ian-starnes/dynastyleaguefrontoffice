import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Fraunces } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

// Inter: clean, neutral UI typeface for nav, body copy, and chrome.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Fraunces: a refined serif reserved for the wordmark and hero statements,
// giving the shell an Augusta National / editorial weight rather than a
// generic SaaS look.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DLFO — Dynasty League Front Office",
  description:
    "The operating system for keeper and dynasty fantasy football.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
