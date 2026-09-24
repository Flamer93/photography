// Shoot pricing.
//
// The number a buyer sees is arithmetic, not a guess. An LLM asked to price a
// job directly will quote $80 one morning and $400 the next for the same
// inputs, and a quote is a number a customer holds you to. So the rate card
// below decides the price, and the model supplies the one input it is
// genuinely better at than a lookup table -- how far the arena actually is --
// plus a bounded adjustment for anything the card does not model.
//
// CALIBRATION. The card is fitted to two prices Noah has actually named:
//
//   Barrie,  ~45km, 15 players, 3 each  ->  $175   (quoted and agreed)
//   Midland,    0km, 15 players, 3 each  ->  $135   (what he would charge)
//
//   base 60 + (15 x 5)                    = 135   local
//   base 60 + (15 x 5) + ((45 - 5) x 1)   = 175   Barrie
//
// Those two fix the travel weight between them: the same roster costs $40
// more once it is a 45km drive, which is what makes the card charge $1/km
// beyond the first 5 rather than treating the drive as a rounding error.
//
// This replaced an earlier fit where a local 15-player job came out at $160,
// which Noah called steep. Dropping it had to move something else, because
// Elmvale sits inside the old free radius and was therefore priced as a
// local job too -- it now quotes $130 rather than the $140 first confirmed.
// That is the trade he chose, not a drift.
//
// Still underdetermined: both anchors are small rosters close to home. A
// 40-player tournament an hour away is extrapolation, not calibration.
// scripts/check-pricing.mjs asserts both, so an edit that quietly reprices
// the business fails loudly instead.

export const RATE_CARD = {
  // Turning up at all: the shoot itself, the card offload, the cull.
  baseCents: 6000,

  // Per player on the roster. This is the real driver -- covering 30 players
  // properly is genuinely twice the work of covering 15, on the ice and at
  // the desk.
  perPlayerCents: 500,

  // Each player's share of the gallery. Beyond this, editing time grows.
  includedPhotosPerPlayer: 3,
  extraPhotoCents: 250,

  // Driving. Free inside the local radius, then per km one way -- the return
  // leg is already inside the base fee.
  travelFreeKm: 5,
  travelPerKmCents: 100,

  // Optional extras the form offers.
  rushCents: 4000, // next-day turnaround
  teamPhotoCents: 3000, // posed roster shot

  // A job small enough to fall under this is not worth the drive.
  minimumCents: 12000,

  // How far the model may move the total for things the card cannot see --
  // two teams back to back, an awkward rink, a tournament weekend. Wide
  // enough to be useful, tight enough that a bad answer is still a real
  // quote rather than a joke.
  maxAdjustPct: 15,
};

// Rough one-way driving distances from Midland. Used to sanity-check the
// model, and on its own when no model is configured. Approximate on purpose:
// a quote is not a taxi meter.
export const KNOWN_DISTANCES_KM = {
  midland: 0,
  penetanguishene: 8,
  elmvale: 15,
  coldwater: 20,
  wyebridge: 6,
  victoriaharbour: 15,
  portmcnicoll: 12,
  waubaushene: 20,
  orillia: 35,
  wasagabeach: 30,
  barrie: 45,
  angus: 50,
  stayner: 40,
  creemore: 50,
  collingwood: 55,
  alliston: 60,
  innisfil: 60,
  gravenhurst: 60,
  bradford: 75,
  bracebridge: 75,
  newmarket: 95,
  aurora: 105,
  owensound: 110,
  vaughan: 130,
  toronto: 150,
};

export function lookupDistanceKm(place) {
  const key = String(place || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!key) return null;
  if (KNOWN_DISTANCES_KM[key] != null) return KNOWN_DISTANCES_KM[key];
  // "barrie molson centre" should still find Barrie.
  for (const [town, km] of Object.entries(KNOWN_DISTANCES_KM)) {
    if (key.includes(town)) return km;
  }
  return null;
}

function clampInt(value, min, max, fallback = min) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeQuoteInput(raw = {}) {
  return {
    location: String(raw.location || "").trim().slice(0, 120),
    sport: String(raw.sport || "").trim().slice(0, 40),
    players: clampInt(raw.players, 1, 200, 15),
    photosPerPlayer: clampInt(raw.photosPerPlayer, 1, 50, 3),
    games: clampInt(raw.games, 1, 20, 1),
    rush: Boolean(raw.rush),
    teamPhoto: Boolean(raw.teamPhoto),
    notes: String(raw.notes || "").trim().slice(0, 600),
  };
}

// The whole price, itemised. `travelKm` comes from the model or the table
// above; `adjustPct` is the model's bounded discretionary nudge.
export function computeQuote(input, { travelKm = 0, adjustPct = 0, card = RATE_CARD } = {}) {
  const i = normalizeQuoteInput(input);
  const km = Math.max(0, Math.round(Number(travelKm) || 0));
  const pct = Math.max(
    -card.maxAdjustPct,
    Math.min(card.maxAdjustPct, Math.round(Number(adjustPct) || 0))
  );

  const lines = [];

  // A second game is more shooting and more editing, but only one drive and
  // one setup -- so the base is charged once and the per-player work repeats.
  lines.push({
    label: i.games > 1 ? `Session fee (${i.games} games)` : "Session fee",
    cents: card.baseCents,
  });

  const rosterCents = card.perPlayerCents * i.players * i.games;
  lines.push({
    label: `${i.players} players${i.games > 1 ? ` x ${i.games} games` : ""}`,
    cents: rosterCents,
  });

  const extraPerPlayer = Math.max(
    0,
    i.photosPerPlayer - card.includedPhotosPerPlayer
  );
  if (extraPerPlayer > 0) {
    lines.push({
      label: `${extraPerPlayer} extra photos per player`,
      cents: card.extraPhotoCents * extraPerPlayer * i.players * i.games,
    });
  }

  const billableKm = Math.max(0, km - card.travelFreeKm);
  if (billableKm > 0) {
    lines.push({
      label: `Travel — ${km}km${i.games > 1 ? ` x ${i.games} trips` : ""}`,
      cents: card.travelPerKmCents * billableKm * i.games,
    });
  }

  if (i.teamPhoto) lines.push({ label: "Team photo", cents: card.teamPhotoCents });
  if (i.rush) lines.push({ label: "Next-day turnaround", cents: card.rushCents });

  let subtotal = lines.reduce((sum, l) => sum + l.cents, 0);

  if (pct !== 0) {
    const cents = Math.round(subtotal * (pct / 100));
    lines.push({
      label: pct > 0 ? `Adjustment (+${pct}%)` : `Adjustment (${pct}%)`,
      cents,
    });
    subtotal += cents;
  }

  // Rounded to the nearest $5: a quote reading $187 looks like it came from a
  // spreadsheet, which is exactly what buyers distrust about online quoting.
  const rounded = Math.round(subtotal / 500) * 500;
  const totalCents = Math.max(card.minimumCents, rounded);

  return {
    input: i,
    travelKm: km,
    adjustPct: pct,
    lines,
    subtotalCents: subtotal,
    totalCents,
    hitMinimum: totalCents > rounded,
    totalPhotos: i.players * i.photosPerPlayer * i.games,
  };
}
