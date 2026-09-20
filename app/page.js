"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

export default function Home() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setAuthReady(true);
  }), []);

  return (
    <main>
      <h1>Hello, world.</h1>
      <p className="lede">
        Next.js on Firebase App Hosting, wired up to Authentication, Cloud
        Firestore and Cloud Storage.
      </p>

      <AuthCard user={user} authReady={authReady} />
      {user && <MessagesCard user={user} />}
      {user && <UploadCard user={user} />}
    </main>
  );
}

function AuthCard({ user, authReady }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setError("");
    setBusy(true);
    try {
      await fn();
      setPassword("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return (
      <section className="card">
        <h2>Authentication</h2>
        <p className="empty">Checking sign-in status…</p>
      </section>
    );
  }

  if (user) {
    return (
      <section className="card">
        <h2>Authentication</h2>
        <p>
          Signed in as <strong>{user.email || user.displayName || user.uid}</strong>
          <span className="meta">uid: {user.uid}</span>
        </p>
        <div className="row">
          <button className="secondary" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Authentication</h2>
      <div className="row">
        <button
          disabled={busy}
          onClick={() => run(() => signInWithPopup(auth, new GoogleAuthProvider()))}
        >
          Continue with Google
        </button>
      </div>

      <form
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => signInWithEmailAndPassword(auth, email, password));
        }}
      >
        <input
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={busy}>
          Sign in
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => run(() => createUserWithEmailAndPassword(auth, email, password))}
        >
          Create account
        </button>
      </form>

      {error && <p className="status error">{error}</p>}
    </section>
  );
}

function MessagesCard({ user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    return onSnapshot(
      q,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setError(e.message)
    );
  }, []);

  async function submit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setError("");
    try {
      await addDoc(collection(db, "messages"), {
        text: trimmed,
        uid: user.uid,
        author: user.email || user.displayName || "anonymous",
        createdAt: serverTimestamp(),
      });
      setText("");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="card">
      <h2>Cloud Firestore</h2>
      <form onSubmit={submit}>
        <input
          type="text"
          placeholder="Write something…"
          maxLength={480}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Save</button>
      </form>

      {error && <p className="status error">{error}</p>}

      {messages.length === 0 ? (
        <p className="empty">No messages yet — add the first one.</p>
      ) : (
        <ul>
          {messages.map((m) => (
            <li key={m.id}>
              {m.text}
              <span className="meta">
                {m.author} ·{" "}
                {m.createdAt?.toDate
                  ? m.createdAt.toDate().toLocaleString()
                  : "saving…"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UploadCard({ user }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUrl("");
    setStatus(`Uploading ${file.name}…`);
    try {
      const path = `uploads/${user.uid}/${Date.now()}-${file.name}`;
      const snap = await uploadBytes(ref(storage, path), file);
      setUrl(await getDownloadURL(snap.ref));
      setStatus("Uploaded.");
    } catch (e) {
      setStatus("");
      setError(e.message);
    } finally {
      e.target.value = "";
    }
  }

  return (
    <section className="card">
      <h2>Cloud Storage</h2>
      <input type="file" accept="image/*" onChange={upload} />
      {status && <p className="status ok">{status}</p>}
      {error && <p className="status error">{error}</p>}
      {url && (
        <>
          <img className="preview" src={url} alt="Uploaded preview" />
          <p className="status">
            <a href={url} target="_blank" rel="noreferrer">
              Open in a new tab
            </a>
          </p>
        </>
      )}
    </section>
  );
}
