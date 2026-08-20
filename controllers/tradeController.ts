import type { SwapTrade, SupabaseAcceleratedSwapRow } from "../models/SwapTrade.js";
import { fromSupabaseRow, toAcceleratedSupabaseRows, toSupabaseRow } from "../models/SwapTrade.js";
import {
  fromAcceleratedSupabaseRow,
  toSwapEvent,
  type SwapAcceleratedEvent,
  type SwapEvent,
} from "../models/TradeEvent.js";
import {
  publishAcceleratedSwapEvents,
  publishSwapEvent,
} from "../helpers/kafkaProducer.js";
import {
  countAcceleratedSwaps,
  countSwaps,
  getAcceleratedSwaps,
  getSwaps,
  upsertAcceleratedSwaps,
  upsertSwaps,
} from "../helpers/supabaseClient.js";
import { broadcastTradeEvent } from "../helpers/tradeBroadcaster.js";
import { logger } from "../helpers/logger.js";

const SWAP_BATCH_SIZE = 10;

let pendingSwaps: SwapTrade[] = [];
let pendingAcceleratedSwaps: SupabaseAcceleratedSwapRow[] = [];

export async function processSwap(trade: SwapTrade): Promise<void> {
  try {
    const event = toSwapEvent(trade);

    await publishSwapEvent(`${trade.txHash}-${trade.logIndex}`, event);
    broadcastTradeEvent(event);
    await publishAcceleratedSwapEvents(event, broadcastTradeEvent);

    pendingSwaps.push(trade);
    pendingAcceleratedSwaps.push(...toAcceleratedSupabaseRows(trade));

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

export async function flushPendingSwaps(options?: {
  reason?: "shutdown";
}): Promise<void> {
  if (options?.reason === "shutdown") {
    logger.info("Flushing leftover swap batches to Supabase", {
      swaps: pendingSwaps.length,
      accelerated: pendingAcceleratedSwaps.length,
    });
  }

  await flushSwapBatch();
  await flushAcceleratedBatch();
}

async function flushSwapBatch(): Promise<void> {
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

async function flushAcceleratedBatch(): Promise<void> {
  if (pendingAcceleratedSwaps.length === 0) {
    return;
  }

  const batch = pendingAcceleratedSwaps;
  pendingAcceleratedSwaps = [];

  try {
    await upsertAcceleratedSwaps(batch);
    logger.info("Wrote accelerated swap batch to Supabase", { count: batch.length });
  } catch (error) {
    pendingAcceleratedSwaps = batch.concat(pendingAcceleratedSwaps);
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

export async function getAcceleratedTradesPage(
  limit: number,
  offset: number
): Promise<{
  trades: SwapAcceleratedEvent[];
  total: number;
  limit: number;
  offset: number;
}> {
  const [rows, total] = await Promise.all([
    getAcceleratedSwaps(limit, offset),
    countAcceleratedSwaps(),
  ]);

  return {
    trades: rows.map(fromAcceleratedSupabaseRow),
    total,
    limit,
    offset,
  };
}
