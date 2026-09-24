// Getting a purchased photo into a phone's camera roll.
//
// A web page cannot write to Photos or Gallery directly -- no browser exposes
// an API for it, and on iOS a plain download always lands in Files. What does
// work is the share sheet: hand the OS an image file and iOS offers "Save
// Image", which puts it in Photos. One extra tap, right destination.
//
// So: share sheet where the browser supports sharing files, ordinary download
// everywhere else. Desktop browsers mostly do not support file sharing, and
// would not want it anyway.

// Fetched files are kept, because of how iOS treats user activation.
// navigator.share() must be called while the tap that triggered it is still
// "live", and awaiting a multi-megabyte fetch first can outlast that -- iOS
// then rejects the share with NotAllowedError even though nothing is wrong.
// With the bytes already in hand the second tap shares instantly and inside
// its own activation, which is why a retry works where the first attempt did
// not.
const fileCache = new Map();

export function isCached(item) {
  return fileCache.has(item.url);
}

export function cacheCount(items) {
  return items.filter((i) => fileCache.has(i.url)).length;
}

// Sharing needs the bytes, not a URL, so each file is fetched first. Reading
// Storage from a script is what the bucket CORS policy is for -- see
// "Storage CORS" in the README. Without it this throws and we fall back.
async function toFile(item, index) {
  const hit = fileCache.get(item.url);
  if (hit) return hit;

  const res = await fetch(item.url);
  if (!res.ok) throw new Error("Could not fetch the photo.");
  const blob = await res.blob();

  // iOS decides what the share sheet offers from the MIME type, so a file
  // arriving as application/octet-stream gets no "Save Image". Storage serves
  // these with contentDisposition: attachment, which can flatten the type.
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  const name = item.filename || `photo-${index + 1}.jpg`;

  const file = new File([blob], name, { type });
  fileCache.set(item.url, file);
  return file;
}

export function canShareFiles() {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    // A probe file: canShare() reports on the shape of the payload, and some
    // browsers expose share() for links while refusing files entirely.
    const probe = new File([new Blob([""], { type: "image/jpeg" })], "p.jpg", {
      type: "image/jpeg",
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

// Returns "shared", "cancelled", or throws. The caller falls back to a plain
// download on a throw; a cancel is the person changing their mind and must
// not look like a failure.
export async function shareToPhotos(items) {
  const files = await Promise.all(items.map(toFile));

  // Re-checked with the real files: a browser can accept one image and refuse
  // twelve, or refuse a payload over some size it does not advertise.
  if (!navigator.canShare({ files })) {
    throw new Error("This browser will not share these files.");
  }

  try {
    await navigator.share({ files });
    return "shared";
  } catch (err) {
    if (err?.name === "AbortError") return "cancelled";

    // The tap that started this has expired while the files downloaded. The
    // bytes are cached now, so the next tap shares immediately and inside a
    // fresh activation -- which is a retry worth asking for, not a failure
    // worth falling back from.
    if (err?.name === "NotAllowedError") return "tap-again";

    throw err;
  }
}

// Sharing holds every file in memory at once, so a big order is a real risk
// on a phone. Past this, save-all falls back to downloading.
export const MAX_SHARE_FILES = 10;

// Is this iOS?
//
// "Press and hold, then Add to Photos" is an iOS system feature. It is not a
// touchscreen feature: a Windows laptop with a touch panel reports touch
// points and coarse pointers too, and showing it those instructions would
// leave it with advice that does nothing and no download button either.
// Android long-press offers "Download image", which is not the same thing --
// but Chrome there does support file sharing, so it takes the share path.
//
// iPadOS 13+ presents itself as a Mac, so the touch points are what give it
// away.
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Mac/.test(ua) && (navigator.maxTouchPoints || 0) > 1;
}
