"use client";

import type { ReactNode } from "react";

/**
 * Hover-triggered tooltip, CSS-only (group-hover), no positioning library.
 * Anchors above the trigger — fine for table cells; near a viewport edge
 * it can clip, an accepted limitation for now over pulling in a floating-
 * element dependency for one use case.
 */
export function Tooltip({
  content,
  children,
}: {
  content: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-block">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-black/10 bg-primary px-3 py-2.5 text-xs text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
