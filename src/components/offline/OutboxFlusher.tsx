"use client";

import { useEffect } from "react";
import { flushOutbox } from "@/lib/offline/outbox";

// Mounted in the app layout: replays any queued offline mutations on load and
// whenever the connection comes back.
export function OutboxFlusher() {
  useEffect(() => {
    void flushOutbox();
    const onOnline = () => void flushOutbox();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
