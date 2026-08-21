import {
  fromSupabaseRow,
  toSupabaseRow,
  type SwapTrade,
} from "../models/SwapTrade.js";
import {
  toSwapEvent,
  type SwapAcceleratedEvent,
  type SwapEvent,
} from "../models/TradeEvent.js";
import {
  publishAcceleratedSwapEvents,
  publishSwapEvent,
} from "../helpers/kafkaProducer.js";
import { countSwaps, getSwaps, upsertSwaps } from "../helpers/supabaseClient.js";
import { broadcastTradeEvent } from "../helpers/tradeBroadcaster.js";
import {
  getAcceleratedSwapsFromKafka,
  getSwapsFromKafka,
  rememberAcceleratedSwapEvent,
  rememberSwapEvent,
} from "../helpers/swapEventStore.js";
import { errorMessage, logger } from "../helpers/logger.js";

const SWAP_BATCH_SIZE = 10;

let pendingSwaps: SwapTrade[] = [];

export async function processSwap(trade: SwapTrade): Promise<void> {
  const event = toSwapEvent(trade);

  try {
    await publishSwapEvent(`${trade.txHash}-${trade.logIndex}`, event);
    rememberSwapEvent(event);
    broadcastTradeEvent(event);

    await publishAcceleratedSwapEvents(event, (copy) => {
      rememberAcceleratedSwapEvent(copy);
      broadcastTradeEvent(copy);
    });
  } catch (error) {
    logger.error("kafka publish failed", {
      txHash: trade.txHash,
      error: errorMessage(error),
    });
  }

  try {
    pendingSwaps.push(trade);
    if (pendingSwaps.length >= SWAP_BATCH_SIZE) {
      await flushSwapBatch();
    }
  } catch (error) {
    pendingSwaps = [];
    logger.warn("supabase write failed", { error: errorMessage(error) });
  }
}

export async function flushPendingSwaps(): Promise<void> {
  try {
    await flushSwapBatch();
  } catch (error) {
    pendingSwaps = [];
    logger.warn("supabase flush failed", { error: errorMessage(error) });
  }
}

async function flushSwapBatch(): Promise<void> {
  if (pendingSwaps.length === 0) {
    return;
  }

  const batch = pendingSwaps;
  pendingSwaps = [];

  try {
    await upsertSwaps(batch.map(toSupabaseRow));
    logger.info("wrote swaps", { count: batch.length });
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
  source: "supabase" | "kafka";
}> {
  try {
    const [rows, total] = await Promise.all([getSwaps(limit, offset), countSwaps()]);
    return {
      trades: rows.map(fromSupabaseRow).map(toSwapEvent),
      total,
      limit,
      offset,
      source: "supabase",
    };
  } catch (error) {
    logger.warn("supabase read failed, using kafka", { error: errorMessage(error) });
    const page = await getSwapsFromKafka(limit, offset);
    return { ...page, limit, offset };
  }
}

export async function getAcceleratedTradesPage(
  limit: number,
  offset: number
): Promise<{
  trades: SwapAcceleratedEvent[];
  total: number;
  limit: number;
  offset: number;
  source: "kafka";
}> {
  const page = await getAcceleratedSwapsFromKafka(limit, offset);
  return { ...page, limit, offset };
}
