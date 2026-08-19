import type { SwapTrade } from "../models/SwapTrade.js";
import { fromSupabaseRow, toSupabaseRow } from "../models/SwapTrade.js";
import { toSwapEvent, type SwapEvent } from "../models/TradeEvent.js";
import { publishSwapEvent } from "../helpers/kafkaProducer.js";
import { countSwaps, getSwaps, upsertSwaps } from "../helpers/supabaseClient.js";
import { broadcastTradeEvent } from "../helpers/tradeBroadcaster.js";
import { logger } from "../helpers/logger.js";

const SWAP_BATCH_SIZE = 10;

let pendingSwaps: SwapTrade[] = [];

export async function processSwap(trade: SwapTrade): Promise<void> {
  try {
    const event = toSwapEvent(trade);

    await publishSwapEvent(`${trade.txHash}-${trade.logIndex}`, event);
    broadcastTradeEvent(event);

    pendingSwaps.push(trade);

    if (pendingSwaps.length >= SWAP_BATCH_SIZE) {
      await flushPendingSwaps();
    }
  } catch (error) {
    logger.error("Failed to process swap", {
      txHash: trade.txHash,
      logIndex: trade.logIndex,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function flushPendingSwaps(): Promise<void> {
  if (pendingSwaps.length === 0) {
    return;
  }

  const batch = pendingSwaps;
  pendingSwaps = [];

  try {
    await upsertSwaps(batch.map(toSupabaseRow));
    logger.info("Wrote swap batch to Supabase", { count: batch.length });
  } catch (error) {
    pendingSwaps = batch.concat(pendingSwaps);
    throw error;
  }
}

export async function getTradesPage(
  limit: number,
  offset: number
): Promise<{
  trades: SwapEvent[];
  total: number;
  limit: number;
  offset: number;
}> {
  const [rows, total] = await Promise.all([
    getSwaps(limit, offset),
    countSwaps(),
  ]);

  return {
    trades: rows.map(fromSupabaseRow).map(toSwapEvent),
    total,
    limit,
    offset,
  };
}
