"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Loader2, ArrowRight, LogIn, Moon, Sun, BookOpen, Users } from "lucide-react";
import { useTheme } from "next-themes";

import { useAuth } from "@/lib/useAuth";
import TsswalLogo from "@/components/TsswalLogo";
import { useTranslation } from "@/lib/i18n";

export default function LandingPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, userData, loading } = useAuth();
  const { t } = useTranslation();

  const FEATURES = [
    { icon: BookOpen, title: t("landing.feature1_title"), description: t("landing.feature1_desc") },
    { icon: Users,    title: t("landing.feature2_title"), description: t("landing.feature2_desc") },
    { icon: Sparkles, title: t("landing.feature3_title"), description: t("landing.feature3_desc") },
  ];

  const [isChecking, setIsChecking] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ─── منطق التوجيه الذكي ───
  useEffect(() => {
    if (!loading) {
      if (user) {
        if (userData) {
          const { role, status, onboarded } = userData;
          if (role === "admin") router.replace("/admin");
          else if (status === "pending") router.replace("/pending");
          else if (!onboarded) router.replace("/onboarding");
          else router.replace("/hub");
        }
      } else {
        setIsChecking(false);
      }
    }
    const safetyTimer = setTimeout(() => { if (!user) setIsChecking(false); }, 2000);
    return () => clearTimeout(safetyTimer);
  }, [user, userData, loading, router]);

  // ─── شاشة التحميل ───
  if (isChecking || (user && !userData) || !mounted) {
    return (
      <div className="min-h-screen bg-[#F8F8F5] dark:bg-[#050505] flex flex-col items-center justify-center gap-5 transition-colors duration-500">
        <div className="w-12 h-12 rounded-2xl bg-[#7c83f2]/10 flex items-center justify-center">
          <Loader2 size={24} className="text-[#7c83f2] animate-spin" />
        </div>
        <p className="font-sans text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase animate-pulse">
          {t("landing.loading")}
        </p>
      </div>
    );
  }

  if (user) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        .landing-wrapper {
          min-height: 100vh;
          font-family: 'Plus Jakarta Sans', sans-serif;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }

        .bg-text {
          font-family: 'Lora', serif;
          font-weight: 600;
          font-style: italic;
          font-size: clamp(50px, 12vw, 150px);
          line-height: 1;
          letter-spacing: -0.01em;
          user-select: none;
        }

        .fg-text {
          font-family: 'Lora', serif;
          font-weight: 500;
          font-size: clamp(40px, 10vw, 120px);
          color: #7c83f2;
          line-height: 0.9;
          letter-spacing: -0.02em;
          position: relative;
          z-index: 10;
        }

        .platform-name {
          font-family: 'Lora', serif;
          font-weight: 600;
          color: #7c83f2;
          font-size: 1.25rem;
          letter-spacing: -0.01em;
        }
        `
      }} />

      <div className="landing-wrapper bg-[#F8F8F5] dark:bg-[#0a0a0b] transition-colors duration-700">

        {/* ─── Header ─── */}
        <header className="w-full max-w-[1400px] mx-auto p-6 md:px-12 flex justify-between items-center relative z-20">
          <div className="flex items-center gap-3">
            <TsswalLogo size={28} className="text-[#7c83f2]" />
            <span className="platform-name">Tawassol</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-11 h-11 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:shadow-sm transition-all"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={() => router.push('/auth?mode=register')}
              className="flex px-6 py-2.5 rounded-full bg-[#7c83f2] hover:bg-[#686ee0] text-white text-sm font-semibold transition-all items-center gap-2 shadow-[0_8px_24px_-6px_rgba(124,131,242,0.6)] hover:shadow-[0_10px_28px_-6px_rgba(124,131,242,0.8)] hover:-translate-y-0.5"
            >
              {t("landing.join")}
            </button>

            <button
              onClick={() => router.push('/auth')}
              className="px-6 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-sm font-semibold text-[#1e3a8a] dark:text-indigo-400 hover:shadow-sm transition-all flex items-center gap-2"
            >
              {t("landing.signin")} <LogIn size={16} />
            </button>
          </div>
        </header>

        {/* ─── Main Content ─── */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full flex flex-col items-center"
          >
            {/* Tagline */}
            <div className="flex items-center gap-2 mb-8 md:mb-10">
              <Sparkles size={14} className="text-[#7c83f2]" />
              <span className="text-[10px] md:text-xs font-bold text-[#7c83f2]/80 uppercase tracking-[0.25em]">
                {t("landing.tagline")}
              </span>
            </div>

            {/* Hero — 3 animated lines */}
            <div className="flex flex-col items-center justify-center w-full relative mb-8">
              <motion.h1
                className="bg-text text-white dark:text-[#121214] drop-shadow-sm dark:drop-shadow-none"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.7, ease: "easeOut" }}
              >
                {t("landing.hero1")}
              </motion.h1>
              <motion.h2
                className="fg-text"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
              >
                {t("landing.hero2")}
              </motion.h2>
              <motion.h3
                className="bg-text text-white dark:text-[#121214] drop-shadow-sm dark:drop-shadow-none"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
              >
                {t("landing.hero3")}
              </motion.h3>
            </div>

            {/* Description */}
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
              {t("landing.description")}
            </p>

            {/* Feature Cards */}
            <motion.div
              className="mt-10 flex flex-col md:flex-row gap-4 w-full max-w-3xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6, ease: "easeOut" }}
            >
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#7c83f2]/10 flex items-center justify-center">
                    <Icon size={20} className="text-[#7c83f2]" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
                </div>
              ))}
            </motion.div>

            {/* Explore button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.6 }}
              className="mt-10"
            >
              <button
                onClick={() => router.push('/auth')}
                className="px-8 py-3.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#7c83f2] dark:hover:text-[#7c83f2] text-sm font-bold tracking-wide transition-all flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                {t("landing.explore")} <ArrowRight size={16} />
              </button>
            </motion.div>
          </motion.div>
        </main>

        {/* ─── Footer ─── */}
        <footer className="w-full py-6 flex items-center justify-center">
          <p className="text-xs text-slate-400">© 2026 Tawassol</p>
        </footer>

      </div>
    </>
  );
}
