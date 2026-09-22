"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
} from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/components/providers";
import { TagInput } from "@/components/taginput";
import {
  addPhoto,
  deletePhoto,
  getGallery,
  listPhotos,
  updateGallery,
  updatePhoto,
} from "@/lib/db";
import { buildPreview, readableSize } from "@/lib/images";
import { formatPrice, parsePriceToCents } from "@/lib/format";

// Keeps a filename safe to sit inside a Content-Disposition header: no quotes,
// no line breaks, plain ASCII. Anything else is replaced rather than dropped so
// the name stays recognizable.
function sanitizeFilename(name) {
  const clean = String(name || "")
    .replace(/[\r\n"\\]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .trim()
    .slice(0, 100);
  return clean || "photo.jpg";
}

export default function AdminGalleryPage() {
  const { id } = useParams();
  const { ready, isAdmin } = useAuth();

  const [gallery, setGallery] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [g, rows] = await Promise.all([getGallery(id), listPhotos(id)]);
      setGallery(g);
      setPhotos(rows);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  if (!ready)
    return (
      <Shell>
        <p className="muted">Checking access…</p>
      </Shell>
    );

  if (!isAdmin)
    return (
      <Shell>
        <div className="notice error">
          Admin access required. <Link href="/admin">Sign in</Link>.
        </div>
      </Shell>
    );

  if (loading)
    return (
      <Shell>
        <p className="muted">Loading…</p>
      </Shell>
    );

  if (!gallery)
    return (
      <Shell>
        <div className="notice error">Gallery not found.</div>
      </Shell>
    );

  // Galleries created before these fields existed default to the safe choice:
  // watermarked and downscaled.
  const watermark = gallery.watermark !== false;
  const lowRes = gallery.lowRes !== false;

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;

    setUploading(true);
    setError("");
    setQueue(
      files.map((f) => ({ name: f.name, size: f.size, pct: 0, done: false }))
    );

    let added = 0;
    let cover = gallery.coverUrl;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const uid = crypto.randomUUID();
        const originalRef = storageRef(storage, `originals/${id}/${uid}`);
        const previewRef = storageRef(storage, `previews/${id}/${uid}`);

        // Original first, with progress -- it is the big one.
        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(originalRef, file, {
            contentType: file.type,
            // Makes a buyer's download link save the file instead of opening
            // it in a browser tab. Storage serves back whatever disposition is
            // stored on the object, so this has to be set at upload time -- the
            // HTML download attribute is ignored for another origin.
            contentDisposition: `attachment; filename="${sanitizeFilename(
              file.name
            )}"`,
          });
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round(
                (snap.bytesTransferred / snap.totalBytes) * 90
              );
              setQueue((q) =>
                q.map((row, idx) => (idx === i ? { ...row, pct } : row))
              );
            },
            reject,
            resolve
          );
        });

        const { blob, width, height } = await buildPreview(file, {
          watermark,
          lowRes,
        });
        await uploadBytes(previewRef, blob, { contentType: "image/jpeg" });
        const previewUrl = await getDownloadURL(previewRef);

        await addPhoto(id, {
          filename: file.name,
          originalPath: originalRef.fullPath,
          previewPath: previewRef.fullPath,
          previewUrl,
          width,
          height,
          watermarked: watermark,
          lowRes,
          priceCents: gallery.defaultPriceCents ?? 0,
        });

        if (!cover) cover = previewUrl;
        added += 1;

        setQueue((q) =>
          q.map((row, idx) =>
            idx === i ? { ...row, pct: 100, done: true } : row
          )
        );
      } catch (e) {
        setError(`${file.name}: ${e.message}`);
        setQueue((q) =>
          q.map((row, idx) =>
            idx === i ? { ...row, pct: 100, failed: true } : row
          )
        );
      }
    }

    if (added > 0) {
      await updateGallery(id, {
        photoCount: (gallery.photoCount || 0) + added,
        ...(cover !== gallery.coverUrl ? { coverUrl: cover } : {}),
      });
    }

    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    await refresh();
  }

  async function changePrice(photo, value) {
    const cents = parsePriceToCents(value);
    if (cents === null) return;
    try {
      await updatePhoto(id, photo.id, { priceCents: cents });
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, priceCents: cents } : p))
      );
    } catch (e) {
      setError(e.message);
    }
  }

  async function removePhoto(photo) {
    if (!window.confirm(`Remove ${photo.filename || "this photo"}?`)) return;
    try {
      await deletePhoto(id, photo.id);
      await updateGallery(id, {
        photoCount: Math.max(0, (gallery.photoCount || 1) - 1),
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function makeCover(photo) {
    try {
      await updateGallery(id, { coverUrl: photo.previewUrl });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function applyPriceToAll() {
    const value = window.prompt(
      "Set every photo in this gallery to this price (CAD):",
      String((gallery.defaultPriceCents ?? 0) / 100)
    );
    if (value === null) return;
    const cents = parsePriceToCents(value);
    if (cents === null) return;
    try {
      await Promise.all(
        photos.map((p) => updatePhoto(id, p.id, { priceCents: cents }))
      );
      await updateGallery(id, { defaultPriceCents: cents });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function setFlag(patch) {
    try {
      await updateGallery(id, patch);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Shell>
      <div className="section-head">
        <div>
          <p className="eyebrow">
            {gallery.sport} — {gallery.published ? "Live" : "Draft"}
          </p>
          <h1>{gallery.title}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin" className="btn ghost small">
            Back
          </Link>
          {gallery.published && (
            <Link href={`/galleries/${gallery.slug}`} className="btn ghost small">
              View live
            </Link>
          )}
          <button
            className="btn small"
            onClick={() => setFlag({ published: !gallery.published })}
          >
            {gallery.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="admin-split">
        <GalleryDetails gallery={gallery} onSaved={refresh} onError={setError} />
        <CoverPanel gallery={gallery} onSaved={refresh} onError={setError} />
      </div>

      <div className="panel" style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 12 }}>Upload photos</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Originals are always stored privately. These two switches only change
          how the preview buyers see is generated, and they apply to photos
          uploaded from now on — existing previews keep the settings they were
          made with.
        </p>

        <div className="toggle-row">
          <Toggle
            label="Watermark previews"
            on={watermark}
            onChange={(next) => setFlag({ watermark: next })}
            onHint="Tiled mark plus corner credit"
            offHint="Clean, unmarked previews"
          />
          <Toggle
            label="Low-res previews"
            on={lowRes}
            onChange={(next) => setFlag({ lowRes: next })}
            onHint="Capped at 1600px"
            offHint="Up to 4000px — sharper, easier to copy"
          />
        </div>

        {!watermark && !lowRes && (
          <div className="notice" style={{ marginBottom: 16 }}>
            Both protections are off, so previews are near full quality. Fine
            for a free highlight gallery — risky for one you intend to sell.
          </div>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          disabled={uploading}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {queue.length > 0 && (
          <div style={{ marginTop: 20 }}>
            {queue.map((row, i) => (
              <div key={`${row.name}-${i}`}>
                <div className="upload-row">
                  <span>{row.name}</span>
                  <span className="muted small">
                    {row.failed
                      ? "Failed"
                      : row.done
                      ? "Done"
                      : readableSize(row.size)}
                  </span>
                </div>
                <div className="progress">
                  <span style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-head">
        <h3>{photos.length} photos</h3>
        {photos.length > 0 && (
          <button className="btn ghost small" onClick={applyPriceToAll}>
            Set all prices
          </button>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="empty-state">
          <p>No photos yet. Upload the game above.</p>
        </div>
      ) : (
        <div className="grid-3">
          {photos.map((photo) => (
            <div key={photo.id} className="panel" style={{ padding: 14 }}>
              <img
                src={photo.previewUrl}
                alt=""
                style={{
                  width: "100%",
                  aspectRatio: "3 / 2",
                  objectFit: "cover",
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              />
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Price (CAD)</label>
                <input
                  defaultValue={((photo.priceCents ?? 0) / 100).toFixed(2)}
                  onBlur={(e) => changePrice(photo, e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <p className="muted small" style={{ margin: "0 0 10px" }}>
                {formatPrice(photo.priceCents)} — {photo.width}×{photo.height}
                {photo.watermarked === false ? " — unmarked" : ""}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn ghost small"
                  onClick={() => makeCover(photo)}
                >
                  Use as cover
                </button>
                <button
                  className="btn ghost small"
                  onClick={() => removePhoto(photo)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="notice error" style={{ marginTop: 20 }}>
          {error}
        </div>
      )}
    </Shell>
  );
}

/* -------------------------------------------------------------- details -- */

function GalleryDetails({ gallery, onSaved, onError }) {
  const [title, setTitle] = useState(gallery.title || "");
  const [description, setDescription] = useState(gallery.description || "");
  const [venue, setVenue] = useState(gallery.venue || "");
  const [tags, setTags] = useState(gallery.tags || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateGallery(gallery.id, {
        title: title.trim(),
        description: description.trim(),
        venue: venue.trim(),
        tags,
      });
      setSaved(true);
      await onSaved();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={save}>
      <h3 style={{ marginBottom: 16 }}>Details</h3>

      <div className="field">
        <label htmlFor="g-title">Title</label>
        <input
          id="g-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaved(false);
          }}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="g-venue">Venue</label>
        <input
          id="g-venue"
          value={venue}
          onChange={(e) => {
            setVenue(e.target.value);
            setSaved(false);
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="g-tags">Teams</label>
        <TagInput
          id="g-tags"
          tags={tags}
          onChange={(next) => {
            setTags(next);
            setSaved(false);
          }}
        />
        <span className="muted small">
          Buyers filter the gallery list by these.
        </span>
      </div>

      <div className="field">
        <label htmlFor="g-desc">Description</label>
        <textarea
          id="g-desc"
          rows={4}
          maxLength={600}
          placeholder="Third period was end to end. Full game below, plus warmups."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setSaved(false);
          }}
        />
        <span className="muted small">
          {description.length}/600 — shown at the top of the gallery.
        </span>
      </div>

      <button className="btn accent" disabled={saving}>
        {saving ? "Saving…" : saved ? "Saved" : "Save details"}
      </button>
    </form>
  );
}

/* ---------------------------------------------------------------- cover -- */

function CoverPanel({ gallery, onSaved, onError }) {
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      // Covers are decoration, not stock: never watermarked, always full
      // quality so the gallery card looks sharp.
      const { blob } = await buildPreview(file, {
        watermark: false,
        lowRes: false,
      });
      const ref = storageRef(storage, `covers/${gallery.id}`);
      await uploadBytes(ref, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(ref);
      await updateGallery(gallery.id, { coverUrl: url });
      await onSaved();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function clearCover() {
    try {
      await updateGallery(gallery.id, { coverUrl: "" });
      await onSaved();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div className="panel">
      <h3 style={{ marginBottom: 16 }}>Cover photo</h3>

      {gallery.coverUrl ? (
        <img
          src={gallery.coverUrl}
          alt="Gallery cover"
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            objectFit: "cover",
            borderRadius: 10,
            marginBottom: 14,
          }}
        />
      ) : (
        <div
          className="gallery-cover-empty"
          style={{ borderRadius: 10, marginBottom: 14 }}
        >
          No cover yet
        </div>
      )}

      <p className="muted small" style={{ marginTop: 0 }}>
        Upload a dedicated cover, or pick one from the photos below with “Use as
        cover”. Covers are never watermarked.
      </p>

      <input
        ref={input}
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={upload}
      />

      {busy && <p className="muted small">Uploading cover…</p>}

      {gallery.coverUrl && (
        <button
          className="btn ghost small"
          style={{ marginTop: 12 }}
          onClick={clearCover}
        >
          Remove cover
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- pieces -- */

function Toggle({ label, on, onChange, onHint, offHint }) {
  return (
    <button
      type="button"
      className={`toggle ${on ? "is-on" : ""}`}
      onClick={() => onChange(!on)}
      aria-pressed={on}
    >
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        <span className="muted small">{on ? onHint : offHint}</span>
      </span>
    </button>
  );
}

function Shell({ children }) {
  return (
    <section className="section">
      <div className="wrap">{children}</div>
    </section>
  );
}
