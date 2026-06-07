"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  Download,
  File,
  ExternalLink,
  Eye,
  Monitor,
  ShieldAlert,
} from "lucide-react";
import { buildViewUrl, buildDownloadUrl, isViewableInBrowser } from "@/lib/fileLinks";

// ────────────────────────────────────────────────────────────────
// MessageAttachment — بطاقة مرفق مع منطق "الاحتجاز الشفاف".
//  • pending → opacity 0.8 + شريط تحذيري أرجواني Serif Italic.
//  • approved → opacity 1 + اختفاء البانر (Real-time).
//  • framer-motion ينقل البطاقة بسلاسة بين الحالتين.
// ────────────────────────────────────────────────────────────────

const ACADEMIC_PURPLE = "#7c83f2";

export default function MessageAttachment({
  imageUrl,
  fileUrl,
  fileName,
  fileType,
  fileSize,
  moderationStatus = "approved",
}) {
  const isPending = moderationStatus === "pending";

  // ─── Image attachment ───
  if (imageUrl) {
    return (
      <QuarantineWrapper isPending={isPending}>
        <motion.a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: isPending ? 0.8 : 1, scale: 1 }}
          whileHover={{ y: -4 }}
          transition={{ duration: 0.5 }}
          className="group relative block max-w-sm rounded-[2rem] overflow-hidden border shadow-premium bg-surface/50"
          style={{
            borderColor: isPending
              ? `${ACADEMIC_PURPLE}55`
              : "rgba(255,255,255,0.05)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
          <img
            src={imageUrl}
            alt="Scholarly Insight"
            className="w-full h-auto max-h-80 object-cover transition-transform duration-1000 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute top-4 right-4 z-20">
            <div className="p-2.5 bg-background/60 backdrop-blur-md rounded-xl border border-white/10 text-white opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
              <ExternalLink size={16} strokeWidth={2.5} />
            </div>
          </div>
        </motion.a>
      </QuarantineWrapper>
    );
  }

  // ─── Generic file attachment ───
  if (fileUrl) {
    const ext = (fileName?.split(".").pop() || "").toLowerCase();
    const Icon = pickLucideIcon(fileType, ext);
    const label = fileName || "Academic_Document";
    const viewable = isViewableInBrowser(fileUrl, fileName);
    const viewHref = buildViewUrl(fileUrl, fileName);
    const downloadHref = buildDownloadUrl(fileUrl, fileName);

    return (
      <QuarantineWrapper isPending={isPending}>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: isPending ? 0.8 : 1, x: 0 }}
          whileHover={{ x: 4 }}
          transition={{ duration: 0.5 }}
          className="max-w-xs"
        >
          <div
            className="flex items-center gap-4 p-4 rounded-[1.5rem] border transition-all duration-500 group"
            style={{
              background: isPending
                ? `${ACADEMIC_PURPLE}10`
                : "rgba(255,255,255,0.02)",
              borderColor: isPending
                ? `${ACADEMIC_PURPLE}45`
                : "rgba(255,255,255,0.05)",
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-all duration-500"
              style={{
                background: isPending
                  ? `${ACADEMIC_PURPLE}1A`
                  : "rgba(255,255,255,0.05)",
                color: isPending ? ACADEMIC_PURPLE : undefined,
              }}
            >
              <Icon size={20} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-[13px] font-bold truncate leading-tight tracking-tight transition-colors"
                style={{ color: isPending ? ACADEMIC_PURPLE : "white" }}
              >
                {label}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  {ext || "Bin"}
                  {fileSize ? ` · ${formatBytes(fileSize)}` : ""}
                  {isPending ? " · Under Review" : " · Verified"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {viewable && (
                <a
                  href={viewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View"
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Eye size={14} strokeWidth={2.5} />
                </a>
              )}
              <a
                href={downloadHref}
                download={fileName || true}
                title="Download"
                className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Download size={14} strokeWidth={2.5} />
              </a>
            </div>
          </div>
        </motion.div>
      </QuarantineWrapper>
    );
  }

  return null;
}

// ─── Quarantine Banner (Academic, Serif Italic) ───────────────
function QuarantineWrapper({ isPending, children }) {
  return (
    <div className="relative">
      <AnimatePresence>
        {isPending && (
          <motion.div
            key="quarantine-banner"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl border backdrop-blur-sm"
            style={{
              background: `${ACADEMIC_PURPLE}14`,
              borderColor: `${ACADEMIC_PURPLE}40`,
              color: ACADEMIC_PURPLE,
            }}
            dir="rtl"
          >
            <ShieldAlert size={13} strokeWidth={2} className="shrink-0" />
            <span className="text-[11px] leading-snug font-serif italic">
              Warning: This file is under review, use at your own risk
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}

function pickLucideIcon(mime, ext) {
  if (!mime && !ext) return File;
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
  if (mime?.startsWith("image/") || imageExts.includes(ext)) return ImageIcon;
  const docExts = ["pdf", "doc", "docx", "txt", "md", "rtf"];
  if (docExts.includes(ext)) return FileText;
  const codeExts = ["js", "jsx", "ts", "tsx", "py", "cpp", "html", "css", "json"];
  if (codeExts.includes(ext)) return Monitor;
  return File;
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
