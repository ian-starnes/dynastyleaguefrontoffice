"use client";

import { useState } from "react";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

type ManagerAvatarProps = {
  avatarUrl: string | null;
  name: string;
  /** Pixel size (square). */
  size?: number;
  /** Desaturated/dimmed treatment for the graveyard section — a departed manager, not an active one. */
  muted?: boolean;
};

/**
 * Same fallback pattern as PlayerHeadshot (initials badge when there's no
 * image, or the image 404s/403s) but for manager avatars — these come
 * from Sleeper's user API via resolveSleeperAvatarUrl, not the fixed NFL
 * player headshot CDN path, so this is a distinct, simpler component
 * rather than a shared one with an awkward "which URL scheme" branch.
 */
export function ManagerAvatar({
  avatarUrl,
  name,
  size = 48,
  muted = false,
}: ManagerAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimensions = { width: size, height: size };

  if (!avatarUrl || imageFailed) {
    return (
      <span
        aria-hidden
        style={{ ...dimensions, fontSize: Math.round(size / 2.5) }}
        className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${
          muted ? "bg-ink/10 text-ink/40" : "bg-primary/10 text-primary"
        }`}
      >
        {getInitials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setImageFailed(true)}
      style={dimensions}
      className={`shrink-0 rounded-full bg-black/5 object-cover ${
        muted ? "opacity-60 grayscale" : ""
      }`}
    />
  );
}
