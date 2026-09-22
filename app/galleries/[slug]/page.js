"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getGalleryBySlug, listPhotos } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { useCart } from "@/components/providers";
import {
  collectJerseyFacets,
  photoMatchesJersey,
  swatchFor,
} from "@/lib/jersey";

export default function GalleryPage() {
  const { slug } = useParams();
  const [gallery, setGallery] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [state, setState] = useState("loading");
  const [activeIndex, setActiveIndex] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [colors, setColors] = useState([]);

  const { add, remove, has, items } = useCart();

  // Only the numbers and colours actually present in this gallery are offered,
  // so a chip never leads to an empty grid.
  const facets = useMemo(() => collectJerseyFacets(photos), [photos]);

  const visible = useMemo(
    () => photos.filter((p) => photoMatchesJersey(p, numbers, colors)),
    [photos, numbers, colors]
  );

  const filtering = numbers.length > 0 || colors.length > 0;

  function toggleFacet(list, setList, value) {
    setActiveIndex(null);
    setList(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );
  }

  function clearFilters() {
    setActiveIndex(null);
    setNumbers([]);
    setColors([]);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const g = await getGalleryBySlug(slug);
        if (cancelled) return;
        if (!g) {
          setState("missing");
          return;
        }
        setGallery(g);
        const rows = await listPhotos(g.id);
        if (cancelled) return;
        setPhotos(rows);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const toggle = useCallback(
    (photo) => {
      if (has(photo.id)) {
        remove(photo.id);
        return;
      }
      add({
        photoId: photo.id,
        galleryId: gallery.id,
        gallerySlug: gallery.slug,
        galleryTitle: gallery.title,
        previewUrl: photo.previewUrl,
        priceCents: photo.priceCents ?? gallery.defaultPriceCents ?? 0,
        filename: photo.filename || "",
        // Carried through to the order so a paid order can be delivered
        // without a second Firestore read. Knowing this path grants nothing
        // by itself -- storage.rules still requires the admin UID to read it.
        originalPath: photo.originalPath || "",
      });
    },
    [add, remove, has, gallery]
  );

  if (state === "loading") {
    return (
      <section className="section">
        <div className="wrap">
          <p className="muted">Loading gallery…</p>
        </div>
      </section>
    );
  }

  if (state === "missing") {
    return (
      <section className="section">
        <div className="wrap empty-state">
          <h2>Gallery not found</h2>
          <p>That gallery may not be published yet.</p>
          <Link href="/galleries" className="btn ghost small">
            All galleries
          </Link>
        </div>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="section">
        <div className="wrap notice error">
          Couldn’t load this gallery. Refresh to try again.
        </div>
      </section>
    );
  }

  // The lightbox walks the filtered set, not the whole gallery -- filter to
  // #12 and Next should go to the next #12, not the next photo of the game.
  const active = activeIndex === null ? null : visible[activeIndex];

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">
            {gallery.sport}
            {gallery.dateOf ? ` — ${formatDate(gallery.dateOf)}` : ""}
          </p>
          <h1>{gallery.title}</h1>
          {gallery.description && (
            <p className="lede">{gallery.description}</p>
          )}
          <div className="hero-meta">
            {gallery.venue && <span>{gallery.venue}</span>}
            <span>{photos.length} photos</span>
            {gallery.defaultPriceCents ? (
              <span>{formatPrice(gallery.defaultPriceCents)} each</span>
            ) : null}
          </div>
          {(gallery.tags || []).length > 0 && (
            <span className="tag-list">
              {gallery.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </span>
          )}
          {items.length > 0 && (
            <div>
              <Link href="/cart" className="btn accent">
                View cart ({items.length})
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          {(facets.numbers.length > 0 || facets.colors.length > 0) && (
            <div className="filter-bar jersey-filter">
              <p className="eyebrow" style={{ marginBottom: 10 }}>
                Find your player
              </p>

              {facets.colors.length > 0 && (
                <div className="filter-tags" style={{ marginBottom: 10 }}>
                  {facets.colors.map(({ value, count }) => (
                    <button
                      key={value}
                      className={`filter-chip ${
                        colors.includes(value) ? "is-on" : ""
                      }`}
                      onClick={() => toggleFacet(colors, setColors, value)}
                      aria-pressed={colors.includes(value)}
                    >
                      <span
                        className="jersey-dot"
                        style={{ background: swatchFor(value) }}
                        aria-hidden="true"
                      />
                      {value}
                      <span className="filter-count">{count}</span>
                    </button>
                  ))}
                </div>
              )}

              {facets.numbers.length > 0 && (
                <div className="filter-tags">
                  {facets.numbers.map(({ value, count }) => (
                    <button
                      key={value}
                      className={`filter-chip jersey-number ${
                        numbers.includes(value) ? "is-on" : ""
                      }`}
                      onClick={() => toggleFacet(numbers, setNumbers, value)}
                      aria-pressed={numbers.includes(value)}
                      aria-label={`Jersey number ${value}`}
                    >
                      #{value}
                      <span className="filter-count">{count}</span>
                    </button>
                  ))}
                </div>
              )}

              {filtering && (
                <p className="muted small" style={{ margin: "12px 0 0" }}>
                  Showing {visible.length} of {photos.length} photos.{" "}
                  <button className="link-button" onClick={clearFilters}>
                    Clear
                  </button>
                </p>
              )}
            </div>
          )}

          {photos.length === 0 ? (
            <div className="empty-state">
              <p>No photos in this gallery yet.</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <p>No photos match that jersey.</p>
              <button className="btn ghost small" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="masonry">
              {visible.map((photo, index) => {
                const price =
                  photo.priceCents ?? gallery.defaultPriceCents ?? 0;
                const inCart = has(photo.id);
                return (
                  <div key={photo.id} className="photo-card">
                    <img
                      src={photo.previewUrl}
                      alt={`${gallery.title} — photo ${index + 1}`}
                      loading="lazy"
                      onClick={() => setActiveIndex(index)}
                    />
                    {(photo.players || []).length > 0 && (
                      <div className="jersey-badges">
                        {photo.players
                          .filter((p) => p.number)
                          .slice(0, 4)
                          .map((p, i) => (
                            <span
                              key={`${p.number}-${p.color}-${i}`}
                              className="jersey-badge"
                              title={p.color}
                            >
                              <span
                                className="jersey-dot"
                                style={{ background: swatchFor(p.color) }}
                                aria-hidden="true"
                              />
                              {p.number}
                            </span>
                          ))}
                      </div>
                    )}
                    <div className="photo-overlay">
                      <span className="photo-price">{formatPrice(price)}</span>
                      <button
                        className={`btn small ${inCart ? "in-cart" : "accent"}`}
                        onClick={() => toggle(photo)}
                      >
                        {inCart ? "In cart" : "Add"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {active && (
        <div className="lightbox" onClick={() => setActiveIndex(null)}>
          <button
            className="lightbox-close"
            aria-label="Close"
            onClick={() => setActiveIndex(null)}
          >
            ×
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            <img src={active.previewUrl} alt="" />
            <div className="lightbox-bar">
              <button
                className="btn ghost small"
                onClick={() =>
                  setActiveIndex((i) => (i > 0 ? i - 1 : visible.length - 1))
                }
              >
                Prev
              </button>
              <span className="photo-price">
                {formatPrice(
                  active.priceCents ?? gallery.defaultPriceCents ?? 0
                )}
              </span>
              <button
                className={`btn small ${has(active.id) ? "ghost" : "accent"}`}
                onClick={() => toggle(active)}
              >
                {has(active.id) ? "Remove" : "Add to cart"}
              </button>
              <button
                className="btn ghost small"
                onClick={() =>
                  setActiveIndex((i) => (i < visible.length - 1 ? i + 1 : 0))
                }
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
