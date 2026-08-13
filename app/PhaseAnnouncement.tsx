"use client";

import { useEffect, useRef, useState } from "react";

type PhaseAnnouncementProps = {
  phase: string;
  message: string;
  enabled: boolean;
};

/**
 * Announce a phase once, then clear the live region. Keeping stale phase copy
 * out of the live region prevents an unrelated modal close from repeating it.
 */
export default function PhaseAnnouncement({ phase, message, enabled }: PhaseAnnouncementProps) {
  const announcedPhaseRef = useRef<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    if (!enabled || announcedPhaseRef.current === phase) return;
    announcedPhaseRef.current = phase;
    setLiveMessage(message);
    const timer = window.setTimeout(() => setLiveMessage(""), 2_500);
    return () => window.clearTimeout(timer);
  }, [enabled, message, phase]);

  return <p id="phase-announcement" className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{liveMessage}</p>;
}
