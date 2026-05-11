"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileVideo, AlertCircle, RefreshCw, Zap, CheckCircle, Lock, Clock } from "lucide-react";
import AnalysisResults from "@/components/AnalysisResults";
import type { AnalysisResult } from "@/lib/analyzer";
import Nav from "@/components/Nav";

type State =
  | { phase: "idle" }
  | { phase: "dragging" }
  | { phase: "uploading"; step: 0 | 1 | 2 }
  | { phase: "done"; result: AnalysisResult; meta: Meta; fileName: string; rateLimit: RateLimit | null }
  | { phase: "error"; message: string; rateLimited?: boolean };

interface Meta {
  gameDurationSecs: number;
  analyzedSecs: number;
  isPro: boolean;
  placement: number | null;
  kills: number;
}

interface RateLimit {
  usedSecs: number;
  remainingSecs: number;
  limitSecs: number;
}

function fmtSecs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const uploadSteps = [
  { label: "Parsing replay file", icon: FileVideo },
  { label: "AI analyzing gameplay", icon: Zap },
  { label: "Building coaching report", icon: CheckCircle },
];

export default function UploadPage() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  const [isPro, setIsPro] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch rate limit status on mount
  useEffect(() => {
    fetch("/api/rate-limit")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setIsPro(data.isPro);
        if (!data.isPro) {
          setRateLimit({ usedSecs: data.usedSecs, remainingSecs: data.remainingSecs, limitSecs: data.limitSecs });
        }
      })
      .catch(() => {});
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".replay")) {
      setState({ phase: "error", message: "Please upload a .replay file from Fortnite." });
      return;
    }

    setState({ phase: "uploading", step: 0 });

    const formData = new FormData();
    formData.append("replay", file);

    const stepTimer = setTimeout(
      () => setState((s) => (s.phase === "uploading" ? { phase: "uploading", step: 1 } : s)),
      3000
    );
    const stepTimer2 = setTimeout(
      () => setState((s) => (s.phase === "uploading" ? { phase: "uploading", step: 2 } : s)),
      12000
    );

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      const data = await res.json();

      if (!res.ok) {
        setState({ phase: "error", message: data.error || "Upload failed.", rateLimited: data.rateLimited });
        return;
      }

      // Update local rate limit counter
      if (data.rateLimit) setRateLimit(data.rateLimit as RateLimit);

      setState({
        phase: "done",
        result: data.result,
        meta: data.meta,
        fileName: file.name,
        rateLimit: data.rateLimit ?? null,
      });
    } catch {
      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      setState({ phase: "error", message: "Network error. Please try again." });
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
      else setState({ phase: "idle" });
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (state.phase === "idle") setState({ phase: "dragging" });
  };

  const onDragLeave = () => {
    if (state.phase === "dragging") setState({ phase: "idle" });
  };

  const isDragging = state.phase === "dragging";
  const isLocked = !isPro && rateLimit !== null && rateLimit.remainingSecs === 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-28 pb-16">
        <AnimatePresence mode="wait">
          {/* ── Idle / Dragging ── */}
          {(state.phase === "idle" || state.phase === "dragging") && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-8">
                <h1 className="text-4xl font-black mb-2">Analyze Your Replay</h1>
                <p className="text-gray-400">
                  Upload a{" "}
                  <code className="text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded text-sm">.replay</code>{" "}
                  file from{" "}
                  <span className="text-gray-300 font-mono text-sm">
                    Documents/My Games/Fortnite/Saved/Demos
                  </span>
                </p>
              </div>

              {/* Time-based rate limit bar */}
              {!isPro && rateLimit !== null && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mb-5 glass-card rounded-xl px-4 py-4 ${
                    isLocked ? "border-red-500/30 bg-red-500/5" : "border-white/8"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      {isLocked ? (
                        <Lock size={13} className="text-red-400" />
                      ) : (
                        <Clock size={13} className="text-blue-400" />
                      )}
                      <span className="text-sm font-semibold">
                        {isLocked ? (
                          <span className="text-red-400">Daily coaching limit reached</span>
                        ) : (
                          <span className="text-gray-300">
                            Free coaching today
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs font-mono tabular-nums">
                      {isLocked ? (
                        <span className="text-red-400">0:00 left</span>
                      ) : (
                        <span className="text-gray-400">
                          <span className="text-white">{fmtSecs(rateLimit.remainingSecs)}</span>
                          {" "}/ {fmtSecs(rateLimit.limitSecs)} remaining
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${isLocked ? "bg-red-500" : "bg-blue-500"}`}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(rateLimit.usedSecs / rateLimit.limitSecs) * 100}%`,
                      }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>

                  {isLocked && (
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-gray-500">Resets at midnight</span>
                      <Link
                        href="/pricing"
                        className="shimmer-cta text-xs font-bold text-white px-3 py-1.5 rounded-lg"
                      >
                        Upgrade to Pro
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Drop zone */}
              <motion.div
                onDrop={isLocked ? undefined : onDrop}
                onDragOver={isLocked ? undefined : onDragOver}
                onDragLeave={onDragLeave}
                onClick={isLocked ? undefined : () => inputRef.current?.click()}
                animate={isDragging ? { scale: 1.02 } : { scale: 1 }}
                transition={{ duration: 0.15 }}
                className={`relative rounded-3xl p-16 text-center transition-all duration-200 overflow-hidden ${
                  isLocked
                    ? "border-2 border-dashed border-white/5 opacity-40 cursor-not-allowed"
                    : isDragging
                    ? "border-2 border-blue-400 bg-blue-500/8 shadow-[0_0_60px_rgba(59,130,246,0.15)] cursor-pointer"
                    : "border-2 border-dashed border-white/10 hover:border-white/25 hover:bg-white/[0.02] cursor-pointer"
                }`}
              >
                <AnimatePresence>
                  {isDragging && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-violet-500/5 pointer-events-none"
                    />
                  )}
                </AnimatePresence>

                <div className="relative z-10">
                  <motion.div
                    animate={isDragging ? { scale: 1.2, y: -4 } : { scale: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mb-5 inline-flex"
                  >
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                        isLocked
                          ? "bg-white/5"
                          : isDragging
                          ? "bg-blue-500/20 ring-2 ring-blue-400/50"
                          : "bg-white/5"
                      }`}
                    >
                      {isLocked ? (
                        <Lock size={28} className="text-gray-600" />
                      ) : isDragging ? (
                        <FileVideo size={28} className="text-blue-400" />
                      ) : (
                        <Upload size={28} className="text-gray-500" />
                      )}
                    </div>
                  </motion.div>

                  <div className="text-xl font-bold mb-2">
                    {isLocked
                      ? "Daily limit reached"
                      : isDragging
                      ? "Release to analyze"
                      : "Drop your .replay file here"}
                  </div>
                  <div className="text-gray-500 text-sm">
                    {isLocked ? "Upgrade to Pro for unlimited analyses" : "or click to browse your files"}
                  </div>

                  {!isLocked && (
                    <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle size={12} className="text-green-500/60" />
                        Free — first 5 min
                      </span>
                      <span className="w-px h-3 bg-white/10" />
                      <span className="flex items-center gap-1.5">
                        <CheckCircle size={12} className="text-green-500/60" />
                        No credit card required
                      </span>
                    </div>
                  )}
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept=".replay"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </motion.div>
            </motion.div>
          )}

          {/* ── Uploading ── */}
          {state.phase === "uploading" && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center py-20"
            >
              <div className="relative w-20 h-20 mb-10">
                <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin" />
                <div
                  className="absolute inset-2 rounded-full border-2 border-transparent border-t-violet-400 animate-spin"
                  style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap size={20} className="text-blue-400" />
                </div>
              </div>

              <h2 className="text-2xl font-black mb-8">Analyzing your gameplay…</h2>

              <div className="flex flex-col gap-3 w-full max-w-sm">
                {uploadSteps.map((step, i) => {
                  const stepState = state.phase === "uploading" ? state.step : 0;
                  const done = i < stepState;
                  const active = i === stepState;

                  return (
                    <motion.div
                      key={step.label}
                      animate={{ opacity: done || active ? 1 : 0.35 }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        active ? "glass-card bg-blue-500/5 border-blue-500/20" : ""
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          done ? "bg-green-500/20" : active ? "bg-blue-500/20" : "bg-white/5"
                        }`}
                      >
                        {done ? (
                          <CheckCircle size={14} className="text-green-400" />
                        ) : active ? (
                          <span className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-white/20" />
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          done ? "text-gray-400 line-through" : active ? "text-white" : "text-gray-600"
                        }`}
                      >
                        {step.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              <p className="text-gray-600 text-xs mt-8">This takes 15–60 seconds</p>
            </motion.div>
          )}

          {/* ── Error ── */}
          {state.phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`glass-card rounded-2xl p-8 text-center ${
                state.rateLimited
                  ? "border-amber-500/25 bg-amber-500/5"
                  : "border-red-500/20 bg-red-500/5"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                  state.rateLimited ? "bg-amber-500/10" : "bg-red-500/10"
                }`}
              >
                {state.rateLimited ? (
                  <Lock size={22} className="text-amber-400" />
                ) : (
                  <AlertCircle size={22} className="text-red-400" />
                )}
              </div>

              <div
                className={`text-lg font-bold mb-2 ${
                  state.rateLimited ? "text-amber-400" : "text-red-400"
                }`}
              >
                {state.rateLimited ? "Daily limit reached" : "Upload failed"}
              </div>

              <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">{state.message}</p>

              <div className="flex items-center justify-center gap-3 flex-wrap">
                {state.rateLimited ? (
                  <Link
                    href="/pricing"
                    className="shimmer-cta inline-flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-xl"
                  >
                    <Zap size={14} />
                    Upgrade to Pro
                  </Link>
                ) : null}
                <button
                  onClick={() => setState({ phase: "idle" })}
                  className="inline-flex items-center gap-2 glass-card hover:border-white/20 text-gray-200 font-semibold px-5 py-2.5 rounded-xl transition-all"
                >
                  <RefreshCw size={14} />
                  {state.rateLimited ? "Back" : "Try Again"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Done ── */}
          {state.phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h1 className="text-3xl font-black">Your Analysis</h1>
                  <p className="text-gray-500 text-sm mt-1 font-mono truncate max-w-xs">
                    {state.fileName}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {state.rateLimit && (
                    <div className="text-xs text-gray-600 hidden sm:block font-mono">
                      {fmtSecs(state.rateLimit.remainingSecs)} coaching left today
                    </div>
                  )}
                  <button
                    onClick={() => setState({ phase: "idle" })}
                    className="glass-card hover:border-white/20 text-gray-400 hover:text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                  >
                    <RefreshCw size={13} />
                    New Replay
                  </button>
                </div>
              </div>
              <AnalysisResults result={state.result} meta={state.meta} fileName={state.fileName} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
