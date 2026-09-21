"use client";

import Link from "next/link";
import { useState } from "react";
import { createEnquiry } from "@/lib/db";
import { SOCIALS } from "@/components/chrome";

const REASONS = [
  "Book me for a game",
  "Looking for a photo from a game",
  "Print or licensing question",
  "Something else",
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [team, setTeam] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createEnquiry({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        reason,
        team: team.trim(),
        message: message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">Get in touch</p>
          <h1>
            Want me at
            <br />
            your game?
          </h1>
          <p className="lede">
            I cover hockey, soccer, football and basketball around Midland and
            the rest of Simcoe County. Send me the details and I will get back
            to you.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap contact-layout">
          {sent ? (
            <div className="panel">
              <p className="eyebrow">Message sent</p>
              <h2 style={{ marginBottom: 16 }}>Thanks.</h2>
              <p className="muted">
                I have got your message and will reply by email. If it is
                urgent, Instagram or Snapchat is faster.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/galleries" className="btn accent">
                  Browse galleries
                </Link>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setSent(false);
                    setMessage("");
                    setTeam("");
                  }}
                >
                  Send another
                </button>
              </div>
            </div>
          ) : (
            <form className="panel" onSubmit={submit}>
              <h3 style={{ marginBottom: 18 }}>Send a message</h3>

              <div className="field">
                <label htmlFor="c-reason">What is this about?</label>
                <select
                  id="c-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="c-name">Your name</label>
                  <input
                    id="c-name"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="c-email">Email</label>
                  <input
                    id="c-email"
                    type="email"
                    value={email}
                    maxLength={120}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="c-phone">Phone (optional)</label>
                  <input
                    id="c-phone"
                    value={phone}
                    maxLength={40}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="c-team">Team (optional)</label>
                  <input
                    id="c-team"
                    placeholder="Midland Flyers U16"
                    value={team}
                    maxLength={80}
                    onChange={(e) => setTeam(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="c-message">Message</label>
                <textarea
                  id="c-message"
                  rows={5}
                  maxLength={1500}
                  placeholder="Date, rink or field, and what you are after."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
                <span className="muted small">{message.length}/1500</span>
              </div>

              <button className="btn accent" disabled={busy}>
                {busy ? "Sending…" : "Send message"}
              </button>

              {error && (
                <div className="notice error" style={{ marginTop: 16 }}>
                  {error}
                </div>
              )}
            </form>
          )}

          <aside>
            <div className="panel" style={{ marginBottom: 20 }}>
              <p className="eyebrow">Faster than email</p>
              <div className="contact-links">
                {SOCIALS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target={s.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel="noreferrer"
                  >
                    <span className="muted small">{s.label}</span>
                    <strong>{s.handle}</strong>
                  </a>
                ))}
              </div>
            </div>

            <div className="panel">
              <p className="eyebrow">Who you are messaging</p>
              <p className="muted" style={{ marginTop: 0 }}>
                I am Noah, I am sixteen, and I shoot sports around Midland,
                Ontario. I started because nobody was capturing the saves and
                the celebrations at our games, so I picked up a camera and did
                it myself.
              </p>
              <p className="muted" style={{ marginBottom: 0 }}>
                Every game I shoot gets a gallery here within a few days.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
