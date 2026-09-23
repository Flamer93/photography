"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
} from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/components/providers";
import { TagInput } from "@/components/taginput";
import { JerseyInput } from "@/components/jerseyinput";
import {
  addPhoto,
  deletePhoto,
  deletePhotos,
  getGallery,
  listPhotos,
  updateGallery,
  updatePhoto,
} from "@/lib/db";
import { buildPreview, readableSize } from "@/lib/images";
import { formatPrice, parsePriceToCents } from "@/lib/format";
import { normalizePlayers } from "@/lib/jersey";
import { useJerseyRun } from "@/components/jerseyrun";

// A few at a time: one request per file is slow enough on a 300-photo game to
// look hung, and all of them at once makes the browser queue them anyway.
const DELETE_CONCURRENCY = 6;

// Removes the image files behind a set of photos. Missing paths are skipped --
// anything uploaded before originalPath/previewPath existed simply has none --
// and a file that is already gone is not an error, because the point is that
// it should not be there.
async function deleteStoredFiles(rows, onProgress) {
  const paths = [];
  for (const photo of rows) {
    if (photo.originalPath) paths.push(photo.originalPath);
    if (photo.previewPath) paths.push(photo.previewPath);
  }

  let done = 0;
  for (let i = 0; i < paths.length; i += DELETE_CONCURRENCY) {
    await Promise.all(
      paths.slice(i, i + DELETE_CONCURRENCY).map(async (path) => {
        try {
          await deleteObject(storageRef(storage, path));
        } catch (err) {
          if (err?.code !== "storage/object-not-found") throw err;
        }
      })
    );
    done = Math.min(paths.length, i + DELETE_CONCURRENCY);
    // Reported against photos rather than files so the number on screen
    // matches the number the admin was asked to confirm.
    onProgress?.(Math.round((done / paths.length) * rows.length));
  }
}

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
  const [wiping, setWiping] = useState({ running: false, done: 0, total: 0 });
  const fileInput = useRef(null);

  const {
    state: ai,
    error: aiError,
    run: runAi,
    stop: stopAi,
    clearError: clearAiError,
  } = useJerseyRun();

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

  async function savePlayers(photo, next, source = "manual") {
    const players = normalizePlayers(next);
    // Optimistic: the chip is already on screen, and a failed write surfaces
    // in the error strip rather than silently reverting under the cursor.
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photo.id ? { ...p, players, playersSource: source } : p
      )
    );
    try {
      await updatePhoto(id, photo.id, { players, playersSource: source });
    } catch (e) {
      setError(e.message);
    }
  }

  // `scope` is "missing" (only photos with nothing on them yet) or "all"
  // (re-read everything, overwriting what is there). Manual entries are
  // preserved by "missing", which is why it is the default button.
  async function runDetection(scope) {
    const targets =
      scope === "all"
        ? photos
        : photos.filter((p) => (p.players || []).length === 0);

    if (targets.length === 0) return;

    if (
      scope === "all" &&
      !window.confirm(
        `Re-read all ${targets.length} photos? Anything you typed by hand gets overwritten.`
      )
    ) {
      return;
    }

    const { done, failed } = await runAi(targets, {
      onPhoto: (photo, players) => savePlayers(photo, players, "ai"),
    });

    if (done > failed) {
      await updateGallery(id, { jerseysTaggedAt: new Date() });
    }
  }

  async function clearAllPlayers() {
    const tagged = photos.filter((p) => (p.players || []).length > 0);
    if (tagged.length === 0) return;
    if (!window.confirm(`Clear jerseys from ${tagged.length} photos?`)) return;
    try {
      await Promise.all(
        tagged.map((p) =>
          updatePhoto(id, p.id, { players: [], playersSource: "manual" })
        )
      );
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removePhoto(photo) {
    if (!window.confirm(`Remove ${photo.filename || "this photo"}?`)) return;
    try {
      await deleteStoredFiles([photo]);
      await deletePhoto(id, photo.id);
      await updateGallery(id, {
        photoCount: Math.max(0, (gallery.photoCount || 1) - 1),
        // The cover breaks if it was pointing at the preview just deleted.
        ...(gallery.coverUrl && gallery.coverUrl === photo.previewUrl
          ? { coverUrl: "" }
          : {}),
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  // Empties a whole gallery: the image files as well as the records. Asking
  // for a typed word rather than an OK click is deliberate -- this throws away
  // the full-resolution originals of an entire game, and the only way back is
  // re-uploading them from the camera.
  async function deleteAllPhotos() {
    const count = photos.length;
    if (count === 0) return;

    const typed = window.prompt(
      `Delete all ${count} photo${count === 1 ? "" : "s"} from "${
        gallery.title
      }"?\n\n` +
        "This removes the previews AND the full-resolution originals from " +
        "storage. It cannot be undone.\n\n" +
        "Type DELETE to confirm:"
    );
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== "DELETE") {
      setError("Not deleted — you need to type DELETE exactly.");
      return;
    }

    setWiping({ running: true, done: 0, total: count });
    setError("");

    try {
      await deleteStoredFiles(photos, (done) =>
        setWiping({ running: true, done, total: count })
      );
      await deletePhotos(
        id,
        photos.map((p) => p.id)
      );

      const coverWasAPhoto = photos.some((p) => p.previewUrl === gallery.coverUrl);
      await updateGallery(id, {
        photoCount: 0,
        jerseysTaggedAt: null,
        ...(coverWasAPhoto ? { coverUrl: "" } : {}),
      });

      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setWiping({ running: false, done: 0, total: 0 });
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

      {photos.length > 0 && (
        <JerseyPanel
          photos={photos}
          ai={ai}
          error={aiError}
          onRun={runDetection}
          onStop={stopAi}
          onClear={clearAllPlayers}
          onDismissError={clearAiError}
        />
      )}

      <div className="section-head">
        <h3>{photos.length} photos</h3>
        {photos.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn ghost small"
              onClick={applyPriceToAll}
              disabled={wiping.running}
            >
              Set all prices
            </button>
            <button
              className="btn ghost small danger"
              onClick={deleteAllPhotos}
              disabled={wiping.running || uploading || ai.running}
            >
              {wiping.running
                ? `Deleting ${wiping.done}/${wiping.total}…`
                : "Delete all photos"}
            </button>
          </div>
        )}
      </div>

      {wiping.running && (
        <div className="progress" style={{ marginBottom: 20 }}>
          <span
            style={{
              width: `${
                wiping.total ? (wiping.done / wiping.total) * 100 : 0
              }%`,
            }}
          />
        </div>
      )}

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
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Jerseys in this photo</label>
                <JerseyInput
                  players={photo.players || []}
                  onChange={(next) => savePlayers(photo, next)}
                  disabled={ai.running}
                />
                <span className="muted small">
                  {(photo.players || []).length === 0
                    ? "Type “12 white”, then Enter. One per player."
                    : photo.playersSource === "ai"
                    ? "Read by AI — check it before publishing."
                    : "Buyers filter by these."}
                </span>
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

/* -------------------------------------------------------------- jerseys -- */

function JerseyPanel({
  photos,
  ai,
  error,
  onRun,
  onStop,
  onClear,
  onDismissError,
}) {
  const tagged = photos.filter((p) => (p.players || []).length > 0).length;
  const missing = photos.length - tagged;
  const pct = ai.total ? Math.round((ai.done / ai.total) * 100) : 0;

  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <h3 style={{ marginBottom: 12 }}>Jerseys</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        Tag each photo with the numbers and colours you can see in it, and
        buyers can filter this gallery down to their own kid instead of
        scrolling the whole game. Type them in under each photo, or let the AI
        take a first pass and correct what it gets wrong.
      </p>

      <p className="muted small">
        <strong>{tagged}</strong> of {photos.length} photos tagged
        {missing > 0 ? ` — ${missing} still empty` : " — all done"}
      </p>

      {ai.running ? (
        <>
          <div className="progress" style={{ margin: "12px 0 10px" }}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="muted small">
              Reading photo {Math.min(ai.done + 1, ai.total)} of {ai.total}
              {ai.failed > 0 ? ` — ${ai.failed} failed` : ""}
            </span>
            <button className="btn ghost small" onClick={onStop}>
              Stop
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button
            className="btn accent small"
            onClick={() => onRun("missing")}
            disabled={missing === 0}
          >
            {missing > 0
              ? `Detect jerseys with AI (${missing})`
              : "Detect jerseys with AI"}
          </button>
          <button className="btn ghost small" onClick={() => onRun("all")}>
            Re-read all {photos.length}
          </button>
          {tagged > 0 && (
            <button className="btn ghost small" onClick={onClear}>
              Clear all
            </button>
          )}
        </div>
      )}

      {ai.total > 0 && !ai.running && !error && (
        <p className="muted small" style={{ marginBottom: 0 }}>
          Read {ai.done} photo{ai.done === 1 ? "" : "s"}. Worth a skim before
          you publish — a wrong number sends a parent to the wrong photos.
        </p>
      )}

      {error && (
        <div className="notice error" style={{ marginTop: 14 }}>
          {error}
          <button
            className="btn ghost small"
            style={{ marginLeft: 12 }}
            onClick={onDismissError}
          >
            Dismiss
          </button>
        </div>
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
