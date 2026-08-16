import { sleeperFetch } from "./client";
import { getSleeperLeagueId } from "./config";
import type { SleeperBracketMatch } from "./types";

export async function getWinnersBracketForLeague(
  leagueId: string
): Promise<SleeperBracketMatch[]> {
  return sleeperFetch<SleeperBracketMatch[]>(
    `/league/${leagueId}/winners_bracket`,
    { next: { revalidate: 3600 } }
  );
}

export async function getWinnersBracket(): Promise<SleeperBracketMatch[]> {
  return getWinnersBracketForLeague(getSleeperLeagueId());
}

/** The consolation bracket — needed for Wall of Shame placements below the playoff cutoff. */
export async function getLosersBracketForLeague(
  leagueId: string
): Promise<SleeperBracketMatch[]> {
  return sleeperFetch<SleeperBracketMatch[]>(
    `/league/${leagueId}/losers_bracket`,
    { next: { revalidate: 3600 } }
  );
}

export async function getLosersBracket(): Promise<SleeperBracketMatch[]> {
  return getLosersBracketForLeague(getSleeperLeagueId());
}
