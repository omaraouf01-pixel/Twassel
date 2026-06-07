"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Users, LayoutGrid, ShieldCheck, LogOut,
  Loader2, Search, X, Home, Flag,
} from "lucide-react";

// --- استدعاءات Firebase & Auth ---
import { auth, firestore } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { useAuth } from "@/lib/useAuth";
import { useTranslation } from "@/lib/i18n";
import { COL } from "@/lib/collectionNames";
import { api } from "@/lib/apiClient";

// --- استدعاء المكونات (Components) ---
import TsswalLogo from "@/components/TsswalLogo";
import AdminPendingTable from "@/components/admin/AdminPendingTable";
import AdminGroupsTable from "@/components/admin/AdminGroupsTable";
import AdminUsersTable from "@/components/admin/AdminUsersTable";
import AdminReportsTable from "@/components/admin/AdminReportsTable";
import IDCardModal from "@/components/admin/IDCardModal";
import UserProfileModal from "@/components/admin/UserProfileModal";

export default function AdminDashboard() {
  const router = useRouter();

  const { userData, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  // --- States ---
  const [tab, setTab] = useState(() => {
    // auto-switch to reports tab if linked from a notification
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("tab") === "reports") return "reports";
    }
    return "pending";
  });
  const [allUsers, setAllUsers] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [viewID, setViewID] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [viewProfile, setViewProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState(""); // حالة البحث الجديدة
  const [processingId, setProcessingId] = useState(null);

  // 🛡️ حماية المسار
  useEffect(() => {
    if (!authLoading && userData?.role !== "admin") {
      router.replace("/hub");
    }
  }, [userData, authLoading, router]);

  // 📡 جلب البيانات اللحظية
  useEffect(() => {
    if (userData?.role !== "admin") return;

    const unsubUsers = onSnapshot(
      query(collection(firestore, COL.USERS), orderBy("createdAt", "desc")),
      (snap) => {
        setAllUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
        setLoadingData(false);
      }
    );

    const unsubGroups = onSnapshot(
      query(collection(firestore, COL.GROUPS), orderBy("createdAt", "desc")),
      (snap) => setAllGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubReports = onSnapshot(
      query(
        collection(firestore, COL.REPORTS),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const adminDocs = allDocs.filter(d => d.type === "post" || d.type === "group");
        setAllReports(adminDocs);
      }
    );

    return () => { unsubUsers(); unsubGroups(); unsubReports(); };
  }, [userData]);

  // ✅ Approve / Reject (يعتمد على /api/admin/users/[uid]/approve|reject)
  // الـ onSnapshot أعلاه يحدّث القائمة تلقائياً بعد تغيير status.
  const handleApprove = async (uid) => {
    if (!uid || processingId) return;
    setProcessingId(uid);
    try {
      await api(`/api/admin/users/${uid}/approve`, { method: "POST" });
    } catch (e) {
      console.error("[Admin] Approve failed:", e);
      alert(e.message || "Approve failed");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (uid) => {
    if (!uid || processingId) return;
    if (!confirm("Reject this registration?")) return;
    setProcessingId(uid);
    try {
      await api(`/api/admin/users/${uid}/reject`, { method: "POST" });
    } catch (e) {
      console.error("[Admin] Reject failed:", e);
      alert(e.message || "Reject failed");
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };


  // 🔍 تصفية البيانات بناءً على البحث (Search Logic)
  const filteredData = useMemo(() => {
    const queryLower = searchQuery.toLowerCase().trim();

    // 1. تصفية طلبات التحقق
    const pending = allUsers.filter(u => u.status === "pending").filter(u =>
      u.fullName?.toLowerCase().includes(queryLower) ||
      u.email?.toLowerCase().includes(queryLower) ||
      u.matricule?.includes(queryLower)
    );

    // 2. تصفية الطلاب النشطين
    const scholars = allUsers.filter(u => u.status === "active" && u.role === "student").filter(u =>
      u.fullName?.toLowerCase().includes(queryLower) ||
      u.email?.toLowerCase().includes(queryLower) ||
      u.matricule?.includes(queryLower)
    );

    // 3. تصفية المجموعات
    const groups = allGroups.filter(g =>
      g.name?.toLowerCase().includes(queryLower) ||
      g.major?.toLowerCase().includes(queryLower) ||
      g.leaderName?.toLowerCase().includes(queryLower)
    );

    return { pending, scholars, groups };
  }, [allUsers, allGroups, searchQuery]);

  if (authLoading || loadingData) return (
    <div className="h-screen flex flex-col items-center justify-center bg-cream dark:bg-black">
      <Loader2 className="animate-spin text-accent" size={40} />
      <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-ink-faint">Syncing Infrastructure...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream dark:bg-black font-sans text-ink transition-colors duration-500">

      {/* ─── Header Section ─── */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-sand dark:border-white/5 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent/20">
            <TsswalLogo size={20} />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-display italic font-bold text-xl leading-none text-ink dark:text-white">Admin Hub</h1>
            <span className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mt-1 block">Oran 1 Command Console</span>
          </div>
        </div>

        <nav className="flex bg-cream dark:bg-white/5 p-1 rounded-full border border-sand dark:border-white/10 shadow-inner overflow-x-auto hide-scrollbar">
          {[
            { id: "pending", label: "Verification", icon: ShieldCheck, count: filteredData.pending.length },
            { id: "users",   label: "Scholars",     icon: Users,       count: filteredData.scholars.length },
            { id: "groups",  label: "Nodes",         icon: LayoutGrid,  count: filteredData.groups.length },
            { id: "reports", label: t("admin.tab_reports"), icon: Flag, count: allReports.filter(r => r.status === "pending").length, alert: true },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${tab === item.id
                ? "bg-white dark:bg-slate-700 text-accent shadow-sm"
                : "text-ink-faint hover:text-ink dark:hover:text-white"
                }`}
            >
              <item.icon size={14} /> {item.label}
              <span className={`ml-1 ${item.alert && item.count > 0 ? "text-rose-500 font-black" : "opacity-30"}`}>
                {item.count}
              </span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/hub")}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent/10 text-accent rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all border border-accent/20"
          >
            <Home size={14} /> <span className="hidden md:inline">Hub</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 text-rose-500 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
          >
            <LogOut size={14} /> <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="max-w-[1400px] mx-auto p-8 lg:p-12">
        <div className={`mb-10 flex items-center justify-end ${tab === "reports" ? "invisible" : ""}`}>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint group-focus-within:text-accent transition-colors" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email or matricule..."
              className="bg-paper dark:bg-white/5 border border-sand dark:border-white/10 rounded-2xl pl-12 pr-10 py-3 text-xs outline-none focus:ring-2 ring-accent/10 w-80 transition-all text-ink dark:text-white placeholder:text-ink-faint/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint hover:text-rose-500 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="relative min-h-[400px]">
          <AnimatePresence mode="wait">
            {tab === "pending" && (
              <motion.div key="pending" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.3 }}>
                <AdminPendingTable
                  users={filteredData.pending}
                  onViewID={setViewID}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  processingId={processingId}
                />
              </motion.div>
            )}

            {tab === "groups" && (
              <motion.div key="groups" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.3 }}>
                <AdminGroupsTable groups={filteredData.groups} />
              </motion.div>
            )}

            {tab === "users" && (
              <motion.div key="users" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.3 }}>
                <AdminUsersTable users={filteredData.scholars} onViewID={setViewID} onViewProfile={setViewProfile} />
              </motion.div>
            )}

            {tab === "reports" && (
              <motion.div key="reports" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.3 }}>
                <AdminReportsTable reports={allReports} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {viewID && <IDCardModal url={viewID} onClose={() => setViewID(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {viewProfile && <UserProfileModal user={viewProfile} onClose={() => setViewProfile(null)} />}
      </AnimatePresence>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}