"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, BookOpen, FileText, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/apiClient";

// ── hook مساعد: يؤخر تحديث القيمة بـ delay ms ──────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchBar({ placeholder = "Search groups, people, and posts..." }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);   // null = لم يُبحث بعد
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  // ── تشغيل البحث عند تغيير الـ query المؤجل ──────────────────
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const doSearch = async () => {
      setLoading(true);
      try {
        const data = await api(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
        if (!cancelled) {
          setResults(data);
          setOpen(true);
        }
      } catch (e) {
        console.error("[SearchBar] error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    doSearch();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // ── إغلاق القائمة عند النقر خارجها ──────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const clear = () => {
    setQuery("");
    setResults(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  const navigate = (href) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  };

  const hasAnyResult =
    results &&
    (results.users?.length > 0 || results.groups?.length > 0 || results.posts?.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-md" dir="rtl">
      {/* ── حقل البحث ────────────────────────────────────────── */}
      <div className="relative flex items-center">
        {loading ? (
          <Loader2 size={16} className="absolute start-3.5 text-accent animate-spin pointer-events-none" />
        ) : (
          <Search size={16} className="absolute start-3.5 text-ink-faint pointer-events-none" />
        )}

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder={placeholder}
          className="w-full ps-10 pe-9 py-2.5 text-[13px] bg-paper dark:bg-white/5 border border-sand dark:border-white/10 rounded-2xl text-ink dark:text-white placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all duration-200 shadow-sm"
          autoComplete="off"
        />

        <AnimatePresence>
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.1 }}
              onClick={clear}
              className="absolute end-3 p-1 rounded-full text-ink-faint hover:text-ink hover:bg-sand/60 dark:hover:bg-white/10 transition-colors"
              aria-label="Clear search"
            >
              <X size={13} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── القائمة المنسدلة ──────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full mt-2 w-full min-w-[320px] bg-paper dark:bg-[#111] rounded-2xl border border-sand dark:border-white/10 shadow-2xl overflow-hidden z-50"
          >
            {!hasAnyResult ? (
              <div className="py-10 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-ink-faint">
                  No matching results
                </p>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto divide-y divide-sand/50 dark:divide-white/5">

                {/* ── مجموعات ───────────────────────────────────── */}
                {results.groups?.length > 0 && (
                  <ResultSection icon={BookOpen} label="Groups">
                    {results.groups.map((g) => (
                      <ResultItem
                        key={g.id}
                        title={g.name}
                        subtitle={g.subject || `${g.memberCount} members`}
                        onClick={() => navigate(`/hub/chat/${g.id}`)}
                      />
                    ))}
                  </ResultSection>
                )}

                {/* ── أشخاص ─────────────────────────────────────── */}
                {results.users?.length > 0 && (
                  <ResultSection icon={Users} label="People">
                    {results.users.map((u) => (
                      <ResultItem
                        key={u.id}
                        title={u.fullName}
                        subtitle={u.department || u.matricule}
                        avatarUrl={u.avatarUrl}
                        initials={u.fullName?.[0]?.toUpperCase()}
                        onClick={() => navigate(`/profile?uid=${u.uid}`)}
                      />
                    ))}
                  </ResultSection>
                )}

                {/* ── منشورات ───────────────────────────────────── */}
                {results.posts?.length > 0 && (
                  <ResultSection icon={FileText} label="Posts">
                    {results.posts.map((p) => (
                      <ResultItem
                        key={p.id}
                        title={p.content}
                        subtitle={`by ${p.authorName}`}
                        onClick={() =>
                          navigate(p.groupId ? `/hub/chat/${p.groupId}` : "/hub")
                        }
                      />
                    ))}
                  </ResultSection>
                )}

              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── مكون القسم ────────────────────────────────────────────────────
function ResultSection({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 bg-cream/60 dark:bg-white/[0.03]">
        <Icon size={10} className="text-accent" />
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-ink-faint">
          {label}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

// ── مكون عنصر النتيجة ─────────────────────────────────────────────
function ResultItem({ title, subtitle, avatarUrl, initials, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-start hover:bg-cream dark:hover:bg-white/5 transition-colors duration-150 group"
    >
      {initials !== undefined && (
        <div className="w-8 h-8 rounded-lg bg-accent/10 overflow-hidden flex items-center justify-center text-accent font-bold text-[13px] shrink-0 group-hover:bg-accent group-hover:text-white transition-colors">
          {avatarUrl ? (
            <img src={avatarUrl} alt={title} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-ink dark:text-white truncate leading-tight">
          {title}
        </p>
        {subtitle && (
          <p className="text-[10px] text-ink-faint truncate mt-0.5">{subtitle}</p>
        )}
      </div>
    </button>
  );
}
