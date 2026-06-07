"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutGrid,
  Compass,
  User,
  LogOut,
  Plus,
  Hash,
  ChevronRight,
  Settings,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";

import { motion } from "framer-motion";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import TsswalLogo from "./TsswalLogo";
import NotificationCenter from "./NotificationCenter";
import SettingsMenu from "./SettingsMenu";
import { useLang } from "@/lib/LanguageContext";
import { useTranslation } from "@/lib/i18n";

// ══════════════════════════════════════════════════════════════════════
// اللون الأساسي لعناصر الشريط الجانبي
// ══════════════════════════════════════════════════════════════════════
const ACADEMIC_PURPLE = "#7c83f2";

/**
 * GroupRow — صف مجموعة واحدة في قائمة العقد الجانبية.
 *
 * يعرض: أيقونة المجموعة (رسمية/عادية)، الاسم، وشارة الدور (Overseer/Member).
 * يُبرز الصف نشطاً إذا كانت الصفحة الحالية هي صفحة شات هذه المجموعة.
 *
 * @param {object}  group      - بيانات المجموعة
 * @param {boolean} isOfficial - هل هي مجموعة أكاديمية رسمية (جامعة)
 * @param {string}  uid        - معرّف المستخدم الحالي (لتحديد الدور)
 * @param {string}  pathname   - المسار الحالي (من usePathname)
 * @param {object}  router     - كائن التوجيه (من useRouter)
 */
const GroupRow = ({ group, isOfficial = false, uid, pathname, router }) => {
  const { t } = useTranslation();
  const isActive  = pathname === `/hub/chat/${group.id}`;
  const isLeader  = group.leaderId === uid;
  return (
    <button
      onClick={() => router.push(`/hub/chat/${group.id}`)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-ink-muted dark:text-slate-400 hover:bg-cream dark:hover:bg-white/5 transition-all text-left group cursor-pointer border-none bg-transparent"
      style={isActive ? { background: `${ACADEMIC_PURPLE}1A`, color: ACADEMIC_PURPLE } : undefined}
    >
      <div
        className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors shrink-0"
        style={
          isActive
            ? { background: `${ACADEMIC_PURPLE}26`, color: ACADEMIC_PURPLE }
            : { background: "rgba(124,131,242,0.08)", color: "#9ca3af" }
        }
      >
        {isOfficial ? (
          <BadgeCheck size={13} style={{ color: isActive ? ACADEMIC_PURPLE : "#60a5fa" }} />
        ) : (
          <Hash size={12} />
        )}
      </div>
      <span className="text-[11px] font-semibold truncate font-display italic flex-1">
        {group.name}
      </span>
      <span
        className="shrink-0 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-[0.15em] border"
        style={{
          color:           ACADEMIC_PURPLE,
          backgroundColor: `${ACADEMIC_PURPLE}14`,
          borderColor:     `${ACADEMIC_PURPLE}33`,
        }}
      >
        {isLeader ? t("sidebar.overseer") : t("sidebar.member")}
      </span>
    </button>
  );
};

/**
 * Sidebar — الشريط الجانبي الثابت للتطبيق.
 *
 * يحتوي على:
 *  - الشعار + NotificationCenter في الرأس.
 *  - التنقل الرئيسي (Hub / Explore / Profile).
 *  - قائمة المجتمعات الأكاديمية الرسمية (Academic Hubs).
 *  - قائمة مجموعات الدراسة الشخصية.
 *  - أدوات النظام: تبديل اللغة، لوحة الأدمن (للأدمن فقط)، معلومات المستخدم، تسجيل الخروج.
 *
 * @param {object} currentUser - بيانات المستخدم من Firestore (uid, fullName, role...)
 * @param {Array}  groups      - جميع المجموعات المُحمّلة من Firestore
 */
export default function Sidebar({ currentUser, groups = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, setLang } = useLang();
  const { t } = useTranslation();

  // إخفاء الشريط على الشاشات الصغيرة (أقل من 768px)
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    const handleResize = () => setIsVisible(window.innerWidth >= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  if (!isVisible) return null;

  // حارس واجهة: استبعاد أي مجموعة لا يكون المستخدم عضواً فيها أو مشرفاً عليها
  const uid = currentUser?.uid;
  const myGroups = uid
    ? groups.filter(
        (g) => Array.isArray(g.members) && (g.members.includes(uid) || g.leaderId === uid)
      )
    : [];

  // فصل المجتمعات الرسمية عن مجموعات الدراسة
  const officialGroups = myGroups.filter((g) => g.isOfficial === true);
  const regularGroups  = myGroups.filter((g) => !g.isOfficial);

  const menu = [
    { label: t("nav.hub"),     icon: LayoutGrid, href: "/hub" },
    { label: t("nav.explore"), icon: Compass,    href: "/explore" },
    { label: t("nav.profile"), icon: User,       href: "/profile" },
  ];

  /**
   * handleLogout — يُسجّل خروج المستخدم من Firebase Auth ويُوجّهه لصفحة الدخول.
   * أي خطأ في Firebase (شبكة، session منتهية...) يُسجَّل في console فقط.
   */
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/auth");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <aside className="w-[280px] h-screen bg-paper dark:bg-[#0A0A0A] border-e border-sand dark:border-white/5 fixed inset-inline-start-0 top-0 flex flex-col z-40 p-6 transition-colors duration-500 overflow-y-auto hide-scrollbar">

      {/* ─── رأس الشريط الجانبي ─── */}
      <div className="flex items-center justify-between mb-10 px-2">
        <div
          className="flex items-center gap-4 cursor-pointer group"
          onClick={() => router.push('/hub')}
        >
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent group-hover:scale-105 transition-transform shadow-sm">
            <TsswalLogo size={20} />
          </div>
          <div className="flex flex-col font-display">
            <span className="text-[14px] font-bold uppercase tracking-[0.2em] text-ink dark:text-white leading-none">Twassel</span>
            <span className="text-[8px] font-bold text-accent uppercase tracking-[0.1em] mt-1 italic">Academic Node</span>
          </div>
        </div>
        <NotificationCenter />
      </div>

      {/* ─── التنقل الرئيسي ─── */}
      <nav className="space-y-1 mb-8">
        {menu.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all relative outline-none cursor-pointer border-none ${isActive
                ? "bg-accent text-white shadow-md shadow-accent/20"
                : "text-ink-muted dark:text-slate-400 hover:bg-cream dark:hover:bg-white/5"
                }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ─── القسم 1: المجتمعات الأكاديمية الرسمية ─── */}
      {officialGroups.length > 0 && (
        <div className="mb-5 px-2">
          <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-ink-faint mb-3 flex items-center gap-1.5 font-sans">
            <BadgeCheck size={10} className="text-blue-400" />
            Academic Hubs
          </h3>
          <div className="space-y-1">
            {officialGroups.map((group) => (
              <GroupRow key={group.id} group={group} isOfficial uid={uid} pathname={pathname} router={router} />
            ))}
          </div>
        </div>
      )}

      {/* ─── القسم 2: مجموعات الدراسة العادية ─── */}
      <div className="mb-6 px-2">
        <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-ink-faint mb-4 flex items-center justify-between font-sans">
          {t("sidebar.communities")}
          <Plus
            size={12}
            className="cursor-pointer hover:text-accent transition-colors"
            onClick={() => router.push('/groups/create')}
          />
        </h3>
        <div className="space-y-1">
          {regularGroups.length > 0 ? (
            regularGroups.map((group) => (
              <GroupRow key={group.id} group={group} uid={uid} pathname={pathname} router={router} />
            ))
          ) : (
            <p className="text-[9px] text-ink-faint italic px-2">{t("sidebar.no_clusters")}</p>
          )}
        </div>
      </div>

      {/* ─── التذييل ─── */}
      <div className="mt-auto space-y-4 pt-6 border-t border-sand dark:border-white/5">

        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-ink-faint">{t("sidebar.system_control")}</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest
                         border border-sand dark:border-white/10 text-accent hover:bg-accent/10 transition"
            >
              {lang === "fr" ? "EN" : "FR"}
            </button>
            <SettingsMenu currentUser={currentUser} />
          </div>
        </div>

        {currentUser?.role === "admin" && (
          <button
            onClick={() =>
              pathname.startsWith("/admin")
                ? router.push("/hub")
                : router.push("/admin")
            }
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] transition-all border-none cursor-pointer ${
              pathname.startsWith("/admin")
                ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                : "bg-accent/10 hover:bg-accent/20 text-accent"
            }`}
          >
            <ShieldCheck size={13} />
            {pathname.startsWith("/admin") ? t("sidebar.back_hub") : t("sidebar.admin_panel")}
          </button>
        )}

        <div
          onClick={() => router.push('/profile')}
          className="group p-3 bg-cream dark:bg-white/5 border border-sand dark:border-white/5 rounded-2xl flex items-center gap-3 hover:border-accent/30 transition-all cursor-pointer shadow-sm shadow-black/5"
        >
          <div className="w-9 h-9 rounded-xl bg-paper dark:bg-slate-800 flex items-center justify-center shrink-0 border border-sand dark:border-white/5 overflow-hidden">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                className="w-full h-full object-cover"
                alt="Profile"
              />
            ) : (
              <div className="text-accent font-display font-bold italic text-sm">
                {currentUser?.fullName?.[0] || "S"}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-ink dark:text-white truncate leading-none mb-1.5">
              {currentUser?.fullName?.split(" ")[0] || "Scholar"}
            </p>
            <p className="text-[8px] font-bold text-accent uppercase tracking-widest truncate">
              {currentUser?.major || "Academic Node"}
            </p>
          </div>
          <ChevronRight size={12} className="text-sand group-hover:text-accent transition-colors" data-flip-rtl />
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 text-ink-faint hover:text-rose-500 text-[9px] font-bold uppercase tracking-[0.3em] transition-colors bg-transparent border-none cursor-pointer"
        >
          <LogOut size={14} data-flip-rtl />
          {t("sidebar.terminate")}
        </button>
      </div>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </aside>
  );
}
