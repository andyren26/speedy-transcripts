"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 3000;

/**
 * While any job is still being processed, re-render the server page every few
 * seconds so progress and status update on their own. Stops as soon as nothing
 * is in progress, and pauses while the tab is hidden.
 */
export default function JobsAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
