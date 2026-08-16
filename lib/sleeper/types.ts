// Raw Sleeper API response shapes — only the fields DLFO actually reads.
// See https://docs.sleeper.com for the full schemas.

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  sport: string;
  status: string;
  total_rosters: number;
  previous_league_id: string | null;
  settings: Record<string, unknown>;
};

export type SleeperUser = {
  user_id: string;
  display_name: string;
  metadata?: {
    team_name?: string;
    /** User-uploaded profile image, when set — not guaranteed to be a real photo of the person. */
    avatar?: string;
  };
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  /**
   * Sleeper's own pre-draft keeper declaration — player_ids the owner
   * marked as keepers going into that season's draft. Confirmed present
   * for some seasons (2021-2024, 2026 in this league) but ALL-NULL for
   * others (2025, despite that season having a real auction) — inconsistent
   * across history, so treat as a secondary signal, never sole source of
   * truth for "was this player kept."
   */
  keepers: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal: number;
    fpts_against: number;
    fpts_against_decimal: number;
    /** Cumulative FAAB spent this season — a Sleeper rollup, no need to sum transactions. */
    waiver_budget_used: number;
  } | null;
  /**
   * Free-text per-player "nicknames" a commissioner can set on a roster.
   * This league appears to reuse it as a manual keeper-price tracker
   * (e.g. p_nick_{playerId}: "$23") for years where the auction draft's
   * own recorded price has since gone stale — human-entered, not a
   * structured Sleeper feature, so treat as corroborating at best.
   */
  metadata: Record<string, string> | null;
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

export type SleeperTransaction = {
  transaction_id: string;
  type: string; // "trade" | "free_agent" | "waiver" | "commissioner"
  status: string; // "complete" | "failed"
  created: number; // epoch ms
  roster_ids: number[];
  adds: Record<string, number> | null; // player_id -> roster_id
  drops: Record<string, number> | null; // player_id -> roster_id
  /** waiver_bid is the FAAB amount spent — only present on waiver-type transactions. */
  settings: { waiver_bid?: number } | null;
  /** Only meaningful on trade-type transactions — which draft picks moved. */
  draft_picks: Array<{
    season: string;
    round: number;
    roster_id: number;
    owner_id: number;
    previous_owner_id: number;
  }>;
};

/**
 * One roster's side of one week's matchup. Two rosters sharing the same
 * matchup_id (within the same week) played each other; players_points
 * covers every rostered player that week (bench included), starters is
 * the subset that was actually started. This is the raw source for
 * weekly scoring history, Ring of Honor (started points only), and
 * head-to-head reconstruction.
 */
export type SleeperMatchup = {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  starters: string[];
  starters_points: number[];
  players: string[];
  players_points: Record<string, number>;
};

/**
 * One match in the winners or losers playoff bracket. `w`/`l` are the
 * winning/losing roster_id once decided. `p`, when present, names which
 * final place this match decides (1 = championship deciding 1st/2nd, 3 =
 * third-place game, 5 = 5th place game, etc.) — this is how Wall of
 * Champions/Wall of Shame final placements get reconstructed.
 */
export type SleeperBracketMatch = {
  m: number;
  r: number;
  t1: number | null;
  t2: number | null;
  w: number | null;
  l: number | null;
  p?: number;
};

export type SleeperDraft = {
  draft_id: string;
  season: string;
  type: string; // "auction" | "snake" | "linear"
  status: string;
};

export type SleeperDraftPick = {
  round: number;
  pick_no: number;
  player_id: string;
  picked_by: string; // user_id; empty string if traded to a roster with no direct pick owner
  roster_id: number;
  is_keeper: boolean | null;
  metadata: {
    amount?: string; // winning bid, auction drafts only
  };
};

export type SleeperTradedPick = {
  season: string;
  round: number;
  roster_id: number; // current owner of the pick
  owner_id: number;
  previous_owner_id: number;
};

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
