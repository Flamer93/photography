"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useCart } from "@/components/providers";
import { SignIn } from "@/components/signin";
import { createOrder } from "@/lib/db";
import { formatPrice } from "@/lib/format";

const ETRANSFER_EMAIL = "noah@homick.com";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotalCents, clear, hydrated } = useCart();
  const { user, ready } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("etransfer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);

  useEffect(() => {
    if (user?.displayName && !name) setName(user.displayName);
  }, [user, name]);

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
        paymentMethod: method,
        items: items.map((i) => ({
          photoId: i.photoId,
          galleryId: i.galleryId,
          galleryTitle: i.galleryTitle,
          previewUrl: i.previewUrl,
          priceCents: i.priceCents,
          filename: i.filename || "",
          originalPath: i.originalPath || "",
        })),
        subtotalCents,
      });
      const summary = { id: ref.id, total: subtotalCents, count: items.length };
      clear();
      setPlaced(summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------- placed -- */

  if (placed) {
    return (
      <section className="section">
        <div className="wrap" style={{ maxWidth: 680 }}>
          <p className="eyebrow">Order placed</p>
          <h1 style={{ marginBottom: 20 }}>Thanks.</h1>

          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="receipt-row">
              <span className="muted">Order reference</span>
              <strong>{placed.id.slice(0, 8).toUpperCase()}</strong>
            </div>
            <div className="receipt-row">
              <span className="muted">Photos</span>
              <strong>{placed.count}</strong>
            </div>
            <div className="receipt-row">
              <span className="muted">Amount due</span>
              <strong>{formatPrice(placed.total)}</strong>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 24 }}>
            <p className="eyebrow">How to pay</p>
            <p className="muted" style={{ marginTop: 0 }}>
              Send an Interac e-Transfer to{" "}
              <strong style={{ color: "var(--text)" }}>{ETRANSFER_EMAIL}</strong>{" "}
              for {formatPrice(placed.total)}, and put your order reference{" "}
              <strong style={{ color: "var(--text)" }}>
                {placed.id.slice(0, 8).toUpperCase()}
              </strong>{" "}
              in the message box.
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Once it lands I will send your full-resolution files — no
              watermark, yours to print and post.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/galleries" className="btn accent">
              Back to galleries
            </Link>
            <Link href="/contact" className="btn ghost">
              Question about this order
            </Link>
          </div>
        </div>
      </section>
    );
  }

  /* -------------------------------------------------------------- gates -- */

  if (!hydrated || !ready) {
    return (
      <section className="section">
        <div className="wrap">
          <p className="muted">Loading checkout…</p>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="section">
        <div className="wrap empty-state">
          <h2>Nothing to check out</h2>
          <p>Your cart is empty.</p>
          <Link href="/galleries" className="btn accent">
            Browse galleries
          </Link>
        </div>
      </section>
    );
  }

  /* ----------------------------------------------------------- checkout -- */

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">Checkout</p>
          <h1>Almost yours.</h1>
        </div>
      </section>

      <section className="section">
        <div className="wrap checkout-layout">
          <div>
            {/* 1 --------------------------------------------------------- */}
            <section className="checkout-step">
              <div className="step-head">
                <span className="step-num">1</span>
                <h3>Your details</h3>
              </div>

              {!user ? (
                <SignIn
                  heading="Sign in to continue"
                  blurb="So the order is tied to you and I know where to send the files."
                />
              ) : (
                <div className="panel">
                  <div className="field">
                    <label htmlFor="co-name">Name</label>
                    <input
                      id="co-name"
                      value={name}
                      maxLength={80}
                      onChange={(e) => setName(e.target.value)}
                      form="checkout-form"
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="co-email">Email (files go here)</label>
                    <input id="co-email" value={user.email || ""} disabled />
                  </div>
                  <div className="field">
                    <label htmlFor="co-phone">Phone (optional)</label>
                    <input
                      id="co-phone"
                      value={phone}
                      maxLength={40}
                      onChange={(e) => setPhone(e.target.value)}
                      form="checkout-form"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="co-note">Note (optional)</label>
                    <textarea
                      id="co-note"
                      rows={2}
                      maxLength={400}
                      placeholder="Anything I should know?"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      form="checkout-form"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* 2 --------------------------------------------------------- */}
            <section className="checkout-step">
              <div className="step-head">
                <span className="step-num">2</span>
                <h3>Delivery</h3>
              </div>
              <div className="panel delivery-panel">
                <span className="offer-check" aria-hidden="true" />
                <div>
                  <strong>Digital download</strong>
                  <p className="muted small" style={{ margin: "4px 0 0" }}>
                    Full resolution, no watermark. Sent to{" "}
                    {user?.email || "your email"} once payment clears. Nothing
                    ships, nothing to collect.
                  </p>
                </div>
              </div>
            </section>

            {/* 3 --------------------------------------------------------- */}
            <section className="checkout-step">
              <div className="step-head">
                <span className="step-num">3</span>
                <h3>Payment</h3>
              </div>

              <div className="pay-methods">
                <label
                  className={`pay-method ${
                    method === "etransfer" ? "is-on" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    value="etransfer"
                    checked={method === "etransfer"}
                    onChange={() => setMethod("etransfer")}
                  />
                  <span>
                    <strong>Interac e-Transfer</strong>
                    <span className="muted small">
                      Pay from your banking app. No fees. Instructions after you
                      place the order.
                    </span>
                  </span>
                </label>

                <label className="pay-method is-disabled">
                  <input type="radio" name="method" value="card" disabled />
                  <span>
                    <strong>
                      Credit or debit card
                      <span className="soon-badge">Coming soon</span>
                    </strong>
                    <span className="muted small">
                      Card payments are not switched on yet.
                    </span>
                  </span>
                </label>
              </div>

              {/* Shown so the finished flow is visible. Inputs are disabled on
                  purpose: with no processor behind them, a real card number
                  typed here would have nowhere safe to go. Stripe Elements
                  drops into this panel when cards go live. */}
              <div className="card-panel" aria-hidden="true">
                <div className="card-panel-lock">
                  <span className="soon-badge">Not accepting cards yet</span>
                </div>

                <div className="field">
                  <label>Card number</label>
                  <input value="4242 4242 4242 4242" disabled />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Expiry</label>
                    <input value="12 / 29" disabled />
                  </div>
                  <div className="field">
                    <label>CVC</label>
                    <input value="123" disabled />
                  </div>
                  <div className="field">
                    <label>Postal code</label>
                    <input value="L4R 0A1" disabled />
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Name on card</label>
                  <input value="A. Parent" disabled />
                </div>
              </div>
            </section>
          </div>

          {/* summary --------------------------------------------------- */}
          <aside className="order-summary">
            <div className="panel">
              <h3 style={{ marginBottom: 16 }}>Order summary</h3>

              <div className="summary-items">
                {items.map((item) => (
                  <div key={item.photoId} className="summary-item">
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt="" />
                    ) : (
                      <div className="summary-thumb-empty" />
                    )}
                    <span className="muted small">{item.galleryTitle}</span>
                    <span>{formatPrice(item.priceCents)}</span>
                  </div>
                ))}
              </div>

              <div className="receipt-row">
                <span className="muted">
                  Subtotal ({items.length} {items.length === 1 ? "photo" : "photos"})
                </span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
              <div className="receipt-row">
                <span className="muted">Delivery</span>
                <span>Free</span>
              </div>
              <div className="receipt-row">
                <span className="muted">Tax</span>
                <span>None</span>
              </div>
              <div className="receipt-row is-total">
                <span>Total</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>

              <form id="checkout-form" onSubmit={submit}>
                <button
                  className="btn accent"
                  style={{ width: "100%", marginTop: 8 }}
                  disabled={busy || !user}
                >
                  {busy
                    ? "Placing order…"
                    : `Place order — ${formatPrice(subtotalCents)}`}
                </button>
              </form>

              {!user && (
                <p className="muted small" style={{ marginBottom: 0 }}>
                  Sign in above to finish.
                </p>
              )}

              <p className="muted small" style={{ marginBottom: 0 }}>
                You are not charged here. Placing the order reserves your photos
                and sends you payment instructions.
              </p>

              {error && (
                <div className="notice error" style={{ marginTop: 14 }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                className="btn ghost small"
                style={{ width: "100%", marginTop: 12 }}
                onClick={() => router.push("/cart")}
              >
                Back to cart
              </button>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
