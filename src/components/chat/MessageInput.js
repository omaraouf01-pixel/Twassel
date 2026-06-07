"use client";

// ══════════════════════════════════════════════════════════════════════
// MessageInput — مكوّن إدخال الرسائل في شات العقدة الأكاديمية
// ──────────────────────────────────────────────────────────────────────
// يتعامل مع:
//  • كتابة الرسائل النصية مع دعم الإيموجي.
//  • رفع الملفات إلى Cloudinary عبر /api/upload.
//  • الرد على رسالة محددة (replyTo).
//  • حماية القنوات المقفلة (isReadOnly) وقنوات الجامعة الرسمية.
// ══════════════════════════════════════════════════════════════════════

import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Paperclip, X, FileText, Reply, Smile, Megaphone } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { useAuth } from "@/lib/useAuth";

// الحد الأقصى لحجم الملف المُرفق (25 ميغابايت)
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_MB = 25;

/**
 * MessageInput — مكوّن حقل إدخال الرسائل.
 *
 * @param {string}   groupId       - معرّف العقدة (المجموعة) الحالية
 * @param {object}   group         - بيانات المجموعة (accessType, isReadOnly, officialType...)
 * @param {Function} sendMessage   - دالة useChat.sendMessage لإرسال الرسالة
 * @param {object}   replyTo       - الرسالة المُشار إليها في الرد (أو null)
 * @param {Function} onClearReply  - callback لمسح حالة الرد
 */
export default function MessageInput({ groupId, group, sendMessage, replyTo, onClearReply }) {
  const { user, userData } = useAuth();
  const fileInputRef = useRef(null);

  const [content, setContent] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef(null);
  const textareaRef = useRef(null);

  // إغلاق قائمة الإيموجي عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmoji(false);
      }
    };
    if (showEmoji) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmoji]);

  /**
   * handleEmojiClick — يُدرج الإيموجي عند موضع المؤشر الحالي في textarea.
   * إذا لم يكن textarea متاحاً، يُلحق الإيموجي بنهاية النص.
   * يستعيد موضع المؤشر بعد الإدراج لتجربة كتابة سلسة.
   */
  const handleEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;
    const textarea = textareaRef.current;
    if (!textarea) { setContent((c) => c + emoji); return; }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + emoji + content.slice(end);
    setContent(newContent);
    // setTimeout(0) لضمان تحديث DOM قبل استعادة موضع المؤشر
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      textarea.focus();
    }, 0);
  };

  const isAdmin = userData?.role === "admin";

  // قناة الجامعة: الطلاب لا يمكنهم الكتابة — إعلانات فقط من الأدمن
  const isUniversityAnnouncement =
    group?.officialType === "university" && !isAdmin;

  const isMuted =
    (group?.isReadOnly && user?.uid !== group?.leaderId && !isAdmin) ||
    isUniversityAnnouncement;

  // عرض لافتة الإعلانات بدلاً من حقل الإدخال لقنوات الجامعة
  if (isUniversityAnnouncement) {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-[#7c83f2]/20 bg-[#7c83f2]/5">
        <div className="w-8 h-8 rounded-xl bg-[#7c83f2]/10 flex items-center justify-center shrink-0">
          <Megaphone size={15} className="text-[#7c83f2]" />
        </div>
        <p className="text-[11px] font-serif italic text-ink-muted dark:text-slate-400 leading-snug">
          This channel is reserved for official academic announcements only.
        </p>
      </div>
    );
  }

  /**
   * handlePickFile — يعالج اختيار ملف من نظام الملفات.
   * - يرفض الملفات الأكبر من MAX_FILE_BYTES ويُظهر رسالة خطأ.
   * - يُخزّن الملف في pendingFile مع معلوماته (اسم، نوع، حجم).
   * - يُعيد تعيين input لإتاحة اختيار نفس الملف مجدداً.
   */
  const handlePickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // إعادة التعيين لإتاحة إعادة الاختيار
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`File is larger than ${MAX_FILE_MB} MB`);
      return;
    }
    setUploadError(null);
    setPendingFile({ file, name: file.name, type: file.type || "application/octet-stream", size: file.size });
  };

  /** clearPending — يلغي اختيار الملف المعلّق ومسح أي خطأ سابق */
  const clearPending = () => {
    setPendingFile(null);
    setUploadError(null);
  };

  /**
   * uploadFile — يرفع الملف إلى Cloudinary عبر الـ API proxy الداخلية.
   * يُنظّم الملف داخل مجلد المجموعة: tawassol/groups/{groupId}.
   * يرمي خطأً صريحاً عند فشل الرفع لمعالجته في handleSendMessage.
   *
   * @param {File} file - كائن الملف المحدد
   * @returns {Promise<{url: string, publicId: string}>}
   */
  const uploadFile = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", `tawassol/groups/${groupId}`);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Could not send");
    }
    return res.json();
  };

  /**
   * handleSendMessage — ينسّق عملية إرسال الرسالة بالكامل:
   *  1. يرفع الملف إن وُجد (مع تحديث حالة الرفع).
   *  2. يمسح حقل الإدخال مباشرة (قبل await sendMessage) لـ Optimistic UI.
   *  3. يستدعي useChat.sendMessage() الذي يُضيف رسالة مؤقتة فوراً.
   *  4. عند الفشل: يُعيد النص ويُظهر رسالة الخطأ.
   */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed && !pendingFile) return;
    if (isSending || isMuted) return;

    setIsSending(true);
    setUploadError(null);

    let fileUrl = null;
    let fileName = null;
    let fileType = null;
    let fileSize = null;

    try {
      if (pendingFile) {
        setIsUploading(true);
        const { url } = await uploadFile(pendingFile.file);
        setIsUploading(false);
        fileUrl = url;
        fileName = pendingFile.name;
        fileType = pendingFile.type;
        fileSize = pendingFile.size;
      }

      // لقطة فورية من النص قبل مسح الحقل (لاستعادتها عند الفشل)
      const snapshotContent = trimmed;
      setContent("");
      setPendingFile(null);
      if (onClearReply) onClearReply();

      if (typeof sendMessage !== "function") {
        console.error("[MessageInput] sendMessage prop is required but was not provided");
        return;
      }
      await sendMessage({
        content: snapshotContent,
        fileUrl,
        fileName,
        fileType,
        fileSize,
        replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, senderName: replyTo.senderName } : null,
      });
    } catch (error) {
      console.error("[MessageInput] send failed:", error);
      setUploadError(error?.message || "Could not send");
      setContent(trimmed); // استعادة النص عند فشل الإرسال
    } finally {
      setIsUploading(false);
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
      <AnimatePresence>
        {/* Reply preview */}
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 6, height: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 px-3 py-2 rounded-xl border-s-2 overflow-hidden"
            style={{ background: "rgba(124, 131, 242, 0.06)", borderColor: "#7c83f2" }}
          >
            <Reply size={13} style={{ color: "#7c83f2", flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-0.5" style={{ color: "#7c83f2" }}>
                Replying to {replyTo.senderName || "Scholar"}
              </p>
              <p className="text-[11px] font-serif italic truncate text-ink dark:text-white/70">
                {replyTo.content || "(attachment)"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearReply}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              aria-label="Cancel reply"
            >
              <X size={13} style={{ color: "#7c83f2" }} />
            </button>
          </motion.div>
        )}

        {/* Pending file pill */}
        {pendingFile && (
          <motion.div
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 6, height: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-3 px-3 py-2 rounded-xl border"
            style={{ background: "rgba(124, 131, 242, 0.08)", borderColor: "rgba(124, 131, 242, 0.35)" }}
          >
            <FileText size={14} style={{ color: "#7c83f2" }} />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-serif italic truncate" style={{ color: "#7c83f2" }}>
                {pendingFile.name}
              </p>
              <p className="text-[9px] uppercase tracking-[0.15em] text-ink-faint">
                {(pendingFile.size / 1024).toFixed(1)} KB · will be queued for review
              </p>
            </div>
            <button type="button" onClick={clearPending} className="p-1.5 rounded-lg hover:bg-white/10 transition" aria-label="Remove file">
              <X size={14} style={{ color: "#7c83f2" }} />
            </button>
          </motion.div>
        )}

        {uploadError && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[11px] font-serif italic text-rose-500 px-3"
          >
            {uploadError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="flex items-center gap-3 relative">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handlePickFile} disabled={isMuted || isSending} />

        {/* Emoji picker container */}
        <div ref={emojiRef} className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            disabled={isMuted}
            title="Insert emoji"
            aria-label="Insert emoji"
            className="p-3 rounded-full border border-sand/30 dark:border-white/10 hover:border-accent/60 hover:bg-accent/5 transition disabled:opacity-50"
            style={{ color: "#7c83f2" }}
          >
            <Smile size={18} strokeWidth={2} />
          </button>
          <AnimatePresence>
            {showEmoji && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 8 }}
                transition={{ duration: 0.18 }}
                className="absolute bottom-14 left-0 z-50"
              >
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  skinTonesDisabled
                  height={380}
                  width={320}
                  previewConfig={{ showPreview: false }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isMuted || isSending}
          title="Attach an academic file"
          aria-label="Attach an academic file"
          className="p-3 rounded-full border border-sand/30 dark:border-white/10 hover:border-accent/60 hover:bg-accent/5 transition disabled:opacity-50"
          style={{ color: "#7c83f2" }}
        >
          <Paperclip size={18} strokeWidth={2} />
        </button>

        <div className="flex-1 bg-paper dark:bg-white/5 border border-sand/20 dark:border-white/10 rounded-[1.5rem] px-4 py-1 flex items-center transition-all focus-within:border-accent">
          <textarea
            ref={textareaRef}
            disabled={isMuted}
            value={isMuted ? "The overseer has silenced this node…" : content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
            }}
            placeholder={pendingFile ? "Add a caption for the file (optional)…" : "Signal your thoughts…"}
            className="w-full bg-transparent border-none py-3 text-sm focus:ring-0 resize-none max-h-32 italic font-serif placeholder:italic placeholder:font-serif placeholder:text-ink-faint"
            rows={1}
          />
        </div>

        <button
          type="submit"
          disabled={isSending || isMuted || (!content.trim() && !pendingFile)}
          aria-label="Send"
          title="Send"
          className={`p-4 rounded-full transition-all ${
            isMuted ? "bg-sand text-ink-faint" : "bg-accent text-white shadow-lg shadow-accent/20 hover:bg-ink disabled:opacity-60"
          }`}
        >
          {isSending || isUploading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} data-flip-rtl />}
        </button>
      </div>
    </form>
  );
}
