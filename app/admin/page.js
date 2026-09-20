"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/providers";
import { SignIn } from "@/components/signin";
import {
  createGallery,
  deleteGallery,
  listAllGalleries,
  listAllOrders,
  setOrderStatus,
  updateGallery,
} from "@/lib/db";
import { formatDate, formatPrice, parsePriceToCents, slugify } from "@/lib/format";

export default function AdminPage() {
  const { user, ready, isAdmin } = useAuth();
  const [tab, setTab] = useState("galleries");

  if (!ready) {
    return (
      <section className="section">
        <div className="wrap">
          <p className="muted">Checking access…</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="section">
        <div className="wrap">
          <p className="eyebrow">Admin</p>
          <h1 style={{ marginBottom: 32 }}>Sign in</h1>
          <SignIn heading="Admin access" />
        </div>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="section">
        <div className="wrap" style={{ maxWidth: 620 }}>
          <p className="eyebrow">Admin</p>
          <h1 style={{ marginBottom: 24 }}>Not authorized</h1>
          <p className="lede">
            This account isn’t the admin account. If this should be yours, the
            user ID below needs to be set as <code>NEXT_PUBLIC_ADMIN_UID</code>.
          </p>
          <div className="panel">
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              Your user ID
            </p>
            <code style={{ wordBreak: "break-all" }}>{user.uid}</code>
          </div>
          <button
            className="btn ghost small"
            style={{ marginTop: 20 }}
            onClick={() => signOut(auth)}
          >
            Sign out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Dashboard</h1>
          </div>
          <button className="btn ghost small" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>

        <div className="admin-tabs">
          <button
            className={tab === "galleries" ? "is-active" : ""}
            onClick={() => setTab("galleries")}
          >
            Galleries
          </button>
          <button
            className={tab === "orders" ? "is-active" : ""}
            onClick={() => setTab("orders")}
          >
            Orders & revenue
          </button>
        </div>

        {tab === "galleries" ? <GalleriesTab /> : <OrdersTab />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ galleries -- */

function GalleriesTab() {
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("Hockey");
  const [dateOf, setDateOf] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("15");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setGalleries(await listAllGalleries());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submit(e) {
    e.preventDefault();
    const cents = parsePriceToCents(price);
    if (cents === null) {
      setError("Enter a valid price.");
      return;
    }
    setBusy(true);
    try {
      await createGallery({
        title: title.trim(),
        slug: slugify(title),
        sport,
        venue: venue.trim(),
        description: description.trim(),
        dateOf: dateOf ? new Date(dateOf) : new Date(),
        defaultPriceCents: cents,
        published: false,
        watermark: true,
        lowRes: true,
      });
      setTitle("");
      setVenue("");
      setDateOf("");
      setDescription("");
      await refresh();
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(g) {
    try {
      await updateGallery(g.id, { published: !g.published });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(g) {
    if (
      !window.confirm(
        `Delete "${g.title}"? This removes the gallery record. Photos already uploaded stay in Storage.`
      )
    )
      return;
    try {
      await deleteGallery(g.id);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 340px)",
        gap: 40,
        alignItems: "start",
      }}
      className="admin-layout"
    >
      <div>
        <h3 style={{ marginBottom: 18 }}>All galleries</h3>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : galleries.length === 0 ? (
          <div className="empty-state">
            <p>No galleries yet — create your first one.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Date</th>
                <th>Photos</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {galleries.map((g) => (
                <tr key={g.id}>
                  <td>
                    <Link href={`/admin/galleries/${g.id}`}>
                      <strong>{g.title}</strong>
                    </Link>
                    <br />
                    <span className="muted small">
                      {g.sport}
                      {g.venue ? ` — ${g.venue}` : ""}
                    </span>
                  </td>
                  <td className="muted small">{formatDate(g.dateOf)}</td>
                  <td>{g.photoCount || 0}</td>
                  <td>
                    <span className={`tag ${g.published ? "paid" : ""}`}>
                      {g.published ? "Live" : "Draft"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="btn ghost small"
                      onClick={() => togglePublished(g)}
                    >
                      {g.published ? "Unpublish" : "Publish"}
                    </button>{" "}
                    <button className="btn ghost small" onClick={() => remove(g)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {error && (
          <div className="notice error" style={{ marginTop: 18 }}>
            {error}
          </div>
        )}
      </div>

      <form className="panel" onSubmit={submit}>
        <h3 style={{ marginBottom: 16 }}>New gallery</h3>
        <div className="field">
          <label htmlFor="title">Game title</label>
          <input
            id="title"
            placeholder="Flyers vs Barrie Colts"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="sport">Sport</label>
          <select
            id="sport"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
          >
            {["Hockey", "Soccer", "Football", "Basketball", "Other"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="dateOf">Game date</label>
          <input
            id="dateOf"
            type="date"
            value={dateOf}
            onChange={(e) => setDateOf(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="venue">Venue</label>
          <input
            id="venue"
            placeholder="North Simcoe Sports Complex"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={3}
            maxLength={600}
            placeholder="What happened in this game?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="price">Default price per photo (CAD)</label>
          <input
            id="price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <button className="btn accent" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Creating…" : "Create gallery"}
        </button>
        <p className="muted small" style={{ marginBottom: 0 }}>
          New galleries start as drafts. Upload photos, then publish.
        </p>
      </form>
    </div>
  );
}

/* --------------------------------------------------------------- orders -- */

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await listAllOrders());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const paid = orders.filter((o) => o.status === "paid");
  const pending = orders.filter((o) => o.status === "pending");
  const revenue = paid.reduce((sum, o) => sum + (o.subtotalCents || 0), 0);
  const outstanding = pending.reduce(
    (sum, o) => sum + (o.subtotalCents || 0),
    0
  );
  const photosSold = paid.reduce((sum, o) => sum + (o.items?.length || 0), 0);

  async function mark(order, status) {
    try {
      await setOrderStatus(order.id, status);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          <p className="eyebrow">Paid revenue</p>
          <p className="stat-value">{formatPrice(revenue)}</p>
        </div>
        <div className="stat">
          <p className="eyebrow">Awaiting payment</p>
          <p className="stat-value">{formatPrice(outstanding)}</p>
        </div>
        <div className="stat">
          <p className="eyebrow">Photos sold</p>
          <p className="stat-value">{photosSold}</p>
        </div>
        <div className="stat">
          <p className="eyebrow">Orders</p>
          <p className="stat-value">{orders.length}</p>
        </div>
      </div>

      <h3 style={{ marginBottom: 18 }}>Orders</h3>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <p>No orders yet.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Buyer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Placed</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <strong>{o.buyerName || "—"}</strong>
                  <br />
                  <span className="muted small">{o.buyerEmail}</span>
                  {o.buyerPhone && (
                    <>
                      <br />
                      <span className="muted small">{o.buyerPhone}</span>
                    </>
                  )}
                  {o.note && (
                    <>
                      <br />
                      <span className="muted small">“{o.note}”</span>
                    </>
                  )}
                </td>
                <td>
                  {o.items?.length || 0}
                  <br />
                  <span className="muted small">
                    {o.items?.[0]?.galleryTitle || ""}
                  </span>
                </td>
                <td>{formatPrice(o.subtotalCents)}</td>
                <td className="muted small">{formatDate(o.createdAt)}</td>
                <td>
                  <span
                    className={`tag ${o.status === "paid" ? "paid" : "pending"}`}
                  >
                    {o.status}
                  </span>
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {o.status === "paid" ? (
                    <button
                      className="btn ghost small"
                      onClick={() => mark(o, "pending")}
                    >
                      Mark unpaid
                    </button>
                  ) : (
                    <button
                      className="btn small"
                      onClick={() => mark(o, "paid")}
                    >
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && (
        <div className="notice error" style={{ marginTop: 18 }}>
          {error}
        </div>
      )}
    </div>
  );
}
