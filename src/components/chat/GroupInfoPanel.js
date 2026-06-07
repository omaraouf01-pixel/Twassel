"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, FileText, Calendar, Search, Loader2,
  Download, ShieldCheck, Image, Link, LayoutGrid,
  UserMinus, ShieldPlus, ShieldMinus, AlertTriangle, Flag,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import ReportModal from "@/components/chat/ReportModal";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { COL } from "@/lib/collectionNames";
import CalendarSidebar from "./CalendarSidebar";

const ACCENT = "#7c83f2";

const TABS = [
  { id: "members",  label: "Members",  Icon: Users },
  { id: "files",    label: "Files",    Icon: FileText },
  { id: "calendar", label: "Calendar", Icon: Calendar },
];

const FILE_TABS = [
  { id: "all",   label: "All",   Icon: LayoutGrid },
  { id: "media", label: "Media", Icon: Image },
  { id: "files", label: "Files", Icon: FileText },
  { id: "links", label: "Links", Icon: Link },
];

// ─── helpers ──────────────────────────────────────────────────────────────────
function isOnline(member) {
  if (typeof member?.online === "boolean") return member.online;
  const ts = member?.lastSeen?.toMillis?.() ?? member?.lastSeen;
  if (!ts) return false;
  return Date.now() - ts < 3 * 60 * 1000;
}

function classifyType(msg) {
  const mime = (msg.fileType || "").toLowerCase();
  if (mime.startsWith("image/") || mime.startsWith("video/")) return "media";
  return "files";
}

// ─── PresenceDot ──────────────────────────────────────────────────────────────
function PresenceDot({ online }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        online
          ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
          : "bg-slate-400/60"
      }`}
    />
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
function ConfirmModal({ isOpen, onConfirm, onCancel, memberName, actionLabel, actionColor }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 16 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-full max-w-sm bg-white dark:bg-[#111] rounded-3xl p-7 shadow-2xl border border-black/5 dark:border-white/10"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: `${actionColor}1A`, color: actionColor }}
              >
                <AlertTriangle size={26} />
              </div>
              <div>
                <h3 className="text-base font-serif italic font-black leading-none text-ink">
                  {actionLabel}?
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-bold text-ink dark:text-white">{memberName}</span>
                </p>
              </div>
              <div className="flex w-full gap-3 mt-2">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-colors"
                  style={{ background: actionColor }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── MemberRow ────────────────────────────────────────────────────────────────
function MemberRow({ member, isOverseer, canKick, canPromote, canDemote, onKick, onPromote, onDemote, pendingId }) {
  const initial = (member.fullName || member.displayName || "S")[0]?.toUpperCase();
  const isPending = pendingId === member.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
    >
      {member.photoURL ? (
        <img
          src={member.photoURL}
          alt={member.fullName}
          className="w-10 h-10 rounded-xl object-cover shrink-0 border border-black/5 dark:border-white/10"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center font-serif italic font-black shrink-0"
          style={{
            background: isOverseer ? `${ACCENT}1A` : "rgba(0,0,0,0.05)",
            color: isOverseer ? ACCENT : "currentColor",
          }}
        >
          {initial}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold truncate" style={isOverseer ? { color: ACCENT } : undefined}>
            {member.fullName || member.displayName || "Anonymous"}
          </p>
          {isOverseer && (
            <span
              className="px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest"
              style={{ background: `${ACCENT}1A`, color: ACCENT }}
            >
              Overseer
            </span>
          )}
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-ink-faint dark:text-slate-500 mt-1 truncate">
          {member.major || (isOverseer ? "Overseer" : "Scholar")}
        </p>
      </div>

      <PresenceDot online={isOnline(member)} />

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canPromote && (
          <button
            onClick={() => onPromote(member)}
            disabled={isPending}
            className="p-2 bg-[#7c83f2]/10 text-[#7c83f2] hover:bg-[#7c83f2] hover:text-white rounded-xl transition-all disabled:opacity-50"
            title="Promote to assistant moderator"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldPlus size={14} />}
          </button>
        )}
        {canDemote && (
          <button
            onClick={() => onDemote(member)}
            disabled={isPending}
            className="p-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-xl transition-all disabled:opacity-50"
            title="Remove moderator privileges"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldMinus size={14} />}
          </button>
        )}
        {canKick && (
          <button
            onClick={() => onKick(member)}
            disabled={isPending}
            className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all disabled:opacity-50"
            title="Kick from group"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── تبويب الأعضاء ────────────────────────────────────────────────────────────
function MembersTab({ group, isLeader, isAdmin }) {
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [confirm, setConfirm]   = useState({ open: false, member: null, type: null });

  const isPrimaryLeader = !!isLeader;
  const canModerate = !!(isLeader || isAdmin);

  useEffect(() => {
    if (!group?.members?.length) { setMembers([]); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all(
      group.members.map(async (uid) => {
        try {
          const snap = await getDoc(doc(firestore, COL.USERS, uid));
          return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch { return null; }
      })
    ).then((rows) => {
      if (!cancelled) setMembers(rows.filter(Boolean));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [group?.members]);

  const { overseers, scholars } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filter = (m) =>
      !term ||
      (m.fullName || m.displayName || "").toLowerCase().includes(term) ||
      (m.major || "").toLowerCase().includes(term);
    const visible = members.filter(filter);
    const leaderId    = group?.leaderId;
    const coLeaderIds = group?.coLeaderIds || [];
    const isOver = (m) =>
      m.id === leaderId || coLeaderIds.includes(m.id) ||
      m.role === "overseer" || m.role === "admin";
    return {
      overseers: visible.filter(isOver),
      scholars:  visible.filter((m) => !isOver(m)).sort((a, b) =>
        (a.fullName || a.displayName || "").localeCompare(b.fullName || b.displayName || "")
      ),
    };
  }, [members, search, group?.leaderId, group?.coLeaderIds]);

  const openKickConfirm    = (m) => setConfirm({ open: true, member: m, type: "kick" });
  const openPromoteConfirm = (m) => setConfirm({ open: true, member: m, type: "promote" });
  const openDemoteConfirm  = (m) => setConfirm({ open: true, member: m, type: "demote" });
  const closeConfirm = () => setConfirm({ open: false, member: null, type: null });

  const handleConfirmed = async () => {
    const { member, type } = confirm;
    if (!member || !group?.id) return;
    closeConfirm();
    setPendingId(member.id);
    try {
      if (type === "kick") {
        await api(`/api/groups/${group.id}/members/${member.id}`, { method: "DELETE" });
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
      } else {
        await api(`/api/groups/${group.id}/members/${member.id}/role`, {
          method: "PATCH",
          body: { action: type === "promote" ? "promote" : "demote" },
        });
      }
    } catch (err) {
      console.error(`[GroupInfoPanel] ${type} failed:`, err);
      alert(err.message || "An error occurred, please try again.");
    } finally {
      setPendingId(null);
    }
  };

  const confirmConfig = {
    kick:    { label: "Kick member",                     color: "#ef4444" },
    promote: { label: "Promote to assistant moderator",  color: ACCENT },
    demote:  { label: "Remove moderator privileges",     color: "#f59e0b" },
  }[confirm.type] || { label: "", color: "#000" };

  return (
    <div className="flex flex-col h-full">
      {/* search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full ps-9 pe-3 py-2 text-xs bg-black/5 dark:bg-white/5 rounded-xl outline-none focus:ring-1 ring-accent/40 transition text-ink placeholder:text-ink-faint"
          />
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-ink-faint mt-2">
          {group?.members?.length || 0} members
        </p>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-3 pb-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" size={22} style={{ color: ACCENT }} />
          </div>
        ) : (
          <>
            {overseers.length > 0 && (
              <section className="mt-2">
                <h4 className="px-3 mb-1 text-[10px] font-serif italic font-bold tracking-wide" style={{ color: ACCENT }}>
                  Overseers
                </h4>
                <AnimatePresence initial={false}>
                  {overseers.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      isOverseer
                      canKick={false}
                      canDemote={isPrimaryLeader && m.id !== group?.leaderId}
                      canPromote={false}
                      onDemote={openDemoteConfirm}
                      pendingId={pendingId}
                    />
                  ))}
                </AnimatePresence>
              </section>
            )}
            {scholars.length > 0 && (
              <section className="mt-3">
                <h4 className="px-3 mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-ink-faint">
                  Scholars — {scholars.length}
                </h4>
                <AnimatePresence initial={false}>
                  {scholars.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      isOverseer={false}
                      canKick={canModerate}
                      canPromote={isPrimaryLeader}
                      canDemote={false}
                      onKick={openKickConfirm}
                      onPromote={openPromoteConfirm}
                      pendingId={pendingId}
                    />
                  ))}
                </AnimatePresence>
              </section>
            )}
            {overseers.length === 0 && scholars.length === 0 && !loading && (
              <p className="py-10 text-center text-[10px] uppercase font-black tracking-widest opacity-30">
                No members
              </p>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirm.open}
        onConfirm={handleConfirmed}
        onCancel={closeConfirm}
        memberName={confirm.member?.fullName || confirm.member?.displayName || ""}
        actionLabel={confirmConfig.label}
        actionColor={confirmConfig.color}
      />
    </div>
  );
}

// ─── تبويب الملفات ────────────────────────────────────────────────────────────
function FilesTab({ messages = [] }) {
  const [fileTab, setFileTab] = useState("all");

  const approved = messages.filter(
    (m) => (m.fileUrl || m.file) && m.moderationStatus !== "pending"
  );
  const filtered = approved.filter((r) =>
    fileTab === "all" ? true : classifyType(r) === fileTab
  );

  return (
    <div className="flex flex-col h-full">
      {/* filter bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5">
          {FILE_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setFileTab(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                fileTab === id
                  ? "bg-white dark:bg-white/10 text-accent shadow-sm"
                  : "text-ink-faint hover:text-ink dark:hover:text-white/70"
              }`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-3 space-y-1 pb-4">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-[10px] uppercase font-black tracking-widest opacity-30">
            No files
          </p>
        ) : (
          filtered.map((res, idx) => {
            const isImage = (res.fileType || "").startsWith("image/");
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="group w-full px-3 py-2.5 rounded-xl flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-black/5 dark:bg-white/10 text-ink-faint group-hover:bg-accent group-hover:text-white overflow-hidden transition-colors">
                  {isImage && res.fileUrl ? (
                    <img src={res.fileUrl} alt={res.fileName} className="w-full h-full object-cover" />
                  ) : (
                    <FileText size={16} />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-start">
                  <p className="text-[12px] font-bold truncate leading-tight text-ink dark:text-slate-200">
                    {res.fileName || "Scholarly Asset"}
                  </p>
                  <span className="text-[7px] font-black uppercase tracking-widest mt-1 flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                    <ShieldCheck size={8} className="text-emerald-500" /> Verified
                  </span>
                </div>
                <a
                  href={res.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-ink-faint opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                  aria-label="Download"
                >
                  <Download size={14} />
                </a>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── البانيل الرئيسي ──────────────────────────────────────────────────────────
export default function GroupInfoPanel({ isOpen, group, isLeader, isAdmin, messages = [], groupId }) {
  const [tab, setTab] = useState("members");
  const [showReport, setShowReport] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="group-info-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 300, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="hidden lg:flex flex-col h-full bg-paper dark:bg-[#0A0A0A] border-s border-sand dark:border-white/5 overflow-hidden shrink-0"
        >
          {/* ── العنوان ─────────────────────────────────────────────── */}
          <div className="px-4 pt-5 pb-0 shrink-0">
            <h2 className="text-[11px] font-black uppercase tracking-[0.28em] text-ink dark:text-white mb-3">
              {group?.name || "Node Info"}
            </h2>

            {/* ── تبويبات ────────────────────────────────────────────── */}
            <div className="flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                    tab === id
                      ? "bg-white dark:bg-white/10 text-accent shadow-sm"
                      : "text-ink-faint hover:text-ink dark:hover:text-white/70"
                  }`}
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── المحتوى ──────────────────────────────────────────────── */}
          <div className="flex-1 overflow-hidden flex flex-col mt-1">
            <AnimatePresence mode="wait">
              {tab === "members" && (
                <motion.div
                  key="members"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 overflow-hidden flex flex-col h-full"
                >
                  <MembersTab group={group} isLeader={isLeader} isAdmin={isAdmin} />
                </motion.div>
              )}
              {tab === "files" && (
                <motion.div
                  key="files"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 overflow-hidden flex flex-col h-full"
                >
                  <FilesTab messages={messages} />
                </motion.div>
              )}
              {tab === "calendar" && (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 overflow-hidden flex flex-col h-full"
                >
                  <CalendarSidebar groupId={groupId} isLeader={isLeader} isAdmin={isAdmin} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── زر الإبلاغ عن المجموعة (للأعضاء غير القادة) ───────── */}
          {!isLeader && (
            <div className="shrink-0 px-4 py-3 border-t border-sand dark:border-white/5">
              <button
                onClick={() => setShowReport(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-rose-500/70 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              >
                <Flag size={13} />
                Report group
              </button>
            </div>
          )}
        </motion.aside>
      )}

      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        reportGroupId={groupId}
      />
    </AnimatePresence>
  );
}
