"use server";

import {
  evaluateTrade,
  type TradeProposal,
  type TradeEvaluation,
} from "@/lib/services/tradeCalculatorService";

export async function evaluateTradeAction(
  proposal: TradeProposal
): Promise<TradeEvaluation> {
  return evaluateTrade(proposal);
}
