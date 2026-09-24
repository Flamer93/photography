"use client";

import Link from "next/link";
import { HEADLINE_SPORTS } from "@/lib/sports";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/providers";
import { listPublishedGalleries } from "@/lib/db";

export default function HomePage() {
  const { user, ready } = useAuth();
  const [galleries, setGalleries] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    listPublishedGalleries(6)
      .then((rows) => {
        setGalleries(rows);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">Midland, Ontario — Sports Photography</p>
          <h1>
            The moment
            <br />
            after the whistle.
          </h1>
          <p className="lede">
            I shoot local games across Simcoe County and put every frame online
            the same week. Find your game, find your shot, and take it home.
          </p>
          <div className="hero-meta">
            {HEADLINE_SPORTS.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <div>
            <Link href="/galleries" className="btn accent">
              Find your game
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Latest</p>
              <h2>Recent work</h2>
            </div>
            <Link href="/galleries" className="btn ghost small">
              All galleries
            </Link>
          </div>

          {state === "loading" && <p className="muted">Loading galleries…</p>}

          {state === "error" && (
            <div className="notice error">
              Couldn’t load galleries right now. Refresh to try again.
            </div>
          )}

          {state === "ready" && galleries.length === 0 && (
            <div className="empty-state">
              <p>No galleries published yet — the first game goes up soon.</p>
            </div>
          )}

          {galleries.length > 0 && (
            <div className="masonry">
              {galleries.map((g) => (
                <Link
                  key={g.id}
                  href={`/galleries/${g.slug}`}
                  className="photo-card"
                >
                  {g.coverUrl ? (
                    <img src={g.coverUrl} alt={g.title} loading="lazy" />
                  ) : (
                    <div className="gallery-cover-empty">No cover yet</div>
                  )}
                  <div className="photo-overlay">
                    <span>{g.title}</span>
                    <span className="photo-price">{g.photoCount || 0} shots</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section team-teaser">
        <div className="wrap">
          <div className="team-cta">
            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                For teams
              </p>
              <h3 style={{ marginBottom: 8 }}>Want your whole team covered?</h3>
              <p className="muted" style={{ margin: 0 }}>
                Warmups, action, celebrations, goalies and team photos — see
                what a booking includes.
              </p>
            </div>
            <Link href="/teams" className="btn accent">
              Book your team
            </Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="wrap">
          <p className="eyebrow">How it works</p>
          <h2>Three steps</h2>
          <div className="grid-3" style={{ marginTop: 40 }}>
            {[
              {
                n: "01",
                t: "Find your game",
                d: "Every game I shoot gets its own gallery, sorted by date. No password, no sign-up to browse.",
              },
              {
                n: "02",
                t: "Pick your shots",
                d: "Previews are watermarked. Add the ones you want to your cart — each photo is priced on the gallery.",
              },
              {
                n: "03",
                t: "Check out",
                d: "Place your order and I’ll send the clean, full-resolution files. No watermark, yours to print and post.",
              },
            ].map((step) => (
              <div key={step.n} className="panel">
                <p className="eyebrow">{step.n}</p>
                <h3>{step.t}</h3>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {step.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {ready && user && (
        <section className="signout-strip">
          <div className="wrap">
            <p className="muted small" style={{ margin: 0 }}>
              Signed in as <strong>{user.email || user.uid}</strong>
            </p>
            <button className="btn ghost small" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        </section>
      )}
    </>
  );
}
