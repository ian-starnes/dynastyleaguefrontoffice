/**
 * Sleeper's user avatar field comes in two real shapes, confirmed live:
 * a full URL under sleepercdn.com/uploads/... for a user-uploaded custom
 * photo, OR a bare hash (e.g. "5cfb438cbccd1e7c446583635977147c") for one
 * of Sleeper's own stock avatars, which only resolves to a real image
 * once prefixed with sleepercdn.com/avatars/ (confirmed via a direct
 * HTTP 200/image response check — a bare hash is NOT a usable <img src>
 * on its own). Every caller that renders a manager's avatar needs to go
 * through this, not read metadata.avatar directly, or a stock-avatar
 * manager silently gets a broken image.
 */
export function resolveSleeperAvatarUrl(
  avatar: string | null | undefined
): string | null {
  if (!avatar) return null;
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
    return avatar;
  }
  return `https://sleepercdn.com/avatars/${avatar}`;
}
