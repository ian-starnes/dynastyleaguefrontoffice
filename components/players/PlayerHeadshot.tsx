"use client";

import { useState } from "react";

const SLEEPER_HEADSHOT_BASE_URL = "https://sleepercdn.com/content/nfl/players";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * A plain <img> rather than next/image on purpose: this renders inside a
 * table with hundreds of rows, and next/image's per-instance optimization
 * pipeline is unnecessary overhead at that scale — native lazy loading is
 * enough here. Falls back to an initials badge if the headshot 404s/403s
 * (team defenses, obscure players Sleeper has no photo for).
 */
export function PlayerHeadshot({
  playerId,
  name,
}: {
  playerId: string;
  name: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) {
    return (
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
      >
        {getInitials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${SLEEPER_HEADSHOT_BASE_URL}/${playerId}.jpg`}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      onError={() => setImageFailed(true)}
      className="h-8 w-8 shrink-0 rounded-full bg-black/5 object-cover"
    />
  );
}
