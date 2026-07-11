"use client";

import { useEffect, useState } from "react";

// Surfaces offline state app-wide. Editing keeps working offline (local-first),
// but navigating to server-rendered routes needs a connection — so we say so
// instead of letting the browser throw its raw "No internet" page.
export function OfflineBanner() {
  // Start false so server and first client render match (no hydration mismatch);
  // the effect corrects it on mount.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      You’re offline — your edits are saved locally. Opening other documents needs a connection.
    </div>
  );
}
