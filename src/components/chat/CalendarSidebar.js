"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Calendar, Clock,
  Plus, X, Loader2, Trash2, Pencil,
} from "lucide-react";
import { firestore as db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { COL } from "@/lib/collectionNames";
import { api } from "@/lib/apiClient";

// ── ثوابت التقويم ────────────────────────────────────────────────
const MONTH_NAMES_AR = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES_AR = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toISODate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthGrid(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

const normalizeDate = (rawDate) => {
  if (!rawDate) return "";
  // إذا كان نصاً (سواء YYYY-MM-DD أو ISO string يحتوي على T)
  if (typeof rawDate === "string") return rawDate.split("T")[0];
  // إذا كان كائن Timestamp من Firestore (يحتوي على toDate)
  if (typeof rawDate.toDate === "function") {
    const d = rawDate.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // إذا كان كائن Date عادي
  if (rawDate instanceof Date) {
    const y = rawDate.getFullYear();
    const m = String(rawDate.getMonth() + 1).padStart(2, "0");
    const day = String(rawDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // إذا كان كائن Timestamp مُسلسَل (يحتوي على seconds فقط)
  if (typeof rawDate === "object" && rawDate.seconds) {
    const d = new Date(rawDate.seconds * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return "";
};

// ── ثوابت تصميم ──────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2 rounded-xl bg-cream dark:bg-white/5 border border-sand dark:border-white/10 text-[12px] text-ink dark:text-white placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all";

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[9px] font-black uppercase tracking-[0.25em] text-ink-faint mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Modal إضافة / تعديل حدث ──────────────────────────────────────
function EventFormModal({ groupId, editEvent = null, defaultDate = "", onClose, onSuccess }) {
  const isEdit = !!editEvent;
  const [form, setForm] = useState({
    title:       editEvent?.title       ?? "",
    date:        editEvent?.date ? normalizeDate(editEvent.date) : (defaultDate || ""),
    time:        editEvent?.time        ?? "",
    description: editEvent?.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) {
      setError("Title and date are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await api(`/api/groups/${groupId}/events`, {
          method: "PATCH",
          body: { eventId: editEvent.id, ...form },
        });
      } else {
        await api(`/api/groups/${groupId}/events`, {
          method: "POST",
          body: form,
        });
      }
      onSuccess?.(form);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      dir="rtl"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="bg-paper dark:bg-[#111] rounded-3xl w-full max-w-sm shadow-2xl border border-sand dark:border-white/10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-sand dark:border-white/8">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-accent" />
            <h2 className="text-[13px] font-black uppercase tracking-widest text-ink dark:text-white">
              {isEdit ? "Edit Event" : "Add Event"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-ink-faint hover:bg-cream dark:hover:bg-white/10 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field label="Event Title *">
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Example: Math lecture"
              className={inputCls}
              maxLength={100}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *">
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={form.time}
                onChange={(e) => set("time", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Description (optional)">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Additional details..."
              className={`${inputCls} min-h-[72px] resize-none`}
              maxLength={500}
            />
          </Field>

          {error && (
            <p className="text-xs text-rose-500 font-bold">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-sand dark:border-white/10 text-[11px] font-black uppercase tracking-widest text-ink-faint hover:bg-cream dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-accent text-white text-[11px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {isEdit ? "Save Changes" : "Save"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── المكون الرئيسي ────────────────────────────────────────────────
export default function CalendarSidebar({ groupId, isLeader = false, isAdmin = false }) {
  const today = new Date();
  const [viewDate, setViewDate]       = useState(today);
  const [selectedDay, setSelectedDay] = useState(null);   // "YYYY-MM-DD"
  const [events, setEvents]           = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // حدث قيد التعديل
  const [deletingId, setDeletingId]   = useState(null);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = buildMonthGrid(year, month);
  const canManage = isLeader || isAdmin;

  // ── جلب أحداث الشهر لحظياً ────────────────────────────────────
  // --- دالة جلب الأحداث من الـ API (آلية بديلة موثوقة) ---
  const fetchEventsViaAPI = useCallback(async (targetYear, targetMonth) => {
    const y = targetYear ?? year;
    const m = targetMonth ?? month;
    try {
      const data = await api(`/api/groups/${groupId}/events`);
      const monthPrefix = `${y}-${String(m + 1).padStart(2, "0")}`;
      const monthEvents = (data.events || [])
        .map((e) => ({ ...e, date: normalizeDate(e.date) }))
        .filter((e) => (e.date || "").startsWith(monthPrefix))
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      setEvents(monthEvents);
      setLoadingEvents(false);
    } catch (err) {
      console.error("[CalendarSidebar] API fetch error:", err);
    }
  }, [groupId, year, month]);

  useEffect(() => {
    if (!groupId) return;
    setLoadingEvents(true);

    const eventsRef = collection(db, COL.GROUPS, groupId, "events");
    // لا نستخدم orderBy لتجنب مشاكل الفهرس — الترتيب يتم محلياً
    let snapshotFired = false;
    const unsub = onSnapshot(
      eventsRef,
      (snap) => {
        snapshotFired = true;
        const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
        const allEvents = snap.docs.map((d) => {
          const raw = d.data();
          const normalized = normalizeDate(raw.date);
          return { id: d.id, ...raw, date: normalized };
        });
        const monthEvents = allEvents
          .filter((e) => (e.date || "").startsWith(monthPrefix))
          .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        setEvents(monthEvents);
        setLoadingEvents(false);
      },
      (err) => {
        console.error("[CalendarSidebar] onSnapshot error:", err);
        // onSnapshot فشل — نجلب من الـ API كبديل
        fetchEventsViaAPI();
      },
    );

    // إذا لم يُطلَق onSnapshot خلال 3 ثوانٍ، نجلب من الـ API
    const fallbackTimer = setTimeout(() => {
      if (!snapshotFired) {
        console.warn("[CalendarSidebar] onSnapshot timeout — falling back to API");
        fetchEventsViaAPI();
      }
    }, 3000);

    return () => {
      unsub();
      clearTimeout(fallbackTimer);
    };
  }, [groupId, year, month, fetchEventsViaAPI]);

  // ── أيام بها أحداث ────────────────────────────────────────────
  const daysWithEvents = new Set(events.map((e) => e.date).filter(Boolean));

  // ── أحداث اليوم المختار ───────────────────────────────────────
  const selectedEvents = selectedDay
    ? events.filter((e) => e.date === selectedDay)
    : [];

  const prevMonth = () => { setViewDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const nextMonth = () => { setViewDate(new Date(year, month + 1, 1)); setSelectedDay(null); };

  const handleDayClick = (day) => {
    if (!day) return;
    const iso = toISODate(year, month, day);
    setSelectedDay((prev) => (prev === iso ? null : iso));
  };

  const handleDeleteEvent = async (eventId) => {
    setDeletingId(eventId);
    try {
      await api(`/api/groups/${groupId}/events?eventId=${eventId}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error("[CalendarSidebar] delete error:", e);
    } finally {
      setDeletingId(null);
    }
  };

  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <>
      <div className="flex flex-col h-full select-none" dir="rtl">

        {/* ── شريط الشهر + التنقل ───────────────────────────── */}
        <div className="px-4 pt-5 pb-2">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-cream dark:hover:bg-white/10 text-ink-faint hover:text-ink transition-colors"
              aria-label="Previous month"
            >
              <ChevronRight size={14} />
            </button>

            <h3 className="text-[11px] font-black uppercase tracking-widest text-ink dark:text-white">
              {MONTH_NAMES_AR[month]} {year}
            </h3>

            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-cream dark:hover:bg-white/10 text-ink-faint hover:text-ink transition-colors"
              aria-label="Next month"
            >
              <ChevronLeft size={14} />
            </button>
          </div>

          {/* ── أسماء الأيام ──────────────────────────────────── */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES_AR.map((d) => (
              <div
                key={d}
                className="text-center text-[8px] font-black uppercase tracking-widest text-ink-faint py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* ── شبكة الأيام ───────────────────────────────────── */}
          {loadingEvents ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-accent" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                const iso       = toISODate(year, month, day);
                const isToday   = iso === todayISO;
                const isSelected = iso === selectedDay;
                const hasEvent  = daysWithEvents.has(iso);

                return (
                  <button
                    key={iso}
                    onClick={() => handleDayClick(day)}
                    className={`
                      relative flex flex-col items-center justify-center py-1.5 rounded-lg
                      transition-all duration-150 text-[11px] font-bold
                      ${isSelected
                        ? "bg-accent text-white shadow-md shadow-accent/30 scale-105"
                        : hasEvent && isToday
                          ? "bg-accent text-white ring-2 ring-white/60 dark:ring-white/30 shadow-md shadow-accent/40 scale-105"
                          : hasEvent
                            ? "bg-accent/20 dark:bg-accent/25 text-accent font-extrabold ring-1 ring-accent/50 shadow-sm shadow-accent/20 scale-105"
                          : isToday
                            ? "border border-accent/60 text-accent"
                          : "text-ink dark:text-white/80 hover:bg-cream dark:hover:bg-white/8"
                      }
                    `}
                  >
                    {day}
                    {hasEvent && !isSelected && (
                      <span className="absolute bottom-0.5 flex gap-[2px]">
                        <span className="w-1 h-1 rounded-full bg-accent" />
                      </span>
                    )}
                    {hasEvent && isSelected && (
                      <span className="absolute bottom-0.5 flex gap-[2px]">
                        <span className="w-1 h-1 rounded-full bg-white/80" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── قسم الأحداث ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto hide-scrollbar px-3 pb-4 mt-2">
          <AnimatePresence mode="wait">
            {selectedDay ? (
              <motion.div
                key={selectedDay}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-ink-faint px-1 mb-2">
                  Events on {selectedDay}
                </p>

                {selectedEvents.length === 0 ? (
                  <p className="text-center py-4 text-[10px] text-ink-faint italic">
                    No events on this day
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.map((ev) => (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        canManage={canManage}
                        deleting={deletingId === ev.id}
                        onDelete={() => handleDeleteEvent(ev.id)}
                        onEdit={() => setEditingEvent(ev)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="all-events"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {events.length === 0 && !loadingEvents && (
                  <p className="text-center py-6 text-[10px] text-ink-faint italic opacity-60">
                    No events this month
                  </p>
                )}
                {events.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-ink-faint px-1 mb-2">
                      Events this month
                    </p>
                    {events.map((ev) => (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        canManage={canManage}
                        deleting={deletingId === ev.id}
                        onDelete={() => handleDeleteEvent(ev.id)}
                        onEdit={() => setEditingEvent(ev)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── زر إضافة حدث (للمشرفين فقط) ─────────────────────── */}
        {canManage && (
          <div className="px-4 pb-4 shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent/10 hover:bg-accent hover:text-white text-accent text-[10px] font-black uppercase tracking-widest transition-all duration-200 border border-accent/20 hover:border-accent hover:shadow-lg hover:shadow-accent/20 group"
            >
              <Plus size={13} className="group-hover:rotate-90 transition-transform duration-200" />
              Add Event
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <EventFormModal
            key="add"
            groupId={groupId}
            defaultDate={selectedDay || ""}
            onClose={() => setShowModal(false)}
            onSuccess={(eventData) => {
              const eventDate = eventData?.date || eventData;
              if (eventDate) {
                setSelectedDay(eventDate);
                // تحديث متفائل: أضف الحدث فوراً للعرض
                if (typeof eventData === "object") {
                  setEvents((prev) => {
                    const optimistic = {
                      id: "temp-" + Date.now(),
                      title: eventData.title || "",
                      date: eventData.date,
                      time: eventData.time || "",
                      description: eventData.description || "",
                      authorName: "أنت",
                    };
                    return [...prev, optimistic].sort((a, b) =>
                      (a.date || "").localeCompare(b.date || "")
                    );
                  });
                }
                // انتقل للشهر الصحيح إذا كان مختلفاً
                const [ey, em] = eventDate.split("-").map(Number);
                if (ey !== year || em !== month + 1) {
                  setViewDate(new Date(ey, em - 1, 1));
                  // جلب أحداث الشهر الجديد من الـ API
                  setTimeout(() => fetchEventsViaAPI(ey, em - 1), 500);
                } else {
                  // جلب الأحداث المحدّثة من الـ API
                  setTimeout(() => fetchEventsViaAPI(), 500);
                }
              }
            }}
          />
        )}
        {editingEvent && (
          <EventFormModal
            key={editingEvent.id}
            groupId={groupId}
            editEvent={editingEvent}
            onClose={() => setEditingEvent(null)}
            onSuccess={(eventData) => {
              const eventDate = eventData?.date || eventData;
              if (eventDate) {
                setSelectedDay(eventDate);
                const [ey, em] = eventDate.split("-").map(Number);
                if (ey !== year || em !== month + 1) {
                  setViewDate(new Date(ey, em - 1, 1));
                  setTimeout(() => fetchEventsViaAPI(ey, em - 1), 500);
                } else {
                  setTimeout(() => fetchEventsViaAPI(), 500);
                }
              }
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── بطاقة الحدث الفردية ──────────────────────────────────────────
function EventCard({ event, canManage, deleting, onDelete, onEdit }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 6 }}
      className="group px-3 py-2.5 rounded-xl bg-cream/60 dark:bg-white/5 border border-sand dark:border-white/8 hover:border-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-ink dark:text-white truncate">
            {event.title}
          </p>
          {event.time && (
            <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] font-black uppercase tracking-wider text-accent">
              <Clock size={8} />
              {event.time}
            </span>
          )}
          {event.description && (
            <p className="mt-1 text-[10px] text-ink-faint leading-relaxed line-clamp-2">
              {event.description}
            </p>
          )}
          <p className="mt-1 text-[8px] text-ink-faint opacity-60">
            by {event.authorName}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {/* زر التعديل */}
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-ink-faint hover:bg-accent/10 hover:text-accent transition-all"
              aria-label="Edit event"
            >
              <Pencil size={12} />
            </button>
            {/* زر الحذف */}
            <button
              onClick={onDelete}
              disabled={deleting}
              className="p-1.5 rounded-lg text-ink-faint hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-500 transition-all disabled:opacity-50"
              aria-label="Delete event"
            >
              {deleting
                ? <Loader2 size={12} className="animate-spin" />
                : <Trash2 size={12} />
              }
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
