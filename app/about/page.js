"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">About</p>
          <h1>
            I shoot the
            <br />
            games I love.
          </h1>
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <p className="lede" style={{ marginBottom: 28 }}>
            I’m Noah — I’m sixteen, I’m from Midland, Ontario, and I spend most
            of my weekends on the side of a rink or a field with a camera.
          </p>
          <p className="muted">
            I started shooting because the photos from our games were either
            blurry phone pictures or nothing at all. Nobody was capturing the
            saves, the celebrations, the last ten seconds. So I picked up a
            camera and started doing it myself.
          </p>
          <p className="muted">
            Now I shoot hockey, soccer, football and basketball across Simcoe
            County. Every game gets its own gallery here, usually within a few
            days. Players and families can look through the whole game, pick the
            frames they actually want, and get clean full-resolution files —
            good enough to print, post, or hang on the wall.
          </p>
          <p className="muted">
            If you want me at your game, or you’re looking for a shot from one I
            was already at, get in touch.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 32 }}>
            <a href="mailto:noah@homick.com" className="btn accent">
              Email me
            </a>
            <Link href="/galleries" className="btn ghost">
              Browse galleries
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
