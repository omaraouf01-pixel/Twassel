"use client";

// ══════════════════════════════════════════════════════════════════════
// MessageList — قائمة الرسائل التفاعلية في شات العقدة
// ──────────────────────────────────────────────────────────────────────
// الميزات:
//  • Auto-scroll ذكي (يبقى في الأسفل إلا إذا تمرّر المستخدم للأعلى)
//  • Context menu عند hover: تثبيت رسالة / إبلاغ / رد
//  • شريط الإيموجي عند hover (6 ردود فعل)
//  • معاينة الرسالة المرد عليها فوق الفقاعة
//  • عدادات ردود الفعل أسفل الفقاعة
// ══════════════════════════════════════════════════════════════════════

import React, { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useCallback, forwardRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Trash2, Loader2, AlertCircle,
  Pin, Flag, Reply, Smile,
} from "lucide-react";
import MessageAttachment from "@/components/MessageAttachment";
import ReportModal from "./ReportModal";
import { api } from "@/lib/apiClient";

// ردود الفعل المتاحة على الرسائل
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

/**
 * formatTime — يُحوّل timestamp إلى نص وقت بتنسيق HH:MM.
 * يدعم: Date، Firestore Timestamp (seconds)، string.
 * يعيد "..." إذا كان التاريخ غير صالح.
 */
function formatTime(createdAt) {
  if (!createdAt) return "...";
  const date =
    createdAt instanceof Date
      ? createdAt
      : createdAt.seconds
      ? new Date(createdAt.seconds * 1000)
      : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "...";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * parseReactions — يُحوّل خريطة ردود الفعل من Firestore إلى مصفوفة منظّمة.
 * الصيغة في Firestore: { "👍": ["uid1", "uid2"], "❤️": ["uid3"] }
 * الناتج: [{ emoji, count, isMine }]
 */
function parseReactions(reactions = {}, uid) {
  return Object.entries(reactions)
    .filter(([, uids]) => Array.isArray(uids) && uids.length > 0)
    .map(([emoji, uids]) => ({ emoji, count: uids.length, isMine: uids.includes(uid) }));
}

/**
 * MessageList — live message feed with:
 *  • Smart auto-scroll
 *  • Context menu (Pin / Report / Reply) on hover
 *  • Emoji reaction bar on hover
 *  • Reply preview above the bubble
 *  • Reaction counters below the bubble
 */
const MessageList = forwardRef(function MessageList({
  messages = [],
  currentUser,
  userData,
  groupLeaderId,
  groupId,
  canPin = false,
  onDeleteMessage,
  onReply,
  pinnedMessageId,
}, ref) {
  const router = useRouter();
  const scrollRef = useRef(null);
  const messageRefs = useRef({});
  const [stickToBottom, setStickToBottom] = useState(true);

  // per-message hover state
  const [hoveredId, setHoveredId] = useState(null);
  // Emoji bar open for a message
  const [emojiBarId, setEmojiBarId] = useState(null);
  // Report modal
  const [reportTarget, setReportTarget] = useState(null); // { messageId }
  // Optimistic reactions: { [messageId]: { [emoji]: string[] } }
  const [optimisticReactions, setOptimisticReactions] = useState({});

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setStickToBottom(distance < 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, stickToBottom]);

  // Expose scrollToMessage to parent via ref
  useImperativeHandle(ref, () => ({ scrollToMessage: (id) => scrollToMessage(id) }));

  // Register ref for a message so we can scroll to it
  const setMsgRef = useCallback((id, el) => {
    if (el) messageRefs.current[id] = el;
  }, []);

  const scrollToMessage = useCallback((id) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // flash highlight
      el.classList.add("ring-2", "ring-accent/50");
      setTimeout(() => el.classList.remove("ring-2", "ring-accent/50"), 1500);
    }
  }, []);

  // Pin a message
  const handlePin = useCallback(async (msgId) => {
    try {
      await api(`/api/groups/${groupId}/pin`, { method: "PATCH", body: { messageId: msgId } });
    } catch (e) {
      console.error("[MessageList] pin failed:", e);
    }
  }, [groupId]);

  // Toggle reaction
  const handleReact = useCallback(async (msgId, emoji) => {
    if (!currentUser?.uid) return;
    const uid = currentUser.uid;

    // Optimistic update
    setOptimisticReactions((prev) => {
      const msgReactions = { ...(prev[msgId] || {}) };
      const current = msgReactions[emoji] ? [...msgReactions[emoji]] : [];
      if (current.includes(uid)) {
        msgReactions[emoji] = current.filter((u) => u !== uid);
      } else {
        msgReactions[emoji] = [...current, uid];
      }
      return { ...prev, [msgId]: msgReactions };
    });

    setEmojiBarId(null);

    try {
      await api(`/api/groups/${groupId}/messages/${msgId}/react`, { method: "POST", body: { emoji } });
    } catch (e) {
      // rollback on failure
      setOptimisticReactions((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      console.error("[MessageList] react failed:", e);
    }
  }, [groupId, currentUser?.uid]);

  // Merge Firestore reactions with optimistic overrides
  const getMergedReactions = useCallback((msg) => {
    const base = msg.reactions || {};
    const override = optimisticReactions[msg.id];
    if (!override) return base;
    return { ...base, ...override };
  }, [optimisticReactions]);

  // Find the message that is being replied to
  const getReplySource = useCallback((replyTo) => {
    if (!replyTo?.id) return null;
    return messages.find((m) => m.id === replyTo.id) || null;
  }, [messages]);

  return (
    <>
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto hide-scrollbar space-y-1 pb-10 px-4"
      >
        {messages.length === 0 && (
          <p className="text-center text-ink-faint italic font-display py-12">
            No messages yet — be the first to speak.
          </p>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, idx) => {
            const isSystem = m.isSystem || m.role === "system";
            const isMe = !isSystem && m.uid === currentUser?.uid;
            const isLeader = m.uid === groupLeaderId;
            const isAdmin = m.role === "admin";
            const isOptimistic = !!m._optimistic;
            const isFailed = !!m._failed;
            const isPinned = m.id === pinnedMessageId;

            const canDelete =
              !isOptimistic &&
              !isSystem &&
              (isMe ||
                currentUser?.uid === groupLeaderId ||
                userData?.role === "admin");

            const replySource = m.replyTo ? getReplySource(m.replyTo) : null;
            const mergedReactions = getMergedReactions(m);
            const reactionList = parseReactions(mergedReactions, currentUser?.uid);
            const isHovered = hoveredId === m.id;
            const showEmojiBar = emojiBarId === m.id;

            // ─── System pill ───────────────────────────────────────
            if (isSystem) {
              return (
                <motion.div
                  key={m.id || idx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center w-full py-1"
                >
                  <div className="px-4 py-1.5 bg-accent-soft border border-accent/20 rounded-full text-[10px] italic font-serif text-accent flex items-center gap-2">
                    <ShieldCheck size={11} />
                    <span className="tracking-wide">{m.content}</span>
                  </div>
                </motion.div>
              );
            }

            // ─── Regular message ───────────────────────────────────
            return (
              <motion.div
                key={m.id || idx}
                ref={(el) => m.id && setMsgRef(m.id, el)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: isOptimistic ? 0.7 : 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"} w-full group py-0.5 relative transition-all rounded-xl ${isPinned ? "bg-accent/5" : ""}`}
                onMouseEnter={() => { setHoveredId(m.id); }}
                onMouseLeave={() => { setHoveredId(null); setEmojiBarId(null); }}
              >
                <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>

                  {/* Sender name + badges + time */}
                  {!m._grouped && (
                    <div className="flex items-center gap-2 mb-1 px-2">
                      <span
                        onClick={() => m.uid && !isMe && router.push(`/profile/${m.uid}`)}
                        className={`text-[11px] italic font-serif text-ink dark:text-white/90 tracking-wide ${m.uid && !isMe ? "cursor-pointer hover:text-accent transition-colors" : ""}`}
                      >
                        {m.senderName || "Scholar"}
                      </span>
                      {(isLeader || isAdmin) && (
                        <span className="flex items-center gap-0.5 text-[8px] font-black text-accent bg-accent/5 px-2 py-0.5 rounded-md border border-accent/15">
                          <ShieldCheck size={8} />
                          {isAdmin ? "ADMIN" : "OVERSEER"}
                        </span>
                      )}
                      <span className="text-[10px] italic font-serif text-ink-faint">
                        · {formatTime(m.createdAt)}
                      </span>
                    </div>
                  )}

                  {/* Reply preview strip */}
                  {replySource && (
                    <button
                      onClick={() => replySource.id && scrollToMessage(replySource.id)}
                      className={`mb-1 mx-2 px-3 py-1.5 rounded-lg border-s-2 text-start w-full max-w-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                        isMe ? "border-white/40 bg-white/10" : "border-accent/40 bg-accent/5"
                      }`}
                    >
                      <p className="text-[9px] font-black uppercase tracking-widest mb-0.5 opacity-60">
                        {replySource.senderName || "Scholar"}
                      </p>
                      <p className="text-[11px] font-serif italic truncate opacity-80">
                        {replySource.content || "(attachment)"}
                      </p>
                    </button>
                  )}

                  {/* Bubble + action buttons */}
                  <div className="relative flex items-center gap-2">
                    {/* Left-side actions (for own messages: delete on the far side) */}
                    <AnimatePresence>
                      {isHovered && !isOptimistic && !isSystem && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.12 }}
                          className={`flex items-center gap-0.5 ${isMe ? "order-first" : "order-last"}`}
                        >
                          {/* Emoji toggle */}
                          <button
                            onClick={() => setEmojiBarId((prev) => (prev === m.id ? null : m.id))}
                            className="p-1.5 rounded-full text-ink-faint hover:text-accent hover:bg-accent/10 transition-colors"
                            title="React"
                          >
                            <Smile size={14} />
                          </button>

                          {/* Reply */}
                          {onReply && (
                            <button
                              onClick={() => onReply({ id: m.id, content: m.content, senderName: m.senderName })}
                              className="p-1.5 rounded-full text-ink-faint hover:text-accent hover:bg-accent/10 transition-colors"
                              title="Reply"
                            >
                              <Reply size={14} />
                            </button>
                          )}

                          {/* Pin (leader/admin only) */}
                          {canPin && m.id && (
                            <button
                              onClick={() => handlePin(m.id)}
                              className="p-1.5 rounded-full text-ink-faint hover:text-accent hover:bg-accent/10 transition-colors"
                              title="Pin message"
                            >
                              <Pin size={14} />
                            </button>
                          )}

                          {/* Report (not own message) */}
                          {!isMe && m.id && (
                            <button
                              onClick={() => setReportTarget({ messageId: m.id })}
                              className="p-1.5 rounded-full text-ink-faint hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                              title="Report"
                            >
                              <Flag size={14} />
                            </button>
                          )}

                          {/* Delete */}
                          {canDelete && onDeleteMessage && (
                            <button
                              onClick={() => onDeleteMessage(m.id)}
                              className="p-1.5 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Message bubble */}
                    <div
                      className={`px-5 py-3 rounded-[1.5rem] text-sm leading-relaxed transition-all
                        ${isMe
                          ? "bg-accent text-white rounded-se-none"
                          : "bg-paper dark:bg-white/5 border border-sand/20 dark:border-white/10 rounded-ss-none text-ink dark:text-white"
                        }
                        ${isFailed ? "ring-2 ring-rose-400/60" : ""}
                      `}
                    >
                      {m.content}

                      {(m.fileUrl || m.imageUrl) && (
                        <div className="mt-3">
                          <MessageAttachment
                            imageUrl={m.imageUrl}
                            fileUrl={m.fileUrl}
                            fileName={m.fileName}
                            fileType={m.fileType}
                            fileSize={m.fileSize}
                            moderationStatus={m.moderationStatus ?? "approved"}
                          />
                        </div>
                      )}

                      {isOptimistic && !isFailed && (
                        <span className="inline-flex items-center gap-1 mt-2 text-[9px] italic font-serif opacity-80">
                          <Loader2 size={10} className="animate-spin" />
                          sending…
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 mt-2 text-[9px] italic font-serif text-rose-200">
                          <AlertCircle size={10} /> failed to send
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Emoji quick-bar (appears above reactions when Smile clicked) */}
                  <AnimatePresence>
                    {showEmojiBar && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className={`mt-1 flex items-center gap-1 px-2 py-1.5 rounded-2xl shadow-lg border border-sand/20 dark:border-white/10 bg-paper dark:bg-[#0F0F0F] ${
                          isMe ? "self-end" : "self-start"
                        }`}
                      >
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(m.id, emoji)}
                            className="text-lg leading-none hover:scale-125 transition-transform"
                            title={emoji}
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Reaction counters */}
                  {reactionList.length > 0 && (
                    <div className={`mt-1 flex flex-wrap gap-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                      {reactionList.map(({ emoji, count, isMine }) => (
                        <button
                          key={emoji}
                          onClick={() => handleReact(m.id, emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all ${
                            isMine
                              ? "bg-accent/15 border-accent/40 text-accent"
                              : "bg-paper dark:bg-white/5 border-sand/20 dark:border-white/10 text-ink-faint hover:border-accent/40"
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-bold">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        groupId={groupId}
        messageId={reportTarget?.messageId}
      />
    </>
  );
});

export default MessageList;
