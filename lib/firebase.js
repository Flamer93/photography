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
