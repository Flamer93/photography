"use client";

import Link from "next/link";
import { useCart } from "@/components/providers";
import { formatPrice } from "@/lib/format";

export default function CartPage() {
  const { items, remove, clear, subtotalCents, hydrated } = useCart();

  if (!hydrated) {
    return (
      <section className="section">
        <div className="wrap">
          <p className="muted">Loading…</p>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="section">
        <div className="wrap empty-state">
          <h2>Your cart is empty</h2>
          <p>Find your game and pick the shots you want.</p>
          <Link href="/galleries" className="btn accent">
            Browse galleries
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

        <div className="cart-layout">
          <div>
            {items.map((item) => (
              <div key={item.photoId} className="cart-line">
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt="" />
                ) : (
                  <div className="summary-thumb-empty" />
                )}
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

            <button
              className="btn ghost small"
              style={{ marginTop: 20 }}
              onClick={() => {
                if (window.confirm("Remove everything from your cart?")) clear();
              }}
            >
              Empty cart
            </button>
          </div>

          <aside>
            <div className="panel">
              <h3 style={{ marginBottom: 16 }}>Summary</h3>

              <div className="receipt-row">
                <span className="muted">
                  {items.length} {items.length === 1 ? "photo" : "photos"}
                </span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>
              <div className="receipt-row">
                <span className="muted">Delivery</span>
                <span>Free</span>
              </div>
              <div className="receipt-row is-total">
                <span>Total</span>
                <span>{formatPrice(subtotalCents)}</span>
              </div>

              <Link
                href="/checkout"
                className="btn accent"
                style={{ width: "100%", marginTop: 8 }}
              >
                Continue to checkout
              </Link>

              <p className="muted small" style={{ marginBottom: 0 }}>
                Digital downloads — full resolution, no watermark.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
