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
  title: "ReplayIQ — AI Fortnite Replay Analyzer",
  description:
    "Upload your Fortnite tournament replay. AI analyzes your gameplay and pinpoints every mistake with timestamps.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#05050f] text-gray-100 flex flex-col selection:bg-blue-500/30 selection:text-blue-100">
        {children}
      </body>
    </html>
  );
}
