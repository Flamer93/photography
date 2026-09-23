import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// These NEXT_PUBLIC_* values are inlined at build time. They are not secrets --
// Firebase web config is meant to ship to the browser; access is controlled by
// the Firestore/Storage security rules, not by hiding these keys.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Next.js hot-reloads modules in dev, so guard against re-initializing.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// A second, optional Firebase project used only for AI Logic calls.
//
// Why it exists: App Hosting requires the Blaze plan, so the main project must
// keep a billing account attached. Gemini's free tier is reached by having NO
// billing on the project -- the two requirements cannot both hold for one
// project. So the model calls get their own no-cost project and the site keeps
// its own. Nothing else moves: photos are still read from the main project's
// Storage bucket.
//
// Leave the NEXT_PUBLIC_AI_FIREBASE_* vars unset and this falls back to the
// main app, which is the right behaviour when the main project does have
// Gemini credit -- one project, one config, nothing extra to keep in sync.
const aiConfig = {
  apiKey: process.env.NEXT_PUBLIC_AI_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_AI_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_AI_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_AI_FIREBASE_APP_ID,
};

export const usingSeparateAiProject = Boolean(
  aiConfig.apiKey && aiConfig.projectId && aiConfig.appId
);

export const aiApp = usingSeparateAiProject
  ? getApps().find((a) => a.name === "ai") || initializeApp(aiConfig, "ai")
  : app;

// App Check, on the AI project only, initialized on first use.
//
// The AI project's config ships in the browser bundle -- it has to, since the
// model call is made from the client -- so without App Check anyone who reads
// the JS can spend its Gemini quota. reCAPTCHA Enterprise scores the browser
// and hands the SDK a token; once enforcement is on, Firebase refuses calls
// that arrive without one.
//
// A reCAPTCHA site key belongs to one project. This one is registered to
// homick-flicks-ai, which is why App Check is initialized on `aiApp` rather
// than on the main app -- the key is simply unknown to photography-c16ff.
//
// Deliberately lazy. App Check here guards exactly one thing, the admin's AI
// button, and initializing it on import would load reCAPTCHA into every
// buyer's browser on every page: slower, and third-party scoring of visitors
// who are only looking at photos. Nothing else in this app is App Check
// enforced, so there is nothing that needs a token sitting ready.
//
// Note there is no <script src=".../recaptcha/enterprise.js"> anywhere in this
// app. initializeAppCheck loads reCAPTCHA itself; adding the tag by hand, as
// Google's generic setup page suggests, would load it a second time.
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_AI_RECAPTCHA_SITE_KEY;

export const appCheckEnabled = Boolean(RECAPTCHA_SITE_KEY);

let appCheckPromise = null;

// Resolves once App Check has a provider attached, so a caller can wait rather
// than race it. Never rejects: App Check guards the AI button, and a bad day
// at reCAPTCHA must not take the galleries down. A real failure surfaces at
// the call itself, which reports it properly.
export function ensureAppCheck() {
  if (appCheckPromise) return appCheckPromise;

  appCheckPromise = (async () => {
    // Browser only -- initializeAppCheck reaches for window and document.
    if (typeof window === "undefined" || !RECAPTCHA_SITE_KEY) return null;

    try {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import(
        "firebase/app-check"
      );

      // `next dev` runs on localhost, which reCAPTCHA will not score. This
      // makes the SDK print a debug token to the console; paste it into
      // App Check > Apps > Manage debug tokens to work locally. The whole
      // branch is compiled out of the production bundle.
      if (process.env.NODE_ENV === "development") {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      return initializeAppCheck(aiApp, {
        provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      console.error("App Check init failed:", err);
      return null;
    }
  })();

  return appCheckPromise;
}
