import Link from "next/link";
import { Zap, Download, Monitor, Shield, Cpu, ChevronRight } from "lucide-react";

export const metadata = {
  title: "Download ReplayIQ Desktop — Windows",
  description: "Download the ReplayIQ desktop app to get AI coaching while watching Fortnite replays.",
};

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-[#05050f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Zap size={13} className="text-white fill-white" />
            </div>
            <span className="font-bold tracking-tight">
              Replay<span className="text-blue-400">IQ</span>
            </span>
          </Link>
          <Link
            href="/api/auth/signin"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-20 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1.5 mb-2">
            <Monitor size={12} />
            Windows Desktop App
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Download ReplayIQ<br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Desktop
            </span>
          </h1>
          <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
            AI coaching that runs alongside Fortnite. Watch your replay in-game — ReplayIQ
            detects it automatically and flags your mistakes in real time.
          </p>
        </div>

        {/* Download card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="px-8 py-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-500/25 shrink-0">
              <Zap size={28} className="text-white fill-white" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="font-bold text-lg">ReplayIQ Desktop</div>
              <div className="text-sm text-gray-400 mt-0.5">Windows 10/11 · 64-bit · ~80 MB</div>
              <div className="text-xs text-gray-600 mt-1">Latest version · Free to install</div>
            </div>
            <a
              href="https://github.com/anguslow2009-sketch/replayiq/releases/latest/download/ReplayIQ-Setup.exe"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 shrink-0"
            >
              <Download size={17} />
              Download .exe
            </a>
          </div>
          <div className="px-8 pb-6 flex gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><Shield size={11} /> Code-signed installer</span>
            <span className="flex items-center gap-1.5"><Cpu size={11} /> Runs in system tray</span>
          </div>
        </div>

        {/* Setup steps */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Getting started</h2>
          <div className="space-y-3">
            {[
              {
                n: 1,
                title: "Install the app",
                body: "Run the downloaded installer. Windows SmartScreen may appear — click \"More info\" then \"Run anyway\". The app is safe and code-signed.",
              },
              {
                n: 2,
                title: "Connect your account",
                body: "Sign in to ReplayIQ on this website, then go to your Account page to get your Desktop Token. Paste it into the app.",
              },
              {
                n: 3,
                title: "Open a replay in Fortnite",
                body: "Launch Fortnite, go to Career → Replays, and open any match. ReplayIQ detects the replay viewer automatically — no setup needed.",
              },
              {
                n: 4,
                title: "Watch the coaching panel",
                body: "Every 30 seconds, ReplayIQ captures the screen, analyzes your position and decisions, and drops coaching cards in the floating panel.",
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                <span className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {n}
                </span>
                <div>
                  <div className="font-medium text-sm">{title}</div>
                  <div className="text-xs text-gray-400 mt-1 leading-relaxed">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-sm">Need your Desktop Token?</div>
            <div className="text-xs text-gray-400 mt-0.5">Sign in to your account and grab it from the Account page.</div>
          </div>
          <Link
            href="/account"
            className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors shrink-0"
          >
            Account page <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
