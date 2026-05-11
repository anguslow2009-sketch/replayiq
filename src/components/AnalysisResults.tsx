"use client";

import { useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { Swords, Target, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyzer";
import MistakeCard from "./MistakeCard";
import Link from "next/link";

interface Props {
  result: AnalysisResult;
  meta: {
    gameDurationSecs: number;
    analyzedSecs: number;
    isPro: boolean;
    placement: number | null;
    kills: number;
  };
  fileName: string;
}

function RatingRing({ rating }: { rating: number }) {
  const [animated, setAnimated] = useState(false);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const progress = animated ? (rating / 10) * circumference : 0;

  const color =
    rating >= 8 ? "#22c55e" : rating >= 6 ? "#eab308" : rating >= 4 ? "#f97316" : "#ef4444";
  const shadowColor =
    rating >= 8 ? "rgba(34,197,94,0.4)" : rating >= 6 ? "rgba(234,179,8,0.4)" : "rgba(239,68,68,0.4)";

  const labelColor =
    rating >= 8 ? "text-green-400" : rating >= 6 ? "text-yellow-400" : rating >= 4 ? "text-orange-400" : "text-red-400";

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 100 100"
          fill="none"
        >
          {/* Track */}
          <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          {/* Progress */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            style={{
              filter: `drop-shadow(0 0 6px ${shadowColor})`,
              transition: "stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black ${labelColor}`}>{rating}</span>
          <span className="text-[10px] text-gray-600 font-medium">/ 10</span>
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-2 tracking-wide">Overall Rating</div>
    </div>
  );
}

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export default function AnalysisResults({ result, meta, fileName }: Props) {
  const criticals = result.mistakes.filter((m) => m.severity === "critical").length;
  const majors = result.mistakes.filter((m) => m.severity === "major").length;
  const minors = result.mistakes.filter((m) => m.severity === "minor").length;

  const analyzedMins = Math.round(meta.analyzedSecs / 60);
  const totalMins = Math.round(meta.gameDurationSecs / 60);

  return (
    <div className="space-y-6">
      {/* ── Summary card ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card rounded-2xl p-6 relative overflow-hidden"
      >
        {/* Subtle gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 to-violet-600/3 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="flex-1 min-w-0">
            {!meta.isPro && (
              <div className="inline-flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/25 text-amber-300 px-3 py-1.5 rounded-full mb-4">
                <AlertTriangle size={11} />
                Free — first {analyzedMins} of {totalMins} min analyzed
                <Link href="/pricing" className="underline hover:text-amber-200 transition-colors">
                  Upgrade →
                </Link>
              </div>
            )}
            <p className="text-gray-300 text-sm leading-relaxed max-w-lg">{result.summary}</p>
          </div>
          <RatingRing rating={result.overallRating} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { icon: TrendingUp, label: "Placement", value: meta.placement ? `#${meta.placement}` : "—", color: "text-blue-400" },
            { icon: Swords, label: "Kills", value: String(meta.kills), color: "text-violet-400" },
            { icon: AlertTriangle, label: "Mistakes", value: String(result.mistakes.length), color: "text-amber-400" },
            { icon: Target, label: "Severity", value: `${criticals}C ${majors}M ${minors}m`, color: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl p-3.5 text-center transition-colors">
              <s.icon size={13} className={`${s.color} mx-auto mb-1.5`} />
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="text-base font-bold text-white font-mono">{s.value}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Strengths ── */}
      {result.strengths.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h3 className="text-sm font-bold text-green-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            What you did well
          </h3>
          <div className="space-y-2">
            {result.strengths.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.4 }}
                className="flex gap-3 items-start bg-green-500/5 border border-green-500/15 rounded-xl px-4 py-3 text-sm text-gray-300"
              >
                <span className="text-green-400 shrink-0 mt-0.5 font-bold">✓</span>
                {s}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Mistakes ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            Mistakes
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            {criticals > 0 && <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">{criticals} Critical</span>}
            {majors > 0 && <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">{majors} Major</span>}
            {minors > 0 && <span className="bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/20">{minors} Minor</span>}
          </div>
        </div>

        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          {result.mistakes.map((mistake, i) => (
            <MistakeCard key={mistake.id} mistake={mistake} index={i} />
          ))}
        </motion.div>
      </div>

      {/* ── Upgrade CTA ── */}
      {!meta.isPro && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="pro-glow-border"
        >
          <div className="relative bg-[#0a0a1c] rounded-[calc(1.25rem-1px)] p-7 text-center">
            <div className="text-lg font-black mb-1 gradient-text">
              {totalMins - analyzedMins} more minutes left unanalyzed
            </div>
            <p className="text-gray-400 text-sm mb-5">
              Upgrade to Pro to analyze the full {totalMins}-minute match with up to 25 mistakes flagged.
            </p>
            <Link
              href="/pricing"
              className="shimmer-cta inline-flex items-center gap-2 text-white font-bold px-7 py-3 rounded-xl"
            >
              Upgrade to Pro — $12/month
              <ArrowRight size={15} />
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
