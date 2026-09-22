// Emails a buyer their full-resolution files once an order is marked paid.
//
// This route is admin-only: the caller must send a Firebase ID token proving
// they are signed in as the admin UID. The download links themselves are
// generated client-side (the admin's authenticated browser already has read
// access to originals/ per storage.rules) and simply passed through here --
// this route's job is to verify who is asking, then hand the links to Resend.
//
// IMPORTANT LIMITATION: these are standard Firebase Storage download URLs.
// Once generated they are bearer links -- anyone holding the URL can open it,
// the same way any file-sharing link works. There is no expiry. That is a
// deliberate tradeoff to avoid running a Cloud Function just to mint signed
// URLs; if that ever matters, the fix is to switch to
// bucket.file(path).getSignedUrl() with an expiry, which needs the runtime
// service account to hold "Service Account Token Creator" on itself.

import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export const runtime = "nodejs";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const PROJECT_ID = "photography-c16ff";
const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID || "";

const FROM =
  process.env.DELIVERY_FROM ||
  process.env.CONTACT_FROM ||
  "Homick Flicks <onboarding@resend.dev>";
const REPLY_TO = process.env.CONTACT_TO || "noah@homick.com";

function adminApp() {
  if (getApps().length) return getApps()[0];

  // On App Hosting / Cloud Run, applicationDefault() discovers the runtime
  // service account automatically via the metadata server -- no key file, no
  // extra IAM role needed for verifying tokens.
  try {
    return initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
    });
  } catch (err) {
    // Fallback for local `next dev`, where ADC usually is not configured.
    // A GOOGLE_APPLICATION_CREDENTIALS_JSON env var (a service account key,
    // pasted as JSON) is picked up if present; otherwise this still throws,
    // which surfaces as a clean 500 below rather than a confusing crash.
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (raw) {
      return initializeApp({
        credential: cert(JSON.parse(raw)),
        projectId: PROJECT_ID,
      });
    }
    throw err;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function headerSafe(value, max) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STORAGE_HOST_RE = /^https:\/\/firebasestorage\.googleapis\.com\//;

// A delivery email carries either direct Storage links, or -- for a larger
// order -- one link to this site's own /download page.
//
// The /download/ path is accepted on any host, not just this one. A host
// comparison looked tighter, but App Hosting sits behind a CDN that can
// rewrite the Host header, and a mismatch there would silently stop delivery
// emails again. This is not much of a security boundary either way: reaching
// this code already required a verified admin token, and an admin could just
// send an email themselves. What it does do is stop a bug from mailing out a
// stray URL of some entirely different shape.
function allowedUrl(url, selfHost) {
  if (STORAGE_HOST_RE.test(url)) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (selfHost && u.host === selfHost) return true;
    return u.pathname.startsWith("/download/");
  } catch {
    return false;
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  // ---- who is asking -------------------------------------------------
  const idToken = String(body.idToken || "");
  if (!idToken) {
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await getAuth(adminApp()).verifyIdToken(idToken);
  } catch (err) {
    console.error("ID token verification failed:", err);
    return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  if (!ADMIN_UID || decoded.uid !== ADMIN_UID) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // ---- what is being sent ---------------------------------------------
  const buyerEmail = headerSafe(body.buyerEmail, 120);
  const buyerName = headerSafe(body.buyerName, 80) || "there";
  const orderRef = headerSafe(body.orderRef, 20);
  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];

  if (!EMAIL_RE.test(buyerEmail)) {
    return Response.json({ ok: false, error: "bad-buyer-email" }, { status: 400 });
  }
  if (items.length === 0) {
    return Response.json({ ok: false, error: "no-items" }, { status: 400 });
  }

  const selfHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host") || "";

  const links = [];
  for (const raw of items) {
    const url = String(raw?.url || "");
    if (!allowedUrl(url, selfHost)) continue;
    links.push({
      url,
      label: headerSafe(raw?.galleryTitle, 80) || "Photo",
      filename: headerSafe(raw?.filename, 120),
    });
  }
  if (links.length === 0) {
    return Response.json({ ok: false, error: "no-valid-links" }, { status: 400 });
  }

  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    return Response.json({ ok: true, emailed: false, reason: "not-configured" });
  }

  const textLines = [
    `Hi ${buyerName},`,
    "",
    `Your photos are ready${orderRef ? ` (order ${orderRef})` : ""}. Full` +
      " resolution, no watermark -- yours to keep, print or post.",
    "",
    ...links.map((l, i) => `${i + 1}. ${l.label}${l.filename ? ` (${l.filename})` : ""}\n   ${l.url}`),
    "",
    "Any trouble opening these, just reply to this email.",
    "",
    "— Homick Flicks",
  ];

  const htmlLinks = links
    .map(
      (l, i) => `<li style="margin-bottom:10px">
        <a href="${l.url}" style="color:#ff6a38;font-weight:600">${escapeHtml(l.label)}</a>
        ${l.filename ? `<br><span style="color:#888;font-size:0.85em">${escapeHtml(l.filename)}</span>` : ""}
      </li>`
    )
    .join("");

  const payload = {
    from: FROM,
    to: [buyerEmail],
    reply_to: REPLY_TO,
    subject: `Your photos are ready${orderRef ? ` — order ${orderRef}` : ""}`,
    text: textLines.join("\n"),
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.6;max-width:520px">
<p>Hi ${escapeHtml(buyerName)},</p>
<p>Your photos are ready${
      orderRef ? ` (order <strong>${escapeHtml(orderRef)}</strong>)` : ""
    }. Full resolution, no watermark — yours to keep, print or post.</p>
<ol style="padding-left:20px">${htmlLinks}</ol>
<p style="color:#888;font-size:0.9em">Any trouble opening these, just reply to this email.</p>
<p>— Homick Flicks</p>
</div>`,
  };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const raw = await res.text();
      console.error("Resend rejected the delivery email:", res.status, raw);

      // Unlike /api/contact, this response never reaches an anonymous
      // caller -- getting this far already required a verified admin ID
      // token, so it is safe to hand the admin Resend's actual reason
      // instead of a generic message they cannot act on.
      let detail = raw.slice(0, 300);
      try {
        const parsed = JSON.parse(raw);
        detail = parsed.message || parsed.name || detail;
      } catch {}

      return Response.json(
        { ok: false, emailed: false, detail },
        { status: 502 }
      );
    }

    return Response.json({ ok: true, emailed: true });
  } catch (err) {
    console.error("Resend request failed:", err);
    return Response.json({ ok: false, emailed: false, detail: String(err?.message || err) }, { status: 502 });
  }
}
