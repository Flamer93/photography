"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listPublishedGalleries } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";

export default function GalleriesPage() {
  const [galleries, setGalleries] = useState([]);
  const [state, setState] = useState("loading");
  const [active, setActive] = useState([]);
  const [search, setSearch] = useState("");

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

  // The filter list is built from the tags that actually exist on published
  // galleries, so it never offers a team with nothing behind it.
  const allTags = useMemo(() => {
    const counts = new Map();
    galleries.forEach((g) =>
      (g.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1))
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [galleries]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return galleries.filter((g) => {
      // Multiple tags read as OR: picking two teams shows both their games.
      const tagOk =
        active.length === 0 ||
        (g.tags || []).some((t) => active.includes(t));
      if (!tagOk) return false;
      if (!term) return true;
      return [g.title, g.venue, g.sport, g.description, ...(g.tags || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [galleries, active, search]);

  function toggleTag(tag) {
    setActive((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <section className="section">
      <div className="wrap">
        <p className="eyebrow">Game galleries</p>
        <h1 style={{ marginBottom: 18 }}>Find your game</h1>
        <p className="lede" style={{ marginBottom: 36 }}>
          Galleries go up within a few days of each game. Filter by your team,
          or search for a venue or opponent.
        </p>

        {state === "ready" && galleries.length > 0 && (
          <div className="filter-bar">
            <input
              type="search"
              className="filter-search"
              placeholder="Search team, venue or opponent…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search galleries"
            />

            {allTags.length > 0 && (
              <div className="filter-tags">
                <button
                  className={`filter-chip ${active.length === 0 ? "is-on" : ""}`}
                  onClick={() => setActive([])}
                >
                  All teams
                </button>
                {allTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    className={`filter-chip ${
                      active.includes(tag) ? "is-on" : ""
                    }`}
                    onClick={() => toggleTag(tag)}
                    aria-pressed={active.includes(tag)}
                  >
                    {tag}
                    <span className="filter-count">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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

        {state === "ready" && galleries.length > 0 && visible.length === 0 && (
          <div className="empty-state">
            <p>Nothing matches that filter.</p>
            <button
              className="btn ghost small"
              onClick={() => {
                setActive([]);
                setSearch("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        <div className="grid-3">
          {visible.map((g) => (
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
                {g.description && (
                  <p className="muted small card-desc">{g.description}</p>
                )}
                {(g.tags || []).length > 0 && (
                  <span className="tag-list">
                    {g.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </span>
                )}
                <p className="muted small" style={{ margin: "10px 0 0" }}>
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
