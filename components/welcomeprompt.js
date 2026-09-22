"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/providers";

const SEEN_KEY = "nh-welcome-seen";

// Pages that already handle sign-in themselves, or where a prompt would be
// plain noise.
const SKIP = ["/admin", "/signin", "/checkout", "/cart"];

export function WelcomePrompt() {
  const pathname = usePathname();
  const { user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Private windows throw here. Worst case the prompt shows again next
      // visit, which is better than crashing the page.
    }
  }, []);

  useEffect(() => {
    if (!ready || user) return;
    if (SKIP.some((prefix) => pathname.startsWith(prefix))) return;

    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Treat an unreadable store as "already seen" so a blocked-storage
      // visitor is not prompted on every single page view.
      seen = true;
    }
    if (seen) return;

    // Let the page land first -- an instant modal reads as an ad.
    const t = setTimeout(() => setOpen(true), 1400);
    return () => clearTimeout(t);
  }, [ready, user, pathname]);

  // Signing in anywhere retires the prompt for good.
  useEffect(() => {
    if (!user) return;
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  async function google() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      dismiss();
    } catch (e) {
      setError(
        e?.code?.includes("popup-closed")
          ? "Sign-in window closed."
          : "Could not sign in just now."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="welcome-backdrop" onClick={dismiss}>
      <div
        className="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="welcome-close"
          onClick={dismiss}
          aria-label="Close"
          type="button"
        >
          ×
        </button>

        <p className="eyebrow">Welcome</p>
        <h3 id="welcome-title" style={{ marginBottom: 10 }}>
          Make checkout quicker
        </h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Sign in and your orders stay tied to you, so I know where to send your
          photos. You can browse every gallery without it.
        </p>

        <button
          className="btn accent"
          style={{ width: "100%" }}
          onClick={google}
          disabled={busy}
          type="button"
        >
          {busy ? "Opening…" : "Continue with Google"}
        </button>

        <Link
          href="/signin"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={dismiss}
        >
          Use email instead
        </Link>

        <button
          className="welcome-skip"
          onClick={dismiss}
          type="button"
        >
          Keep browsing
        </button>

        {error && (
          <div className="notice error" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
