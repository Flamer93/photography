"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getDeliveryGallery } from "@/lib/db";

// Downloads are staggered so the browser treats them as a queue rather than a
// burst. Most browsers still ask permission before saving several files at
// once -- that prompt is expected, not a failure.
const STAGGER_MS = 500;

export default function DownloadPage() {
  const { orderId } = useParams();
  const [gallery, setGallery] = useState(null);
  const [state, setState] = useState("loading");
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDeliveryGallery(orderId)
      .then((row) => {
        if (cancelled) return;
        setGallery(row);
        setState(row ? "ready" : "missing");
      })
      .catch((e) => {
        console.error("Could not load the download gallery:", e.message);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  function saveOne(item) {
    // The originals are stored with a content-disposition of attachment, so
    // the browser saves the file rather than opening it in a tab. That is set
    // server-side at upload, which is why this works cross-origin -- the HTML
    // download attribute alone would be ignored for another domain.
    const a = document.createElement("a");
    a.href = item.url;
    a.rel = "noreferrer";
    if (item.filename) a.download = item.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function saveAll() {
    setDownloadingAll(true);
    try {
      for (const item of gallery.items) {
        saveOne(item);
        await new Promise((r) => setTimeout(r, STAGGER_MS));
      }
    } finally {
      setDownloadingAll(false);
    }
  }

  if (state === "loading") {
    return (
      <section className="section">
        <div className="wrap">
          <p className="muted">Loading your photos…</p>
        </div>
      </section>
    );
  }

  if (state === "missing") {
    return (
      <section className="section">
        <div className="wrap empty-state">
          <h2>Nothing here</h2>
          <p>
            This download link is not valid. If your order was only a few
            photos, the email has a direct link for each one instead.
          </p>
          <Link href="/contact" className="btn accent">
            Get in touch
          </Link>
        </div>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="section">
        <div className="wrap notice error">
          Could not load your photos just now. Refresh to try again, or get in
          touch and I will send them over directly.
        </div>
      </section>
    );
  }

  const count = gallery.items?.length || 0;

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">
            Your photos
            {gallery.orderRef ? ` — order ${gallery.orderRef}` : ""}
          </p>
          <h1>
            {gallery.buyerName ? `Thanks, ${gallery.buyerName}.` : "Thank you."}
          </h1>
          <p className="lede">
            {count} {count === 1 ? "photo" : "photos"}, full resolution and
            without a watermark. Yours to keep, print and post.
          </p>
          <div className="row">
            <button
              className="btn accent"
              onClick={saveAll}
              disabled={downloadingAll}
            >
              {downloadingAll ? "Starting downloads…" : "Download all"}
            </button>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Your browser may ask permission to save several files at once — that
            is normal. You can also download them one at a time below.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="download-grid">
            {gallery.items.map((item, i) => (
              <div className="download-item" key={item.url || i}>
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt="" loading="lazy" />
                ) : (
                  <div className="gallery-cover-empty">Photo {i + 1}</div>
                )}
                <div className="download-item-body">
                  <span className="muted small">
                    {item.galleryTitle || `Photo ${i + 1}`}
                  </span>
                  <button
                    className="btn ghost small"
                    onClick={() => saveOne(item)}
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="muted small" style={{ marginTop: 28 }}>
            The thumbnails above are the watermarked previews — the files you
            download are the clean, full-resolution originals. Any trouble, just{" "}
            <Link href="/contact" style={{ color: "var(--accent)" }}>
              get in touch
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
