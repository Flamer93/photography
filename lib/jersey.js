// Jersey numbers and colours, per photo.
//
// A photo carries `players: [{ number, color }]` -- one entry per player whose
// jersey is readable in the frame. Most action shots have two or three. Buyers
// filter a gallery by number and colour, which is how a parent finds their kid
// without scrolling a 300-photo game.
//
// Numbers are kept as typed (a hockey "00" is not a "0") and colours are
// normalised to a small vocabulary, because a filter list that offers
// "Navy", "navy blue" and "dark blue" as three separate chips is useless.

// The swatch colours are for the little dot next to a chip. They are
// deliberately mid-tone rather than literal -- pure white and pure black dots
// both vanish against this site's palette.
export const JERSEY_COLORS = [
  { name: "white", swatch: "#f2f2f0" },
  { name: "black", swatch: "#2a2a2e" },
  { name: "red", swatch: "#d33a34" },
  { name: "blue", swatch: "#3b6fd4" },
  { name: "navy", swatch: "#1e2d5a" },
  { name: "light blue", swatch: "#6db3e8" },
  { name: "green", swatch: "#2f9e5c" },
  { name: "yellow", swatch: "#e5c033" },
  { name: "gold", swatch: "#bf9a3a" },
  { name: "orange", swatch: "#e2762c" },
  { name: "purple", swatch: "#7a4bc4" },
  { name: "maroon", swatch: "#7d2338" },
  { name: "grey", swatch: "#8a8a90" },
  { name: "teal", swatch: "#2a9d9b" },
  { name: "pink", swatch: "#dd6fa5" },
  { name: "brown", swatch: "#6b4a33" },
];

const COLOR_NAMES = JERSEY_COLORS.map((c) => c.name);

// Everything a person (or the model) might plausibly write, mapped onto the
// vocabulary above. Anything not listed is kept as typed -- better to show an
// odd chip than to silently relabel a real team colour.
const COLOR_ALIASES = {
  gray: "grey",
  silver: "grey",
  charcoal: "grey",
  slate: "grey",
  cream: "white",
  ivory: "white",
  "off white": "white",
  "off-white": "white",
  royal: "blue",
  "royal blue": "blue",
  "dark blue": "navy",
  "midnight blue": "navy",
  sky: "light blue",
  "sky blue": "light blue",
  powder: "light blue",
  "powder blue": "light blue",
  "baby blue": "light blue",
  burgundy: "maroon",
  wine: "maroon",
  crimson: "maroon",
  "dark red": "maroon",
  lime: "green",
  "kelly green": "green",
  "forest green": "green",
  "dark green": "green",
  "light green": "green",
  turquoise: "teal",
  aqua: "teal",
  cyan: "teal",
  violet: "purple",
  magenta: "pink",
  tan: "brown",
  beige: "brown",
  mustard: "yellow",
};

export function swatchFor(color) {
  const hit = JERSEY_COLORS.find((c) => c.name === color);
  return hit ? hit.swatch : "#6a6a72";
}

export function normalizeColor(raw) {
  const value = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return "";
  if (COLOR_NAMES.includes(value)) return value;
  if (COLOR_ALIASES[value]) return COLOR_ALIASES[value];
  return value.slice(0, 20);
}

// "07" and "7" are the same jersey, so leading zeros go -- except for an
// all-zero number, because hockey treats 0 and 00 as two different players.
export function normalizeNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 3);
  if (!digits) return "";
  if (/^0+$/.test(digits)) return digits.slice(0, 2);
  return digits.replace(/^0+/, "");
}

// Accepts the shapes a person actually types: "12 white", "white 12",
// "#12 navy", "12/white", "12". Either half may be missing.
export function parsePlayer(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const digits = text.match(/\d+/);
  const number = digits ? normalizeNumber(digits[0]) : "";
  const color = normalizeColor(text.replace(/\d+/g, " ").replace(/[#\/]/g, " "));

  if (!number && !color) return null;
  return { number, color };
}

export function samePlayer(a, b) {
  return a.number === b.number && a.color === b.color;
}

// De-dupes, drops empties, and caps the list. The cap is a guard against a
// model returning a crowd shot as forty entries, not a real limit on a photo.
export function normalizePlayers(list, max = 12) {
  const out = [];
  for (const entry of Array.isArray(list) ? list : []) {
    const player = {
      number: normalizeNumber(entry?.number),
      color: normalizeColor(entry?.color),
    };
    if (!player.number && !player.color) continue;
    if (out.some((p) => samePlayer(p, player))) continue;
    out.push(player);
    if (out.length >= max) break;
  }
  return out;
}

export function playerLabel(player) {
  const parts = [];
  if (player.number) parts.push("#" + player.number);
  if (player.color) parts.push(player.color);
  return parts.join(" ");
}

// Builds the buyer-facing filter lists from the photos actually in a gallery,
// so a chip is never offered with nothing behind it. Numbers sort numerically
// rather than as strings, which is why "#9" comes before "#10".
export function collectJerseyFacets(photos) {
  const numbers = new Map();
  const colors = new Map();

  for (const photo of photos || []) {
    const seenNumbers = new Set();
    const seenColors = new Set();
    for (const player of photo.players || []) {
      if (player.number && !seenNumbers.has(player.number)) {
        seenNumbers.add(player.number);
        numbers.set(player.number, (numbers.get(player.number) || 0) + 1);
      }
      if (player.color && !seenColors.has(player.color)) {
        seenColors.add(player.color);
        colors.set(player.color, (colors.get(player.color) || 0) + 1);
      }
    }
  }

  return {
    numbers: [...numbers.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([value, count]) => ({ value, count })),
    colors: [...colors.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count })),
  };
}

// A photo matches when ONE player in it satisfies every active filter --
// picking "#12" and "white" means "number 12 wearing white", not "anyone in
// white plus anyone wearing 12". Within a category the chips read as OR.
export function photoMatchesJersey(photo, numbers, colors) {
  if (numbers.length === 0 && colors.length === 0) return true;
  return (photo.players || []).some((player) => {
    const numberOk = numbers.length === 0 || numbers.includes(player.number);
    const colorOk = colors.length === 0 || colors.includes(player.color);
    return numberOk && colorOk;
  });
}
