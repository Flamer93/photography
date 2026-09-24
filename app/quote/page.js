"use client";

import Link from "next/link";
import { useState } from "react";
import { createQuoteRequest } from "@/lib/db";
import { formatPrice } from "@/lib/format";

const SPORTS = ["Hockey", "Soccer", "Football", "Basketball", "Other"];

export default function QuotePage() {
  const [location, setLocation] = useState("");
  const [sport, setSport] = useState(SPORTS[0]);
  const [players, setPlayers] = useState("15");
  const [photosPerPlayer, setPhotosPerPlayer] = useState("3");
  const [games, setGames] = useState("1");
  const [rush, setRush] = useState(false);
  const [teamPhoto, setTeamPhoto] = useState(false);
  const [notes, setNotes] = useState("");

  const [quote, setQuote] = useState(null);
  const [note, setNote] = useState("");
  const [recognised, setRecognised] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Contact details are only asked for once a price is on screen. Nobody
  // wants to hand over an email to find out a number.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function getQuote(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSent(false);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          sport,
          players,
          photosPerPlayer,
          games,
          rush,
          teamPhoto,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.error === "rate-limited"
            ? "That’s a lot of quotes in a row — give it a minute."
            : "Couldn’t work out a price just now. Try again, or use the contact page."
        );
        return;
      }
      setQuote(data.quote);
      setNote(data.note || "");
      setRecognised(data.locationRecognised);
    } catch {
      setError("Couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function send(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await createQuoteRequest({
        name: name.trim(),
        email: email.trim(),
        location: quote.input.location,
        sport: quote.input.sport,
        players: quote.input.players,
        photosPerPlayer: quote.input.photosPerPlayer,
        games: quote.input.games,
        rush: quote.input.rush,
        teamPhoto: quote.input.teamPhoto,
        notes: quote.input.notes,
        travelKm: quote.travelKm,
        totalCents: quote.totalCents,
        lines: quote.lines,
      });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <p className="eyebrow">Quotes</p>
          <h1>
            What will
            <br />
            it cost?
          </h1>
          <p className="lede">
            Tell me about the game and you get a price straight away — no
            waiting on me to reply. It is an estimate, not an invoice: send it
            over and I will confirm before anything is booked.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap contact-layout">
          <form className="panel" onSubmit={getQuote}>
            <h3 style={{ marginBottom: 16 }}>Your game</h3>

            <div className="field">
              <label htmlFor="q-loc">Arena or town</label>
              <input
                id="q-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Barrie Molson Centre"
                required
              />
              <span className="muted small">
                Used to work out the drive from Midland.
              </span>
            </div>

            <div className="field">
              <label htmlFor="q-sport">Sport</label>
              <select
                id="q-sport"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
              >
                {SPORTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="quote-row">
              <div className="field">
                <label htmlFor="q-players">Players</label>
                <input
                  id="q-players"
                  type="number"
                  min="1"
                  max="200"
                  value={players}
                  onChange={(e) => setPlayers(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="q-photos">Photos each</label>
                <input
                  id="q-photos"
                  type="number"
                  min="1"
                  max="50"
                  value={photosPerPlayer}
                  onChange={(e) => setPhotosPerPlayer(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="q-games">Games</label>
                <input
                  id="q-games"
                  type="number"
                  min="1"
                  max="20"
                  value={games}
                  onChange={(e) => setGames(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={teamPhoto}
                  onChange={(e) => setTeamPhoto(e.target.checked)}
                />
                <span>Posed team photo</span>
              </label>
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={rush}
                  onChange={(e) => setRush(e.target.checked)}
                />
                <span>Next-day turnaround</span>
              </label>
            </div>

            <div className="field">
              <label htmlFor="q-notes">Anything else</label>
              <textarea
                id="q-notes"
                rows={3}
                maxLength={600}
                placeholder="Two teams playing back to back, tight rink, that sort of thing."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button className="btn accent" disabled={busy}>
              {busy
                ? "Working it out…"
                : quote
                ? "Update the price"
                : "Get a price"}
            </button>
          </form>

          <div>
            {quote ? (
              <div className="panel quote-result">
                <p className="eyebrow" style={{ marginBottom: 6 }}>
                  Estimate
                </p>
                <p className="quote-total">{formatPrice(quote.totalCents)}</p>
                <p className="muted small" style={{ marginTop: 0 }}>
                  {quote.totalPhotos} edited photos
                  {quote.travelKm > 0 ? ` — ${quote.travelKm}km each way` : ""}
                </p>

                <ul className="quote-lines">
                  {quote.lines.map((line, i) => (
                    <li key={`${line.label}-${i}`}>
                      <span>{line.label}</span>
                      <span>{formatPrice(line.cents)}</span>
                    </li>
                  ))}
                </ul>

                {quote.hitMinimum && (
                  <p className="muted small">
                    That is my minimum for a booking — smaller jobs come out
                    the same.
                  </p>
                )}

                {note && <p className="muted small">{note}</p>}

                {!recognised && (
                  <div className="notice" style={{ marginTop: 14 }}>
                    I could not place that arena, so there is no travel in this
                    price. If it is a fair drive the real number will be higher
                    — send it over and I will check.
                  </div>
                )}

                {sent ? (
                  <div className="notice" style={{ marginTop: 16 }}>
                    Sent. I will come back to you to confirm — usually same
                    day. <Link href="/galleries">Browse galleries</Link> in the
                    meantime.
                  </div>
                ) : (
                  <form onSubmit={send} style={{ marginTop: 20 }}>
                    <p className="muted small" style={{ marginTop: 0 }}>
                      Happy with that? Send it over and I will confirm.
                    </p>
                    <div className="field">
                      <label htmlFor="q-name">Your name</label>
                      <input
                        id="q-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="q-email">Email</label>
                      <input
                        id="q-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <button className="btn" disabled={sending}>
                      {sending ? "Sending…" : "Send this quote"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="panel">
                <p className="eyebrow" style={{ marginBottom: 10 }}>
                  How it works
                </p>
                <p className="muted small" style={{ marginTop: 0 }}>
                  The price is built from the size of the roster, how many
                  photos each player wants, and the drive out to you. Fill in
                  the form and it appears here, itemised, so you can see
                  exactly what you are paying for.
                </p>
                <p className="muted small">
                  Nothing is booked and no details are kept until you choose to
                  send it.
                </p>
              </div>
            )}

            {error && (
              <div className="notice error" style={{ marginTop: 16 }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
