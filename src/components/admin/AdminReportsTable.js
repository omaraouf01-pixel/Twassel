"use client";

// ══════════════════════════════════════════════════════════════════════
// AdminReportsTable — لوحة إدارة البلاغات للأدمن
// ──────────────────────────────────────────────────────────────────────
// تتعامل مع:
//  • عرض البلاغات المعلّقة (منشورات + مجموعات) في شبكة بطاقات.
//  • تصفية البلاغات حسب النوع (الكل / منشور / مجموعة).
//  • "رفض" البلاغ: يُغيّر حالته إلى dismissed عبر PATCH.
//  • "حذف المحتوى": يحذف المنشور أو المجموعة ثم يُغلق البلاغ كـ resolved.
//  • نافذة تأكيد (ConfirmDialog) قبل أي حذف نهائي.
// ══════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flag, FileText, LayoutGrid, MessageSquare, Loader2,
  CheckCircle, X, Trash2, AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/apiClient";
import { useTranslation } from "@/lib/i18n";

// ─── ConfirmDialog ─────────────────────────────────────────────────────────────
/**
 * ConfirmDialog — نافذة حوار تأكيد الحذف.
 * تُعرض فوق كل شيء (z-index 300) وتطلب تأكيداً صريحاً قبل الإجراء التدميري.
 *
 * @param {boolean}  isOpen    - هل النافذة مفتوحة
 * @param {Function} onConfirm - callback عند الضغط على "تأكيد الحذف"
 * @param {Function} onCancel  - callback عند الإلغاء
 * @param {string}   message   - رسالة التحذير المعروضة للمستخدم
 */
function ConfirmDialog({ isOpen, onConfirm, onCancel, message }) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 12 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-full max-w-sm bg-white dark:bg-[#111] rounded-3xl p-7 shadow-2xl border border-black/5 dark:border-white/10"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertTriangle size={26} />
              </div>
              <p className="text-sm font-bold text-ink dark:text-white leading-snug">{message}</p>
              <div className="flex w-full gap-3 mt-1">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                >
                  {t("admin.confirm_cancel")}
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors"
                >
                  {t("admin.confirm_delete")}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── ReportCard ────────────────────────────────────────────────────────────────
/**
 * ReportCard — بطاقة عرض بلاغ واحد.
 * تُظهر: نوع البلاغ (post/group)، السبب، معاينة المحتوى، المُبلِّغ، وأزرار الإجراء.
 * تُعطَّل الأزرار أثناء معالجة أي بلاغ (processing !== null) لمنع التكرار.
 *
 * @param {object}   report     - بيانات البلاغ من Firestore
 * @param {Function} onDismiss  - callback لرفض البلاغ
 * @param {Function} onDelete   - callback لطلب حذف المحتوى (يفتح ConfirmDialog)
 * @param {string}   processing - ID البلاغ الذي يُعالَج حالياً (أو null)
 */
function ReportCard({ report, onDismiss, onDelete, processing }) {
  const { t } = useTranslation();
  const isPost    = report.type === "post";
  const isMessage = report.type === "message";
  const isPending = processing === report.id;

  const REASON_LABELS = {
    inappropriate: t("report.reason_inappropriate"),
    spam:          t("report.reason_spam"),
    harassment:    t("report.reason_harassment"),
    misinformation:t("report.reason_misinformation"),
    other:         t("report.reason_other"),
  };

  const contentPreview = isPost
    ? (report.postText || "—")
    : isMessage
    ? (report.messageText || "—")
    : (report.groupName || "—");

  const timeLabel = (() => {
    const ts = report.createdAt?.toDate?.() ?? (report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000) : null);
    if (!ts) return "";
    return ts.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-paper dark:bg-white/5 border border-sand dark:border-white/10 rounded-2xl p-5 flex flex-col gap-3"
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* type badge */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
              isPost
                ? "bg-violet-500/10 text-violet-500"
                : isMessage
                ? "bg-sky-500/10 text-sky-500"
                : "bg-amber-500/10 text-amber-500"
            }`}
          >
            {isPost ? <FileText size={9} /> : isMessage ? <MessageSquare size={9} /> : <LayoutGrid size={9} />}
            {isPost ? t("admin.type_post") : isMessage ? t("admin.type_message") : t("admin.type_group")}
          </span>

          {/* reason badge */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500">
            <Flag size={9} />
            {REASON_LABELS[report.reason] || report.reason}
          </span>
        </div>

        <span className="text-[10px] text-ink-faint shrink-0">{timeLabel}</span>
      </div>

      {/* ── Content preview ── */}
      <p className="text-sm font-serif italic text-ink-muted dark:text-slate-300 leading-relaxed border-s-2 border-accent/30 ps-3 line-clamp-3">
        {contentPreview}
      </p>

      {/* ── Reporter info ── */}
      <p className="text-[11px] text-ink-faint">
        {t("admin.reported_by")}{" "}
        <span className="font-bold text-ink dark:text-white">{report.reporterName || "—"}</span>
        {(isMessage || !isPost) && report.groupName && isMessage && (
          <>
            {" "}في{" "}
            <span className="font-bold text-ink dark:text-white">{report.groupName}</span>
          </>
        )}
        {!isPost && report.authorName && (
          <>
            {" "}{t("admin.content_by")}{" "}
            <span className="font-bold text-ink dark:text-white">{report.authorName}</span>
          </>
        )}
      </p>

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 pt-1 border-t border-sand dark:border-white/5">
        <button
          onClick={() => onDismiss(report)}
          disabled={!!processing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-ink-faint border border-sand dark:border-white/10 hover:border-accent/40 hover:text-accent disabled:opacity-40 transition-all"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
          {t("admin.dismiss")}
        </button>
        <button
          onClick={() => onDelete(report)}
          disabled={!!processing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white disabled:opacity-40 transition-all"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          {t("admin.delete_content")}
        </button>
      </div>
    </motion.div>
  );
}

// ─── AdminReportsTable ─────────────────────────────────────────────────────────
/**
 * AdminReportsTable — المكوّن الرئيسي للوحة إدارة البلاغات.
 *
 * @param {Array} reports - قائمة البلاغات المحمّلة من Firestore (جميع الحالات)
 *
 * الحالة الداخلية:
 *  - typeFilter: تصفية حسب نوع المحتوى (all | post | group)
 *  - processing: ID البلاغ الذي يُعالَج حالياً (لمنع التكرار)
 *  - dismissed:  Set من IDs البلاغات التي أُغلقت في الجلسة الحالية (Optimistic UI)
 *  - confirm:    بيانات البلاغ الذي يُنتظر تأكيد حذفه
 */
export default function AdminReportsTable({ reports = [] }) {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState("all");
  const [processing, setProcessing] = useState(null);
  const [dismissed, setDismissed]   = useState(new Set());
  const [confirm, setConfirm] = useState(null); // { report } — يُفعّل ConfirmDialog

  const TYPE_FILTERS = [
    { id: "all",     label: t("admin.filter_all"),      Icon: Flag },
    { id: "post",    label: t("admin.filter_posts"),    Icon: FileText },
    { id: "group",   label: t("admin.filter_groups"),   Icon: LayoutGrid },
  ];

  // البلاغات المرئية: pending فقط + غير مُرفوضة في الجلسة + مطابقة للفلتر
  const visible = useMemo(() => {
    return reports
      .filter((r) => !dismissed.has(r.id))
      .filter((r) => r.status === "pending")
      .filter((r) => typeFilter === "all" || r.type === typeFilter);
  }, [reports, dismissed, typeFilter]);

  /**
   * handleDismiss — يرفض البلاغ دون حذف المحتوى.
   * يُرسل PATCH بـ status: "dismissed" ويُخفي البلاغ فوراً (Optimistic UI).
   */
  const handleDismiss = async (report) => {
    if (processing) return;
    setProcessing(report.id);
    try {
      await api(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        body: { status: "dismissed" },
      });
      setDismissed((prev) => new Set([...prev, report.id]));
    } catch (e) {
      alert(e.message || t("admin.error_dismiss"));
    } finally {
      setProcessing(null);
    }
  };

  /**
   * handleDeleteContent — يُفتح نافذة التأكيد قبل الحذف النهائي.
   * لا يحذف مباشرةً — يُخزّن البلاغ في confirm لينتظر تأكيد المستخدم.
   */
  const handleDeleteContent = async (report) => {
    setConfirm({ report });
  };

  /**
   * confirmDelete — يُنفّذ الحذف الفعلي بعد التأكيد:
   *  1. يحذف المحتوى (منشور أو مجموعة) عبر API المناسبة.
   *  2. يُغلق البلاغ بحالة "resolved".
   *  3. يُخفيه من القائمة (Optimistic UI).
   */
  const confirmDelete = async () => {
    const { report } = confirm;
    setConfirm(null);
    if (!report) return;
    setProcessing(report.id);
    try {
      if (report.type === "post") {
        await api(`/api/posts/${report.postId}`, { method: "DELETE" });
      } else if (report.type === "group") {
        await api(`/api/admin/groups/${report.groupId}`, { method: "DELETE" });
      }
      await api(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        body: { status: "resolved" },
      });
      setDismissed((prev) => new Set([...prev, report.id]));
    } catch (e) {
      alert(e.message || t("admin.error_delete"));
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div>
      {/* ── Filter bar ── */}
      <div className="flex gap-2 mb-6">
        {TYPE_FILTERS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTypeFilter(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all border ${
              typeFilter === id
                ? "bg-accent text-white border-accent shadow-sm shadow-accent/20"
                : "border-sand dark:border-white/10 text-ink-faint hover:text-ink dark:hover:text-white hover:border-accent/30"
            }`}
          >
            <Icon size={12} />
            {label}
            {id !== "all" && (
              <span className="opacity-60">
                {reports.filter((r) => r.status === "pending" && r.type === id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Cards grid ── */}
      {visible.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4">
            <CheckCircle size={28} />
          </div>
          <p className="text-sm font-black uppercase tracking-widest text-ink-faint">
            {t("admin.no_reports")}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {visible.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onDismiss={handleDismiss}
                onDelete={handleDeleteContent}
                processing={processing}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onConfirm={confirmDelete}
        onCancel={() => setConfirm(null)}
        message={
          confirm?.report?.type === "post"
            ? t("admin.confirm_delete_post")
            : t("admin.confirm_delete_group", { name: confirm?.report?.groupName ?? "" })
        }
      />
    </div>
  );
}
