// Firebase auth email actions -- verification, password reset, email change.
//
// Firebase sends these emails with a link back to a handler page. By default
// that is a Firebase-branded page on firebaseapp.com, which is a jarring place
// to land from an email about your own account. The console can point at a
// page of our own instead (Authentication > Templates > edit > customise
// action URL), which is /auth/action here.
//
// That page receives:
//   mode        what to do: verifyEmail, resetPassword, recoverEmail,
//               verifyAndChangeEmail, signIn
//   oobCode     the one-time code proving the request came from the email
//   continueUrl where to send the person afterwards, if we asked for one
//   lang        the locale Firebase would have used
//
// The code is single-use and expires, so every one of these can legitimately
// fail by the time someone clicks -- an old email, a second click, a link
// already used. Those are the normal cases, not edge cases, and each one says
// what to do next rather than "invalid action code".

// Where Firebase sends someone after the action completes. It must be on an
// authorised domain (Authentication > Settings > Authorized domains) or
// Firebase rejects the send outright.
export function continueTo(path = "/") {
  if (typeof window === "undefined") return undefined;
  return { url: new URL(path, window.location.origin).toString() };
}

export function friendlyAuthError(e) {
  const code = e?.code || "";

  if (code.includes("invalid-credential") || code.includes("wrong-password"))
    return "That email and password don’t match.";
  if (code.includes("email-already-in-use"))
    return "That email already has an account — try signing in.";
  if (code.includes("weak-password"))
    return "Passwords need to be at least 6 characters.";
  if (code.includes("popup-closed")) return "Sign-in window closed.";
  if (code.includes("unauthorized-domain"))
    return "This domain isn’t authorized for sign-in yet.";
  if (code.includes("user-not-found"))
    return "No account with that email.";
  if (code.includes("invalid-email")) return "That email doesn’t look right.";
  if (code.includes("too-many-requests"))
    return "Too many attempts. Wait a few minutes and try again.";

  // The link cases. Firebase reports all three as expired or invalid, and the
  // difference matters to whoever is reading: one needs a fresh email, one
  // means it already worked.
  if (code.includes("expired-action-code"))
    return "That link has expired. Send yourself a new one and use the newest email.";
  if (code.includes("invalid-action-code"))
    return "That link is not valid any more. It may already have been used — links work once. Send a fresh one if you still need it.";
  if (code.includes("user-disabled")) return "That account has been disabled.";

  if (code.includes("requires-recent-login"))
    return "For security, sign out and back in before changing this.";

  return e?.message || "Something went wrong.";
}
