"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2, GraduationCap, CalendarDays, Globe,
  Code2 as Github, Briefcase as Linkedin, ChevronRight,
  Layers, FileText, Trophy, ArrowRight,
} from "lucide-react";

import { useAuth } from "@/lib/useAuth";
import { firestore } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { api } from "@/lib/apiClient";
import { COL } from "@/lib/collectionNames";
import UserBadge from "@/components/UserBadge";
import Sidebar from "@/components/Sidebar";

// ─── Helpers ────────────────────────────────────────────────────
function formatJoinDate(ms) {
  if (!ms) return "—";
  try {
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

// ─── Stat Card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-paper dark:bg-white/[0.04] border border-sand dark:border-white/10
                 rounded-2xl p-5 shadow-soft transition-colors duration-500"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-faint">
          {label}
        </p>
        <span className={`w-8 h-8 inline-flex items-center justify-center rounded-xl
                         ${accent
                           ? "bg-accent/10 text-accent"
                           : "bg-sand/40 dark:bg-white/5 text-ink-muted dark:text-slate-400"}`}>
          <Icon size={15} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold font-display text-ink dark:text-white">
        {value}
      </p>
    </motion.div>
  );
}

// ─── Social Row ─────────────────────────────────────────────────
function SocialRow({ href, icon: Icon, label }) {
  let display = href;
  try { display = new URL(href).hostname.replace(/^www\./, ""); } catch { /* keep */ }

  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-4 py-3 rounded-2xl
                   border border-sand dark:border-white/10
                   hover:border-accent/50 hover:bg-accent/5
                   transition group"
      >
        <span className="w-9 h-9 inline-flex items-center justify-center rounded-xl
                         bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition">
          <Icon size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink dark:text-white">{label}</p>
          <p className="text-xs text-ink-faint truncate">{display}</p>
        </div>
        <ChevronRight size={14} className="text-ink-faint group-hover:text-accent transition" />
      </a>
    </li>
  );
}

// ─── Page ───────────────────────────────────────────────────────
export default function PublicProfilePage() {
  const { uid } = useParams();
  const router = useRouter();
  const { userData: me, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);

  // إذا كان المستخدم ينظر لبروفيله الخاص → أعد التوجيه
  useEffect(() => {
    if (!authLoading && me?.uid && me.uid === uid) {
      router.replace("/profile");
    }
  }, [authLoading, me?.uid, uid, router]);

  // جلب بيانات البروفيل
  useEffect(() => {
    if (!uid || authLoading) return;
    let cancelled = false;

    setLoading(true);
    api(`/api/profile/${uid}`)
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load profile");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [uid, authLoading]);

  // مجموعات المستخدم الحالي للسيدبار
  useEffect(() => {
    if (!me?.uid) return;
    const q = query(
      collection(firestore, COL.GROUPS),
      where("members", "array-contains", me.uid)
    );
    const unsub = onSnapshot(q, (snap) =>
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [me?.uid]);

  const joinDate = useMemo(() => formatJoinDate(profile?.createdAt), [profile?.createdAt]);
  const social = profile?.socialLinks || {};
  const hasAnyLink = !!(social.github || social.linkedin || social.portfolio);
  const academicTitle = profile?.major || profile?.department || "Scholar";

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-[#0e0d14]">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen bg-cream dark:bg-[#0e0d14] font-sans text-ink dark:text-white">
        <Sidebar currentUser={me} groups={groups} />
        <main className="flex-1 md:ms-[280px] flex items-center justify-center px-6">
          <div className="text-center">
            <p className="text-5xl mb-4">😕</p>
            <h2 className="text-xl font-display italic font-bold text-ink dark:text-white mb-2">
              Profile not available
            </h2>
            <p className="text-sm text-ink-faint mb-6">
              {error || "This user was not found"}
            </p>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                         bg-accent text-white text-sm font-semibold shadow-soft hover:brightness-110 transition"
            >
              <ArrowRight size={14} className="rotate-180" /> Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-cream dark:bg-[#0e0d14] font-sans
                    text-ink dark:text-white transition-colors duration-500">

      <Sidebar currentUser={me} groups={groups} />

      <main className="flex-1 md:ms-[280px] h-screen overflow-y-auto hide-scrollbar
                       pb-24 px-5 pt-6 md:px-10 md:pt-10 lg:px-14">
        <div className="max-w-5xl mx-auto">

          {/* ─── Header ───────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
                Scholar Profile
              </p>
              <h1 className="text-2xl md:text-3xl font-display italic font-bold mt-1 text-ink dark:text-white">
                {profile.fullName}
              </h1>
            </div>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
                         text-sm font-semibold text-ink-muted hover:bg-sand/50 transition"
            >
              <ArrowRight size={14} className="rotate-180" />
              Back
            </button>
          </div>

          {/* ─── Identity Card ────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl border border-sand dark:border-white/10
                       bg-paper dark:bg-white/[0.04] shadow-soft p-8 md:p-10
                       transition-colors duration-500"
          >
            <div className="absolute -top-24 -end-24 w-72 h-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div
                  className="w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden
                             ring-4 ring-accent/80 ring-offset-4 ring-offset-paper dark:ring-offset-[#1a1820]
                             bg-cream dark:bg-white/5"
                  style={{ boxShadow: "0 0 0 1px rgba(124,131,242,0.15), 0 12px 30px -10px rgba(124,131,242,0.35)" }}
                >
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-accent
                                    bg-accent/10 font-display italic font-bold text-5xl">
                      {(profile.fullName?.[0] || "S").toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Identity text */}
              <div className="flex-1 text-center md:text-start">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <h2 className="text-3xl md:text-4xl font-display italic font-bold leading-tight text-ink dark:text-white">
                    {profile.fullName}
                  </h2>
                  <UserBadge rank={profile.rank} size="lg" />
                </div>

                <p className="mt-2 text-sm md:text-base text-accent font-semibold">
                  {academicTitle}
                </p>

                <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-x-5 gap-y-2 text-xs text-ink-muted dark:text-slate-400">
                  {profile.university && (
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap size={13} className="text-accent" />
                      {profile.university}
                    </span>
                  )}
                  {profile.academicYear && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={13} className="text-accent" />
                      {profile.academicYear}
                    </span>
                  )}
                </div>

                {hasAnyLink && (
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                                  bg-accent/10 text-accent border border-accent/20">
                    {social.github && (
                      <a href={social.github} target="_blank" rel="noopener noreferrer"
                         aria-label="GitHub" className="hover:opacity-80 transition">
                        <Github size={16} />
                      </a>
                    )}
                    {social.linkedin && (
                      <a href={social.linkedin} target="_blank" rel="noopener noreferrer"
                         aria-label="LinkedIn" className="hover:opacity-80 transition">
                        <Linkedin size={16} />
                      </a>
                    )}
                    {social.portfolio && (
                      <a href={social.portfolio} target="_blank" rel="noopener noreferrer"
                         aria-label="Portfolio" className="hover:opacity-80 transition">
                        <Globe size={16} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.section>

          {/* ─── Stats Grid ───────────────────────────────────── */}
          <section className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={Trophy}       label="Contribution Points" value={profile.points ?? 0} accent />
            <StatCard icon={Layers}       label="Nodes Joined"        value={profile.stats?.groupsCount ?? 0} />
            <StatCard icon={FileText}     label="Resources Uploaded"  value={profile.stats?.resourcesCount ?? 0} />
            <StatCard icon={CalendarDays} label="Member Since"        value={joinDate} />
          </section>

          {/* ─── Bio + Links ──────────────────────────────────── */}
          <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bio */}
            <div className="lg:col-span-2 rounded-3xl border border-sand dark:border-white/10
                            bg-paper dark:bg-white/[0.04] p-7 shadow-soft transition-colors duration-500">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent mb-4">
                About
              </p>
              {profile.bio ? (
                <p className="font-display italic text-base md:text-lg leading-relaxed text-ink dark:text-slate-200">
                  "{profile.bio}"
                </p>
              ) : (
                <p className="font-display italic text-ink-faint">
                  This user hasn't added a bio yet.
                </p>
              )}
            </div>

            {/* Professional Links */}
            <div className="rounded-3xl border border-sand dark:border-white/10
                            bg-paper dark:bg-white/[0.04] p-7 shadow-soft transition-colors duration-500">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent mb-5">
                Professional Links
              </p>
              {hasAnyLink ? (
                <ul className="space-y-2">
                  {social.github && <SocialRow href={social.github} icon={Github} label="GitHub" />}
                  {social.linkedin && <SocialRow href={social.linkedin} icon={Linkedin} label="LinkedIn" />}
                  {social.portfolio && <SocialRow href={social.portfolio} icon={Globe} label="Portfolio" />}
                </ul>
              ) : (
                <p className="text-sm text-ink-faint">No professional links.</p>
              )}
            </div>
          </section>

        </div>
      </main>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
