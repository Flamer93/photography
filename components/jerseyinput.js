"use client";

import { useState } from "react";
import {
  JERSEY_COLORS,
  normalizePlayers,
  parsePlayer,
  playerLabel,
  samePlayer,
  swatchFor,
} from "@/lib/jersey";

// Per-photo jersey entry. One chip per player: type "12 white" and press
// Enter. The order does not matter -- "white 12" parses the same -- because
// typing these across a hundred photos is the tedious part and the input
// should not also be fussy.
export function JerseyInput({ players, onChange, disabled = false }) {
  const [draft, setDraft] = useState("");
  const [picker, setPicker] = useState(false);

  function commit(raw) {
    const player = parsePlayer(raw);
    setDraft("");
    if (!player) return;
    if (players.some((p) => samePlayer(p, player))) return;
    onChange(normalizePlayers([...players, player]));
  }

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && players.length > 0) {
      onChange(players.slice(0, -1));
    }
  }

  // Recolouring is the common correction after an AI pass -- the number is
  // usually right and the colour is what it got wrong -- so the swatches
  // retint the last chip rather than adding a new one.
  function recolorLast(color) {
    if (players.length === 0) {
      if (!draft.trim()) return;
      commit(draft + " " + color);
      return;
    }
    const next = players.slice(0, -1);
    const last = { ...players[players.length - 1], color };
    onChange(normalizePlayers([...next, last]));
  }

  return (
    <div className="jersey-input-wrap">
      <div className="tag-input jersey-input">
        {players.map((player, i) => (
          <span key={player.number + "-" + player.color + "-" + i} className="tag-chip jersey-chip">
            {player.color && (
              <span
                className="jersey-dot"
                style={{ background: swatchFor(player.color) }}
                aria-hidden="true"
              />
            )}
            {playerLabel(player)}
            <button
              type="button"
              aria-label={"Remove " + playerLabel(player)}
              disabled={disabled}
              onClick={() => onChange(players.filter((_, idx) => idx !== i))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          disabled={disabled}
          placeholder={players.length ? "Add another…" : "12 white"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          onFocus={() => setPicker(true)}
          maxLength={30}
          aria-label="Jersey number and colour"
        />
      </div>

      {picker && !disabled && (
        <div className="jersey-swatches">
          {JERSEY_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              className="jersey-swatch"
              title={c.name}
              aria-label={c.name}
              style={{ background: c.swatch }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => recolorLast(c.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
