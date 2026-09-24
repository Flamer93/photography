// Locks the rate card to the jobs Noah has actually priced by hand.
//
// The card has four levers and they trade off against each other: raise the
// session fee, drop the per-player rate, and the anchor still lands on $175
// while a 40-player tournament moves by a hundred dollars. These assertions
// are what stops a well-meant edit quietly repricing the whole business.
//
//   npm run check:pricing
//
// Add a case here whenever a real job is quoted and agreed.

import { computeQuote } from "../lib/pricing.js";

const CASES = [
  {
    why: "Barrie, 15 players, 3 photos each — quoted and agreed at $175",
    input: { location: "Barrie", players: 15, photosPerPlayer: 3 },
    travelKm: 45,
    expect: 17500,
  },
  {
    why: "Elmvale, 12 players, 3 photos each — confirmed at $140",
    input: { location: "Elmvale", players: 12, photosPerPlayer: 3 },
    travelKm: 15,
    expect: 14000,
  },
];

// Not a price, but a rule: a job too small to be worth the drive charges the
// minimum rather than whatever the arithmetic says.
const INVARIANTS = [
  {
    why: "a 4-player local job cannot come out under the minimum",
    check: () => {
      const q = computeQuote(
        { location: "Midland", players: 4, photosPerPlayer: 3 },
        { travelKm: 0 }
      );
      return q.totalCents >= 12000;
    },
  },
  {
    why: "the model cannot move a total by more than the allowed percentage",
    check: () => {
      const q = computeQuote(
        { players: 15, photosPerPlayer: 3 },
        { travelKm: 45, adjustPct: 9000 }
      );
      return q.adjustPct === 15;
    },
  },
  {
    why: "more players always costs more, never less",
    check: () => {
      const small = computeQuote({ players: 10, photosPerPlayer: 3 }, { travelKm: 45 });
      const big = computeQuote({ players: 30, photosPerPlayer: 3 }, { travelKm: 45 });
      return big.totalCents > small.totalCents;
    },
  },
];

let failed = 0;

for (const c of CASES) {
  const got = computeQuote(c.input, { travelKm: c.travelKm }).totalCents;
  const ok = got === c.expect;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  $${(got / 100).toFixed(2)}` +
      `${ok ? "" : ` (expected $${(c.expect / 100).toFixed(2)})`}  — ${c.why}`
  );
}

for (const i of INVARIANTS) {
  const ok = Boolean(i.check());
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  — ${i.why}`);
}

if (failed > 0) {
  console.error(
    `\n${failed} pricing check(s) failed. The rate card no longer matches a ` +
      `job that was really quoted — fix the card, or update the case here if ` +
      `the price genuinely changed.`
  );
  process.exit(1);
}
console.log("\nAll pricing checks passed.");
