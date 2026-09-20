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

  if (!ready) return <Shell><p className="muted">Checking access…</p></Shell>;
  if (!isAdmin)
    return (
      <Shell>
        <div className="notice error">
          Admin access required. <Link href="/admin">Sign in</Link>.
        </div>
      </Shell>
    );
  if (loading) return <Shell><p className="muted">Loading…</p></Shell>;
  if (!gallery)
    return (
      <Shell>
        <div className="notice error">Gallery not found.</div>
      </Shell>
    );

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;

    setUploading(true);
    setError("");
    setQueue(files.map((f) => ({ name: f.name, size: f.size, pct: 0, done: false })));

    let added = 0;
    let cover = gallery.coverUrl;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const uid = crypto.randomUUID();
        const originalRef = storageRef(storage, `originals/${id}/${uid}`);
        const previewRef = storageRef(storage, `previews/${id}/${uid}`);

        // Original first, with progress -- it's the big one.
        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(originalRef, file, {
            contentType: file.type,
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

        const { blob, width, height } = await buildPreview(file);
        await uploadBytes(previewRef, blob, { contentType: "image/jpeg" });
        const previewUrl = await getDownloadURL(previewRef);

        await addPhoto(id, {
          filename: file.name,
          originalPath: originalRef.fullPath,
          previewPath: previewRef.fullPath,
          previewUrl,
          width,
          height,
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
            onClick={async () => {
              await updateGallery(id, { published: !gallery.published });
              await refresh();
            }}
          >
            {gallery.published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 12 }}>Upload photos</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Originals are stored privately. A watermarked preview is generated in
          your browser and is the only version buyers can see.
        </p>
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
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className="btn ghost small"
                  onClick={() => makeCover(photo)}
                >
                  Cover
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

function Shell({ children }) {
  return (
    <section className="section">
      <div className="wrap">{children}</div>
    </section>
  );
}
