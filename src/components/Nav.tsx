"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#05050f]/85 backdrop-blur-xl border-b border-white/[0.06]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow">
            <Zap size={15} className="text-white fill-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Replay<span className="text-blue-400">IQ</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            Pricing
          </Link>
          <Link
            href="/download"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            Download
          </Link>
          <Link
            href="/upload"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            Upload
          </Link>
          <Link
            href="/api/auth/signin"
            className="shimmer-cta text-sm font-semibold px-4 py-2 rounded-lg text-white ml-1"
          >
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}
