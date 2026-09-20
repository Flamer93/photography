"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listPublishedGalleries } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";

export default function GalleriesPage() {
  const [galleries, setGalleries] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    listPublishedGalleries(100)
      .then((rows) => {
        setGalleries(rows);
        setState("ready");
      })
      .catch((e) => {
        console.error("listPublishedGalleries failed: " + e.message);
        setState("error");
      });
  }, []);

  return (
    <section className="section">
      <div className="wrap">
        <p className="eyebrow">Game galleries</p>
        <h1 style={{ marginBottom: 18 }}>Find your game</h1>
        <p className="lede" style={{ marginBottom: 48 }}>
          Galleries go up within a few days of each game. If yours isn’t here
          yet, it’s probably still being edited — check back soon.
        </p>

        {state === "loading" && <p className="muted">Loading…</p>}

        {state === "error" && (
          <div className="notice error">
            Couldn’t load galleries right now. Refresh to try again.
          </div>
        )}

        {state === "ready" && galleries.length === 0 && (
          <div className="empty-state">
            <p>No galleries published yet.</p>
          </div>
        )}

        <div className="grid-3">
          {galleries.map((g) => (
            <Link
              key={g.id}
              href={`/galleries/${g.slug}`}
              className="gallery-card"
            >
              {g.coverUrl ? (
                <img className="gallery-cover" src={g.coverUrl} alt={g.title} />
              ) : (
                <div className="gallery-cover-empty">No cover yet</div>
              )}
              <div className="gallery-body">
                <p className="eyebrow" style={{ marginBottom: 8 }}>
                  {g.sport}
                  {g.dateOf ? ` — ${formatDate(g.dateOf)}` : ""}
                </p>
                <h3>{g.title}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {g.photoCount || 0} photos
                  {g.defaultPriceCents
                    ? ` — from ${formatPrice(g.defaultPriceCents)}`
                    : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
