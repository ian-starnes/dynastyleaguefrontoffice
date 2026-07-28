import { SLEEPER_API_BASE_URL } from "./config";

/**
 * The only place in this codebase allowed to call the Sleeper API directly.
 * Every other lib/sleeper function — and every UI component — goes through
 * this wrapper (or the domain functions built on top of it).
 */
export async function sleeperFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${SLEEPER_API_BASE_URL}${path}`, init);

  if (!response.ok) {
    throw new Error(
      `Sleeper API request to ${path} failed with status ${response.status}`
    );
  }

  return response.json() as Promise<T>;
}
