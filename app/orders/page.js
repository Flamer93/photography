"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getDeliveryGallery, listOrdersForBuyer } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { useAuth } from "@/components/providers";
import { SignIn } from "@/components/signin";

// Orders are tied to the account that placed them, and the security rules
// only let someone read their own -- so this page shows whatever the signed-in
// account has, and signing in as someone else shows theirs.
//
// An order that was placed before signing in, or from a different account,
// will not appear here. That is worth saying out loud on the page rather than
// leaving someone to conclude their order vanished.

// Where an order actually is, in the buyer's terms rather than the database's.
function describe(order) {
  if (order.status === "paid" && order.filesSentAt) {
    return {
      label: "Sent",
      tone: "paid",
      detail: `Photos emailed on ${formatDate(order.filesSentAt)}.`,
    };
  }
  if (order.status === "paid") {
    return {
      label: "Paid",
      tone: "paid",
      detail: "Payment received — your photos are on their way.",
    };
  }
  return {
    label: "Waiting on payment",
    tone: "pending",
    detail:
      "Send the e-Transfer with your order reference and I’ll send the files once it lands.",
  };
}

export default function OrdersPage() {
  const { user, ready } = useAuth();
  const [orders, setOrders] = useState([]);
  const [downloads, setDownloads] = useState({});
  const [state, setState] = useState("loading");

  const load = useCallback(async () => {
    if (!user) return;
    setState("loading");
    try {
      const rows = await listOrdersForBuyer(user.uid);
      setOrders(rows);
      setState("ready");

      // Bigger orders get a download page. Small ones were emailed as direct
      // links and have none, so the link is only offered where one exists --
      // sending someone to a page that says "nothing here" is worse than not
      // offering it.
      const sent = rows.filter((o) => o.filesSentAt).slice(0, 20);
      const found = {};
      await Promise.all(
        sent.map(async (o) => {
          try {
            if (await getDeliveryGallery(o.id)) found[o.id] = true;
          } catch {
            // No download page for this one; the emailed links still work.
          }
        })
      );
      setDownloads(found);
    } catch (e) {
      console.error("Could not load orders:", e.message);
      setState("error");
    }
  }, [user]);

  useEffect(() => {
    if (ready && user) load();
    else if (ready && !user) setState("signed-out");
  }, [ready, user, load]);

  if (!ready || state === "loading") {
    return (
      <section className="section">
        <div className="wrap">
          <p className="muted">Loading your orders…</p>
        </div>
      </section>
    );
  }

  if (state === "signed-out") {
    return (
      <section className="section">
        <div className="wrap">
          <p className="eyebrow">Your orders</p>
          <h1 style={{ marginBottom: 32 }}>Sign in to see them</h1>
          <SignIn blurb="Your orders are tied to your account, so I need to know who you are." />
        </div>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="section">
        <div className="wrap notice error">
          Couldn’t load your orders just now. Refresh to try again, or{" "}
          <Link href="/contact">get in touch</Link> and I’ll look them up.
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">Your orders</p>
          <h1>
            What you
            <br />
            have bought.
          </h1>
          <p className="lede">
            Every order on this account, and where each one has got to.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          {orders.length === 0 ? (
            <div className="empty-state">
              <p>No orders on this account yet.</p>
              <p className="muted small">
                Ordered without signing in, or with a different email? It will
                be sitting under that account instead —{" "}
                <Link href="/contact" style={{ color: "var(--accent)" }}>
                  tell me
                </Link>{" "}
                and I’ll find it.
              </p>
              <Link href="/galleries" className="btn accent">
                Browse galleries
              </Link>
            </div>
          ) : (
            <div className="order-list">
              {orders.map((order) => {
                const status = describe(order);
                const count = order.items?.length || 0;
                return (
                  <div className="panel order-row" key={order.id}>
                    <div className="order-head">
                      <div>
                        <p className="eyebrow" style={{ marginBottom: 6 }}>
                          Order {order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="muted small" style={{ margin: 0 }}>
                          {formatDate(order.createdAt)} — {count}{" "}
                          {count === 1 ? "photo" : "photos"} —{" "}
                          {formatPrice(order.subtotalCents)}
                        </p>
                      </div>
                      <span className={`tag ${status.tone}`}>{status.label}</span>
                    </div>

                    <p className="muted small">{status.detail}</p>

                    {order.status !== "paid" && (
                      <p className="muted small">
                        Reference{" "}
                        <strong style={{ color: "var(--text)" }}>
                          {order.id.slice(0, 8).toUpperCase()}
                        </strong>{" "}
                        — put that in the e-Transfer message.
                      </p>
                    )}

                    {(order.items || []).length > 0 && (
                      <div className="order-thumbs">
                        {order.items.slice(0, 8).map((item, i) => (
                          <img
                            key={`${item.photoId || i}-${i}`}
                            src={item.previewUrl}
                            alt=""
                            loading="lazy"
                          />
                        ))}
                        {order.items.length > 8 && (
                          <span className="muted small">
                            +{order.items.length - 8} more
                          </span>
                        )}
                      </div>
                    )}

                    {downloads[order.id] && (
                      <Link
                        href={`/download/${order.id}`}
                        className="btn ghost small"
                      >
                        Open my photos
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="muted small" style={{ marginTop: 28 }}>
            Something not right?{" "}
            <Link href="/contact" style={{ color: "var(--accent)" }}>
              Get in touch
            </Link>{" "}
            with the order reference and I’ll sort it.
          </p>
        </div>
      </section>
    </>
  );
}
