"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Heart, MessageSquare,
  MoreHorizontal, Loader2, Search,
  Paperclip, Download, Eye, X, Reply, ShieldCheck, Flag,
} from "lucide-react";

// ─── Core Components ───
import Sidebar from "@/components/Sidebar";
import NotificationCenter from "@/components/NotificationCenter";
import SearchBar from "@/components/SearchBar";
import ReportModal from "@/components/chat/ReportModal";

// ─── Firebase & Auth Logic ───
import { useAuth } from "@/lib/useAuth";
import { useTranslation } from "@/lib/i18n";
import { firestore } from "@/lib/firebase";
import {
  collection, onSnapshot, query, orderBy, where,
  limit,
} from "firebase/firestore";
import { COL } from "@/lib/collectionNames";

// ─── File Link Helpers (Cloudinary proxy) ───
import { buildViewUrl, buildDownloadUrl, isViewableInBrowser } from "@/lib/fileLinks";
import { api } from "@/lib/apiClient";

const timeAgo = (ts) => {
  if (!ts) return "—";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
};

const PostAvatar = ({ avatarUrl, fallbackName }) => (
  <div className="w-12 h-12 rounded-xl bg-cream dark:bg-slate-800 flex items-center justify-center text-accent font-display font-bold italic border border-sand dark:border-white/10 shadow-inner overflow-hidden shrink-0">
    {avatarUrl ? (
      <img src={avatarUrl} className="w-full h-full object-cover" alt="Author" />
    ) : (
      <span className="text-lg uppercase">{fallbackName ? fallbackName[0] : "?"}</span>
    )}
  </div>
);

const CommentsThread = ({
  postId, loading, comments, draft, onDraftChange, onSubmit, submitting, currentUser,
  replyTo, onSetReplyTo,
}) => {
  const { t } = useTranslation();
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Separate top-level from replies
  const topLevel = comments.filter((c) => !c.replyToCommentId);
  const getReplies = (parentId) => comments.filter((c) => c.replyToCommentId === parentId);

  const CommentBubble = ({ c, isReply = false }) => (
    <div className={`flex gap-3 ${isReply ? "ms-10 mt-2" : ""}`}>
      <div className="w-9 h-9 rounded-xl overflow-hidden bg-cream dark:bg-slate-800 border border-sand dark:border-white/10 shrink-0 flex items-center justify-center text-accent font-bold italic">
        {c.authorAvatar ? (
          <img src={c.authorAvatar} alt={c.authorName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm uppercase">{c.authorName ? c.authorName[0] : "?"}</span>
        )}
      </div>
      <div className="flex-1">
        <div className="bg-cream dark:bg-white/5 rounded-2xl px-4 py-3 border border-sand dark:border-white/10">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-bold text-ink dark:text-slate-100">{c.authorName}</span>
            {c.authorRole && (
              <span className="text-[9px] text-accent uppercase tracking-widest font-black">{c.authorRole}</span>
            )}
          </div>
          {c.replyToAuthorName && (
            <span className="text-[10px] text-accent font-black me-1">@{c.replyToAuthorName}</span>
          )}
          <span className="text-[13px] text-ink-muted dark:text-slate-300 leading-relaxed font-display italic">
            {c.content}
          </span>
        </div>
        {!isReply && (
          <button
            onClick={() => onSetReplyTo(replyTo?.id === c.id ? null : { id: c.id, authorName: c.authorName })}
            className={`mt-1 ms-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors ${
              replyTo?.id === c.id ? "text-accent" : "text-ink-faint hover:text-accent"
            }`}
          >
            <Reply size={11} /> Reply
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="mt-6 pt-6 border-t border-sand dark:border-white/5">
      {/* Comments list */}
      <div className="space-y-4 mb-5">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-accent" size={18} />
          </div>
        ) : topLevel.length === 0 ? (
          <p className="text-center text-ink-faint italic font-display text-sm py-2">
            {t("hub.first_comment")}
          </p>
        ) : (
          topLevel.map((c) => (
            <div key={c.id}>
              <CommentBubble c={c} />
              {getReplies(c.id).map((r) => (
                <CommentBubble key={r.id} c={r} isReply />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Reply preview strip */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl border-s-2 overflow-hidden"
            style={{ background: "rgba(124,131,242,0.06)", borderColor: "#7c83f2" }}
          >
            <Reply size={11} style={{ color: "#7c83f2" }} />
            <span className="text-[11px] font-serif italic text-ink dark:text-white/70 flex-1">
              Replying to <strong>{replyTo.authorName}</strong>
            </span>
            <button onClick={() => onSetReplyTo(null)} className="text-ink-faint hover:text-ink">
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New comment input */}
      <div className="flex gap-3 items-start">
        <div className="w-9 h-9 rounded-xl overflow-hidden bg-accent/5 border border-sand dark:border-white/10 shrink-0 flex items-center justify-center text-accent font-bold italic">
          {currentUser?.avatarUrl ? (
            <img src={currentUser.avatarUrl} alt="Me" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm uppercase">{currentUser?.fullName?.[0] || "?"}</span>
          )}
        </div>
        <div className="flex-1 flex items-center gap-2 bg-cream dark:bg-white/5 rounded-2xl border border-sand dark:border-white/10 px-4 py-2 focus-within:border-accent transition-colors">
          <input
            type="text"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? `Replying to ${replyTo.authorName}…` : t("hub.reply_placeholder")}
            disabled={submitting}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-faint text-ink dark:text-white disabled:opacity-50"
          />
          <button
            onClick={onSubmit}
            disabled={submitting || !draft.trim()}
            aria-label="Reply"
            className="bg-accent text-white px-4 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-widest hover:brightness-110 disabled:opacity-30 transition-all flex items-center gap-1.5 shadow shadow-accent/20"
          >
            {submitting ? <Loader2 className="animate-spin" size={12} /> : <>
              Reply <Send size={12} data-flip-rtl />
            </>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ScholarHub() {
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Report / post-menu state ───
  const [reportingPostId, setReportingPostId] = useState(null);
  const [openMenuFor, setOpenMenuFor] = useState(null);

  // ─── Comments state ───
  const [openCommentsFor, setOpenCommentsFor] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [loadingCommentsFor, setLoadingCommentsFor] = useState(null);
  const [draftComment, setDraftComment] = useState({});
  const [postingCommentFor, setPostingCommentFor] = useState(null);
  // replyToByPost: { [postId]: { id: commentId, authorName: string } | null }
  const [replyToByPost, setReplyToByPost] = useState({});

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user?.uid || !userData?.uid) return;
    const q = query(collection(firestore, COL.POSTS), orderBy("createdAt", "desc"), limit(25));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        if (error?.code !== "permission-denied") console.error("Firestore Error:", error);
      }
    );
    return () => unsubscribe();
  }, [authLoading, user?.uid, userData?.uid]);

  useEffect(() => {
    if (authLoading || !user?.uid || !userData?.uid) return;

    // الأدمن يرى جميع المجموعات النشطة — المستخدم العادي يرى مجموعاته فقط
    const isAdmin = userData?.role === "admin";
    const q = isAdmin
      ? query(
          collection(firestore, COL.GROUPS),
          where("status", "==", "active")
        )
      : query(
          collection(firestore, COL.GROUPS),
          where("members", "array-contains", user.uid)
        );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        if (error?.code !== "permission-denied") console.error("Groups Sync Error:", error);
      }
    );
    return () => unsubscribe();
  }, [authLoading, user?.uid, userData?.uid, userData?.role]);

  const handleLike = async (postId) => {
    if (!user?.uid) return;
    // Optimistic toggle — snapshot listener will reconcile.
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const arr = Array.isArray(p.likes) ? p.likes : [];
        const liked = arr.includes(user.uid);
        return { ...p, likes: liked ? arr.filter((u) => u !== user.uid) : [...arr, user.uid] };
      })
    );
    try {
      await api(`/api/posts/${postId}/like`, { method: "POST" });
    } catch (e) {
      console.error("Like toggle error:", e);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() && !selectedFile) return;
    setIsSubmitting(true);

    try {
      let fileUrl = null;
      let fileName = null;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch("/api/upload", { method: "POST", body: formData });
        if (!response.ok) throw new Error("Upload failed.");
        const data = await response.json();
        fileUrl = data.url;
        fileName = selectedFile.name;
      }

      await api("/api/posts", {
        method: "POST",
        body: {
          text: newPost,
          fileUrl: fileUrl,
          fileName: fileName,
        },
      });

      setNewPost("");
      setSelectedFile(null);
    } catch (error) {
      console.error("Transmission Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleComments = async (postId) => {
    if (openCommentsFor === postId) {
      setOpenCommentsFor(null);
      return;
    }
    setOpenCommentsFor(postId);
    if (commentsByPost[postId]) return;
    setLoadingCommentsFor(postId);
    try {
      const data = await api(`/api/posts/${postId}/comments`);
      setCommentsByPost((prev) => ({ ...prev, [postId]: data.comments || [] }));
    } catch (e) {
      console.error("Comments fetch error:", e);
      setCommentsByPost((prev) => ({ ...prev, [postId]: [] }));
    } finally {
      setLoadingCommentsFor(null);
    }
  };

  const handleCommentSubmit = async (postId) => {
    const content = (draftComment[postId] || "").trim();
    if (!content || postingCommentFor === postId) return;

    const replyTo = replyToByPost[postId] || null;

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      content,
      authorId: userData.uid,
      authorName: userData.fullName,
      authorAvatar: userData.avatarUrl || "",
      authorRole: userData.major || "",
      replyToCommentId: replyTo?.id || null,
      replyToAuthorName: replyTo?.authorName || null,
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };
    setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), optimistic] }));
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
    setDraftComment((prev) => ({ ...prev, [postId]: "" }));
    setReplyToByPost((prev) => ({ ...prev, [postId]: null }));
    setPostingCommentFor(postId);

    try {
      const saved = await api(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: { content, replyToCommentId: replyTo?.id || null },
      });
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) => (c.id === tempId ? saved : c)),
      }));
    } catch (e) {
      console.error("Comment submit error:", e);
      setCommentsByPost((prev) => ({ ...prev, [postId]: (prev[postId] || []).filter((c) => c.id !== tempId) }));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 1) - 1) } : p));
      setDraftComment((prev) => ({ ...prev, [postId]: content }));
    } finally {
      setPostingCommentFor(null);
    }
  };

  if (!mounted || authLoading || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-black">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  const firstName = userData.fullName?.split(' ')[0] || "Scholar";

  return (
    <div className="flex min-h-screen bg-cream dark:bg-black font-sans text-ink dark:text-white transition-colors duration-500 overflow-hidden">

      <Sidebar currentUser={userData} groups={groups} />

      <main className="flex-1 md:ms-[280px] h-screen overflow-hidden flex flex-col relative">

        {/* Header */}
        <header className="h-20 px-8 flex items-center justify-between bg-cream/80 dark:bg-black/60 backdrop-blur-2xl border-b border-sand dark:border-white/5 z-30 sticky top-0">
          <SearchBar />
          <div className="flex items-center gap-3">
            {userData?.role === "admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all border border-accent/20"
              >
                <ShieldCheck size={13} /> <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            <NotificationCenter />
          </div>
        </header>

        {/* Feed Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-8 lg:p-12">
          <div className="max-w-[800px] mx-auto space-y-10 pb-32">

            {/* Post Forge */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-paper dark:bg-white/5 rounded-[2rem] p-8 shadow-sm border border-sand dark:border-white/10">
              <div className="flex gap-5">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-accent/5 border border-sand dark:border-white/10 shrink-0">
                  {userData.avatarUrl ? (
                    <img src={userData.avatarUrl} className="w-full h-full object-cover" alt="Me" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-accent font-bold italic text-xl uppercase">{userData?.fullName?.[0]?.toUpperCase() || "?"}</div>
                  )}
                </div>
                <div className="flex-1">
                  <textarea
                    placeholder={`Transmitting new findings, ${firstName}?`}
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    className="w-full bg-transparent outline-none text-lg min-h-[100px] py-2 resize-none font-display italic placeholder:text-ink-faint"
                  />

                  {selectedFile && (
                    <div className="mb-4 p-3 bg-cream dark:bg-white/5 rounded-xl flex items-center justify-between border border-sand dark:border-white/10">
                      <div className="flex items-center gap-2">
                        <Paperclip size={14} className="text-accent" />
                        <span className="text-xs font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                      </div>
                      <button onClick={() => setSelectedFile(null)} aria-label="Remove file" className="text-rose-500 p-1 hover:bg-rose-100 rounded-full transition-all">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-6 border-t border-sand dark:border-white/5">
                    <button onClick={() => fileInputRef.current.click()} aria-label="Attach an academic file" className="p-2 rounded-xl hover:bg-cream dark:hover:bg-white/5 text-accent transition-all">
                      <Paperclip size={20} />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files[0])} className="hidden" />

                    <button
                      onClick={handleCreatePost}
                      disabled={isSubmitting || (!newPost.trim() && !selectedFile)}
                      className="bg-accent text-white px-8 py-3 rounded-full font-bold text-[10px] uppercase tracking-widest hover:brightness-110 disabled:opacity-30 transition-all flex items-center gap-2 shadow-lg shadow-accent/20"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : "Transmit"} <Send size={14} data-flip-rtl />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Posts Stream */}
            <div className="space-y-8">
              {posts.length === 0 && (
                <p className="text-center text-ink-faint italic font-display py-12">{t("hub.no_posts")}</p>
              )}
              <AnimatePresence>
                {posts.map((post) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-paper dark:bg-white/5 rounded-[2rem] p-8 border border-sand dark:border-white/10 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => router.push(`/profile/${post.authorId}`)}
                          className="focus:outline-none"
                          aria-label={`View ${post.authorName}'s profile`}
                        >
                          <PostAvatar avatarUrl={post.authorAvatar} fallbackName={post.authorName} />
                        </button>
                        <div>
                          <h3
                            onClick={() => router.push(`/profile/${post.authorId}`)}
                            className="text-sm font-bold text-ink dark:text-slate-100 cursor-pointer hover:text-accent transition-colors"
                          >{post.authorName}</h3>
                          <p className="text-[10px] text-accent uppercase tracking-widest font-black mt-1">
                            {post.authorRole} • <span className="text-ink-faint lowercase font-sans">{timeAgo(post.createdAt)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuFor(openMenuFor === post.id ? null : post.id)}
                          className="p-2 text-ink-faint hover:bg-cream dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <MoreHorizontal size={20} />
                        </button>
                        <AnimatePresence>
                          {openMenuFor === post.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute end-0 top-10 z-30 w-44 bg-paper dark:bg-[#0F0F0F] border border-sand dark:border-white/10 rounded-xl shadow-xl overflow-hidden"
                            >
                              {post.authorId !== user?.uid && (
                                <button
                                  onClick={() => { setOpenMenuFor(null); setReportingPostId(post.id); }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                >
                                  <Flag size={14} />
                                  {t("hub.report_post")}
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <p className="text-ink-muted dark:text-slate-300 text-[15px] leading-relaxed mb-6 px-1 font-display italic">
                      {post.content}
                    </p>

                    {post.fileUrl && (
                      <div className="mb-6 flex items-center gap-2 flex-wrap">
                        {isViewableInBrowser(post.fileUrl, post.fileName) && (
                          <a
                            href={buildViewUrl(post.fileUrl, post.fileName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-3 p-4 bg-cream dark:bg-white/5 rounded-2xl border border-sand dark:border-white/10 hover:border-accent transition-all group"
                          >
                            <div className="p-2 bg-accent/10 text-accent rounded-lg group-hover:bg-accent group-hover:text-white transition-colors">
                              <Eye size={16} />
                            </div>
                            <div className="flex flex-col pe-2">
                              <span className="text-xs font-bold text-ink dark:text-white truncate max-w-[200px]">{post.fileName}</span>
                              <span className="text-[9px] text-ink-faint uppercase tracking-widest">Open Scholarly Asset</span>
                            </div>
                          </a>
                        )}
                        <a
                          href={buildDownloadUrl(post.fileUrl, post.fileName)}
                          download={post.fileName || true}
                          className="inline-flex items-center gap-3 p-4 bg-cream dark:bg-white/5 rounded-2xl border border-sand dark:border-white/10 hover:border-accent transition-all group"
                        >
                          <div className="p-2 bg-accent/10 text-accent rounded-lg group-hover:bg-accent group-hover:text-white transition-colors">
                            <Download size={16} />
                          </div>
                          <div className="flex flex-col pe-2">
                            <span className="text-xs font-bold text-ink dark:text-white truncate max-w-[200px]">{post.fileName}</span>
                            <span className="text-[9px] text-ink-faint uppercase tracking-widest">Download Scholarly Asset</span>
                          </div>
                        </a>
                      </div>
                    )}

                    <div className="flex items-center gap-10 border-t border-sand dark:border-white/5 pt-6">
                      {(() => {
                        const likesArr = Array.isArray(post.likes) ? post.likes : [];
                        const likedByMe = !!user?.uid && likesArr.includes(user.uid);
                        const likeCount = Array.isArray(post.likes) ? likesArr.length : (post.likes || 0);
                        return (
                          <button onClick={() => handleLike(post.id)} className="flex items-center gap-2 text-ink-faint hover:text-rose-500 transition-all text-[11px] font-bold uppercase tracking-widest group">
                            <Heart size={18} className={likedByMe ? "fill-rose-500 text-rose-500" : ""} /> {likeCount}
                          </button>
                        );
                      })()}
                      <button
                        onClick={() => toggleComments(post.id)}
                        aria-expanded={openCommentsFor === post.id}
                        className={`flex items-center gap-2 transition-all text-[11px] font-bold uppercase tracking-widest ${
                          openCommentsFor === post.id ? "text-accent" : "text-ink-faint hover:text-accent"
                        }`}
                      >
                        <MessageSquare size={18} /> {post.commentsCount || 0}
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {openCommentsFor === post.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <CommentsThread
                            postId={post.id}
                            loading={loadingCommentsFor === post.id}
                            comments={commentsByPost[post.id] || []}
                            draft={draftComment[post.id] || ""}
                            onDraftChange={(val) =>
                              setDraftComment((prev) => ({ ...prev, [post.id]: val }))
                            }
                            onSubmit={() => handleCommentSubmit(post.id)}
                            submitting={postingCommentFor === post.id}
                            currentUser={userData}
                            replyTo={replyToByPost[post.id] || null}
                            onSetReplyTo={(val) =>
                              setReplyToByPost((prev) => ({ ...prev, [post.id]: val }))
                            }
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Report Post Modal */}
      <ReportModal
        isOpen={!!reportingPostId}
        onClose={() => setReportingPostId(null)}
        postId={reportingPostId}
      />

      {/* Close post menu on outside click */}
      {openMenuFor && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setOpenMenuFor(null)}
        />
      )}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
