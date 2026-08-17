import type { SwapTrade } from "../models/SwapTrade.js";
import {
  fromSupabaseRow,
  toSupabaseRow,
} from "../models/SwapTrade.js";
import {
  toExecuteEvent,
  toSwapEvent,
  serializeSwapForApi,
  type ExecuteEvent,
} from "../models/TradeEvent.js";
import { publishTradeEvent } from "../helpers/kafkaProducer.js";
import { countSwaps, getSwaps, upsertSwap } from "../helpers/supabaseClient.js";
import { broadcastTradeEvent } from "../helpers/tradeBroadcaster.js";
import { logger } from "../helpers/logger.js";

export async function processExecute(event: ExecuteEvent): Promise<void> {
  try {
    await publishTradeEvent(event.txHash, event);
    broadcastTradeEvent(event);

    logger.info("Execute event published", {
      txHash: event.txHash,
      blockNumber: event.blockNumber,
    });
  } catch (error) {
    logger.error("Failed to process execute event", {
      txHash: event.txHash,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function processSwap(trade: SwapTrade): Promise<void> {
  try {
    await upsertSwap(toSupabaseRow(trade));

    const event = toSwapEvent(trade);
    await publishTradeEvent(`${trade.txHash}-${trade.logIndex}`, event);
    broadcastTradeEvent(event);

    logger.info("Swap event published", {
      txHash: trade.txHash,
      logIndex: trade.logIndex,
      poolId: trade.poolId,
    });
  } catch (error) {
    logger.error("Failed to process swap", {
      txHash: trade.txHash,
      logIndex: trade.logIndex,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getTradesPage(
  limit: number,
  offset: number
): Promise<{
  trades: ReturnType<typeof serializeSwapForApi>[];
  total: number;
  limit: number;
  offset: number;
}> {
  const [rows, total] = await Promise.all([
    getSwaps(limit, offset),
    countSwaps(),
  ]);

  return {
    trades: rows.map(fromSupabaseRow).map(serializeSwapForApi),
    total,
    limit,
    offset,
  };
}

export { toExecuteEvent };
