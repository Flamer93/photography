"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth, useCart } from "@/components/providers";
import { SignIn } from "@/components/signin";
import { createOrder } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export default function CartPage() {
  const { items, remove, clear, subtotalCents, hydrated } = useCart();
  const { user, ready } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ref = await createOrder({
        buyerUid: user.uid,
        buyerEmail: user.email || "",
        buyerName: name.trim(),
        buyerPhone: phone.trim(),
        note: note.trim(),
        items: items.map((i) => ({
          photoId: i.photoId,
          galleryId: i.galleryId,
          galleryTitle: i.galleryTitle,
          previewUrl: i.previewUrl,
          priceCents: i.priceCents,
        })),
        subtotalCents,
      });
      clear();
      setPlaced(ref.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (placed) {
    return (
      <section className="section">
        <div className="wrap" style={{ maxWidth: 620 }}>
          <p className="eyebrow">Order placed</p>
          <h1 style={{ marginBottom: 20 }}>Thanks.</h1>
          <p className="lede">
            Your order reference is <strong>{placed.slice(0, 8)}</strong>. I’ll
            be in touch by email to arrange payment and send your
            full-resolution files.
          </p>
          <Link href="/galleries" className="btn accent">
            Back to galleries
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="wrap">
        <p className="eyebrow">Your selection</p>
        <h1 style={{ marginBottom: 40 }}>Cart</h1>

        {!hydrated ? (
          <p className="muted">Loading…</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p>Nothing in your cart yet.</p>
            <Link href="/galleries" className="btn ghost small">
              Browse galleries
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
              gap: 48,
              alignItems: "start",
            }}
            className="cart-layout"
          >
            <div>
              {items.map((item) => (
                <div key={item.photoId} className="cart-line">
                  <img src={item.previewUrl} alt="" />
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>
                      {item.galleryTitle}
                    </p>
                    <Link
                      href={`/galleries/${item.gallerySlug}`}
                      className="muted small"
                    >
                      View gallery
                    </Link>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p className="photo-price" style={{ margin: "0 0 6px" }}>
                      {formatPrice(item.priceCents)}
                    </p>
                    <button
                      className="btn ghost small"
                      onClick={() => remove(item.photoId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <div className="cart-total">
                <span>Subtotal</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
              <p className="muted small">
                Digital downloads — full resolution, no watermark. Taxes not
                applied.
              </p>
            </div>

            <div>
              {!ready ? (
                <p className="muted">Checking sign-in…</p>
              ) : !user ? (
                <SignIn
                  heading="Sign in to check out"
                  blurb="So I know who the order belongs to and where to send your files."
                />
              ) : (
                <form className="panel" onSubmit={submit}>
                  <h3 style={{ marginBottom: 16 }}>Your details</h3>
                  <div className="field">
                    <label htmlFor="name">Name</label>
                    <input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="phone">Phone (optional)</label>
                    <input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="note">Note (optional)</label>
                    <textarea
                      id="note"
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  <p className="muted small">
                    Signed in as {user.email || user.uid}
                  </p>

                  <button
                    className="btn accent"
                    style={{ width: "100%" }}
                    disabled={busy}
                  >
                    {busy ? "Placing order…" : "Place order"}
                  </button>

                  <p className="muted small" style={{ marginBottom: 0 }}>
                    Card payments aren’t live yet — I’ll email you to arrange
                    e-transfer and send your files.
                  </p>

                  {error && (
                    <div className="notice error" style={{ marginTop: 14 }}>
                      {error}
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
