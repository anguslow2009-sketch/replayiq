"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Upload, Brain, Clock, RotateCw, Target, Map, Zap, Shield, TrendingUp, Wind, CheckCircle } from "lucide-react";
import Nav from "@/components/Nav";

type Feature = { icon: React.ElementType; label: string; desc: string; color: string };

const steps = [
  {
    n: "01",
    icon: Upload,
    title: "Drop your .replay file",
    desc: "Find it in Documents/My Games/Fortnite/Saved/Demos — drag it straight onto the page.",
  },
  {
    n: "02",
    icon: Brain,
    title: "AI watches your match",
    desc: "We parse every elim, damage event, and rotation, then route it to an elite AI coach.",
  },
  {
    n: "03",
    icon: Clock,
    title: "Get timestamped coaching",
    desc: "Every mistake comes with exact game-time, what went wrong, and what to do instead.",
  },
];

const features: Feature[] = [
  { icon: RotateCw, label: "Rotations", desc: "Zone path & movement timing", color: "blue" },
  { icon: Map, label: "Zone Strategy", desc: "Storm edge & late-circle reads", color: "violet" },
  { icon: Shield, label: "Build Fights", desc: "Box fights, ramp rushes, high ground", color: "indigo" },
  { icon: Zap, label: "Edit Speed", desc: "Edit patterns & reset discipline", color: "cyan" },
  { icon: Target, label: "Aim & Damage", desc: "Tracking, burst windows, weapon choice", color: "red" },
  { icon: TrendingUp, label: "Positioning", desc: "Height control & cover selection", color: "emerald" },
  { icon: Brain, label: "Decision Making", desc: "When to push, heel, or rotate", color: "amber" },
  { icon: Wind, label: "Storm Plays", desc: "Edge-zone timing & final circle", color: "purple" },
];

const iconColor: Record<string, string> = {
  blue: "text-blue-400 bg-blue-500/10 ring-blue-500/20",
  violet: "text-violet-400 bg-violet-500/10 ring-violet-500/20",
  indigo: "text-indigo-400 bg-indigo-500/10 ring-indigo-500/20",
  cyan: "text-cyan-400 bg-cyan-500/10 ring-cyan-500/20",
  red: "text-red-400 bg-red-500/10 ring-red-500/20",
  emerald: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20",
  amber: "text-amber-400 bg-amber-500/10 ring-amber-500/20",
  purple: "text-purple-400 bg-purple-500/10 ring-purple-500/20",
};

const stats = [
  { value: "8", label: "Mistake categories" },
  { value: "25", label: "Mistakes (Pro)" },
  { value: "<60s", label: "Analysis time" },
  { value: "Free", label: "First 5 minutes" },
];

const ease = "easeOut" as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <Nav />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 dot-grid overflow-hidden">
        <div className="absolute rounded-full pointer-events-none blur-3xl w-[700px] h-[700px] bg-blue-600/20 -top-48 -left-64" />
        <div className="absolute rounded-full pointer-events-none blur-3xl w-[600px] h-[600px] bg-violet-600/15 -bottom-32 -right-48 animate-float" style={{ animationDelay: "2s" }} />

        <div className="relative z-10 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs font-semibold px-4 py-2 rounded-full mb-8 tracking-widest uppercase"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            AI-Powered Competitive Coaching
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.08 }}
            className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.92] mb-7"
          >
            Stop Guessing.
            <br />
            <span className="gradient-text">See Every Mistake.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.16 }}
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Drop your Fortnite tournament replay. Our AI watches every kill, rotation,
            and edit — then tells you exactly what cost you placement with pinpoint timestamps.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.22 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-14"
          >
            <Link href="/upload" className="shimmer-cta inline-flex items-center justify-center gap-2 text-white font-bold px-8 py-4 rounded-xl text-lg">
              Analyze My Replay
              <ArrowRight size={18} />
            </Link>
            <Link href="/pricing" className="glass-card inline-flex items-center justify-center gap-2 text-gray-200 font-semibold px-8 py-4 rounded-xl text-lg hover:border-white/20 hover:text-white transition-all">
              View Pricing
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease, delay: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-px glass-card rounded-2xl overflow-hidden max-w-2xl mx-auto"
          >
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center py-4 px-3 bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-default">
                <div className="text-2xl font-black gradient-text">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5 text-center">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-gray-700 rounded mx-auto" />
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease }}
            className="text-center mb-16"
          >
            <div className="text-xs font-bold text-blue-400 tracking-widest uppercase mb-3">How it works</div>
            <h2 className="text-4xl md:text-5xl font-black">Three steps to better play</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease, delay: i * 0.12 }}
                whileHover={{ y: -4 }}
                className="relative glass-card rounded-2xl p-7 group"
              >
                <div className="absolute top-6 right-6 text-5xl font-black text-white/[0.04] select-none">{step.n}</div>
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20 flex items-center justify-center mb-5 group-hover:bg-blue-500/20 transition-colors">
                  <step.icon size={20} className="text-blue-400" />
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                {i < 2 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-[#05050f] border border-white/10 items-center justify-center">
                    <ArrowRight size={12} className="text-gray-600" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section className="py-24 px-6 relative">
        <div className="absolute rounded-full pointer-events-none blur-3xl w-[400px] h-[400px] bg-violet-600/10 -top-10 -right-24" />
        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease }}
            className="text-center mb-14"
          >
            <div className="text-xs font-bold text-violet-400 tracking-widest uppercase mb-3">What gets analyzed</div>
            <h2 className="text-4xl md:text-5xl font-black">Every dimension of your game</h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, ease, delay: i * 0.05 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="glass-card rounded-2xl p-5 group cursor-default"
              >
                <div className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center mb-4 transition-all group-hover:scale-110 ${iconColor[f.color]}`}>
                  <f.icon size={18} />
                </div>
                <div className="font-bold text-sm mb-1">{f.label}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA section ── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
            className="glass-card rounded-3xl p-10 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-violet-600/5 pointer-events-none" />
            <div className="relative z-10">
              <div className="text-xs font-bold text-blue-400 tracking-widest uppercase mb-4">Free vs Pro</div>
              <h2 className="text-4xl font-black mb-4">Start free. Win more.</h2>
              <p className="text-gray-400 mb-8 leading-relaxed max-w-xl mx-auto">
                Free analyzes your first 5 minutes and flags up to 8 mistakes.
                Pro unlocks the full match with 25 flagged mistakes.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 mb-8 text-left">
                {[
                  { tier: "Free", border: "border-white/10", items: ["First 5 min analyzed", "Up to 8 mistakes", "All 8 categories", "Timestamped feedback"] },
                  { tier: "Pro — $12/mo", border: "border-blue-500/30 bg-blue-500/5", items: ["Full match analysis", "Up to 25 mistakes", "Priority AI processing", "Unlimited replays"] },
                ].map((t) => (
                  <div key={t.tier} className={`rounded-2xl border p-5 ${t.border}`}>
                    <div className="font-bold text-sm mb-3 gradient-text">{t.tier}</div>
                    <ul className="space-y-2">
                      {t.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                          <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/upload" className="shimmer-cta inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3 rounded-xl">
                  Try for Free <ArrowRight size={16} />
                </Link>
                <Link href="/pricing" className="glass-card hover:border-white/20 inline-flex items-center justify-center gap-2 text-gray-300 hover:text-white font-semibold px-7 py-3 rounded-xl transition-all">
                  See Full Pricing
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Zap size={12} className="text-white fill-white" />
          </div>
          <span className="font-bold text-sm">Replay<span className="text-blue-400">IQ</span></span>
        </div>
        <p className="text-gray-600 text-xs">Not affiliated with Epic Games or Fortnite™</p>
      </footer>
    </div>
  );
}
