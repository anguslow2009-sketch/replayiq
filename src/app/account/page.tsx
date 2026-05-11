"use client";

import { useEffect, useState } from "react";
import { Zap, Copy, RefreshCw, Check, Monitor, Download } from "lucide-react";
import Link from "next/link";

export default function AccountPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchToken();
  }, []);

  async function fetchToken() {
    try {
      const res = await fetch("/api/auth/desktop-token");
      if (res.status === 401) {
        window.location.href = "/api/auth/signin?callbackUrl=/account";
        return;
      }
      const data = await res.json();
      setToken(data.token);
    } catch {
      setError("Failed to load token");
    } finally {
      setLoading(false);
    }
  }

  async function rotateToken() {
    setRotating(true);
    try {
      const res = await fetch("/api/auth/desktop-token", { method: "POST" });
      const data = await res.json();
      setToken(data.token);
    } catch {
      setError("Failed to rotate token");
    } finally {
      setRotating(false);
    }
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[#05050f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Zap size={13} className="text-white fill-white" />
            </div>
            <span className="font-bold tracking-tight">
              Replay<span className="text-blue-400">IQ</span>
            </span>
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-sm text-gray-400">Account</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Account</h1>
          <p className="text-gray-400 mt-1">Manage your ReplayIQ desktop connection.</p>
        </div>

        {/* Desktop Token Card */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Monitor size={15} className="text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold">Desktop Token</h2>
              <p className="text-xs text-gray-500 mt-0.5">Used to connect the ReplayIQ desktop app to your account</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {loading ? (
              <div className="h-12 rounded-lg bg-white/5 animate-pulse" />
            ) : error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="flex-1 bg-black/40 border border-white/[0.08] rounded-lg px-3 py-3 font-mono text-xs text-gray-300 tracking-wide overflow-hidden text-ellipsis whitespace-nowrap">
                    {token}
                  </div>
                  <button
                    onClick={copyToken}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/[0.08] rounded-lg transition-colors flex items-center gap-1.5 text-sm text-gray-400 hover:text-white shrink-0"
                  >
                    {copied ? (
                      <><Check size={14} className="text-green-400" /> Copied</>
                    ) : (
                      <><Copy size={14} /> Copy</>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Keep this token private — it grants access to your coaching quota.
                  </p>
                  <button
                    onClick={rotateToken}
                    disabled={rotating}
                    className="text-xs text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={rotating ? "animate-spin" : ""} />
                    Regenerate
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* How to connect */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="px-6 py-5 border-b border-white/[0.06]">
            <h2 className="font-semibold">How to connect the desktop app</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <ol className="space-y-3">
              {[
                { n: 1, text: "Download and install ReplayIQ Desktop for Windows below." },
                { n: 2, text: "Open the app — it appears in your system tray." },
                { n: 3, text: 'Click the app, then paste your Desktop Token into the "Connect" field.' },
                { n: 4, text: "Open Fortnite, go to Career → Replays, and open any match replay." },
                { n: 5, text: "ReplayIQ detects the replay viewer automatically and starts coaching every 30 seconds." },
              ].map(({ n, text }) => (
                <li key={n} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {n}
                  </span>
                  <span className="text-sm text-gray-300">{text}</span>
                </li>
              ))}
            </ol>

            <div className="pt-2">
              <Link
                href="/download"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-blue-500/20"
              >
                <Download size={15} />
                Download for Windows
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
