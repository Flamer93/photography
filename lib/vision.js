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
import { aiApp, storage, usingSeparateAiProject } from "@/lib/firebase";
import { JERSEY_COLORS, normalizePlayers } from "@/lib/jersey";

// Google retires model names out from under you -- 2.5 Flash stopped being
// available to new projects and the API said so in a 404. When that happens
// the error names its replacement; put it here.
const MODEL = "gemini-3.6-flash";

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
    const ai = getAI(aiApp, { backend: new GoogleAIBackend() });
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

// Errors carry the stage they came from. Without this a CORS failure and a
// model failure both surface as the browser's bare "Failed to fetch", which
// says nothing about which of the two things to go and fix.
function stageError(stage, message) {
  return Object.assign(new Error(message), { stage });
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
  throw stageError("image", "This photo has no image file to read.");
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

  // Reading the bytes out of Storage needs CORS configured on the bucket.
  // Without it the browser blocks the response and throws a bare
  // "Failed to fetch" with no detail at all -- hence the stage tag.
  let blob;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw stageError("image", "Storage returned " + res.status + ".");
    }
    blob = await res.blob();
  } catch (err) {
    if (err?.stage) throw err;
    throw stageError("image", String(err?.message || err));
  }

  const data = await toInlineJpeg(blob);

  let result;
  try {
    result = await model().generateContent([
      PROMPT,
      { inlineData: { mimeType: "image/jpeg", data } },
    ]);
  } catch (err) {
    throw stageError("model", String(err?.message || err));
  }

  try {
    return normalizePlayers(JSON.parse(result.response.text())?.players);
  } catch {
    throw stageError("model", "The AI reply was not readable.");
  }
}

// Turns the model's failure modes into something actionable. The setup error
// is the one that matters: it is what every call returns until AI Logic is
// enabled on the project, and its raw text does not say that.
export function describeAiError(err) {
  const raw = String(err?.message || err || "");

  // "Failed to fetch" is what the browser says when it blocks a response for
  // CORS, and the Storage download endpoint sends no CORS headers on a GET
  // until the bucket has a CORS policy. It answers the preflight with a
  // permissive wildcard, which makes this look like it should work and is why
  // it got shipped broken. The fix is a one-time bucket config -- see the
  // "Storage CORS" section of the README.
  if (err?.stage === "image") {
    if (/failed to fetch|networkerror|load failed/i.test(raw)) {
      return (
        "The browser could not read the photo out of Storage. The bucket " +
        "needs a CORS policy before it will hand image bytes to a script -- " +
        "see “Storage CORS” in the README for the one-line fix."
      );
    }
    return "Could not load the photo: " + raw;
  }

  if (err?.stage === "model" && /failed to fetch|networkerror|load failed/i.test(raw)) {
    return (
      "Could not reach Gemini. Usually that means AI Logic is not switched " +
      "on yet: Firebase console > Build > AI Logic > Get started, Gemini " +
      "Developer API."
    );
  }

  // Firebase switches App Check enforcement on by default for a new AI Logic
  // setup. This app sends no App Check token, so an enforcing project rejects
  // every call at 401 before the model is reached.
  if (/app check/i.test(raw)) {
    return (
      "The AI project is enforcing App Check, and this site does not send an " +
      "App Check token. In that project: Firebase console > Build > App Check " +
      "> APIs > Firebase AI Logic > Unenforce."
    );
  }

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
  // Google retires model names, and the 404 it returns names the replacement.
  // Worth calling out plainly: nothing about the setup is wrong, one constant
  // in this file is out of date.
  if (/no longer available|is not found|not supported for generateContent/i.test(raw)) {
    return `The model "${MODEL}" was rejected — Google has probably retired it. The error below names the one to switch to; it is a one-line change in lib/vision.js. ${raw}`;
  }

  // Depleted credits and ordinary rate-limiting both come back as 429, and the
  // difference matters entirely: one clears by waiting, the other never does.
  if (/prepayment credits|credits are depleted|billing/i.test(raw)) {
    return usingSeparateAiProject
      ? "Gemini is refusing the requests for billing reasons on the separate " +
          "AI project. That project is meant to have no billing account at " +
          "all, which is what puts it on the free tier — check that billing " +
          "was never linked to it."
      : "Gemini has no credit left on this project, so it is refusing the " +
          "requests. Either add credit at https://ai.studio/projects, or move " +
          "the model calls to a separate no-cost project — see “A separate " +
          "project for the AI” in the README. Nothing else needs changing.";
  }

  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return "Gemini is rate-limiting the requests. Wait a minute and run it again.";
  }
  return raw || "The AI request failed.";
}
