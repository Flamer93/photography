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
