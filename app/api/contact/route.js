// Emails the admin when a contact-form message arrives.
//
// The message itself is written to Firestore by the browser before this route
// is called, so a failure here loses the notification but never the message --
// it is still in Admin > Messages either way.

export const runtime = "nodejs";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Resend's shared sending domain. Until a real domain is verified it can only
// deliver to the address the Resend account was created with.
const FROM = process.env.CONTACT_FROM || "Homick Flicks <onboarding@resend.dev>";
const TO = process.env.CONTACT_TO || "noah@homick.com";

// Strip CR/LF before any value reaches a header, so a crafted field cannot
// inject extra headers, and cap lengths to match the Firestore rules.
function headerSafe(value, max) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  const name = headerSafe(body.name, 80);
  const email = headerSafe(body.email, 120);
  const phone = headerSafe(body.phone, 40);
  const reason = headerSafe(body.reason, 60);
  const team = headerSafe(body.team, 80);
  const message = String(body.message ?? "").trim().slice(0, 1500);

  if (!name || !message) {
    return Response.json({ ok: false, error: "missing-fields" }, { status: 400 });
  }

  // Trimmed: a secret set from an interactive prompt can carry a trailing
  // newline, which corrupts the Authorization header even when the key itself
  // is correct.
  const apiKey = (process.env.RESEND_API_KEY || "").trim();

  // Checked after validation so a malformed request is still a 400. No key
  // configured is not an error: the site keeps working and the message is
  // already saved, the admin just does not get a nudge.
  if (!apiKey) {
    return Response.json({ ok: true, emailed: false, reason: "not-configured" });
  }

  const replyable = EMAIL_RE.test(email);

  const lines = [
    `From: ${name}`,
    `Email: ${email || "(not given)"}`,
    phone ? `Phone: ${phone}` : null,
    `About: ${reason || "(not given)"}`,
    team ? `Team: ${team}` : null,
    "",
    message,
  ].filter(Boolean);

  const payload = {
    from: FROM,
    to: [TO],
    subject: `Homick Flicks — ${reason || "New message"} from ${name}`,
    text: lines.join("\n"),
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.6">
<p><strong>${escapeHtml(name)}</strong> sent a message through the site.</p>
<p>
Email: ${escapeHtml(email) || "(not given)"}<br>
${phone ? `Phone: ${escapeHtml(phone)}<br>` : ""}
About: ${escapeHtml(reason) || "(not given)"}<br>
${team ? `Team: ${escapeHtml(team)}<br>` : ""}
</p>
<blockquote style="margin:0;padding-left:14px;border-left:3px solid #ff6a38;white-space:pre-wrap">${escapeHtml(
      message
    )}</blockquote>
</div>`,
    // Hitting reply goes straight to the sender rather than to Resend.
    ...(replyable ? { reply_to: email } : {}),
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
      console.error("Resend rejected the message:", res.status, raw);

      // Surface Resend's own reason. It describes this site's mail
      // configuration, not anything a sender submitted, and without it a
      // misconfiguration is invisible outside the server log.
      let detail = raw.slice(0, 300);
      try {
        const parsed = JSON.parse(raw);
        detail = parsed.message || parsed.name || detail;
      } catch {}

      return Response.json(
        { ok: false, emailed: false, status: res.status, detail },
        { status: 502 }
      );
    }

    return Response.json({ ok: true, emailed: true });
  } catch (err) {
    console.error("Resend request failed:", err);
    return Response.json({ ok: false, emailed: false }, { status: 502 });
  }
}

// Diagnostic probe: confirms which build is serving and whether a key reached
// the runtime, without sending anything or revealing the key.
export async function GET() {
  const key = (process.env.RESEND_API_KEY || "").trim();
  return Response.json({
    ok: true,
    build: "secret-v4",
    keyPresent: key.length > 0,
    keyLength: key.length,
    keyPrefix: key.slice(0, 3),
  });
}
