"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { friendlyAuthError } from "@/lib/authactions";

// The handler Firebase sends people to from its account emails. Set as the
// custom action URL in Authentication > Templates so the link lands here
// rather than on a Firebase-branded page on firebaseapp.com.
//
// Everything it needs is in the query string, and it is deliberately read
// from window rather than useSearchParams: that hook would force this page
// dynamic or need a Suspense boundary, and there is nothing to gain either
// way for a page that only ever runs in a browser.

export default function AuthActionPage() {
  const [state, setState] = useState("working");
  const [mode, setMode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [continueUrl, setContinueUrl] = useState("");

  // resetPassword only: the code is verified first, then held while the
  // person types a new password.
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oobCode = params.get("oobCode") || "";
    const action = params.get("mode") || "";
    const next = params.get("continueUrl") || "";

    setMode(action);
    setCode(oobCode);

    // Only same-origin, so a crafted link cannot use this page to bounce
    // someone to another site wearing our name.
    if (next) {
      try {
        const url = new URL(next, window.location.origin);
        if (url.origin === window.location.origin) setContinueUrl(url.pathname + url.search);
      } catch {
        // Unparseable: no onward link rather than a broken one.
      }
    }

    if (!oobCode || !action) {
      setState("bad-link");
      return;
    }

    (async () => {
      try {
        switch (action) {
          case "verifyEmail":
          case "verifyAndChangeEmail": {
            // checkActionCode first so the address can be shown -- after
            // applyActionCode the code is spent and tells us nothing.
            const info = await checkActionCode(auth, oobCode);
            setEmail(info?.data?.email || "");
            await applyActionCode(auth, oobCode);
            // The signed-in session still carries the old emailVerified and
            // email until it refreshes.
            await auth.currentUser?.reload().catch(() => {});
            setState(action === "verifyEmail" ? "verified" : "email-changed");
            break;
          }

          case "recoverEmail": {
            // Someone changed the email on this account and the owner is
            // undoing it. The address being restored is the one to show.
            const info = await checkActionCode(auth, oobCode);
            setEmail(info?.data?.email || "");
            await applyActionCode(auth, oobCode);
            setState("email-recovered");
            break;
          }

          case "resetPassword": {
            const address = await verifyPasswordResetCode(auth, oobCode);
            setEmail(address);
            setState("reset-form");
            break;
          }

          default:
            setState("unknown-mode");
        }
      } catch (e) {
        setError(friendlyAuthError(e));
        setState("failed");
      }
    })();
  }, []);

  const submitReset = useCallback(
    async (e) => {
      e.preventDefault();
      if (password !== confirm) {
        setError("Those two passwords do not match.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        await confirmPasswordReset(auth, code, password);
        setState("reset-done");
      } catch (err) {
        setError(friendlyAuthError(err));
      } finally {
        setBusy(false);
      }
    },
    [code, password, confirm]
  );

  // Offered whenever a link has expired or been used: the way out of every
  // one of these is a fresh email, and making someone hunt for that is how a
  // dead link becomes a lost account.
  async function resend() {
    if (!email) return;
    setBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setState("resent");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 520 }}>
        <p className="eyebrow">Your account</p>

        {state === "working" && (
          <>
            <h1 style={{ marginBottom: 18 }}>One moment.</h1>
            <p className="muted">Checking that link…</p>
          </>
        )}

        {state === "verified" && (
          <>
            <h1 style={{ marginBottom: 18 }}>Email confirmed.</h1>
            <p className="lede">
              {email ? `${email} is verified.` : "Your email is verified."} You
              can get on with it.
            </p>
            <Done continueUrl={continueUrl} />
          </>
        )}

        {state === "email-changed" && (
          <>
            <h1 style={{ marginBottom: 18 }}>Email updated.</h1>
            <p className="lede">
              {email
                ? `Your account now uses ${email}.`
                : "Your account email has been updated."}{" "}
              Sign in with the new address from now on.
            </p>
            <Done continueUrl={continueUrl} signInAgain />
          </>
        )}

        {state === "email-recovered" && (
          <>
            <h1 style={{ marginBottom: 18 }}>Email restored.</h1>
            <p className="lede">
              Your account is back to {email || "your original address"}.
            </p>
            <div className="notice" style={{ marginBottom: 20 }}>
              If you did not ask for that change, someone else may know your
              password. Reset it now to be safe.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn accent" onClick={resend} disabled={busy}>
                {busy ? "Sending…" : "Reset my password"}
              </button>
              <Link href="/" className="btn ghost">
                Back to the site
              </Link>
            </div>
          </>
        )}

        {state === "reset-form" && (
          <>
            <h1 style={{ marginBottom: 18 }}>Pick a new password.</h1>
            <p className="lede" style={{ marginBottom: 28 }}>
              For {email}.
            </p>
            <form className="panel" onSubmit={submitReset}>
              <div className="field">
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <span className="muted small">At least 6 characters.</span>
              </div>
              <div className="field">
                <label htmlFor="confirm-password">Again</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <button className="btn accent" disabled={busy}>
                {busy ? "Saving…" : "Save new password"}
              </button>
            </form>
          </>
        )}

        {state === "reset-done" && (
          <>
            <h1 style={{ marginBottom: 18 }}>Password changed.</h1>
            <p className="lede">You can sign in with it now.</p>
            <Done continueUrl={continueUrl} signInAgain />
          </>
        )}

        {state === "resent" && (
          <>
            <h1 style={{ marginBottom: 18 }}>Check your email.</h1>
            <p className="lede">
              A fresh link is on its way to {email}. Use the newest one — older
              links stop working.
            </p>
            <Link href="/" className="btn ghost">
              Back to the site
            </Link>
          </>
        )}

        {(state === "failed" || state === "bad-link" || state === "unknown-mode") && (
          <>
            <h1 style={{ marginBottom: 18 }}>That link did not work.</h1>
            <p className="lede">
              {state === "bad-link"
                ? "This page is only reachable from a link in one of my account emails, and that link looks incomplete. Open it straight from the email rather than copying part of it."
                : state === "unknown-mode"
                ? `I do not know what "${mode}" is meant to do. Open the link straight from the email.`
                : error}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/signin" className="btn accent">
                Go to sign in
              </Link>
              <Link href="/contact" className="btn ghost">
                Get in touch
              </Link>
            </div>
          </>
        )}

        {error && state === "reset-form" && (
          <div className="notice error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}
      </div>
    </section>
  );
}

function Done({ continueUrl, signInAgain }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
      {signInAgain && (
        <Link href="/signin" className="btn accent">
          Sign in
        </Link>
      )}
      <Link href={continueUrl || "/galleries"} className={signInAgain ? "btn ghost" : "btn accent"}>
        {continueUrl ? "Carry on" : "Browse galleries"}
      </Link>
    </div>
  );
}
