const money = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

export function formatPrice(cents) {
  return money.format((cents ?? 0) / 100);
}

export function parsePriceToCents(input) {
  const n = Number(String(input).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatDate(value) {
  if (!value) return "";
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return dateFmt.format(d);
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Is everything in this gallery free?
//
// Two ways of knowing, because the gallery list never loads photos. Where the
// photos are in hand -- the gallery page itself -- every one is checked, which
// is the only truly correct answer. On a card there is just the gallery doc,
// so it leans on `allFree`, a flag the admin writes whenever a price changes.
//
// The flag matters: `defaultPriceCents` alone would be wrong the moment one
// photo is priced differently from the gallery default, and a card promising
// "Free gallery" over photos that cost $15 is a promise made to a buyer.
//
// An empty gallery is not free, it is empty.
export function galleryIsFree(gallery, photos) {
  if (Array.isArray(photos)) {
    if (photos.length === 0) return false;
    return photos.every(
      (p) => (p.priceCents ?? gallery?.defaultPriceCents ?? 0) === 0
    );
  }

  if (!gallery?.photoCount) return false;
  if (typeof gallery.allFree === "boolean") return gallery.allFree;

  // Galleries from before the flag existed: the default is all there is.
  return (gallery.defaultPriceCents ?? 0) === 0;
}
