"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import { useAuth } from "@/components/providers";
import { SignIn } from "@/components/signin";
import { TagInput } from "@/components/taginput";
import {
  createGallery,
  deleteDeliveryGallery,
  deleteEnquiry,
  deleteGallery,
  deleteOrder,
  listAllGalleries,
  listAllOrders,
  listEnquiries,
  recordDelivery,
  saveDeliveryGallery,
  setEnquiryHandled,
  setOrderStatus,
  updateGallery,
} from "@/lib/db";
import {
  formatDate,
  formatPrice,
  parsePriceToCents,
  slugify,
} from "@/lib/format";

// Orders larger than this get a download page instead of one link per photo.
const GALLERY_THRESHOLD = 3;

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
            Orders &amp; revenue
          </button>
          <button
            className={tab === "messages" ? "is-active" : ""}
            onClick={() => setTab("messages")}
          >
            Messages
          </button>
        </div>

        {tab === "galleries" && <GalleriesTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "messages" && <MessagesTab />}
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
  const [tags, setTags] = useState([]);
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

  // Offer every team already tagged anywhere, so spelling stays consistent.
  const knownTags = useMemo(() => {
    const set = new Set();
    galleries.forEach((g) => (g.tags || []).forEach((t) => set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [galleries]);

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
        tags,
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
      setTags([]);
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
    <div className="admin-layout">
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
                <th>Teams</th>
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
                  <td>
                    {(g.tags || []).length === 0 ? (
                      <span className="muted small">—</span>
                    ) : (
                      <span className="tag-list">
                        {(g.tags || []).map((t) => (
                          <span key={t} className="tag">
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
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
          <label htmlFor="tags">Teams</label>
          <TagInput tags={tags} onChange={setTags} suggestions={knownTags} />
          <span className="muted small">
            Enter or comma to add. Buyers filter galleries by these.
          </span>
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
  const [sendingId, setSendingId] = useState(null);

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
      // Marking an order paid is the trigger the buyer is waiting on -- send
      // the files right away. sendFiles records its own outcome, so a
      // delivery failure never undoes the payment status just set above.
      if (status === "paid") await sendFiles(order);
    } catch (e) {
      setError(e.message);
    }
  }

  async function sendFiles(order) {
    setSendingId(order.id);
    setError("");
    try {
      const deliverable = (order.items || []).filter((i) => i.originalPath);

      if (deliverable.length === 0) {
        await recordDelivery(order.id, {
          sent: false,
          error: "This order predates file delivery -- send the photos by hand.",
        });
        await refresh();
        return;
      }

      const links = [];
      for (const item of deliverable) {
        try {
          const url = await getDownloadURL(storageRef(storage, item.originalPath));
          links.push({
            url,
            galleryTitle: item.galleryTitle,
            filename: item.filename,
            previewUrl: item.previewUrl || "",
          });
        } catch (e) {
          console.error("Could not get a download URL for", item.originalPath, e);
        }
      }

      if (links.length === 0) {
        await recordDelivery(order.id, {
          sent: false,
          error: "Could not read the original files from Storage.",
        });
        await refresh();
        return;
      }

      const orderRef = order.id.slice(0, 8).toUpperCase();

      // A handful of links reads fine in an email. Past that it becomes a wall
      // of URLs, so bigger orders get one link to a download page instead.
      let emailItems = links;
      if (links.length > GALLERY_THRESHOLD) {
        await saveDeliveryGallery(order.id, {
          items: links,
          buyerName: order.buyerName || "",
          orderRef,
        });
        emailItems = [
          {
            url: `${window.location.origin}/download/${order.id}`,
            galleryTitle: `Your gallery — ${links.length} photos`,
            filename: "",
          },
        ];
      }

      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          buyerEmail: order.buyerEmail,
          buyerName: order.buyerName,
          orderRef,
          items: emailItems,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok && data.emailed) {
        await recordDelivery(order.id, { sent: true });
      } else if (res.ok && data.ok && data.reason === "not-configured") {
        await recordDelivery(order.id, {
          sent: false,
          error: "Email is not set up yet -- no Resend key configured.",
        });
      } else if (res.status === 401 || res.status === 403) {
        await recordDelivery(order.id, {
          sent: false,
          error: "Not recognized as the admin account -- try signing in again.",
        });
      } else {
        // Resend's own rejection reason, or failing that the route's own
        // error code -- this response only ever reaches an already-verified
        // admin, so showing the real reason here is safe and much more useful
        // than "check the server log", which most admins cannot do. Showing
        // only `detail` once hid a route-level rejection behind a generic
        // message and cost a round of guesswork.
        await recordDelivery(order.id, {
          sent: false,
          error:
            data.detail ||
            (data.error ? `Delivery failed: ${data.error}` : null) ||
            "The delivery email did not send.",
        });
      }
      await refresh();
    } catch (e) {
      setError(e.message);
      try {
        await recordDelivery(order.id, { sent: false, error: e.message });
        await refresh();
      } catch {}
    } finally {
      setSendingId(null);
    }
  }

  async function remove(order) {
    if (
      !window.confirm(
        order.status === "paid"
          ? `Delete this paid order (${formatPrice(order.subtotalCents)})? This removes it from revenue and order history permanently.`
          : "Delete this order? This cannot be undone."
      )
    )
      return;
    try {
      // Take the download page with it, or its link would outlive the order.
      // A gallery only exists for larger orders, so a missing one is normal.
      await deleteDeliveryGallery(order.id).catch(() => {});
      await deleteOrder(order.id);
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
              <th>Files</th>
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
                <td>
                  {o.status !== "paid" ? (
                    <span className="muted small">—</span>
                  ) : sendingId === o.id ? (
                    <span className="muted small">Sending…</span>
                  ) : o.filesSentAt ? (
                    <>
                      <span className="tag paid">Sent</span>
                      <br />
                      <span className="muted small">{formatDate(o.filesSentAt)}</span>
                    </>
                  ) : (
                    <>
                      <span className="tag pending">Not sent</span>
                      {o.deliveryError && (
                        <>
                          <br />
                          <span className="muted small">{o.deliveryError}</span>
                        </>
                      )}
                    </>
                  )}
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {o.status === "paid" ? (
                    <>
                      <button
                        className="btn ghost small"
                        disabled={sendingId === o.id}
                        onClick={() => sendFiles(o)}
                      >
                        {o.filesSentAt ? "Resend files" : "Send files"}
                      </button>{" "}
                      <button
                        className="btn ghost small"
                        onClick={() => mark(o, "pending")}
                      >
                        Mark unpaid
                      </button>{" "}
                    </>
                  ) : (
                    <>
                      <button className="btn small" onClick={() => mark(o, "paid")}>
                        Mark paid
                      </button>{" "}
                    </>
                  )}
                  <button className="btn ghost small" onClick={() => remove(o)}>
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
  );
}

/* ------------------------------------------------------------- messages -- */

function MessagesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listEnquiries());
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

  async function toggle(row) {
    try {
      await setEnquiryHandled(row.id, !row.handled);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete the message from ${row.name || "this sender"}?`))
      return;
    try {
      await deleteEnquiry(row.id);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  const open = rows.filter((r) => !r.handled).length;

  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          <p className="eyebrow">Needs a reply</p>
          <p className="stat-value">{open}</p>
        </div>
        <div className="stat">
          <p className="eyebrow">Total messages</p>
          <p className="stat-value">{rows.length}</p>
        </div>
      </div>

      <h3 style={{ marginBottom: 18 }}>From the contact page</h3>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p>No messages yet.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>From</th>
              <th>About</th>
              <th>Message</th>
              <th>Sent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name || "—"}</strong>
                  <br />
                  <a className="muted small" href={`mailto:${r.email}`}>
                    {r.email}
                  </a>
                  {r.phone && (
                    <>
                      <br />
                      <span className="muted small">{r.phone}</span>
                    </>
                  )}
                </td>
                <td>
                  <span className="muted small">{r.reason}</span>
                  {r.team && (
                    <>
                      <br />
                      <span className="tag">{r.team}</span>
                    </>
                  )}
                </td>
                <td style={{ whiteSpace: "pre-wrap", maxWidth: 420 }}>
                  {r.message}
                </td>
                <td className="muted small">{formatDate(r.createdAt)}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <span className={`tag ${r.handled ? "paid" : "pending"}`}>
                    {r.handled ? "Replied" : "Open"}
                  </span>
                  <br />
                  <button
                    className="btn ghost small"
                    style={{ marginTop: 8 }}
                    onClick={() => toggle(r)}
                  >
                    {r.handled ? "Reopen" : "Mark replied"}
                  </button>{" "}
                  <button
                    className="btn ghost small"
                    style={{ marginTop: 8 }}
                    onClick={() => remove(r)}
                  >
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
  );
}
