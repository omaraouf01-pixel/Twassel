// ══════════════════════════════════════════════════════════════════════
// useMessages — Hook جلب الرسائل اللحظي (legacy)
// ──────────────────────────────────────────────────────────────────────
// ⚠️ ملاحظة: هذا الـ Hook legacy — الصفحة الرئيسية تستخدم useChat بدلاً منه.
//    useChat يُوفّر: Optimistic UI + pagination + طلبات الانضمام + ملفات معلّقة.
//    useMessages أبسط ويُستخدم في مكوّنات ثانوية أو للاختبار.
// ══════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { firestore as db } from "./firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { COL } from "./collectionNames";

/**
 * useMessages — يجلب رسائل مجموعة بمستمع لحظي مع تجميع تلقائي.
 *
 * @param {string} groupId - معرّف المجموعة
 * @returns {{ messages: Array, loading: boolean, error: string|null }}
 *
 * التجميع (_grouped): رسالتان متتاليتان لنفس المستخدم خلال 5 دقائق
 *   تُدمجان بصرياً (بدون إعادة تكرار الاسم والصورة).
 */
export function useMessages(groupId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      // 1. تحديد المجموعة الرئيسية
      const messagesCol = collection(db, COL.MESSAGES);

      // 2. بناء الاستعلام
      const q = query(
        messagesCol,
        where("groupId", "==", groupId),
        orderBy("createdAt", "asc")
      );

      // 3. فتح المستمع اللحظي
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const rawMessages = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          };
        });

        // 4. منطق التجميع (Grouping)
        const grouped = rawMessages.map((m, index) => {
          const prevMessage = rawMessages[index - 1];
          const isSameUser = prevMessage && prevMessage.uid === m.uid;
          const isRecent = prevMessage && (m.createdAt - prevMessage.createdAt) < 5 * 60 * 1000;

          return {
            ...m,
            _grouped: isSameUser && isRecent
          };
        });

        setMessages(grouped);
        setLoading(false);
      }, (err) => {
        console.error("❌ خطأ في استماع Firestore:", err);
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      // ✅ السطر المُصحح هنا:
      console.error("❌ فشل إعداد المواسير:", err);
      setError(err.message);
      setLoading(false);
    }
  }, [groupId]);

  return { messages, loading, error };
}