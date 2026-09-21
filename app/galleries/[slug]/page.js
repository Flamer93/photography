"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getGalleryBySlug, listPhotos } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { useCart } from "@/components/providers";

export default function GalleryPage() {
  const { slug } = useParams();
  const [gallery, setGallery] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [state, setState] = useState("loading");
  const [activeIndex, setActiveIndex] = useState(null);

  const { add, remove, has, items } = useCart();

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

  const active = activeIndex === null ? null : photos[activeIndex];

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
          {photos.length === 0 ? (
            <div className="empty-state">
              <p>No photos in this gallery yet.</p>
            </div>
          ) : (
            <div className="masonry">
              {photos.map((photo, index) => {
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
                  setActiveIndex((i) => (i > 0 ? i - 1 : photos.length - 1))
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
                  setActiveIndex((i) => (i < photos.length - 1 ? i + 1 : 0))
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
