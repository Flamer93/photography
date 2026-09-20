"use client";

import { useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export function SignIn({ heading = "Sign in", blurb }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(friendly(e));
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
              : createUserWithEmailAndPassword(auth, email, password)
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

      {error && (
        <div className="notice error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function friendly(e) {
  const code = e?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password"))
    return "That email and password don’t match.";
  if (code.includes("email-already-in-use"))
    return "That email already has an account — try signing in.";
  if (code.includes("weak-password"))
    return "Passwords need to be at least 6 characters.";
  if (code.includes("popup-closed")) return "Sign-in window closed.";
  if (code.includes("unauthorized-domain"))
    return "This domain isn’t authorized for sign-in yet.";
  return e?.message || "Something went wrong.";
}
