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

// Sharing needs the bytes, not a URL, so each file is fetched first. Reading
// Storage from a script is what the bucket CORS policy is for -- see
// "Storage CORS" in the README. Without it this throws and we fall back.
async function toFile(item, index) {
  const res = await fetch(item.url);
  if (!res.ok) throw new Error("Could not fetch the photo.");
  const blob = await res.blob();

  // iOS decides what the share sheet offers from the MIME type, so a file
  // arriving as application/octet-stream gets no "Save Image". Storage serves
  // these with contentDisposition: attachment, which can flatten the type.
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  const name = item.filename || `photo-${index + 1}.jpg`;

  return new File([blob], name, { type });
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
    throw err;
  }
}

// Sharing holds every file in memory at once, so a big order is a real risk
// on a phone. Past this, save-all falls back to downloading.
export const MAX_SHARE_FILES = 10;
