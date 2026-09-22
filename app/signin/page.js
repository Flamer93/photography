"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/providers";
import { SignIn } from "@/components/signin";

export default function SignInPage() {
  const { user, ready, isAdmin } = useAuth();

  if (!ready) {
    return (
      <section className="section">
        <div className="wrap">
          <p className="muted">Checking sign-in…</p>
        </div>
      </section>
    );
  }

  if (user) {
    return (
      <section className="section">
        <div className="wrap" style={{ maxWidth: 560 }}>
          <p className="eyebrow">Your account</p>
          <h1 style={{ marginBottom: 24 }}>Signed in.</h1>

          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="receipt-row" style={{ borderTop: "none" }}>
              <span className="muted">Email</span>
              <strong>{user.email || "—"}</strong>
            </div>
            {user.displayName && (
              <div className="receipt-row">
                <span className="muted">Name</span>
                <strong>{user.displayName}</strong>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/galleries" className="btn accent">
              Browse galleries
            </Link>
            {isAdmin && (
              <Link href="/admin" className="btn ghost">
                Admin dashboard
              </Link>
            )}
            <button className="btn ghost" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 560 }}>
        <p className="eyebrow">Your account</p>
        <h1 style={{ marginBottom: 18 }}>Sign in.</h1>
        <p className="lede" style={{ marginBottom: 32 }}>
          You do not need an account to browse galleries — only to check out, so
          your order is tied to you and I know where to send the files.
        </p>
        <SignIn heading="Sign in or create an account" />
      </div>
    </section>
  );
}
