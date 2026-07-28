"use client";

import { useState } from "react";

const SLEEPER_HEADSHOT_BASE_URL = "https://sleepercdn.com/content/nfl/players";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

type PlayerHeadshotProps = {
  playerId: string;
  name: string;
  /** Pixel size (square) — 32 for table rows, larger for the profile header. */
  size?: number;
};

/**
 * A plain <img> rather than next/image on purpose: this renders inside a
 * table with hundreds of rows, and next/image's per-instance optimization
 * pipeline is unnecessary overhead at that scale — native lazy loading is
 * enough here. Falls back to an initials badge if the headshot 404s/403s
 * (team defenses, obscure players Sleeper has no photo for).
 *
 * Size is set via inline style rather than a Tailwind class because the
 * class name would need to be built from the `size` prop at runtime —
 * Tailwind only generates CSS for class strings it can see statically in
 * source, so a template-literal class like `h-[${size}px]` would silently
 * produce no styles at all.
 */
export function PlayerHeadshot({
  playerId,
  name,
  size = 32,
}: PlayerHeadshotProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimensions = { width: size, height: size };

  if (imageFailed) {
    return (
      <span
        aria-hidden
        style={{ ...dimensions, fontSize: Math.round(size / 2.8) }}
        className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
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
      width={size}
      height={size}
      loading="lazy"
      onError={() => setImageFailed(true)}
      style={dimensions}
      className="shrink-0 rounded-full bg-black/5 object-cover"
    />
  );
}
