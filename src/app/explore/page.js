"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, Sparkles, Compass,
  GraduationCap, Flame, LayoutGrid, School, Book,
  SlidersHorizontal, ChevronDown, X, RotateCcw, Check
} from "lucide-react";

// ─── المكونات والخطافات ───
import Sidebar from "@/components/Sidebar";
import DiscoveryGrid from "@/components/DiscoveryGrid";
import NodeShelf from "@/components/explore/NodeShelf";
import JoinNodeModal from "@/components/explore/JoinNodeModal";
import { useAuth } from "@/lib/useAuth";
import { useAllGroups } from "@/lib/useAllGroups";
import { firestore } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { COL } from "@/lib/collectionNames";
import { selectMajorMatched, selectHighFrequency, excludeIds } from "@/lib/relevance";
import { api } from "@/lib/apiClient";
import { useTranslation } from "@/lib/i18n";

// ─── البيانات الأكاديمية الموحَّدة ───
import {
  UNIVERSITIES, MAJORS, LEVELS, ALL,
  UNIVERSITY_LABELS, MAJOR_LABELS,
} from "@/lib/academicData";

// ─── ثابت اللون الأرجواني الصريح للمشروع ───
const PURPLE = "#7c83f2";

// ─── أدوات الفلترة (Pure helpers) ───
const matchesUniversity = (node, uni) => {
  if (uni === ALL) return true;
  return node.university === uni || node.tags?.includes(uni);
};
const matchesMajor = (node, major) => {
  if (major === ALL) return true;
  return (
    node.subject === major ||
    node.major === major ||
    node.tags?.includes(major)
  );
};
const matchesLevel = (node, level) => {
  if (level === ALL) return true;
  return node.level === level || node.tags?.includes(level);
};

export default function ScholarExplore() {
  const { userData, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { groups: allGroups, loading: groupsLoading } = useAllGroups();

  // ─── حالات الصفحة ───
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    university: ALL,
    major: ALL,
    level: ALL,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'university' | 'major' | 'level' | null
  const [selectedNode, setSelectedNode] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [pendingGroupIds, setPendingGroupIds] = useState(new Set());

  // جلب قائمة المجموعات التي للمستخدم طلب انضمام معلق فيها
  const refreshPending = React.useCallback(async () => {
    if (!userData?.uid) return;
    try {
      const res = await api("/api/user/pending-requests");
      setPendingGroupIds(new Set(res.groupIds || []));
    } catch (e) {
      // فشل صامت — لا نمنع الاستكشاف
    }
  }, [userData?.uid]);

  useEffect(() => { refreshPending(); }, [refreshPending]);

  // Sidebar groups (real-time) — مجموعات المستخدم فقط (أو الكل للأدمن)
  // ملاحظة: useAllGroups أعلاه يبقى لشبكة الاستكشاف (Explore تعرض كل المتاح)،
  //         بينما الـ Sidebar تعرض فقط ما ينتمي إليه المستخدم (أو الكل للأدمن).
  useEffect(() => {
    if (!userData?.uid) return;
    const isAdminUser = userData?.role === "admin";
    const q = isAdminUser
      ? query(
          collection(firestore, COL.GROUPS),
          where("status", "==", "active")
        )
      : query(
          collection(firestore, COL.GROUPS),
          where("members", "array-contains", userData.uid)
        );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setMyGroups(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("[Explore] myGroups listener:", err)
    );
    return () => unsubscribe();
  }, [userData?.uid, userData?.role]);

  // ─── 1. استبعاد مجموعات العضوية الحالية (الأدمن يرى الكل) ───
  const isAdmin = userData?.role === "admin";
  const memberOfIds = useMemo(() => {
    if (!userData?.uid || isAdmin) return new Set();
    return new Set(
      allGroups.filter((g) => g.members?.includes(userData.uid)).map((g) => g.id)
    );
  }, [allGroups, userData?.uid, isAdmin]);

  // ─── 2. منطق الفلترة التراكمي ───
  const filteredNodes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return excludeIds(allGroups, memberOfIds).filter((node) => {
      const okSearch =
        !q ||
        node.name?.toLowerCase().includes(q) ||
        node.subject?.toLowerCase().includes(q) ||
        node.major?.toLowerCase().includes(q);
      return (
        okSearch &&
        matchesUniversity(node, filters.university) &&
        matchesMajor(node, filters.major) &&
        matchesLevel(node, filters.level)
      );
    });
  }, [allGroups, memberOfIds, searchQuery, filters]);

  // ─── 3. هل لا يوجد أي فلتر (لعرض الرفوف)؟ ───
  const noFilters =
    !searchQuery &&
    filters.university === ALL &&
    filters.major === ALL &&
    filters.level === ALL;

  const activeFilterCount =
    (filters.university !== ALL ? 1 : 0) +
    (filters.major !== ALL ? 1 : 0) +
    (filters.level !== ALL ? 1 : 0);

  // ─── 4. الرفوف الذكية ───
  const majorMatched = useMemo(
    () => (noFilters ? selectMajorMatched(filteredNodes, userData, 10) : []),
    [filteredNodes, userData, noFilters]
  );

  const highFrequency = useMemo(() => {
    if (!noFilters) return [];
    const majorIds = new Set(majorMatched.map((n) => n.id));
    return selectHighFrequency(excludeIds(filteredNodes, majorIds), 10);
  }, [filteredNodes, majorMatched, noFilters]);

  // ─── 5. شبكة الاستكشاف (ما تبقّى) ───
  const gridNodes = useMemo(() => {
    if (!noFilters) return filteredNodes;
    const shelfIds = new Set([
      ...majorMatched.map((n) => n.id),
      ...highFrequency.map((n) => n.id),
    ]);
    return excludeIds(filteredNodes, shelfIds);
  }, [filteredNodes, majorMatched, highFrequency, noFilters]);

  const resetFilters = () => {
    setFilters({ university: ALL, major: ALL, level: ALL });
    setOpenDropdown(null);
  };

  if (authLoading || groupsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-black">
        <Loader2 className="animate-spin" size={40} style={{ color: PURPLE }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-cream dark:bg-black font-sans text-ink dark:text-white transition-colors duration-500 overflow-hidden">
      <Sidebar currentUser={userData} groups={myGroups} />

      <main className="flex-1 md:ms-[280px] h-screen overflow-hidden flex flex-col relative">
        {/* ── Header ── */}
        <header className="px-8 py-6 bg-cream/80 dark:bg-black/60 backdrop-blur-2xl border-b border-sand dark:border-white/5 z-30">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Compass size={24} style={{ color: PURPLE }} />
                <h1 className="text-2xl font-bold font-display italic">{t("explore.title")}</h1>
              </div>
              <p className="text-xs text-ink-faint font-medium uppercase tracking-widest">
                {t("explore.label")}
              </p>
            </div>

            {/* Search + Filter toggle */}
            <div className="flex items-center gap-3 w-full max-w-md">
              <div className="flex-1 flex items-center gap-4 bg-paper dark:bg-white/5 px-5 py-3 rounded-2xl border border-sand dark:border-white/10 shadow-sm">
                <Search size={18} className="text-ink-faint" />
                <input
                  type="text"
                  placeholder={t("explore.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none text-sm w-full placeholder:text-ink-faint text-ink dark:text-white"
                />
              </div>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="relative shrink-0 p-3.5 rounded-2xl border shadow-sm transition-all"
                style={{
                  backgroundColor: showFilters ? PURPLE : "transparent",
                  borderColor: showFilters ? PURPLE : "rgb(var(--c-sand))",
                  color: showFilters ? "#fff" : "rgb(var(--c-ink-faint))",
                }}
                aria-label="All fields"
                title="All fields"
              >
                <SlidersHorizontal size={18} />
                {activeFilterCount > 0 && !showFilters && (
                  <span
                    className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white shadow-md"
                    style={{ backgroundColor: PURPLE }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-8 lg:p-12">
          <div className="max-w-6xl mx-auto">

            {/* ─── Collapsible Filter Card ─── */}
            <AnimatePresence initial={false}>
              {showFilters && (
                <motion.div
                  key="filter-card"
                  initial={{ opacity: 0, y: -16, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -16, height: 0 }}
                  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-visible mb-8"
                >
                  <div
                    className="bg-white dark:bg-white/[0.03] rounded-[2rem] p-7 border border-slate-100 dark:border-white/10 shadow-sm"
                    style={{ borderColor: "rgba(124, 131, 242, 0.18)" }}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${PURPLE}15`, color: PURPLE }}
                        >
                          <SlidersHorizontal size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold font-serif italic text-slate-800 dark:text-white">
                            All fields
                          </h3>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mt-0.5">
                            {filteredNodes.length} {filteredNodes.length === 1 ? "Node" : "Nodes"}
                          </p>
                        </div>
                      </div>
                      {(activeFilterCount > 0 || searchQuery) && (
                        <button
                          onClick={() => { resetFilters(); setSearchQuery(""); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border hover:text-white"
                          style={{
                            color: PURPLE,
                            backgroundColor: `${PURPLE}10`,
                            borderColor: `${PURPLE}30`,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = PURPLE; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${PURPLE}10`; }}
                        >
                          <RotateCcw size={12} data-flip-rtl /> {t("explore.reset")}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <FilterDropdown
                        icon={School}
                        label="Field"
                        options={[ALL, ...UNIVERSITIES]}
                        labelMap={UNIVERSITY_LABELS}
                        selected={filters.university}
                        isOpen={openDropdown === "university"}
                        onToggle={() =>
                          setOpenDropdown(openDropdown === "university" ? null : "university")
                        }
                        onSelect={(v) => {
                          setFilters((f) => ({ ...f, university: v }));
                          setOpenDropdown(null);
                        }}
                        allLabel="All"
                      />
                      <FilterDropdown
                        icon={Book}
                        label="Major"
                        options={[ALL, ...MAJORS]}
                        labelMap={MAJOR_LABELS}
                        selected={filters.major}
                        isOpen={openDropdown === "major"}
                        onToggle={() =>
                          setOpenDropdown(openDropdown === "major" ? null : "major")
                        }
                        onSelect={(v) => {
                          setFilters((f) => ({ ...f, major: v }));
                          setOpenDropdown(null);
                        }}
                        allLabel="All"
                      />
                      <FilterDropdown
                        icon={GraduationCap}
                        label="Academic year"
                        options={[ALL, ...LEVELS]}
                        selected={filters.level}
                        isOpen={openDropdown === "level"}
                        onToggle={() =>
                          setOpenDropdown(openDropdown === "level" ? null : "level")
                        }
                        onSelect={(v) => {
                          setFilters((f) => ({ ...f, level: v }));
                          setOpenDropdown(null);
                        }}
                        allLabel="All"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Hybrid Shelves (تظهر فقط عند صفر فلاتر) ─── */}
            {noFilters && (
              <>
                <NodeShelf
                  title={t("explore.matched")}
                  subtitle={userData?.major || t("explore.matched")}
                  icon={GraduationCap}
                  nodes={majorMatched}
                  onNodeClick={(node) => setSelectedNode(node)}
                  onViewAll={() => setFilters((f) => ({ ...f, major: userData?.major || ALL }))}
                  pendingGroupIds={pendingGroupIds}
                />
                <NodeShelf
                  title={t("explore.trending")}
                  subtitle={t("explore.trending")}
                  icon={Flame}
                  nodes={highFrequency}
                  onNodeClick={(node) => setSelectedNode(node)}
                  onViewAll={() => setShowFilters(true)}
                  pendingGroupIds={pendingGroupIds}
                />
              </>
            )}

            {/* ─── Discovery Grid ─── */}
            <AnimatePresence mode="wait">
              {gridNodes.length > 0 ? (
                <motion.div
                  key={`grid-${searchQuery}-${filters.university}-${filters.major}-${filters.level}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.25 }}
                >
                  {noFilters && (
                    <div className="flex items-center gap-4 mb-6 mt-4">
                      <div
                        className="p-2 rounded-2xl"
                        style={{ backgroundColor: `${PURPLE}15`, color: PURPLE }}
                      >
                        <LayoutGrid size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold font-serif italic text-slate-800 dark:text-white leading-tight">
                          Nodes
                        </h2>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">
                          All fields
                        </p>
                      </div>
                    </div>
                  )}
                  <DiscoveryGrid
                    nodes={gridNodes}
                    onNodeClick={(node) => setSelectedNode(node)}
                    pendingGroupIds={pendingGroupIds}
                  />
                </motion.div>
              ) : filteredNodes.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-32 flex flex-col items-center text-center"
                >
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                    style={{ backgroundColor: `${PURPLE}15`, color: PURPLE }}
                  >
                    <Sparkles size={32} />
                  </div>
                  <h3 className="text-xl font-display italic font-bold mb-2">{t("explore.no_results")}</h3>
                  <p className="text-ink-faint text-sm max-w-xs mb-6">
                    {t("explore.no_results")}
                  </p>
                  {(activeFilterCount > 0 || searchQuery) && (
                    <button
                      onClick={() => { resetFilters(); setSearchQuery(""); }}
                      className="flex items-center gap-2 px-5 py-2.5 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg transition-all hover:brightness-110"
                      style={{ backgroundColor: PURPLE, boxShadow: `0 10px 25px ${PURPLE}40` }}
                    >
                      <RotateCcw size={12} data-flip-rtl /> Reset
                    </button>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* Join Modal */}
        {selectedNode && (
          <JoinNodeModal
            group={selectedNode}
            isOpen={!!selectedNode}
            onClose={() => setSelectedNode(null)}
            isPending={pendingGroupIds.has(selectedNode.id)}
            onRequestSent={refreshPending}
          />
        )}
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// FilterDropdown — منسدلة مفردة للفلتر
// ════════════════════════════════════════════════════════════════
function FilterDropdown({
  icon: Icon, label, options, labelMap,
  selected, isOpen, onToggle, onSelect, allLabel,
}) {
  const rootRef = useRef(null);

  // إغلاق المنسدلة عند الضغط خارجها
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  const display = selected === ALL ? (allLabel || "All") : (labelMap?.[selected] || selected);
  const isActive = selected !== ALL;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border text-start transition-all"
        style={{
          backgroundColor: isActive ? `${PURPLE}10` : "rgb(var(--c-paper))",
          borderColor: isActive ? `${PURPLE}40` : "rgb(var(--c-sand))",
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${PURPLE}15`, color: PURPLE }}
          >
            <Icon size={14} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 leading-tight">
              {label}
            </p>
            <p
              className="text-sm font-bold truncate mt-0.5"
              style={{ color: isActive ? PURPLE : "rgb(var(--c-ink))" }}
              title={selected}
            >
              {display}
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown size={16} className="text-slate-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute start-0 end-0 top-full mt-2 z-40 bg-white dark:bg-[#1a1a1c] rounded-2xl border shadow-2xl overflow-hidden"
            style={{ borderColor: `${PURPLE}25` }}
          >
            <div className="max-h-[260px] overflow-y-auto custom-scrollbar py-2">
              {options.map((opt) => {
                const isSelected = opt === selected;
                const optDisplay = opt === ALL ? (allLabel || "All") : (labelMap?.[opt] || opt);
                return (
                  <button
                    key={opt}
                    onClick={() => onSelect(opt)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-start text-sm transition-colors"
                    style={{
                      backgroundColor: isSelected ? `${PURPLE}10` : "transparent",
                      color: isSelected ? PURPLE : "rgb(var(--c-ink))",
                      fontWeight: isSelected ? 700 : 500,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = `${PURPLE}08`;
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span className="truncate" title={opt}>{optDisplay}</span>
                    {isSelected && <Check size={14} className="shrink-0" style={{ color: PURPLE }} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${PURPLE}40; border-radius: 10px; }
      `}</style>
    </div>
  );
}
