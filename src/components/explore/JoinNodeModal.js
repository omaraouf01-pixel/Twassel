"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, Zap, Loader2, CheckCircle, Lock,
    HelpCircle, Sparkles, BookOpen,
    ChevronRight, ArrowLeft, ScrollText,
    School, GraduationCap, Book, Clock
} from "lucide-react";

import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/apiClient";

export default function JoinNodeModal({ isOpen, onClose, group, isPending = false, onRequestSent }) {
    const { user, userData } = useAuth();
    const [answers, setAnswers] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [requestStatus, setRequestStatus] = useState(null);

    const isOpenAccess = group?.accessType === "open" || userData?.role === "admin";

    useEffect(() => {
        if (isOpen && group) {
            const qCount = (group.questions || []).length;
            setAnswers(new Array(qCount).fill(""));
            setRequestStatus(isPending ? "pending" : null);
        }
    }, [isOpen, group, isPending]);

    const handleAnswerChange = (index, value) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    const handleJoinRequest = async (e) => {
        e.preventDefault();
        if (!group?.id || !user?.uid) return;

        setIsSubmitting(true);
        setRequestStatus(null);

        try {
            const result = await api(`/api/groups/${group.id}/join-requests`, {
                method: "POST",
                body: { answers: isOpenAccess ? [] : answers },
            });
            setRequestStatus(result.status === "joined" ? "joined" : "pending");
            if (typeof onRequestSent === "function") onRequestSent();
            setTimeout(() => onClose(), 2500);
        } catch (error) {
            console.error("Join Protocol Error:", error);
            setRequestStatus(error.message || "Could not send request");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isSuccess = requestStatus === "joined" || requestStatus === "pending";

    return (
        <AnimatePresence>
            {isOpen && group && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={!isSubmitting ? onClose : undefined}
                        className="absolute inset-0 bg-black/40 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="w-full max-w-5xl bg-[#F8F8F5] dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 rounded-[3rem] overflow-hidden relative z-10 shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
                    >
                        {!isSubmitting && (
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                className="absolute top-8 end-8 text-slate-400 hover:text-[#7c83f2] transition-all z-50 p-2 hover:bg-[#7c83f2]/10 rounded-full"
                            >
                                <X size={20} />
                            </button>
                        )}

                        {/* Identity panel */}
                        <div className="w-full md:w-[40%] p-10 bg-white dark:bg-black/20 border-b md:border-b-0 md:border-e border-slate-100 dark:border-white/5 flex flex-col overflow-y-auto custom-scrollbar">
                            <div className="w-14 h-14 bg-[#7c83f2]/10 border border-[#7c83f2]/20 rounded-2xl flex items-center justify-center text-[#7c83f2] mb-8">
                                <BookOpen size={24} />
                            </div>

                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#7c83f2] mb-3">Academic Node</p>
                            <h2 className="text-3xl font-serif font-black italic text-slate-800 dark:text-white leading-tight mb-8">
                                {group.name}
                            </h2>

                            <div className="space-y-3 mb-8">
                                {[
                                    { icon: School, label: "Field", value: group.tags?.[0] },
                                    { icon: Book, label: "Major", value: group.subject || group.tags?.[1] },
                                    { icon: GraduationCap, label: "Academic year", value: group.tags?.[2] || group.level },
                                ].filter(f => f.value).map((f) => (
                                    <div
                                        key={f.label}
                                        className="flex items-center gap-4 p-4 bg-[#F8F8F5] dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 flex items-center justify-center text-[#7c83f2] flex-shrink-0">
                                            <f.icon size={16} strokeWidth={1.8} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{f.label}</p>
                                            <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate font-serif italic">{f.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-auto">
                                <div className="p-6 bg-[#F8F8F5] dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-[2rem]">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7c83f2] mb-3 flex items-center gap-2">
                                        <ScrollText size={14} /> Node settings
                                    </p>
                                    <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed italic font-serif">
                                        {group.rules || "What will you discuss in this node?"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Form panel */}
                        <div className="w-full md:w-[60%] p-10 md:p-16 bg-[#F8F8F5] dark:bg-[#0A0A0C] flex flex-col justify-center overflow-y-auto custom-scrollbar">
                            {isSuccess ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-10"
                                >
                                    <div className="w-20 h-20 bg-[#7c83f2]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#7c83f2]">
                                        <CheckCircle size={48} />
                                    </div>
                                    <h3 className="text-2xl font-serif font-black text-slate-800 dark:text-white italic mb-2">
                                        {requestStatus === "joined" ? "Joined successfully" : "Join request sent"}
                                    </h3>
                                    <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">
                                        {requestStatus === "joined"
                                            ? "You are already a member"
                                            : "Your request is pending"}
                                    </p>
                                </motion.div>
                            ) : (
                                <>
                                    <div className={`mb-8 p-5 rounded-2xl border flex items-start gap-4 ${
                                        isOpenAccess
                                            ? "bg-[#7c83f2]/10 border-[#7c83f2]/30"
                                            : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10"
                                    }`}>
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                            isOpenAccess ? "bg-[#7c83f2] text-white" : "bg-slate-800 dark:bg-white/10 text-[#7c83f2]"
                                        }`}>
                                            {isOpenAccess ? <Zap size={18} /> : <Lock size={18} />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c83f2] mb-1.5">
                                                {isOpenAccess ? "Public" : "Node members only"}
                                            </p>
                                            <p className="text-[12.5px] font-serif italic text-slate-600 dark:text-slate-300 leading-snug">
                                                {isOpenAccess
                                                    ? "Public — any scholar can join"
                                                    : "Private — overseer invite only"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mb-8 text-start">
                                        <button
                                            onClick={onClose}
                                            className="flex items-center gap-2 text-[#7c83f2] mb-4 text-[10px] font-bold uppercase tracking-widest hover:underline"
                                        >
                                            <ArrowLeft size={12} data-flip-rtl /> Back
                                        </button>
                                        <h3 className="text-2xl font-serif font-black text-slate-800 dark:text-white mb-2 italic">
                                            {isOpenAccess ? "Join" : "Request to join"}
                                        </h3>
                                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                                            {isOpenAccess
                                                ? "Discover new academic nodes and request to join"
                                                : "Write a short message to the overseer explaining your interest."}
                                        </p>
                                    </div>

                                    {requestStatus && !isSuccess && (
                                        <div className="p-4 mb-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-[11px] font-bold italic">
                                            {requestStatus}
                                        </div>
                                    )}

                                    <form onSubmit={handleJoinRequest} className="space-y-8">
                                        {!isOpenAccess && group.questions && group.questions.length > 0 ? (
                                            <div className="space-y-6">
                                                {group.questions.map((q, idx) => (
                                                    <div key={idx} className="space-y-3">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 ms-1">
                                                            <HelpCircle size={14} className="text-[#7c83f2]" /> {q}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            required
                                                            value={answers[idx] || ""}
                                                            onChange={(e) => handleAnswerChange(idx, e.target.value)}
                                                            placeholder="Why do you want to join? (optional)"
                                                            className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-5 px-6 text-slate-800 dark:text-white text-sm outline-none focus:border-[#7c83f2] transition-all font-serif italic shadow-sm"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-16 text-center bg-white dark:bg-white/[0.02] rounded-[2.5rem] border border-dashed border-[#7c83f2]/30">
                                                <Zap size={28} className="mx-auto mb-4 text-[#7c83f2]" />
                                                <p className="text-[13px] text-slate-500 dark:text-slate-400 italic font-serif">
                                                    {isOpenAccess
                                                        ? "Public — any scholar can join"
                                                        : "Private — overseer invite only"}
                                                </p>
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isSubmitting || isPending}
                                            className="w-full mt-8 py-6 bg-[#7c83f2] text-white rounded-[1.5rem] font-bold text-[11px] uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-[#7c83f2]/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
                                            title={isPending ? "Your request is pending" : undefined}
                                        >
                                            {isPending ? (
                                                <><Clock size={14} /> Pending…</>
                                            ) : isSubmitting ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : isOpenAccess ? (
                                                <><Zap size={14} /> Join</>
                                            ) : (
                                                <><Sparkles size={14} /> Send request <ChevronRight size={14} data-flip-rtl /></>
                                            )}
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(124, 131, 242, 0.2); border-radius: 10px; }
            `}</style>
        </AnimatePresence>
    );
}
