"use client";

import { motion, type Variants } from "framer-motion";
import { RotateCw, Map, Shield, Zap, Target, TrendingUp, Brain, Wind, Clock } from "lucide-react";
import type { Mistake } from "@/lib/analyzer";

const severityConfig = {
  critical: {
    label: "Critical",
    labelBg: "bg-red-500",
    glow: "hover:shadow-[0_4px_24px_rgba(239,68,68,0.12)]",
    border: "border-red-500/20 hover:border-red-500/40",
    bg: "bg-red-500/[0.04]",
    accentBar: "bg-red-500",
    dot: "bg-red-400",
  },
  major: {
    label: "Major",
    labelBg: "bg-orange-500",
    glow: "hover:shadow-[0_4px_24px_rgba(249,115,22,0.12)]",
    border: "border-orange-500/20 hover:border-orange-500/40",
    bg: "bg-orange-500/[0.04]",
    accentBar: "bg-orange-500",
    dot: "bg-orange-400",
  },
  minor: {
    label: "Minor",
    labelBg: "bg-yellow-500",
    glow: "hover:shadow-[0_4px_24px_rgba(234,179,8,0.12)]",
    border: "border-yellow-500/20 hover:border-yellow-500/40",
    bg: "bg-yellow-500/[0.03]",
    accentBar: "bg-yellow-500",
    dot: "bg-yellow-400",
  },
};

const categoryIcon: Record<string, React.ElementType> = {
  rotation: RotateCw,
  positioning: Map,
  building: Shield,
  editing: Zap,
  decision: Brain,
  aim: Target,
  storm: Wind,
};

const categoryColor: Record<string, string> = {
  rotation: "text-blue-400",
  positioning: "text-violet-400",
  building: "text-indigo-400",
  editing: "text-cyan-400",
  decision: "text-amber-400",
  aim: "text-red-400",
  storm: "text-purple-400",
};

interface Props {
  mistake: Mistake;
  index: number;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function MistakeCard({ mistake, index }: Props) {
  const cfg = severityConfig[mistake.severity];
  const Icon = categoryIcon[mistake.category] ?? Brain;
  const catColor = categoryColor[mistake.category] ?? "text-gray-400";

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      className={`relative rounded-2xl border ${cfg.border} ${cfg.bg} ${cfg.glow} transition-all duration-200 overflow-hidden`}
    >
      {/* Left severity accent bar */}
      <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full ${cfg.accentBar}`} />

      <div className="p-5 pl-6">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Severity badge */}
            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full text-white uppercase tracking-wide ${cfg.labelBg}`}>
              {cfg.label}
            </span>
            {/* Category */}
            <div className={`flex items-center gap-1 text-xs font-medium ${catColor}`}>
              <Icon size={12} />
              <span className="capitalize">{mistake.category}</span>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] px-2.5 py-1 rounded-lg shrink-0">
            <Clock size={10} className="text-gray-500" />
            <span className="text-xs font-mono text-gray-300">{mistake.timestamp}</span>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-white mb-2">
          <span className="text-gray-600 font-mono mr-1.5">#{index + 1}</span>
          {mistake.title}
        </h4>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed mb-3">{mistake.description}</p>

        {/* Fix section */}
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
          <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5">
            What to do instead
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{mistake.suggestion}</p>
        </div>
      </div>
    </motion.div>
  );
}
