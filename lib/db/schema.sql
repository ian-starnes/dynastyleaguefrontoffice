-- DLFO permanent league data architecture.
-- Run once via `npm run db:migrate` (scripts/migrate.mjs) against a real
-- Postgres database. Deliberately NOT persisting raw NFL player reference
-- data (name/position/team) here — lib/sleeper/players.ts is already the
-- fresh, zero-maintenance source of truth for that.

-- One row per season-league Sleeper actually created (the
-- previous_league_id chain).
create table if not exists leagues (
  league_id           text primary key,
  season              int not null,
  name                text not null,
  previous_league_id  text references leagues(league_id),
  settings            jsonb not null,
  imported_at         timestamptz not null default now()
);

-- A Sleeper user, independent of any one season.
create table if not exists owners (
  owner_id      text primary key,
  display_name  text not null,
  team_name     text
);

-- One team, in one league-season. roster_id is only unique within a league.
create table if not exists teams (
  league_id   text not null references leagues(league_id),
  roster_id   int not null,
  owner_id    text references owners(owner_id),
  primary key (league_id, roster_id)
);

-- The current, mutable STORED FACTS about one player as a DLFO asset, in
-- one league. keeper_cost/market_value/keeper_surplus/asset_value are NOT
-- columns here — they're always derived at read time by
-- lib/services/assetCalculator.ts from fantasyCalc (live) + these facts
-- (originalAuctionPrice + keeperYearsRemaining), so they can never drift
-- out of sync with a stale stored copy.
create table if not exists assets (
  league_id               text not null references leagues(league_id),
  player_id               text not null,
  current_owner_id        text references owners(owner_id),
  original_auction_price  int not null,
  keeper_years_remaining  int not null,
  draft_year              int not null,
  -- The season this player's contract lineage actually began (may predate
  -- draft_year — a player kept since 2023 has draft_year reflecting only
  -- the most recent recorded price, not when the lineage started).
  contract_start_season   int,
  acquisition_type        text,
  acquisition_date        timestamptz,
  original_draft_owner    text references owners(owner_id),
  updated_at              timestamptz not null default now(),
  primary key (league_id, player_id)
);

-- The immutable ledger. Every event, ever. sleeper_transaction_id is
-- unique per league so re-running the importer is a safe no-op on repeats.
create table if not exists transactions (
  id                     bigserial primary key,
  league_id              text not null references leagues(league_id),
  sleeper_transaction_id text not null,
  type                   text not null,
  created_at             timestamptz not null,
  raw_payload            jsonb not null,
  unique (league_id, sleeper_transaction_id)
);

-- One row per drafted/kept player per season — the real (not placeholder)
-- source of originalAuctionPrice/draftYear/keeperCost once populated.
create table if not exists auction_records (
  id           bigserial primary key,
  league_id    text not null references leagues(league_id),
  season       int not null,
  player_id    text not null,
  owner_id     text references owners(owner_id),
  winning_bid  int not null,
  is_keeper    boolean not null,
  keeper_year  int,
  unique (league_id, season, player_id)
);

-- Trades. Players/picks involved kept as jsonb rather than a web of join
-- tables — a trade is read as one whole event, not queried player-by-player.
create table if not exists trades (
  id                     bigserial primary key,
  league_id              text not null references leagues(league_id),
  sleeper_transaction_id text not null,
  occurred_at            timestamptz not null,
  teams_involved         jsonb not null,
  players_involved       jsonb not null,
  picks_involved         jsonb not null,
  unique (league_id, sleeper_transaction_id)
);

-- One roster's side of one week's matchup. Raw source for weekly scoring
-- history — Ring of Honor, head-to-head, PPG, league records all read
-- from here rather than recomputing from Sleeper on every request.
create table if not exists weekly_performances (
  id                  bigserial primary key,
  league_id           text not null references leagues(league_id),
  season              int not null,
  week                int not null,
  roster_id           int not null,
  matchup_id          int,
  opponent_roster_id  int,
  team_score          numeric not null,
  opponent_score      numeric,
  result              text, -- 'win' | 'loss' | 'tie' | null
  starters            jsonb not null,
  bench               jsonb not null,
  points_by_player    jsonb not null,
  unique (league_id, season, week, roster_id)
);

-- Sleeper's own pre-draft keeper declaration (roster.keepers), where
-- present — confirmed inconsistent across this league's history (see
-- lib/models/KeeperDeclaration.ts), stored as a secondary signal, not
-- the primary source of "was this player kept" (that's auction_records).
create table if not exists keeper_declarations (
  id         bigserial primary key,
  league_id  text not null references leagues(league_id),
  season     int not null,
  roster_id  int not null,
  player_id  text not null,
  unique (league_id, season, roster_id, player_id)
);

-- Final standing for one roster in one season, reconstructed from
-- Sleeper's winners_bracket/losers_bracket. Powers Wall of Champions;
-- does NOT cover "10th place at start of playoffs" (see the model's
-- doc comment — that's a regular-season standing, not a final placement).
create table if not exists playoff_results (
  id         bigserial primary key,
  league_id  text not null references leagues(league_id),
  season     int not null,
  roster_id  int not null,
  place      int not null,
  unique (league_id, season, roster_id)
);

create index if not exists idx_transactions_league on transactions (league_id);
create index if not exists idx_auction_records_player on auction_records (league_id, player_id);
create index if not exists idx_trades_league on trades (league_id);
create index if not exists idx_weekly_performances_league_season on weekly_performances (league_id, season);
create index if not exists idx_weekly_performances_roster on weekly_performances (league_id, roster_id);
create index if not exists idx_keeper_declarations_league_season on keeper_declarations (league_id, season);
create index if not exists idx_playoff_results_league_season on playoff_results (league_id, season);
