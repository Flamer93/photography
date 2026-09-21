"use client";

import { useState } from "react";

// Team tags. Free text rather than a fixed list, because team names vary by
// league and season -- the buyer-facing filter is built from whatever tags
// actually exist on published galleries.
export function TagInput({ tags, onChange, id = "tags", suggestions = [] }) {
  const [draft, setDraft] = useState("");

  function add(raw) {
    const value = raw.trim().replace(/,+$/, "").trim();
    if (!value) return;
    // Case-insensitive de-dupe so "Flyers" and "flyers" do not both appear in
    // the buyer's filter list.
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...tags, value.slice(0, 40)]);
    setDraft("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  const unused = suggestions.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())
  );

  return (
    <div>
      <div className="tag-input">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(tags.filter((t) => t !== tag))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={tags.length ? "Add another…" : "Midland Flyers"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          maxLength={40}
        />
      </div>

      {unused.length > 0 && (
        <div className="tag-suggestions">
          <span className="muted small">Used before:</span>
          {unused.slice(0, 12).map((s) => (
            <button
              key={s}
              type="button"
              className="tag-suggestion"
              onClick={() => add(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
