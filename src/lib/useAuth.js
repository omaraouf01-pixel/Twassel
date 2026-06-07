"use client";

// ══════════════════════════════════════════════════════════════════════
// useAuth.js — نظام إدارة المصادقة والتوجيه الذكي لـ TAWASSOL
// ──────────────────────────────────────────────────────────────────────
// يُوفّر AuthContext عالمياً يحمل:
//   user:     كائن Firebase Auth (للتوكن والـ uid)
//   userData: بيانات المستخدم من Firestore (role, status, onboarded...)
//   loading:  true حتى يصل أول snapshot من Firestore
//
// منطق التوجيه التلقائي بحسب حالة الحساب:
//   onboarding  → /onboarding   (إكمال البيانات)
//   pending     → /pending      (انتظار موافقة الأدمن)
//   active+لم يُكمل → /onboarding
//   active+مكتمل   → /hub
// ══════════════════════════════════════════════════════════════════════

import { useState, useEffect, createContext, useContext } from "react";
import { auth, firestore as db } from "./firebase";
import { onIdTokenChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { COL } from "./collectionNames";
import { useRouter, usePathname } from "next/navigation";

const AuthContext = createContext({ user: null, userData: null, loading: true });

/**
 * AuthProvider — مُزوّد السياق العالمي للمصادقة.
 *
 * يُغلف التطبيق بالكامل ويُدير 3 Effects مستقلة:
 *  1. مراقبة Firebase Auth (onIdTokenChanged) — لا يقرأ Firestore.
 *  2. مستمع Firestore (onSnapshot) — يُوفّر البيانات الأولية + التحديثات اللحظية.
 *  3. منطق التوجيه الذكي — يُعيد التوجيه بناءً على status/onboarded.
 *
 * يجب وضعه في layout.js كأعلى wrapper بعد ThemeProvider.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // ─── 1. مراقبة حالة الجلسة والتوكن ───
  // يعمل مرة واحدة فقط — لا يعتمد على pathname/router لتجنب إعادة التسجيل عند كل تنقل
  // لا تقرأ Firestore هنا — Effect الثاني يتكفّل بالبيانات الأولية عبر onSnapshot
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true); // يبقى true حتى يُطلق onSnapshot أول snapshot
        setUser(firebaseUser);
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 2. المستمع اللحظي + البيانات الأولية + إجبار تحديث التوكن عند تغير الحالة ───
  // أول snapshot يحمل البيانات الأولية ويُنهي حالة loading — لا حاجة لـ getDoc منفصل
  useEffect(() => {
    if (!user) return;

    let lastStatus = null;
    let firstFired = false;
    let unsub;
    // Guard: if the component unmounts (or user changes) before getIdToken()
    // resolves, the onSnapshot call is skipped and no listener is leaked.
    let cancelled = false;

    // نجبر استرجاع التوكن أولاً حتى تتعرف Firestore على الجلسة قبل بدء الـ listener
    user.getIdToken().then(() => {
      if (cancelled) return;

      unsub = onSnapshot(
        doc(db, COL.USERS, user.uid),
        { includeMetadataChanges: false },
        async (snapshot) => {
          if (cancelled) return;
          if (!snapshot.exists()) {
            if (!firstFired) { firstFired = true; setLoading(false); }
            return;
          }
          const data = snapshot.data();

          // إذا تغيرت الحالة (مثلاً pending → active بعد موافقة الـ Admin)،
          // اطلب توكن جديد لتتزامن الـ Custom Claims قبل تحديث userData
          // حتى لا يطلق منطق التوجيه قبل أن تكون قواعد Firestore جاهزة.
          if (lastStatus !== null && lastStatus !== data.status) {
            try {
              await auth.currentUser?.getIdToken(true);
            } catch (e) {
              console.warn("[Auth] Token refresh failed:", e.message);
            }
          }
          lastStatus = data.status;
          if (!cancelled) {
            setUserData(data);
            if (!firstFired) { firstFired = true; setLoading(false); }
          }
        },
        (error) => {
          console.error("[Auth] Snapshot Error:", error);
          if (!cancelled && !firstFired) { firstFired = true; setLoading(false); }
        }
      );
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user]);

  // ─── 3. منطق التوجيه الذكي ───
  useEffect(() => {
    if (loading) return;

    const path = pathname;
    const PUBLIC_PATHS = ["/", "/auth"];

    // لا مستخدم → توجيه لصفحة الدخول إن لم يكن في صفحة عامة
    if (!userData) {
      if (!PUBLIC_PATHS.includes(path)) {
        router.replace("/auth");
      }
      return;
    }

    const status = userData.status;
    const onboarded = !!userData.onboarded;

    // 🛡️ السماح بالبقاء في /onboarding بعد الإنهاء مباشرةً
    if (status === "active" && onboarded && path === "/onboarding") return;

    if (status === "onboarding" && path !== "/onboarding") {
      router.replace("/onboarding");
    } else if (status === "pending" && path !== "/pending" && path !== "/onboarding") {
      router.replace("/pending");
    } else if (status === "active" && !onboarded && path !== "/onboarding") {
      router.replace("/onboarding");
    } else if (status === "active" && onboarded && (path === "/auth" || path === "/pending")) {
      router.replace("/hub");
    }
  }, [userData, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth — Hook للوصول إلى بيانات المصادقة من أي مكوّن.
 *
 * @returns {{ user: FirebaseUser|null, userData: object|null, loading: boolean }}
 *
 * الاستخدام الشائع:
 *   const { user, userData, loading } = useAuth();
 *   if (loading) return <Spinner />;
 *   if (!userData) return null; // غير مسجّل
 */
export const useAuth = () => useContext(AuthContext);