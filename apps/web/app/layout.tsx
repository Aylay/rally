import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rally.lucas-attali.me"),
  title: "Rally — a shared real-time match companion",
  description:
    "Everyone sees the same second of the match. Make predictions, climb a live multiplayer leaderboard. Built with React, TypeScript and AWS.",
  openGraph: {
    title: "Rally — a shared real-time match companion",
    description:
      "Everyone sees the same second of the match. Make predictions, climb a live multiplayer leaderboard. Built with React, TypeScript and AWS.",
    url: "https://rally.lucas-attali.me",
    siteName: "Rally",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rally — a shared real-time match companion",
    description:
      "Everyone sees the same second of the match. Make predictions, climb a live multiplayer leaderboard.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
  }
