"use client";

import Link from "next/link";
import { useState } from "react";
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/providers";
import { SignIn } from "@/components/signin";
import { continueTo, friendlyAuthError } from "@/lib/authactions";

export default function AccountPage() {
  const { user, ready } = useAuth();

  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(fn) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <section className="section">
        <div className="wrap">
          <p className="muted">One moment…</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section">
        <div className="wrap">
          <p className="eyebrow">Your account</p>
          <h1 style={{ marginBottom: 32 }}>Sign in first</h1>
          <SignIn blurb="Sign in to change your email or password." />
        </div>
      </section>
    );
  }

  // Google accounts have no password here and their email belongs to Google,
  // so offering to change either would be offering something that cannot work.
  const passwordAccount = user.providerData.some(
    (p) => p.providerId === "password"
  );

  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 560 }}>
        <p className="eyebrow">Your account</p>
        <h1 style={{ marginBottom: 28 }}>{user.email || "Signed in"}</h1>

        {!user.emailVerified && user.email && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 10 }}>Confirm your email</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              Your photos get sent to this address, so it is worth knowing it
              works before there is an order riding on it.
            </p>
            <button
              className="btn accent"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await sendEmailVerification(
                    auth.currentUser,
                    continueTo("/account")
                  );
                  setNotice(`Verification link sent to ${user.email}.`);
                })
              }
            >
              {busy ? "Sending…" : "Send me the link"}
            </button>
          </div>
        )}

        {user.emailVerified && (
          <p className="muted small" style={{ marginTop: 0, marginBottom: 24 }}>
            Email confirmed.
          </p>
        )}

        {passwordAccount ? (
          <>
            <div className="panel" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 10 }}>Change your email</h3>
              <p className="muted small" style={{ marginTop: 0 }}>
                I will send a confirmation link to the new address. Nothing
                changes until you click it — so a typo cannot lock you out.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    // verifyBeforeUpdateEmail, not updateEmail: the address
                    // has to prove it exists before it becomes the one that
                    // receives password resets.
                    await verifyBeforeUpdateEmail(
                      auth.currentUser,
                      newEmail.trim(),
                      continueTo("/account")
                    );
                    setNotice(
                      `Confirmation sent to ${newEmail.trim()}. Your email changes once you click it.`
                    );
                    setNewEmail("");
                  });
                }}
              >
                <div className="field">
                  <label htmlFor="new-email">New email</label>
                  <input
                    id="new-email"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <button className="btn" disabled={busy}>
                  {busy ? "Sending…" : "Send confirmation"}
                </button>
              </form>
            </div>

            <div className="panel">
              <h3 style={{ marginBottom: 10 }}>Change your password</h3>
              <p className="muted small" style={{ marginTop: 0 }}>
                Sent as a link to {user.email}, so nobody who wanders up to an
                unlocked phone can change it.
              </p>
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await sendPasswordResetEmail(
                      auth,
                      user.email,
                      continueTo("/account")
                    );
                    setNotice(`Password link sent to ${user.email}.`);
                  })
                }
              >
                {busy ? "Sending…" : "Email me a reset link"}
              </button>
            </div>
          </>
        ) : (
          <div className="panel">
            <h3 style={{ marginBottom: 10 }}>Signed in with Google</h3>
            <p className="muted small" style={{ marginTop: 0, marginBottom: 0 }}>
              Your email and password live with your Google account, so they
              are changed there rather than here.
            </p>
          </div>
        )}

        {notice && (
          <div className="notice" style={{ marginTop: 20 }}>
            {notice}
          </div>
        )}
        {error && (
          <div className="notice error" style={{ marginTop: 20 }}>
            {error}
          </div>
        )}

        <p className="muted small" style={{ marginTop: 28 }}>
          <Link href="/galleries" style={{ color: "var(--accent)" }}>
            Back to the galleries
          </Link>
        </p>
      </div>
    </section>
  );
}
