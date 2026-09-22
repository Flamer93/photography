"use client";

import { useCallback, useRef, useState } from "react";
import { describeAiError, detectPlayers } from "@/lib/vision";

// The AI detection loop, shared by the gallery editor and the dashboard so
// the two cannot drift apart on the things that matter here: one photo at a
// time, a Stop that actually stops, and giving up early on a failure that is
// obviously going to repeat.
export function useJerseyRun() {
  const [state, setState] = useState({
    running: false,
    done: 0,
    total: 0,
    failed: 0,
    key: null,
  });
  const [error, setError] = useState("");

  // A ref, not state: by the time the next photo comes round the loop would
  // be reading a stale copy of state and the Stop button would do nothing.
  const stopRef = useRef(false);

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);

  // `key` identifies which thing is running, so a dashboard with a button per
  // gallery can show progress on the right row. `onPhoto` does the persisting
  // -- this hook never writes to Firestore itself.
  const run = useCallback(async (photos, { key = null, onPhoto }) => {
    stopRef.current = false;
    setError("");
    setState({ running: true, done: 0, total: photos.length, failed: 0, key });

    let done = 0;
    let failed = 0;
    let firstFailure = "";

    for (const photo of photos) {
      if (stopRef.current) break;
      try {
        const players = await detectPlayers(photo);
        await onPhoto(photo, players);
      } catch (e) {
        failed += 1;
        if (!firstFailure) firstFailure = describeAiError(e);
        // A setup or quota problem fails identically on every photo, so
        // working through the whole gallery to prove it wastes both the
        // admin's time and their quota. Three strikes and stop.
        if (failed >= 3) stopRef.current = true;
      }
      done += 1;
      setState({ running: true, done, total: photos.length, failed, key });
    }

    setState({ running: false, done, total: photos.length, failed, key });

    if (firstFailure) {
      setError(
        failed === done
          ? firstFailure
          : `${failed} of ${done} photos failed — ${firstFailure}`
      );
    }

    return { done, failed, stopped: stopRef.current };
  }, []);

  return { state, error, run, stop, clearError: () => setError("") };
}
