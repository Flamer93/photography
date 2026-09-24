"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getDeliveryGallery } from "@/lib/db";
import { SaveHelp } from "@/components/savehelp";
import {
  MAX_SHARE_FILES,
  canShareFiles,
  isIOS,
  shareToPhotos,
} from "@/lib/saveimage";

// Downloads are staggered so the browser treats them as a queue rather than a
// burst. Most browsers still ask permission before saving several files at
// once -- that prompt is expected, not a failure.
const STAGGER_MS = 500;

export default function DownloadPage() {
  const { orderId } = useParams();
  const [gallery, setGallery] = useState(null);
  const [state, setState] = useState("loading");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [busyIndex, setBusyIndex] = useState(null);
  const [notice, setNotice] = useState("");

  // Resolved on mount, not at module load: this file is rendered on the
  // server too, where there is no navigator to ask.
  const [canShare, setCanShare] = useState(false);
  const [onIOS, setOnIOS] = useState(false);

  // The full-resolution original shown for long-pressing. Null when closed.
  const [pressItem, setPressItem] = useState(null);

  useEffect(() => {
    setCanShare(canShareFiles());
    setOnIOS(isIOS());
  }, []);

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

  // One photo, into Photos if the phone can do it. Falls back silently to a
  // download, because a failed share that leaves someone with nothing is a
  // worse outcome than a file in the wrong folder.
  async function savePhoto(item, index) {
    // No file sharing, but a touchscreen: that is Chrome on iOS, where a
    // download goes to Files and nothing a site does can redirect it. Show
    // the original instead and let iOS save it from a long press.
    if (!canShare) {
      if (onIOS) setPressItem(item);
      else saveOne(item);
      return;
    }
    setBusyIndex(index);
    setNotice("");
    try {
      const result = await shareToPhotos([item]);
      if (result === "shared") setNotice("Saved — check your Photos app.");
      if (result === "tap-again") {
        setNotice("Ready — tap Save to photos again and it will go straight through.");
      }
    } catch (err) {
      console.error("Share failed:", err);
      // On a phone a download is the wrong answer -- it lands in Files, which
      // is the thing the person was trying to avoid. Long press works there
      // whatever the browser.
      if (onIOS) {
        setPressItem(item);
      } else {
        saveOne(item);
        setNotice("Shared saving was not available, so it downloaded instead.");
      }
    } finally {
      setBusyIndex(null);
    }
  }

  async function saveAll() {
    setDownloadingAll(true);
    setNotice("");
    try {
      // iOS offers "Save N Images" for a multi-file share, which is one tap
      // for the whole order rather than one per photo. Capped because every
      // file is held in memory at once.
      if (canShare && gallery.items.length <= MAX_SHARE_FILES) {
        try {
          const result = await shareToPhotos(gallery.items);
          if (result === "shared") setNotice("Saved — check your Photos app.");
          if (result === "tap-again") {
            setNotice(
              "Photos ready — tap Save all to photos again and they will go straight through."
            );
          }
          return;
        } catch (err) {
          console.error("Share failed, downloading instead:", err);
          setNotice("Shared saving was not available, so they downloaded instead.");
        }
      }

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
          {/* On a phone there is deliberately no button here. A download goes
              to Files, which is not where anyone wants their photos, and
              there is no bulk equivalent of a long press -- so offering one
              would only be offering the wrong thing loudly. */}
          {!onIOS && (
            <>
              <div className="row">
                <button
                  className="btn accent"
                  onClick={saveAll}
                  disabled={downloadingAll}
                >
                  {downloadingAll ? "Saving…" : "Download all"}
                </button>
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                Your browser may ask permission to save several files at once —
                that is normal. You can also download them one at a time below.
              </p>
            </>
          )}

          {onIOS && (
            <ol className="save-steps">
              <li>Tap a photo to open it full size.</li>
              <li>
                Press and hold it, then choose <strong>Add to Photos</strong>.
              </li>
              <li>It is now in your camera roll. Back out and do the next.</li>
            </ol>
          )}

          {notice && (
            <p className="muted small" style={{ margin: 0 }}>
              {notice}
            </p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="download-grid">
            {gallery.items.map((item, i) => (
              <div
                className={`download-item${onIOS ? " is-tappable" : ""}`}
                key={`${item.url}-${i}`}
                onClick={onIOS ? () => setPressItem(item) : undefined}
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt=""
                    loading="lazy"
                    style={onIOS ? { cursor: "zoom-in" } : undefined}
                    onClick={onIOS ? () => setPressItem(item) : undefined}
                  />
                ) : (
                  <div className="gallery-cover-empty">Photo {i + 1}</div>
                )}
                <div className="download-item-body">
                  <span className="muted small">
                    {onIOS
                      ? `Photo ${i + 1} — tap to save`
                      : item.galleryTitle || `Photo ${i + 1}`}
                  </span>
                  {!onIOS && (
                    <button
                      className="btn ghost small"
                      onClick={() => savePhoto(item, i)}
                      disabled={busyIndex === i}
                    >
                      {busyIndex === i
                        ? "Saving…"
                        : canShare
                        ? "Save to photos"
                        : "Download"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {onIOS && (
            <p className="muted small" style={{ marginTop: 28 }}>
              Prefer them on a computer instead? Open this same link there and
              you get a straight download.
            </p>
          )}

          <p className="muted small" style={{ marginTop: 28 }}>
            The thumbnails above are the watermarked previews — what you save
            is the clean, full-resolution original. Any trouble, just{" "}
            <Link href="/contact" style={{ color: "var(--accent)" }}>
              get in touch
            </Link>
            .
          </p>
        </div>
      </section>

      <SaveHelp onIOS={onIOS} ready={state === "ready"} />

      {pressItem && (
        <div className="lightbox" onClick={() => setPressItem(null)}>
          <button
            className="lightbox-close"
            aria-label="Close"
            onClick={() => setPressItem(null)}
          >
            ×
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            {/* The original, not the preview: a long press saves the bytes
                this img was loaded from, so showing the watermarked version
                here would put the watermarked version in their camera roll. */}
            <img src={pressItem.url} alt={pressItem.galleryTitle || "Your photo"} />
            <div className="lightbox-bar">
              <span className="muted small">
                Press and hold the photo, then <strong>Add to Photos</strong>.
              </span>
              <button
                className="btn ghost small"
                onClick={() => setPressItem(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
