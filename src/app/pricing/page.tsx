"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Zap, ArrowRight } from "lucide-react";
import Nav from "@/components/Nav";

const freeFeatures = [
  "First 5 minutes of each replay",
  "Up to 8 flagged mistakes",
  "All 8 mistake categories",
  "Timestamped coaching feedback",
  "Unlimited replays (cap applies)",
];

const proFeatures = [
  "Full match analysis — no time limit",
  "Up to 25 flagged mistakes per match",
  "Priority AI processing queue",
  "All 8 mistake categories",
  "Unlimited replays",
  "Match history dashboard",
];

export default function PricingPage() {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 flex flex-col items-center px-6 pt-32 pb-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs font-semibold px-4 py-2 rounded-full mb-6 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Simple Pricing
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
            Start free.<br />
            <span className="gradient-text">Win more.</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            No credit card required. Upgrade when you&apos;re ready to go deeper.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl w-full">
          {/* Free */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="glass-card rounded-2xl p-8 flex flex-col"
          >
            <div className="text-sm font-semibold text-gray-400 mb-1">Free</div>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-5xl font-black">$0</span>
            </div>
            <div className="text-gray-500 text-sm mb-7">Forever free</div>

            <ul className="space-y-3 flex-1 mb-8">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <CheckCircle size={15} className="text-green-400 mt-0.5 shrink-0" />
                  <span className="text-gray-300">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/upload"
              className="block text-center glass-card hover:border-white/20 text-gray-200 hover:text-white font-semibold px-6 py-3 rounded-xl transition-all"
            >
              Get Started Free
            </Link>
          </motion.div>

          {/* Pro — animated border */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="pro-glow-border"
          >
            <div className="relative bg-[#0b0b1e] rounded-[calc(1.25rem-1px)] p-8 flex flex-col h-full">
              {/* Popular badge */}
              <div className="absolute top-5 right-5 flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold px-3 py-1 rounded-full">
                <Zap size={10} className="fill-blue-300" />
                Most Popular
              </div>

              <div className="text-sm font-semibold text-blue-300 mb-1">Pro</div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-5xl font-black gradient-text">$12</span>
              </div>
              <div className="text-gray-500 text-sm mb-7">per month, cancel anytime</div>

              <ul className="space-y-3 flex-1 mb-8">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <CheckCircle size={15} className="text-blue-400 mt-0.5 shrink-0" />
                    <span className="text-gray-200">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="shimmer-cta w-full flex items-center justify-center gap-2 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Redirecting…
                  </span>
                ) : (
                  <>
                    Upgrade to Pro
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-gray-600 text-sm mt-10 text-center"
        >
          Payments powered by Stripe. Cancel anytime — no penalties, no hassle.
        </motion.p>
      </main>
    </div>
  );
}
