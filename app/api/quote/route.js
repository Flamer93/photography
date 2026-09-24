// Prices a shoot from the details a buyer types in.
//
// Server-side on purpose. /quote is a public page, so a browser-side model
// call would put the AI project's credentials in reach of anyone who opens
// devtools, and they would be spending Noah's Gemini balance. Here the key
// never leaves the server and the route can be rate limited.
//
// The model does NOT set the price. It answers one question the rate card
// cannot -- how far the arena is from Midland -- plus a bounded adjustment
// for anything the card does not model. `computeQuote` does the arithmetic,
// so the same inputs always produce the same number.
//
// With no GEMINI_API_KEY the route still works: it falls back to the distance
// table in lib/pricing.js and returns a quote with no adjustment.

import {
  RATE_CARD,
  computeQuote,
  lookupDistanceKm,
  normalizeQuoteInput,
} from "@/lib/pricing";

export const runtime = "nodejs";

const MODEL = "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const HOME = "Midland, Ontario, Canada";

// A crude per-IP brake. App Hosting can run more than one instance, so this
// is not a real quota -- it is enough to stop one bored person holding down
// refresh, which is the actual threat to a small prepaid balance.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const seen = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  seen.push(now);
  hits.set(ip, seen);

  // Keep the map from growing forever on a long-lived instance.
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return seen.length > MAX_PER_WINDOW;
}

function buildPrompt(input) {
  return [
    `A sports photographer based in ${HOME} has been asked to shoot a game.`,
    "",
    "Details given by the customer:",
    `  Location/arena: ${input.location || "(not given)"}`,
    `  Sport: ${input.sport || "(not given)"}`,
    `  Players: ${input.players}`,
    `  Photos wanted per player: ${input.photosPerPlayer}`,
    `  Games: ${input.games}`,
    `  Notes: ${input.notes || "(none)"}`,
    "",
    "Return two things.",
    "",
    `1. travelKm — the approximate ONE-WAY driving distance in km from ${HOME}`,
    "   to that location. Use the town or arena name. If the location is",
    "   missing or you genuinely cannot place it, return -1 rather than",
    "   guessing; a wrong distance becomes a wrong price.",
    "",
    `2. adjustPct — a whole-number percentage between -${RATE_CARD.maxAdjustPct}`,
    `   and ${RATE_CARD.maxAdjustPct} for anything in the notes that the price`,
    "   list does not already cover. The list already charges for players,",
    "   photos per player, number of games, travel, rush turnaround and team",
    "   photos, so do NOT adjust for those -- it would double-count them.",
    "   Use it only for things like an unusually awkward venue, a charity or",
    "   community rate being asked for, or several teams in one visit.",
    "   Return 0 when nothing in the notes warrants it, which is most of the",
    "   time.",
    "",
    "3. note — one short sentence, addressed to the customer, explaining the",
    "   travel and any adjustment. No price figures; those are added",
    "   separately.",
  ].join("\n");
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    travelKm: { type: "NUMBER" },
    adjustPct: { type: "NUMBER" },
    note: { type: "STRING" },
  },
  required: ["travelKm", "adjustPct", "note"],
};

async function askModel(input, apiKey) {
  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    console.error("Gemini rejected the quote request:", res.status, raw.slice(0, 400));
    throw new Error("model-unavailable");
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(text);

  return {
    travelKm: Number(parsed.travelKm),
    adjustPct: Number(parsed.adjustPct),
    note: String(parsed.note || "").slice(0, 300),
  };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return Response.json(
      { ok: false, error: "rate-limited" },
      { status: 429 }
    );
  }

  const input = normalizeQuoteInput(body);

  // The table is both the fallback and the sanity check on the model.
  const tableKm = lookupDistanceKm(input.location);

  let travelKm = tableKm ?? 0;
  let adjustPct = 0;
  let note = "";
  let source = tableKm == null ? "default" : "table";

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (apiKey) {
    try {
      const guess = await askModel(input, apiKey);

      // -1 is the model saying it could not place the location, which is a
      // better answer than a number it made up.
      if (Number.isFinite(guess.travelKm) && guess.travelKm >= 0) {
        // 600km from Midland is well past anywhere this business drives; a
        // number that big is a misread, not a booking.
        travelKm = Math.min(600, Math.round(guess.travelKm));
        source = "ai";
      }
      if (Number.isFinite(guess.adjustPct)) adjustPct = guess.adjustPct;
      note = guess.note;
    } catch {
      // Falls through on the table value. A quote that is slightly off on
      // travel beats an error page.
      source = tableKm == null ? "default" : "table";
    }
  }

  const quote = computeQuote(input, { travelKm, adjustPct });

  return Response.json({
    ok: true,
    quote: {
      totalCents: quote.totalCents,
      lines: quote.lines,
      travelKm: quote.travelKm,
      adjustPct: quote.adjustPct,
      totalPhotos: quote.totalPhotos,
      hitMinimum: quote.hitMinimum,
      input: quote.input,
    },
    note,
    source,
    locationRecognised: source !== "default",
  });
}
