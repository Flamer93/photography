// Reads jersey numbers and colours out of a photo using Firebase AI Logic
// (Gemini), straight from the admin's browser.
//
// Why client-side: the admin is already signed in and already has Storage read
// access to the originals, so there is nothing for a server route to add
// except a second copy of the image moving across the network. Firebase AI
// Logic exists precisely so a client can call Gemini without an API key in the
// bundle -- the call is authorised by the Firebase app, not by a secret.
//
// SETUP: this needs "AI Logic" turned on once in the Firebase console
// (Build > AI Logic > Get started, Gemini Developer API). Until that is done
// every call fails with a permission error, which `describeAiError` below
// turns into a sentence that says so.
//
// Cost note: a game's worth of photos is a real number of model calls. That is
// why detection is a button the admin presses, never something that fires on
// upload.

import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from "firebase/ai";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { app, storage } from "@/lib/firebase";
import { JERSEY_COLORS, normalizePlayers } from "@/lib/jersey";

const MODEL = "gemini-2.5-flash";

// Big enough that a number on a moving player is legible, small enough that
// the base64 payload stays a couple of hundred KB.
const AI_MAX_EDGE = 1280;
const AI_QUALITY = 0.85;

const COLOR_LIST = JERSEY_COLORS.map((c) => c.name).join(", ");

const PROMPT = [
  "You are looking at a photo from a youth sports game.",
  "",
  "List every player whose jersey number is actually readable in the frame.",
  "There are usually two or three. For each one give:",
  "  number - the digits on the jersey, exactly as printed, no '#'",
  "  color  - the dominant colour of that jersey",
  "",
  "Rules:",
  "- Only list a player if you can genuinely read the number. A guess is",
  "  worse than an omission here: a wrong number sends a parent to the wrong",
  "  photos. If nobody's number is readable, return an empty list.",
  "- Use the colour of the jersey itself, not the helmet, socks or pants.",
  "- Pick the closest colour from this list: " + COLOR_LIST + ".",
  "- Do not list the same player twice.",
  "- Ignore referees, coaches and spectators.",
].join("\n");

const RESPONSE_SCHEMA = Schema.object({
  properties: {
    players: Schema.array({
      items: Schema.object({
        properties: {
          number: Schema.string({
            description: "Digits on the jersey, e.g. \"12\". Empty if unreadable.",
          }),
          color: Schema.string({
            description: "Closest colour name from the allowed list.",
          }),
        },
      }),
    }),
  },
});

let cachedModel = null;

function model() {
  if (!cachedModel) {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    cachedModel = getGenerativeModel(ai, {
      model: MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        // Reading digits is not a creative task, and a low temperature makes
        // a re-run of the same gallery return the same answers.
        temperature: 0,
      },
    });
  }
  return cachedModel;
}

// The original is unwatermarked and sharp, which matters when the number is
// half-turned away from the camera -- the tiled preview watermark sits right
// over the middle of the jersey. Falls back to the preview if the original is
// missing, which is the case for anything uploaded before originals were kept.
async function sourceUrl(photo) {
  if (photo.originalPath) {
    try {
      return await getDownloadURL(storageRef(storage, photo.originalPath));
    } catch {
      // fall through to the preview
    }
  }
  if (photo.previewUrl) return photo.previewUrl;
  throw new Error("This photo has no image file to read.");
}

// Downscales in-browser before sending. A 24MP original is both slower and no
// more readable to the model than a 1280px one.
async function toInlineJpeg(blob) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, AI_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const jpeg = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", AI_QUALITY)
  );
  if (!jpeg) throw new Error("Could not prepare the image.");

  const buffer = await jpeg.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// Returns a normalised players array for one photo. Throws on a real failure
// (no model access, network down); an image the model simply cannot read comes
// back as an empty array, which is a valid answer.
export async function detectPlayers(photo) {
  const url = await sourceUrl(photo);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load the image (" + res.status + ").");

  const data = await toInlineJpeg(await res.blob());

  const result = await model().generateContent([
    PROMPT,
    { inlineData: { mimeType: "image/jpeg", data } },
  ]);

  let parsed;
  try {
    parsed = JSON.parse(result.response.text());
  } catch {
    throw new Error("The AI reply was not readable.");
  }

  return normalizePlayers(parsed?.players);
}

// Turns the model's failure modes into something actionable. The setup error
// is the one that matters: it is what every call returns until AI Logic is
// enabled on the project, and its raw text does not say that.
export function describeAiError(err) {
  const raw = String(err?.message || err || "");
  if (/API key not valid|api-key-not-valid/i.test(raw)) {
    return "Firebase rejected the AI request. Check the web API key in apphosting.yaml.";
  }
  if (/403|PERMISSION_DENIED|has not been used|is disabled|not enabled/i.test(raw)) {
    return (
      "AI Logic is not switched on for this project yet. Open the Firebase " +
      "console > Build > AI Logic > Get started, pick the Gemini Developer " +
      "API, then try again."
    );
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return "Gemini is rate-limiting the requests. Wait a minute and run it again.";
  }
  return raw || "The AI request failed.";
}
