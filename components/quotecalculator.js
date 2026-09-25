"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";
import { SPORTS } from "@/lib/sports";

// The quote, written out as the message the buyer would otherwise have to
// type. Handing this to the form below means Noah reads the same figure the
// site actually showed them, instead of "you quoted me about 200?".
export function quoteMessage(quote) {
  const i = quote.input;
  return [
    `I got a quote of ${formatPrice(quote.totalCents)} on the site:`,
    "",
    `Arena or town: ${i.location || "—"}`,
    `Sport: ${i.sport || "—"}`,
    `Players: ${i.players}`,
    `Photos per player: ${i.photosPerPlayer}`,
    i.games > 1 ? `Games: ${i.games}` : null,
    i.teamPhoto ? "Team photo: yes" : null,
    i.rush ? "Next-day turnaround: yes" : null,
    quote.travelKm ? `Travel: about ${quote.travelKm}km each way` : null,
    i.notes ? `Notes: ${i.notes}` : null,
    "",
    "Can we book it in?",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function QuoteCalculator({ onBook }) {
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

  async function getQuote(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
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

  return (
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

                <div className="quote-next">
                  <p className="muted small" style={{ marginTop: 0 }}>
                    Happy with that? Send it over and I will confirm the date —
                    nothing is booked from this page.
                  </p>
                  <button
                    type="button"
                    className="btn accent"
                    onClick={() => onBook?.(quote)}
                  >
                    Book this in
                  </button>
                  <p className="muted small" style={{ marginBottom: 0 }}>
                    The details come with you — nothing to type again.
                  </p>
                </div>
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
  );
}
