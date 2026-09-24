"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SEEN_KEY = "hf-save-help-seen";

// Shown once, the first time someone opens a delivery link on an iPhone.
//
// It only exists because the answer is a gesture rather than a button, and a
// gesture nobody thinks to try on a web page. Once per device, not once per
// order: a parent buying a second game already knows, and being told twice is
// how a helpful thing turns into an annoying one. The steps stay on the page
// underneath either way, so dismissing it loses nothing.
export function SaveHelp({ onIOS, ready }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Private windows throw. Worst case it shows again next visit, which
      // beats crashing the page someone just paid for.
    }
  }, []);

  useEffect(() => {
    if (!ready || !onIOS) return;

    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Unreadable storage is treated as seen, so a blocked-storage visitor
      // is not shown this on every photo they open.
      seen = true;
    }
    if (seen) return;

    // A beat after the photos appear, so it reads as help with what is on
    // screen rather than a wall in front of it.
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [ready, onIOS]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div className="welcome-backdrop" onClick={dismiss}>
      <div
        className="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="savehelp-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="welcome-close"
          onClick={dismiss}
          aria-label="Close"
          type="button"
        >
          ×
        </button>

        <p className="eyebrow">Your photos</p>
        <h3 id="savehelp-title" style={{ marginBottom: 10 }}>
          Saving to your camera roll
        </h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          On an iPhone there is no download button for this — saving a photo to
          your camera roll is a press and hold.
        </p>

        <ol className="save-steps" style={{ margin: "16px 0 20px" }}>
          <li>Tap a photo to open it full size.</li>
          <li>
            Press and hold it, then choose <strong>Add to Photos</strong>.
          </li>
          <li>That is it — it is in your camera roll.</li>
        </ol>

        <button
          className="btn accent"
          style={{ width: "100%" }}
          onClick={dismiss}
          type="button"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
