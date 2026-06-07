"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { firestore, auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { COL } from "./collectionNames";

/**
 * useMyGroups — يتابع لحظياً المجموعات التي ينتمي إليها المستخدم الحالي.
 *
 * الاستراتيجية:
 *  - يستمع لتغييرات Auth (onAuthStateChanged) أولاً — ينشئ/يلغي الـ Snapshot listener
 *    تلقائياً عند تسجيل الدخول والخروج.
 *  - mountedRef: يمنع تحديث الحالة بعد unmount (تجنّب memory leak).
 *
 * @returns {{
 *   groups:         Array,  - جميع مجموعاتي (رسمية + عادية)
 *   officialGroups: Array,  - المجتمعات الأكاديمية الرسمية (isOfficial: true)
 *   regularGroups:  Array,  - مجموعات الدراسة العادية
 *   loading:        boolean,
 *   error:          string|null
 * }}
 */
export function useMyGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let unsubscribeSnap = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnap) {
        unsubscribeSnap();
        unsubscribeSnap = null;
      }

      if (!user) {
        if (mountedRef.current) {
          setGroups([]);
          setLoading(false);
        }
        return;
      }

      const q = query(
        collection(firestore, COL.GROUPS),
        where("members", "array-contains", user.uid),
        where("status", "==", "active"),
        orderBy("updatedAt", "desc")
      );

      unsubscribeSnap = onSnapshot(
        q,
        (snap) => {
          if (!mountedRef.current) return;
          const list = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              createdAt: data.createdAt?.toDate?.().toISOString() || null,
              updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
            };
          });
          setGroups(list);
          setLoading(false);
        },
        (err) => {
          console.error("[useMyGroups] listener error:", err);
          if (!mountedRef.current) return;
          setError(err.message);
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubscribeSnap) unsubscribeSnap();
      unsubscribeAuth();
    };
  }, []);

  // Derived splits — computed on every groups update, not on every render
  const officialGroups = useMemo(
    () => groups.filter((g) => g.isOfficial === true),
    [groups]
  );
  const regularGroups = useMemo(
    () => groups.filter((g) => !g.isOfficial),
    [groups]
  );

  return { groups, officialGroups, regularGroups, loading, error };
}
