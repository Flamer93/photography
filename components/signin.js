"use client";

import { useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { continueTo, friendlyAuthError } from "@/lib/authactions";

export function SignIn({ heading = "Sign in", blurb }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentReset, setSentReset] = useState(false);
  const [sentVerify, setSentVerify] = useState(false);

  // A new account gets a verification email straight away. It is not enforced
  // anywhere -- someone can buy photos without clicking it -- but it means
  // the address is confirmed before there is an order to deliver to it.
  async function signUp() {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await sendEmailVerification(cred.user, continueTo("/galleries"));
      setSentVerify(true);
    } catch (e) {
      // Not worth failing the sign-up over: they are in, and the account
      // page can send it again.
      console.error("Verification email failed:", e);
    }
  }

  async function forgotPassword() {
    if (!email) {
      setError("Put your email in first and I will send you a reset link.");
      return;
    }
    setSentReset(false);
    await run(async () => {
      await sendPasswordResetEmail(auth, email, continueTo("/signin"));
      setSentReset(true);
    });
  }

  async function run(fn) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 460 }}>
      <h3 style={{ marginBottom: 10 }}>{heading}</h3>
      {blurb && (
        <p className="muted small" style={{ marginTop: 0 }}>
          {blurb}
        </p>
      )}

      <button
        className="btn"
        style={{ width: "100%", marginBottom: 18 }}
        disabled={busy}
        onClick={() => run(() => signInWithPopup(auth, new GoogleAuthProvider()))}
      >
        Continue with Google
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            mode === "signin"
              ? signInWithEmailAndPassword(auth, email, password)
              : signUp()
          );
        }}
      >
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <button className="btn accent" style={{ width: "100%" }} disabled={busy}>
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        className="btn ghost small"
        style={{ width: "100%", marginTop: 12 }}
        onClick={() => {
          setError("");
          setMode((m) => (m === "signin" ? "signup" : "signin"));
        }}
      >
        {mode === "signin" ? "Need an account?" : "Already have an account?"}
      </button>

      {mode === "signin" && (
        <button
          type="button"
          className="link-button"
          style={{ display: "block", margin: "14px auto 0", fontSize: "0.82rem" }}
          onClick={forgotPassword}
          disabled={busy}
        >
          Forgotten your password?
        </button>
      )}

      {sentReset && (
        <div className="notice" style={{ marginTop: 16 }}>
          Reset link sent to {email}. Check your junk folder if it is not there
          in a minute.
        </div>
      )}

      {sentVerify && (
        <div className="notice" style={{ marginTop: 16 }}>
          Account created. I have sent {email} a link to confirm the address —
          worth clicking so your photos reach you.
        </div>
      )}

      {error && (
        <div className="notice error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}
    </div>
  );
}
