"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDollarValue } from "@/lib/format";
import { evaluateTradeAction } from "@/app/trades/actions";
import type { TradeAsset, TradeEvaluation } from "@/lib/services/tradeCalculatorService";

export type OwnerOption = { ownerId: string; ownerName: string };
export type RosterPlayerOption = {
  playerId: string;
  fullName: string;
  position: string;
  nflTeam: string;
  marketValue: number | null;
};
export type PickOption = { season: number; round: number };

function assetKey(asset: TradeAsset): string {
  return asset.kind === "player" ? `player:${asset.playerId}` : `pick:${asset.season}:${asset.round}`;
}

function formatChange(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatDollarValue(value)}`;
}

function changeClassName(value: number): string {
  return value >= 0 ? "text-primary" : "text-red-700";
}

function TeamAssetPicker({
  label,
  owners,
  selectedOwnerId,
  onOwnerChange,
  roster,
  picks,
  selected,
  onToggle,
}: {
  label: string;
  owners: OwnerOption[];
  selectedOwnerId: string;
  onOwnerChange: (ownerId: string) => void;
  roster: RosterPlayerOption[];
  picks: PickOption[];
  selected: Set<string>;
  onToggle: (asset: TradeAsset) => void;
}) {
  return (
    <Card className="p-5">
      <label className="text-xs font-medium uppercase tracking-wide text-ink/50">
        {label}
      </label>
      <select
        value={selectedOwnerId}
        onChange={(event) => onOwnerChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-ink focus:border-primary/30 focus:outline-none"
      >
        {owners.map((owner) => (
          <option key={owner.ownerId} value={owner.ownerId}>
            {owner.ownerName}
          </option>
        ))}
      </select>

      <div className="mt-4 max-h-64 space-y-1 overflow-auto">
        {roster.map((player) => {
          const asset: TradeAsset = { kind: "player", playerId: player.playerId };
          const key = assetKey(asset);
          return (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.03]"
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(key)}
                  onChange={() => onToggle(asset)}
                />
                {player.fullName}
                <span className="text-xs text-ink/40">
                  {player.position} · {player.nflTeam}
                </span>
              </span>
              <span className="text-xs text-ink/50">
                {player.marketValue !== null ? formatDollarValue(player.marketValue) : "—"}
              </span>
            </label>
          );
        })}

        {picks.map((pick) => {
          const asset: TradeAsset = { kind: "pick", season: pick.season, round: pick.round };
          const key = assetKey(asset);
          return (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.03]"
            >
              <input
                type="checkbox"
                checked={selected.has(key)}
                onChange={() => onToggle(asset)}
              />
              {pick.season} Round {pick.round} Pick
            </label>
          );
        })}
      </div>
    </Card>
  );
}

function AssetImpactLine({
  asset,
  direction,
}: {
  asset: TradeEvaluation["sideA"]["assetsGivenUp"][number];
  direction: "given" | "received";
}) {
  const yearsNote =
    direction === "given"
      ? asset.currentOwnerYearsRemaining !== null
        ? ` (${asset.currentOwnerYearsRemaining}y left)`
        : ""
      : asset.acquiringOwnerYearsRemaining !== null
        ? ` (resets to ${asset.acquiringOwnerYearsRemaining}y)`
        : "";

  const surplus =
    direction === "given" ? asset.currentOwnerProjectedSurplus : asset.acquiringOwnerProjectedSurplus;

  return (
    <div className="mt-1 flex justify-between text-sm">
      <span>
        {asset.label}
        {yearsNote}
      </span>
      {asset.currentMarketValue === null ? (
        <span className="text-ink/30">no market value yet</span>
      ) : (
        <span className={direction === "given" ? "text-ink/60" : "text-primary"}>
          {direction === "received" && surplus >= 0 ? "+" : ""}
          {formatDollarValue(surplus)} {direction === "given" ? "forfeited" : "gained"}
        </span>
      )}
    </div>
  );
}

function FranchiseImpactRow({
  label,
  before,
  after,
  change,
  emphasize,
}: {
  label: string;
  before: number;
  after: number;
  change: number;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={emphasize ? "font-medium text-ink" : "text-ink/60"}>{label}</span>
      <span className="flex items-center gap-2">
        <span className={emphasize ? "text-ink" : "text-ink/50"}>
          {formatDollarValue(before)} → {formatDollarValue(after)}
        </span>
        <span className={`font-medium ${changeClassName(change)}`}>{formatChange(change)}</span>
      </span>
    </div>
  );
}

function TradeResultCard({
  title,
  evaluation,
  currentSeason,
}: {
  title: string;
  evaluation: TradeEvaluation["sideA"];
  currentSeason: number;
}) {
  const { franchiseImpact } = evaluation;

  return (
    <Card className="p-5">
      <h3 className="font-serif text-lg text-primary">{title}</h3>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Gives Up</p>
        {evaluation.assetsGivenUp.length === 0 ? (
          <p className="mt-1 text-sm text-ink/40">Nothing</p>
        ) : (
          evaluation.assetsGivenUp.map((a) => (
            <AssetImpactLine key={a.label} asset={a} direction="given" />
          ))
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Receives</p>
        {evaluation.assetsReceived.length === 0 ? (
          <p className="mt-1 text-sm text-ink/40">Nothing</p>
        ) : (
          evaluation.assetsReceived.map((a) => (
            <AssetImpactLine key={a.label} asset={a} direction="received" />
          ))
        )}
      </div>

      <div className="mt-4 border-t border-black/10 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
          {currentSeason} Market Value &amp; Franchise Value Impact
        </p>
        <div className="mt-2 space-y-1.5">
          <FranchiseImpactRow
            label={`${currentSeason} Roster Market Value`}
            before={franchiseImpact.before.rosterMarketValue}
            after={franchiseImpact.after.rosterMarketValue}
            change={franchiseImpact.change.rosterMarketValue}
          />
          <FranchiseImpactRow
            label="Future Pick Value"
            before={franchiseImpact.before.futurePickValue}
            after={franchiseImpact.after.futurePickValue}
            change={franchiseImpact.change.futurePickValue}
          />
          <FranchiseImpactRow
            label="Total Franchise Value"
            before={franchiseImpact.before.franchiseValue}
            after={franchiseImpact.after.franchiseValue}
            change={franchiseImpact.change.franchiseValue}
            emphasize
          />
        </div>
      </div>

      <div className="mt-4 border-t border-black/10 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
          Net Multi-Year Keeper Value
        </p>
        <p className={`mt-1 font-serif text-2xl ${changeClassName(evaluation.netChange)}`}>
          {formatChange(evaluation.netChange)}
        </p>
        <p className="mt-1 text-xs text-ink/40">
          Projected cumulative keeper surplus over the years remaining on each asset — a
          longer-horizon view, distinct from the immediate impact above.
        </p>
      </div>
    </Card>
  );
}

/**
 * DLFO's Trade Analyzer — pressure-tests a proposed (not executed) trade
 * two ways: the immediate real impact to each side's actual Market Value
 * and Franchise Value (franchiseImpact, using the exact same methodology
 * as the League/Front Office pages), and the longer-horizon multi-year
 * keeper-surplus projection via lib/services/tradeCalculatorService.ts
 * (where the real "receiving-team contract reset" value shows up — a
 * same-day Asset Value comparison would always show zero difference,
 * per that service's own doc comment).
 */
export function TradeAnalyzer({
  owners,
  rostersByOwnerId,
  picksByOwnerId,
}: {
  owners: OwnerOption[];
  rostersByOwnerId: Record<string, RosterPlayerOption[]>;
  picksByOwnerId: Record<string, PickOption[]>;
}) {
  const [ownerAId, setOwnerAId] = useState(owners[0]?.ownerId ?? "");
  const [ownerBId, setOwnerBId] = useState(owners[1]?.ownerId ?? "");
  const [selectedA, setSelectedA] = useState<Map<string, TradeAsset>>(new Map());
  const [selectedB, setSelectedB] = useState<Map<string, TradeAsset>>(new Map());
  const [evaluation, setEvaluation] = useState<TradeEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const rosterA = useMemo(() => rostersByOwnerId[ownerAId] ?? [], [rostersByOwnerId, ownerAId]);
  const rosterB = useMemo(() => rostersByOwnerId[ownerBId] ?? [], [rostersByOwnerId, ownerBId]);
  const picksA = useMemo(() => picksByOwnerId[ownerAId] ?? [], [picksByOwnerId, ownerAId]);
  const picksB = useMemo(() => picksByOwnerId[ownerBId] ?? [], [picksByOwnerId, ownerBId]);

  function toggle(side: "A" | "B", asset: TradeAsset) {
    const setSelected = side === "A" ? setSelectedA : setSelectedB;
    setSelected((prev) => {
      const next = new Map(prev);
      const key = assetKey(asset);
      if (next.has(key)) next.delete(key);
      else next.set(key, asset);
      return next;
    });
    setEvaluation(null);
  }

  async function handleEvaluate() {
    if (!ownerAId || !ownerBId || ownerAId === ownerBId) return;
    setIsEvaluating(true);
    try {
      const result = await evaluateTradeAction({
        sideA: { ownerId: ownerAId, gives: [...selectedA.values()] },
        sideB: { ownerId: ownerBId, gives: [...selectedB.values()] },
      });
      setEvaluation(result);
    } finally {
      setIsEvaluating(false);
    }
  }

  const canEvaluate =
    ownerAId &&
    ownerBId &&
    ownerAId !== ownerBId &&
    (selectedA.size > 0 || selectedB.size > 0);

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        <TeamAssetPicker
          label="Team A"
          owners={owners}
          selectedOwnerId={ownerAId}
          onOwnerChange={(id) => {
            setOwnerAId(id);
            setSelectedA(new Map());
            setEvaluation(null);
          }}
          roster={rosterA}
          picks={picksA}
          selected={new Set(selectedA.keys())}
          onToggle={(asset) => toggle("A", asset)}
        />
        <TeamAssetPicker
          label="Team B"
          owners={owners}
          selectedOwnerId={ownerBId}
          onOwnerChange={(id) => {
            setOwnerBId(id);
            setSelectedB(new Map());
            setEvaluation(null);
          }}
          roster={rosterB}
          picks={picksB}
          selected={new Set(selectedB.keys())}
          onToggle={(asset) => toggle("B", asset)}
        />
      </div>

      <div className="mt-6 flex justify-center">
        <Button onClick={handleEvaluate} disabled={!canEvaluate || isEvaluating}>
          {isEvaluating ? "Analyzing…" : "Analyze Trade"}
        </Button>
      </div>

      {evaluation ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <TradeResultCard
            title={evaluation.sideA.ownerName ?? "Team A"}
            evaluation={evaluation.sideA}
            currentSeason={evaluation.currentSeason}
          />
          <TradeResultCard
            title={evaluation.sideB.ownerName ?? "Team B"}
            evaluation={evaluation.sideB}
            currentSeason={evaluation.currentSeason}
          />
        </div>
      ) : null}
    </div>
  );
}
