"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || "";

/* ---------------------------------------------------------------- theme --- */

const ThemeContext = createContext({ theme: "dark", toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    let stored = null;
    try {
      stored = localStorage.getItem("nh-theme");
    } catch {
      // Private windows and blocked site data both throw here; fall through to
      // the system preference.
    }
    const initial =
      stored ||
      (window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark");
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("nh-theme", next);
      } catch {}
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ----------------------------------------------------------------- auth --- */

const AuthContext = createContext({ user: null, ready: false, isAdmin: false });
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    []
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      isAdmin: Boolean(user && ADMIN_UID && user.uid === ADMIN_UID),
    }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ----------------------------------------------------------------- cart --- */

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

const CART_KEY = "nh-cart";

function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const add = useCallback((photo) => {
    setItems((prev) =>
      prev.some((i) => i.photoId === photo.photoId) ? prev : [...prev, photo]
    );
  }, []);

  const remove = useCallback((photoId) => {
    setItems((prev) => prev.filter((i) => i.photoId !== photoId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = useCallback(
    (photoId) => items.some((i) => i.photoId === photoId),
    [items]
  );

  const subtotalCents = useMemo(
    () => items.reduce((sum, i) => sum + (i.priceCents || 0), 0),
    [items]
  );

  const value = useMemo(
    () => ({ items, add, remove, clear, has, subtotalCents, hydrated }),
    [items, add, remove, clear, has, subtotalCents, hydrated]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/* ---------------------------------------------------------------- root ---- */

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
