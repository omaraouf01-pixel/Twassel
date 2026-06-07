"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ChevronLeft, Sparkles, School, Book, GraduationCap,
  ArrowRight, ArrowLeft, Zap, Lock
} from "lucide-react";

// Firebase & Auth
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/apiClient";

// Academic Data — Single Source of Truth
import { UNIVERSITIES, MAJORS, LEVELS } from "@/lib/academicData";

// Components
import TsswalLogo from "@/components/TsswalLogo";
import SelectionModal from "@/components/SelectionModal";

export default function CreateGroupPage() {
  const router = useRouter();
  const { authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState({ open: false, type: "", title: "", options: [] });

  const [form, setForm] = useState({
    name: "",
    description: "",
    university: "",
    major: "",
    level: "",
    rules: "",
    questions: "",
    accessType: "protected"
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) {
      alert("Please complete the required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isOpen = form.accessType === "open";
      const payload = {
        name: form.name.trim(),
        subject: form.major,
        description: form.description.trim() || `Study group for ${form.major}`,
        rules: form.rules.trim() || "Academic integrity and respect.",
        tags: [form.university, form.major, form.level].filter(Boolean),
        questions: isOpen ? [] : form.questions.split("\n").map(q => q.trim()).filter(Boolean),
        accessType: isOpen ? "open" : "protected",
        maxMembers: 50
      };

      const result = await api("/api/groups", {
        method: "POST",
        body: payload,
      });

      if (result.id) {
        router.push(`/hub/chat/${result.id}`);
      }
    } catch (error) {
      console.error("Forge Error:", error);
      alert(error.message || "Failed to forge node");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pageBg = "bg-[#F8F8F5] dark:bg-[#0a0a0b] transition-colors duration-700";

  if (authLoading) return null;

  return (
    <div className={`min-h-screen flex flex-col font-sans ${pageBg}`}>
      <header className="max-w-[1360px] w-full mx-auto px-6 lg:px-10 py-6 flex justify-between items-center relative z-20 border-b border-slate-200/50 dark:border-white/5">
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push("/groups/join")}
            className="p-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-[#7c83f2] transition-all shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[12px] bg-[#7c83f2] flex items-center justify-center text-white shadow-lg shadow-[#7c83f2]/20">
              <TsswalLogo size={20} />
            </div>
            <span className="font-serif text-[18px] italic font-bold text-slate-800 dark:text-slate-100">Twassel</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="w-full max-w-[650px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 sm:p-14 shadow-xl border border-slate-100 dark:border-slate-800"
          >
            <button
              onClick={() => router.push("/groups/join")}
              className="flex items-center gap-2 text-slate-400 hover:text-[#7c83f2] mb-8 transition-colors text-[10px] font-bold uppercase tracking-[0.2em]"
            >
              <ChevronLeft size={14} /> Back
            </button>

            <div className="mb-10">
              <h1 className="font-serif text-4xl font-bold text-slate-800 dark:text-slate-50 mb-3 italic">Forge New Node.</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Design your academic cluster’s frequency and governance.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Node Identity (Name)</label>
                  <input
                    type="text" required placeholder="e.g. Theoretical Physics Group"
                    className="w-full p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-sm outline-none focus:border-[#7c83f2] transition-all dark:text-white"
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Objective (Description)</label>
                  <textarea
                    placeholder="Briefly describe the node's mission..."
                    className="w-full p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-sm outline-none focus:border-[#7c83f2] transition-all min-h-[100px] resize-none dark:text-white"
                    value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Academic Sphere</label>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: "University", val: form.university, opts: UNIVERSITIES, icon: School, type: "university", required: false },
                    { label: "Major / Specialty", val: form.major, opts: MAJORS, icon: Book, type: "major", required: false },
                    { label: "Academic Level", val: form.level, opts: LEVELS, icon: GraduationCap, type: "level", required: false },
                  ].map((f) => (
                    <button
                      key={f.label} type="button"
                      onClick={() => setModal({ open: true, type: f.type, title: f.label, options: f.opts })}
                      className="w-full flex items-center justify-between p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:border-[#7c83f2] transition-all text-left group shadow-sm"
                    >
                      <div className="flex items-center gap-5">
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-white/5 text-slate-400 group-hover:text-[#7c83f2] transition-colors">
                          <f.icon size={20} strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            {f.label}
                            {!f.required && (
                              <span className="ml-2 normal-case tracking-normal font-medium text-slate-300 dark:text-slate-600">— optional</span>
                            )}
                          </p>
                          <p className="text-[14px] font-bold text-slate-700 dark:text-slate-200 mt-0.5">{f.val || `Select ${f.label}...`}</p>
                        </div>
                      </div>
                      <ArrowRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── Access Protocol ─── */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Access Protocol</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      value: "open",
                      icon: Zap,
                      title: "Open Access",
                      desc: "Scholars sync into the node instantly — no questions, no gate."
                    },
                    {
                      value: "protected",
                      icon: Lock,
                      title: "Verified Access",
                      desc: "Requires overseer review. Define questions to filter applicants."
                    }
                  ].map((opt) => {
                    const active = form.accessType === opt.value;
                    return (
                      <button
                        key={opt.value} type="button"
                        onClick={() => setForm({ ...form, accessType: opt.value })}
                        className={`text-left p-6 rounded-2xl border transition-all shadow-sm ${
                          active
                            ? "bg-[#7c83f2]/10 border-[#7c83f2] ring-2 ring-[#7c83f2]/20"
                            : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-[#7c83f2]/60"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                          active
                            ? "bg-[#7c83f2] text-white"
                            : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 text-slate-400"
                        }`}>
                          <opt.icon size={18} strokeWidth={1.8} />
                        </div>
                        <p className="font-serif italic text-[15px] font-bold text-slate-800 dark:text-slate-100">{opt.title}</p>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1.5">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {form.accessType === "protected" && (
                  <motion.div
                    key="questions-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-2">Governance (Questions - One per line)</label>
                        <textarea
                          placeholder="e.g. What is your student ID?&#10;What do you hope to learn here?"
                          className="w-full p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-sm outline-none focus:border-[#7c83f2] transition-all min-h-[100px] resize-none dark:text-white"
                          value={form.questions} onChange={e => setForm({ ...form, questions: e.target.value })}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                disabled={isSubmitting}
                type="submit"
                className="w-full py-6 bg-[#7c83f2] text-white rounded-[1.5rem] font-bold uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-[#7c83f2]/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-40"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Sparkles size={18} /> Initialize Node</>}
              </button>
            </form>
          </motion.div>
        </div>
      </main>

      <SelectionModal
        isOpen={modal.open} onClose={() => setModal({ ...modal, open: false })}
        title={modal.title} options={modal.options} selectedValue={form[modal.type]}
        onSelect={(val) => setForm({ ...form, [modal.type]: val })}
      />

    </div>
  );
}