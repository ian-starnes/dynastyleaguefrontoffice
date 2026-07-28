// Raw Sleeper API response shapes — only the fields DLFO actually reads.
// See https://docs.sleeper.com for the full schemas.

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  sport: string;
  status: string;
  total_rosters: number;
};

export type SleeperUser = {
  user_id: string;
  display_name: string;
  metadata?: {
    team_name?: string;
  };
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
};

export type SleeperRawPlayer = {
  player_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  team: string | null;
};

// Sleeper's /players/nfl endpoint returns a map keyed by player_id rather
// than an array.
export type SleeperPlayersMap = Record<string, SleeperRawPlayer>;

/**
 * Immutable NFL reference data, independent of any league. Who owns this
 * player in a fantasy league never changes what it is.
 */
export type NFLPlayer = {
  id: string;
  fullName: string;
  position: string;
  nflTeam: string;
};

/**
 * An NFL player in the context of one specific league. Wraps the immutable
 * NFLPlayer with league-specific state. Only `currentOwnerName` exists
 * today — acquisition cost, keeper cost, contract years remaining,
 * franchise value contribution, keeper surplus, and trade value will all
 * attach here as those features get built.
 */
export type LeaguePlayer = {
  nflPlayer: NFLPlayer;
  currentOwnerName: string | null;
};
