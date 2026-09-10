"use client";

import { useState, type ReactNode } from "react";

/**
 * Tooltip trigger, no positioning library. Anchors above the trigger —
 * fine for table cells; near a viewport edge it can clip, an accepted
 * limitation for now over pulling in a floating-element dependency for
 * one use case. State-driven (not pure CSS group-hover) so it also opens
 * on tap/focus — hover has no equivalent on a touchscreen, so a
 * hover-only tooltip is simply unreachable on mobile.
 */
export function Tooltip({
  content,
  children,
}: {
  content: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((prev) => !prev)}
      className="relative inline-block outline-none"
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-black/10 bg-primary px-3 py-2.5 text-xs text-background shadow-lg transition-opacity duration-150 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        {content}
      </span>
    </span>
  );
}
